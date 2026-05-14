/**
 * Vertex Build Runner — SDK automation for phased field tech UX build.
 *
 * Usage:
 *   npx ts-node build_runner.ts              # Run next pending slice
 *   npx ts-node build_runner.ts --all        # Run all pending slices sequentially
 *   npx ts-node build_runner.ts --dry-run    # Show what would run without executing
 *   npx ts-node build_runner.ts --status     # Show current slice status
 *   npx ts-node build_runner.ts --slice 41b  # Run a specific slice
 *
 * Requires: CURSOR_API_KEY environment variable
 */

import { Agent } from "@cursor/sdk";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { SLICES, type Slice } from "./slices";
import { selectModel, updateLookupRow, buildEscalationLadder } from "./model_selector";
import { validateSlice, type ValidationResult } from "./validator";
import { buildPrompt } from "./prompt_builder";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const STATE_FILE = path.join(__dirname, ".build_state.json");
const LOG_FILE = path.join(__dirname, "build_log.txt");

// ─── State Management ───

interface SliceState {
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  model?: string;
  attempts: number;
  lastAttempt?: string;
  previewUrl?: string;
  errors?: string[];
}

interface BuildState {
  slices: Record<string, SliceState>;
  lastRun: string;
}

function loadState(): BuildState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  }
  const state: BuildState = { slices: {}, lastRun: "" };
  for (const s of SLICES) {
    state.slices[s.id] = { status: "pending", attempts: 0 };
  }
  return state;
}

function saveState(state: BuildState): void {
  state.lastRun = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Logging ───

function log(msg: string): void {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n");
}

// ─── Dependency Resolution ───

function canRun(slice: Slice, state: BuildState): boolean {
  return slice.dependsOn.every((dep) => state.slices[dep]?.status === "passed");
}

function getNextSlice(state: BuildState): Slice | null {
  for (const slice of SLICES) {
    const ss = state.slices[slice.id];
    if (ss.status === "pending" && canRun(slice, state)) {
      return slice;
    }
  }
  return null;
}

// ─── Firebase Preview Deploy ───

function deployPreview(sliceId: string): string | null {
  try {
    log(`Deploying Firebase preview channel: slice-${sliceId}`);
    const output = execSync(
      `npx firebase hosting:channel:deploy slice-${sliceId} --expires 7d --json`,
      { cwd: PROJECT_ROOT, stdio: "pipe", timeout: 120000 }
    ).toString();
    const parsed = JSON.parse(output);
    const url =
      parsed?.result?.["vertex-core-db"]?.url ||
      parsed?.result?.url ||
      null;
    if (url) log(`Preview deployed: ${url}`);
    return url;
  } catch (e: any) {
    log(`Preview deploy failed (non-blocking): ${e.message?.slice(0, 200)}`);
    return null;
  }
}

// ─── Core Slice Runner ───

interface RunAttemptResult {
  passed: boolean;
  model: string;
  errors: string[];
}

async function runSliceAttempt(
  slice: Slice,
  model: string,
  attempt: number,
  maxAttempts: number
): Promise<RunAttemptResult> {
  log(`\n${"═".repeat(60)}`);
  log(`SLICE ${slice.id}: ${slice.title}`);
  log(`Model: ${model} | Attempt: ${attempt}/${maxAttempts} | Risk: ${slice.riskLevel}`);
  log(`Patterns: ${slice.patterns.join(", ")}`);
  log(`${"═".repeat(60)}`);

  const prompt = buildPrompt(slice, model);

  try {
    log(`Launching SDK agent with ${model}...`);
    const result = await Agent.prompt(prompt, {
      apiKey: process.env.CURSOR_API_KEY!,
      model: { id: model },
      local: { cwd: PROJECT_ROOT },
    });

    if (result.status === "error") {
      log(`Agent returned error status for slice ${slice.id}`);
      return { passed: false, model, errors: [`Agent error: ${result.result || "unknown"}`] };
    }

    log(`Agent completed. Running validation...`);
    const validation = validateSlice(slice);

    if (!validation.passed) {
      log(`Validation FAILED for slice ${slice.id}:`);
      for (const err of validation.errors) log(`  ✗ ${err}`);
      return { passed: false, model, errors: validation.errors };
    }

    if (validation.warnings.length > 0) {
      log(`Warnings for slice ${slice.id}:`);
      for (const w of validation.warnings) log(`  ⚠ ${w}`);
    }

    return { passed: true, model, errors: [] };
  } catch (e: any) {
    log(`SDK error for slice ${slice.id}: ${e.message?.slice(0, 500)}`);
    return { passed: false, model, errors: [e.message?.slice(0, 500) || "Unknown SDK error"] };
  }
}

/**
 * Run a slice with automatic escalation: try cheapest model first,
 * escalate to next tier on failure, up to 3 attempts.
 * Lookup table is updated ONLY after the final outcome.
 */
async function runSliceWithEscalation(slice: Slice, state: BuildState): Promise<boolean> {
  const ss = state.slices[slice.id];
  const ladder = buildEscalationLadder(slice.patterns);

  log(`\nEscalation ladder for ${slice.id}: ${ladder.join(" → ")}`);

  let lastResult: RunAttemptResult | null = null;

  for (let i = 0; i < ladder.length; i++) {
    const model = ladder[i];
    ss.status = "running";
    ss.attempts = i + 1;
    ss.model = model;
    ss.lastAttempt = new Date().toISOString();
    saveState(state);

    // If this is a retry, revert any partial changes from the failed attempt
    if (i > 0) {
      log(`Reverting partial changes before retry...`);
      try {
        execSync("git checkout -- .", { cwd: PROJECT_ROOT, stdio: "pipe" });
        execSync("git clean -fd", { cwd: PROJECT_ROOT, stdio: "pipe" });
      } catch {
        log(`Git revert warning (non-fatal)`);
      }
    }

    lastResult = await runSliceAttempt(slice, model, i + 1, ladder.length);

    if (lastResult.passed) {
      // Success — update lookup table: this model works for these patterns
      for (const pattern of slice.patterns) {
        updateLookupRow(pattern, model, true);
      }

      // Deploy preview
      const previewUrl = deployPreview(slice.id);
      ss.previewUrl = previewUrl || undefined;

      // Auto-push safe slices
      if (slice.riskLevel === "safe") {
        try {
          execSync("git push origin main", { cwd: PROJECT_ROOT, stdio: "pipe" });
          log(`Pushed to origin/main (safe slice).`);
        } catch (e: any) {
          log(`Push failed (non-blocking): ${e.message?.slice(0, 200)}`);
        }
      } else {
        log(`Committed but NOT pushed (review-required slice).`);
      }

      ss.status = "passed";
      saveState(state);
      log(`✓ Slice ${slice.id} PASSED on ${model}`);
      return true;
    }

    // Failed — log and escalate
    if (i < ladder.length - 1) {
      log(`✗ ${model} failed for slice ${slice.id}. Escalating to ${ladder[i + 1]}...`);
    } else {
      log(`✗ ${model} failed for slice ${slice.id}. No more models to try.`);
    }
  }

  // All attempts exhausted — update lookup table with failure on the primary pattern
  for (const pattern of slice.patterns) {
    updateLookupRow(pattern, ladder[ladder.length - 1], false);
  }

  ss.status = "failed";
  ss.errors = lastResult?.errors || ["All escalation attempts failed"];
  saveState(state);
  log(`✗✗ Slice ${slice.id} FAILED after ${ladder.length} attempts (${ladder.join(" → ")})`);
  return false;
}

// ─── Status Display ───

function printStatus(state: BuildState): void {
  console.log("\n  Vertex Build Runner — Slice Status\n");
  console.log(
    "  " +
      "Slice".padEnd(8) +
      "Title".padEnd(50) +
      "Status".padEnd(10) +
      "Model".padEnd(22) +
      "Preview"
  );
  console.log("  " + "─".repeat(110));

  for (const slice of SLICES) {
    const ss = state.slices[slice.id] || { status: "pending", attempts: 0 };
    const icon =
      ss.status === "passed"
        ? "✓"
        : ss.status === "failed"
        ? "✗"
        : ss.status === "running"
        ? "▶"
        : ss.status === "skipped"
        ? "⏭"
        : "○";
    const statusStr = `${icon} ${ss.status}`;
    const previewStr = ss.previewUrl || "";
    console.log(
      `  ${slice.id.padEnd(8)}${slice.title.slice(0, 48).padEnd(50)}${statusStr.padEnd(10)}${(ss.model || "—").padEnd(22)}${previewStr}`
    );
  }

  const passed = SLICES.filter((s) => state.slices[s.id]?.status === "passed").length;
  const failed = SLICES.filter((s) => state.slices[s.id]?.status === "failed").length;
  const pending = SLICES.length - passed - failed;
  console.log(`\n  Total: ${passed} passed, ${failed} failed, ${pending} pending\n`);
}

// ─── Main ───

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const state = loadState();

  if (args.includes("--status")) {
    printStatus(state);
    return;
  }

  const dryRun = args.includes("--dry-run");

  if (!process.env.CURSOR_API_KEY && !dryRun) {
    console.error(
      "\n  Error: CURSOR_API_KEY not set.\n" +
        "  Get your key at: https://cursor.com/dashboard/integrations\n" +
        "  Then: set CURSOR_API_KEY=your_key_here  (Windows)\n" +
        "    or: export CURSOR_API_KEY=your_key_here (Mac/Linux)\n"
    );
    process.exit(1);
  }

  const runAll = args.includes("--all");
  const specificSlice = args.find((a) => !a.startsWith("--"));

  if (dryRun) {
    console.log("\n  DRY RUN — showing what would execute:\n");
    let next = specificSlice
      ? SLICES.find((s) => s.id === specificSlice) || null
      : getNextSlice(state);
    let count = 0;
    while (next) {
      const ladder = buildEscalationLadder(next.patterns);
      console.log(
        `  ${++count}. Slice ${next.id}: ${next.title}\n` +
          `     Escalation: ${ladder.join(" → ")}\n` +
          `     Risk: ${next.riskLevel} | ` +
          `Files: ${[...next.filesToCreate, ...next.filesToModify].join(", ")}\n`
      );
      if (!runAll || specificSlice) break;
      state.slices[next.id] = { status: "passed", attempts: 1 };
      next = getNextSlice(state);
    }
    return;
  }

  log("Build runner started.");

  if (specificSlice) {
    const slice = SLICES.find((s) => s.id === specificSlice);
    if (!slice) {
      console.error(`Slice '${specificSlice}' not found.`);
      process.exit(1);
    }
    if (!canRun(slice, state)) {
      console.error(
        `Slice ${specificSlice} dependencies not met: ${slice.dependsOn.join(", ")}`
      );
      process.exit(1);
    }
    await runSliceWithEscalation(slice, state);
    printStatus(state);
    return;
  }

  // Run next (or all) pending slices
  let next = getNextSlice(state);
  while (next) {
    const success = await runSliceWithEscalation(next, state);

    if (!success) {
      log(`Slice ${next.id} failed after full escalation. Stopping.`);
      break;
    }

    if (!runAll) break;
    next = getNextSlice(state);
  }

  if (!next && !SLICES.some((s) => state.slices[s.id]?.status === "failed")) {
    log("All slices completed successfully!");
  }

  printStatus(state);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
