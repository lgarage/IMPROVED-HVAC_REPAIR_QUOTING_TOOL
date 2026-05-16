/**
 * Vertex Build Runner — Interactive CLI with slash commands.
 *
 * Start:  npx ts-node build_runner.ts
 * Then:   type / to see all commands
 *
 * Requires: CURSOR_API_KEY environment variable
 */

import { Agent } from "@cursor/sdk";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { execSync } from "child_process";
import { SLICES, type Slice } from "./slices";
import { ARCHIVED_SLICES } from "./slices_archive";
import { selectModel, updateLookupRow, buildEscalationLadder, MODEL_COST_RANK, getCostEstimates } from "./model_selector";
import { validateSlice } from "./validator";
import { buildPrompt } from "./prompt_builder";

const MAX_ACTIVE_SLICES = 20;

const PROJECT_ROOT = path.resolve(__dirname, "..");
const STATE_FILE = path.join(__dirname, ".build_state.json");
const LOG_FILE = path.join(__dirname, "build_log.txt");
const VERSION = "2.1.0";

function formatChicagoTimestamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} ${values.timeZoneName}`;
}

let stopAfterCurrent = false;
let currentSliceStart = 0;
let currentSliceId = "";
let recentSliceDurations: number[] = [];
let hotkeyHandler: ((key: Buffer) => void) | null = null;

function enableStopHotkey(): void {
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  hotkeyHandler = (key: Buffer) => {
    const ch = key.toString();
    if (ch === "s" || ch === "S") {
      if (!stopAfterCurrent) {
        stopAfterCurrent = true;
        const elapsed = currentSliceStart ? Math.round((Date.now() - currentSliceStart) / 1000) : 0;
        const avgDuration = recentSliceDurations.length > 0
          ? Math.round(recentSliceDurations.reduce((a, b) => a + b, 0) / recentSliceDurations.length / 1000)
          : 0;
        const remaining = avgDuration > elapsed ? avgDuration - elapsed : 0;
        console.log(`\n\n  ⏸  STOP received — will finish current slice then pause.`);
        if (currentSliceId) {
          console.log(`  Currently running: Slice ${currentSliceId} (${elapsed}s elapsed)`);
        }
        if (remaining > 0) {
          console.log(`  Estimated time to safe stop: ~${remaining}s (avg slice takes ~${avgDuration}s)`);
        } else if (avgDuration > 0) {
          console.log(`  Should finish soon (avg slice takes ~${avgDuration}s, already ${elapsed}s in)`);
        } else {
          console.log(`  First slice — no duration estimate yet. Hang tight.`);
        }
        console.log();
      }
    }
    if (ch === "\u0003") {
      console.log("\n  Force quit.\n");
      process.exit(1);
    }
  };
  process.stdin.on("data", hotkeyHandler);
}

function disableStopHotkey(): void {
  if (!process.stdin.isTTY) return;
  if (hotkeyHandler) {
    process.stdin.removeListener("data", hotkeyHandler);
    hotkeyHandler = null;
  }
  process.stdin.setRawMode(false);
}

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
  lastChecklist?: string[];
  checklistResults?: Record<number, "passed" | "failed">;
}

function loadState(): BuildState {
  let state: BuildState;
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } else {
    state = { slices: {}, lastRun: "" };
  }
  for (const s of SLICES) {
    if (!state.slices[s.id]) {
      state.slices[s.id] = { status: "pending", attempts: 0 };
    }
  }
  // Reset stale "running" slices from a previous crashed session
  for (const [id, ss] of Object.entries(state.slices)) {
    if (ss.status === "running") {
      ss.status = ss.attempts > 0 ? "failed" : "pending";
    }
  }
  // Strip archived slices — they're done and don't need to be tracked
  const archivedIds = new Set(ARCHIVED_SLICES.map((s) => s.id));
  let stripped = 0;
  for (const id of Object.keys(state.slices)) {
    if (archivedIds.has(id)) {
      delete state.slices[id];
      stripped++;
    }
  }
  if (stripped > 0) {
    saveState(state);
  }
  return state;
}

function saveState(state: BuildState): void {
  state.lastRun = formatChicagoTimestamp();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Logging ───

function log(msg: string): void {
  const ts = formatChicagoTimestamp();
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
    if ((ss.status === "pending" || ss.status === "failed") && canRun(slice, state)) {
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

  currentSliceStart = Date.now();
  currentSliceId = slice.id;

  const prompt = buildPrompt(slice, model);

  let ticker: ReturnType<typeof setInterval> | null = null;
  try {
    log(`Launching SDK agent with ${model}...`);
    console.log(`  ─── Press S to stop after this slice ───`);

    ticker = setInterval(() => {
      const elapsed = Math.round((Date.now() - currentSliceStart) / 1000);
      const avgDuration = recentSliceDurations.length > 0
        ? Math.round(recentSliceDurations.reduce((a, b) => a + b, 0) / recentSliceDurations.length / 1000)
        : 0;
      const remaining = avgDuration > elapsed ? avgDuration - elapsed : 0;
      let timeStr: string;
      if (avgDuration === 0) {
        timeStr = "estimating...";
      } else if (remaining > 0) {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timeStr = mins > 0 ? `~${mins}m ${secs}s remaining` : `~${secs}s remaining`;
      } else {
        timeStr = "finishing up...";
      }
      process.stdout.write(`\r  ⏳ Slice ${slice.id}: ${timeStr}  [S = pause after this slice]   `);
    }, 15000);

    const result = await Agent.prompt(prompt, {
      apiKey: process.env.CURSOR_API_KEY!,
      model: { id: model },
      local: { cwd: PROJECT_ROOT },
    });

    clearInterval(ticker);
    console.log();

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
    if (ticker) clearInterval(ticker);
    console.log();
    log(`SDK error for slice ${slice.id}: ${e.message?.slice(0, 500)}`);
    return { passed: false, model, errors: [e.message?.slice(0, 500) || "Unknown SDK error"] };
  }
}

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
    ss.lastAttempt = formatChicagoTimestamp();
    saveState(state);

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
      for (const pattern of slice.patterns) {
        updateLookupRow(pattern, model, true);
      }

      const previewUrl = deployPreview(slice.id);
      ss.previewUrl = previewUrl || undefined;

      if (slice.riskLevel === "safe") {
        try {
          execSync("git push origin main", { cwd: PROJECT_ROOT, stdio: "pipe" });
          log(`Pushed to origin/main (safe slice).`);
        } catch (e: any) {
          log(`Push failed (non-blocking): ${e.message?.slice(0, 200)}`);
        }
      } else {
        log(`Committed but NOT pushed (review-required slice).`);
        if (slice.reviewChecklist && slice.reviewChecklist.length > 0) {
          const previewLine = ss.previewUrl ? `  │  Preview: ${ss.previewUrl}` : "";
          console.log(`\n  ┌── Verify before pushing: ${slice.id} — ${slice.title}`);
          slice.reviewChecklist.forEach((item, i) => {
            console.log(`  │  ${i + 1}. ${item}`);
          });
          if (previewLine) console.log(previewLine);
          console.log(`  └── Run: vertex> /push ${slice.id}  (when satisfied)\n`);
        }
      }

      ss.status = "passed";
      saveState(state);
      const sliceDuration = Date.now() - currentSliceStart;
      recentSliceDurations.push(sliceDuration);
      if (recentSliceDurations.length > 5) recentSliceDurations.shift();
      log(`✓ Slice ${slice.id} PASSED on ${model} (${Math.round(sliceDuration / 1000)}s)`);
      currentSliceId = "";
      return true;
    }

    // Record this model's failure for every pattern on the slice
    for (const pattern of slice.patterns) {
      updateLookupRow(pattern, model, false);
    }

    if (i < ladder.length - 1) {
      log(`✗ ${model} failed for slice ${slice.id}. Escalating to ${ladder[i + 1]}...`);
    } else {
      log(`✗ ${model} failed for slice ${slice.id}. No more models to try.`);
    }
  }

  ss.status = "failed";
  ss.errors = lastResult?.errors || ["All escalation attempts failed"];
  saveState(state);
  const sliceDuration = Date.now() - currentSliceStart;
  recentSliceDurations.push(sliceDuration);
  if (recentSliceDurations.length > 5) recentSliceDurations.shift();
  log(`✗✗ Slice ${slice.id} FAILED after ${ladder.length} attempts (${ladder.join(" → ")}) (${Math.round(sliceDuration / 1000)}s)`);
  currentSliceId = "";
  return false;
}

// ─── Auto-Archive Routine ───

/**
 * Extracts the full object literal for a slice from slices.ts text.
 * Matches by id field; grabs from opening { to closing },
 */
function extractSliceObjectText(slicesTsText: string, sliceId: string): string | null {
  // Match the opening of a slice object by its id field
  const idPattern = new RegExp(
    `(\\{[^{}]*id:\\s*["']${sliceId}["'][\\s\\S]*?)(?=\\n  \\{\\n|\\n\\];)`,
    "m"
  );
  const match = idPattern.exec(slicesTsText);
  if (!match) return null;
  // Ensure we have a properly closed object by counting braces
  let text = match[1];
  let depth = 0;
  let end = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  return text.slice(0, end + 1).trim();
}

async function runArchiveRoutine(state: BuildState, force = false): Promise<number> {
  const slicesTsPath = path.join(__dirname, "slices.ts");
  const archiveTsPath = path.join(__dirname, "slices_archive.ts");

  if (!force && SLICES.length <= MAX_ACTIVE_SLICES) return 0;

  // Find all passed slices in build_state that are still in slices.ts
  const activeIds = new Set(SLICES.map((s) => s.id));
  const passedInActive = SLICES.filter((s) => state.slices[s.id]?.status === "passed");

  if (passedInActive.length === 0) return 0;

  const slicesTsText = fs.readFileSync(slicesTsPath, "utf-8");
  let archiveTsText = fs.readFileSync(archiveTsPath, "utf-8");

  const extractedObjects: string[] = [];
  let newSlicesTsText = slicesTsText;

  for (const slice of passedInActive) {
    const objText = extractSliceObjectText(slicesTsText, slice.id);
    if (!objText) {
      log(`  ⚠ Could not extract object for slice ${slice.id} — skipping`);
      continue;
    }
    extractedObjects.push(`  ${objText},`);
    // Remove the object (plus surrounding whitespace/comma) from slices.ts
    newSlicesTsText = newSlicesTsText.replace(objText + ",", "").replace(objText, "");
  }

  if (extractedObjects.length === 0) return 0;

  // Append extracted objects into ARCHIVED_SLICES array in slices_archive.ts
  archiveTsText = archiveTsText.replace(
    /(\];)\s*$/,
    extractedObjects.join("\n") + "\n];"
  );

  // Remove entries from build_state.json
  for (const slice of passedInActive) {
    delete state.slices[slice.id];
  }

  // Write files
  fs.writeFileSync(slicesTsPath, newSlicesTsText.replace(/\n{3,}/g, "\n\n"));
  fs.writeFileSync(archiveTsPath, archiveTsText);
  saveState(state);

  const msg = force
    ? `Archived ${extractedObjects.length} passed slices (/archive command)`
    : `Auto-archived ${extractedObjects.length} passed slices (SLICES had ${SLICES.length} > MAX_ACTIVE_SLICES=${MAX_ACTIVE_SLICES})`;
  log(msg);
  return extractedObjects.length;
}

// ═══════════════════════════════════════════════════════════
//  SLASH COMMANDS
// ═══════════════════════════════════════════════════════════

interface SlashCommand {
  name: string;
  alias: string[];
  args: string;
  description: string;
  handler: (args: string[], state: BuildState) => Promise<void>;
}

const commands: SlashCommand[] = [
  {
    name: "/status",
    alias: ["/s"],
    args: "",
    description: "Show status of all slices",
    handler: async (_args, state) => {
      console.log("\n  Vertex Build Runner — Slice Status\n");
      console.log(
        "  " +
          "Slice".padEnd(8) +
          "Title".padEnd(50) +
          "Status".padEnd(12) +
          "Model".padEnd(22) +
          "Preview"
      );
      console.log("  " + "─".repeat(110));

      for (const slice of SLICES) {
        const ss = state.slices[slice.id] || { status: "pending", attempts: 0 };
        const icon =
          ss.status === "passed" ? "✓" :
          ss.status === "failed" ? "✗" :
          ss.status === "running" ? "▶" :
          ss.status === "skipped" ? "⏭" : "○";
        console.log(
          `  ${slice.id.padEnd(8)}${slice.title.slice(0, 48).padEnd(50)}${(icon + " " + ss.status).padEnd(12)}${(ss.model || "—").padEnd(22)}${ss.previewUrl || ""}`
        );
      }

      const passed = SLICES.filter((s) => state.slices[s.id]?.status === "passed").length;
      const failed = SLICES.filter((s) => state.slices[s.id]?.status === "failed").length;
      const pending = SLICES.length - passed - failed;
      console.log(`\n  Total: ${passed} passed, ${failed} failed, ${pending} pending`);
      console.log(`  ${ARCHIVED_SLICES.length} archived (see slices_archive.ts)`);
      if (state.lastRun) console.log(`  Last run: ${state.lastRun}`);
      console.log();
    },
  },
  {
    name: "/next",
    alias: ["/n"],
    args: "",
    description: "Run the next pending slice (with auto-escalation)",
    handler: async (_args, state) => {
      if (!requireApiKey()) return;
      const next = getNextSlice(state);
      if (!next) {
        console.log("\n  No pending slices with satisfied dependencies.\n");
        return;
      }
      console.log(`\n  Running: Slice ${next.id} — ${next.title}`);
      console.log(`  Press S to stop after this slice finishes.\n`);
      enableStopHotkey();
      await runSliceWithEscalation(next, state);
      disableStopHotkey();
      stopAfterCurrent = false;
    },
  },
  {
    name: "/all",
    alias: ["/a"],
    args: "",
    description: "Run ALL pending slices sequentially (fire and forget)",
    handler: async (_args, state) => {
      if (!requireApiKey()) return;
      console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  Press S at any time to stop after the current slice.    │
  │                                                          │
  │  • "review" slices are committed but NOT pushed.         │
  │  • "safe" slices auto-push to main.                     │
  │  • Each slice is validated before moving on.             │
  │  • Dependency order is enforced.                         │
  └──────────────────────────────────────────────────────────┘
`);
      // Auto-archive at start if SLICES is bloated
      if (SLICES.length > MAX_ACTIVE_SLICES) {
        console.log(`  ♻  SLICES.length (${SLICES.length}) > MAX_ACTIVE_SLICES (${MAX_ACTIVE_SLICES}) — running auto-archive...`);
        await runArchiveRoutine(state);
      }

      enableStopHotkey();
      let next = getNextSlice(state);
      let count = 0;
      while (next) {
        if (stopAfterCurrent) {
          console.log(`\n  ⏸  Graceful stop. Finished ${count} slice(s). Repo is clean.`);
          console.log(`  Next pending: Slice ${next.id} — ${next.title}`);
          console.log(`  You can safely edit in Cursor now.`);
          console.log(`  Type 'vertex' to resume later.\n`);
          stopAfterCurrent = false;
          disableStopHotkey();
          process.exit(0);
        }
        count++;
        const ss = state.slices[next.id];
        const retrying = ss.status === "failed";
        if (retrying) {
          console.log(`\n  [${count}] Retrying: Slice ${next.id} — ${next.title} (previously failed)\n`);
          ss.status = "pending";
          ss.attempts = 0;
          ss.errors = undefined;
          saveState(state);
        } else {
          console.log(`\n  [${count}] Running: Slice ${next.id} — ${next.title}\n`);
        }
        const success = await runSliceWithEscalation(next, state);
        if (!success) {
          console.log(`\n  Stopped: Slice ${next.id} failed after full escalation.\n`);
          break;
        }
        next = getNextSlice(state);
      }
      disableStopHotkey();
      stopAfterCurrent = false;
      if (!next) {
        console.log(`\n  All done! ${count} slices completed.\n`);
      }
      // Auto-archive at end in case the run pushed count over the threshold
      if (SLICES.length > MAX_ACTIVE_SLICES) {
        await runArchiveRoutine(state);
      }
    },
  },
  {
    name: "/run",
    alias: ["/r"],
    args: "<slice_id>",
    description: "Run a specific slice (e.g. /run 41a)",
    handler: async (args, state) => {
      if (!requireApiKey()) return;
      const id = args[0];
      if (!id) {
        console.log("\n  Usage: /run <slice_id>  (e.g. /run 41a)\n");
        return;
      }
      const slice = SLICES.find((s) => s.id === id);
      if (!slice) {
        console.log(`\n  Slice '${id}' not found. Use /status to see all slices.\n`);
        return;
      }
      if (!canRun(slice, state)) {
        console.log(`\n  Dependencies not met: ${slice.dependsOn.join(", ")}\n`);
        return;
      }
      await runSliceWithEscalation(slice, state);
    },
  },
  {
    name: "/preview",
    alias: ["/p"],
    args: "",
    description: "Show all Firebase preview URLs",
    handler: async (_args, state) => {
      console.log("\n  Preview URLs:\n");
      let any = false;
      for (const slice of SLICES) {
        const ss = state.slices[slice.id];
        if (ss?.previewUrl) {
          console.log(`  ${slice.id.padEnd(8)} ${ss.previewUrl}`);
          any = true;
        }
      }
      if (!any) console.log("  No previews deployed yet. Run a slice first.");
      console.log();
    },
  },
  {
    name: "/plan",
    alias: [],
    args: "",
    description: "Show what would run next (dry run of all pending)",
    handler: async (_args, state) => {
      console.log("\n  Build Plan — pending slices in execution order:\n");
      const simState = JSON.parse(JSON.stringify(state)) as BuildState;
      let next = getNextSlice(simState);
      let count = 0;
      while (next) {
        const ladder = buildEscalationLadder(next.patterns);
        console.log(
          `  ${++count}. Slice ${next.id}: ${next.title}\n` +
            `     Escalation: ${ladder.join(" → ")}\n` +
            `     Risk: ${next.riskLevel} | Files: ${[...next.filesToCreate, ...next.filesToModify].join(", ")}\n`
        );
        simState.slices[next.id] = { status: "passed", attempts: 1 };
        next = getNextSlice(simState);
      }
      if (count === 0) console.log("  Nothing pending.");
      console.log();
    },
  },
  {
    name: "/inspect",
    alias: ["/i"],
    args: "<slice_id>",
    description: "Show full details for a slice (scope, files, escalation)",
    handler: async (args, _state) => {
      const id = args[0];
      if (!id) {
        console.log("\n  Usage: /inspect <slice_id>  (e.g. /inspect 41a)\n");
        return;
      }
      const slice = SLICES.find((s) => s.id === id);
      if (!slice) {
        console.log(`\n  Slice '${id}' not found.\n`);
        return;
      }
      const ladder = buildEscalationLadder(slice.patterns);
      console.log(`\n  ═══ Slice ${slice.id}: ${slice.title} ═══\n`);
      console.log(`  Phase:       ${slice.phase}`);
      console.log(`  Risk:        ${slice.riskLevel}`);
      console.log(`  Depends on:  ${slice.dependsOn.length > 0 ? slice.dependsOn.join(", ") : "none"}`);
      console.log(`  Escalation:  ${ladder.join(" → ")}`);
      console.log(`  Patterns:    ${slice.patterns.join(", ")}`);
      console.log(`  Create:      ${slice.filesToCreate.length > 0 ? slice.filesToCreate.join(", ") : "none"}`);
      console.log(`  Modify:      ${slice.filesToModify.join(", ")}`);
      console.log(`  Cache-busts: ${slice.cacheBusts.join(", ")}`);
      console.log(`  HTML IDs:    ${slice.expectedIds.length > 0 ? slice.expectedIds.join(", ") : "none"}`);
      console.log(`\n  Scope:\n    ${slice.scope.replace(/\n/g, "\n    ")}`);
      console.log(`\n  Out of scope:\n    ${slice.outOfScope}`);
      console.log();
    },
  },
  {
    name: "/reset",
    alias: [],
    args: "<slice_id | all>",
    description: "Reset a failed slice to pending (or 'all' to reset everything)",
    handler: async (args, state) => {
      const id = args[0];
      if (!id) {
        console.log("\n  Usage: /reset <slice_id>  or  /reset all\n");
        return;
      }
      if (id === "all") {
        for (const s of SLICES) {
          state.slices[s.id] = { status: "pending", attempts: 0 };
        }
        saveState(state);
        console.log("\n  All slices reset to pending.\n");
        return;
      }
      const ss = state.slices[id];
      if (!ss) {
        console.log(`\n  Slice '${id}' not found.\n`);
        return;
      }
      ss.status = "pending";
      ss.attempts = 0;
      ss.errors = undefined;
      saveState(state);
      console.log(`\n  Slice ${id} reset to pending.\n`);
    },
  },
  {
    name: "/push",
    alias: [],
    args: "<slice_id | unpushed>",
    description: "Git push a review slice you've checked, or 'unpushed' for all",
    handler: async (args, _state) => {
      const id = args[0];
      if (!id) {
        console.log("\n  Usage: /push <slice_id>  or  /push unpushed\n");
        return;
      }
      try {
        execSync("git push origin main", { cwd: PROJECT_ROOT, stdio: "inherit" });
        console.log("\n  Pushed to origin/main.\n");
      } catch {
        console.log("\n  Push failed. Check git status.\n");
      }
    },
  },
  {
    name: "/log",
    alias: ["/l"],
    args: "[lines]",
    description: "Show recent build log entries (default: last 30)",
    handler: async (args, _state) => {
      const count = parseInt(args[0] || "30", 10);
      if (!fs.existsSync(LOG_FILE)) {
        console.log("\n  No build log yet. Run a slice first.\n");
        return;
      }
      const lines = fs.readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean);
      const tail = lines.slice(-count);
      console.log(`\n  Last ${tail.length} log entries:\n`);
      for (const l of tail) console.log(`  ${l}`);
      console.log();
    },
  },
  {
    name: "/errors",
    alias: ["/e"],
    args: "",
    description: "Show errors from all failed slices",
    handler: async (_args, state) => {
      console.log("\n  Failed Slices:\n");
      let any = false;
      for (const slice of SLICES) {
        const ss = state.slices[slice.id];
        if (ss?.status === "failed" && ss.errors?.length) {
          any = true;
          console.log(`  ✗ ${slice.id}: ${slice.title}`);
          console.log(`    Model: ${ss.model} | Attempts: ${ss.attempts}`);
          for (const err of ss.errors) console.log(`    - ${err}`);
          console.log();
        }
      }
      if (!any) console.log("  No failed slices.\n");
    },
  },
  {
    name: "/cost",
    alias: [],
    args: "",
    description: "Estimate remaining cost based on model selections",
    handler: async (_args, state) => {
      const costEstimates = getCostEstimates();

      let totalLow = 0;
      let totalHigh = 0;
      let spent = 0;

      console.log("\n  Cost Estimate (remaining slices):\n");
      for (const slice of SLICES) {
        const ss = state.slices[slice.id];
        if (ss?.status === "passed") {
          const range = costEstimates[ss.model || "claude-sonnet-4-6"] || [10, 20];
          spent += (range[0] + range[1]) / 2;
          continue;
        }
        if (ss?.status === "failed" || ss?.status === "pending") {
          const model = selectModel(slice.patterns);
          const range = costEstimates[model] || [10, 20];
          totalLow += range[0];
          totalHigh += range[1];
          console.log(`  ${slice.id.padEnd(8)} ${model.padEnd(22)} ~$${range[0]}-${range[1]}`);
        }
      }
      console.log(`\n  Estimated remaining: $${totalLow}–$${totalHigh}`);
      if (spent > 0) console.log(`  Estimated spent:     ~$${Math.round(spent)}`);
      console.log(`  Ultra plan budget:   $400/month\n`);
    },
  },
  {
    name: "/models",
    alias: [],
    args: "",
    description: "Show the model lookup table (cheapest per pattern)",
    handler: async () => {
      const content = fs.readFileSync(
        path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_LOOKUP.md"),
        "utf-8"
      );
      console.log("\n" + content);
    },
  },
  {
    name: "/help",
    alias: ["/", "/h", "/?"],
    args: "",
    description: "Show this command list",
    handler: async () => {
      printHelp();
    },
  },
  {
    name: "/preflight",
    alias: ["/check", "/pre"],
    args: "",
    description: "Check that everything is ready to run",
    handler: async () => {
      await runPreflight();
    },
  },
  {
    name: "/stop",
    alias: ["/pause", "/yield"],
    args: "",
    description: "Finish current slice then stop (so you can use Cursor safely)",
    handler: async () => {
      if (stopAfterCurrent) {
        console.log("\n  Already stopping after current slice.\n");
        return;
      }
      stopAfterCurrent = true;
      console.log("\n  ⏸  Stop requested. Will finish the current slice then pause.");
      console.log("  The repo will be in a clean state when it stops.");
      console.log("  Use /a to resume building later.\n");
    },
  },
  {
    name: "/archive",
    alias: [],
    args: "",
    description: "Force-archive all passed slices from slices.ts → slices_archive.ts",
    handler: async (_args, state) => {
      console.log("\n  Running archive routine (forced)...\n");
      const n = await runArchiveRoutine(state, true);
      if (n === 0) {
        console.log("  Nothing to archive — no passed slices in the active SLICES array.\n");
      } else {
        console.log(`  Archived ${n} slice(s). Restart the runner to reload slices.\n`);
      }
    },
  },
  {
    name: "/build",
    alias: ["/b"],
    args: "[hours]",
    description: "What changed recently + what to test (default: last 12h)",
    handler: async (args, state) => {
      const hours = parseInt(args[0] || "12", 10);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      let commits: Array<{ hash: string; subject: string; time: string; date: string; files: string[] }> = [];
      try {
        const raw = execSync(
          `git log --since="${since}" --format="__COMMIT__%H||%aI||%s" --name-only`,
          { cwd: PROJECT_ROOT, stdio: "pipe" }
        ).toString().trim();

        if (!raw) {
          console.log(`\n  No commits in the last ${hours} hours.\n`);
          return;
        }

        let current: { hash: string; subject: string; time: string; date: string; files: string[] } | null = null;
        for (const line of raw.split("\n")) {
          if (line.startsWith("__COMMIT__")) {
            if (current) commits.push(current);
            const payload = line.replace("__COMMIT__", "");
            const [hash, isoTime, ...rest] = payload.split("||");
            const commitDate = new Date(isoTime);
            const hhmm = new Intl.DateTimeFormat("en-US", {
              timeZone: "America/Chicago",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(commitDate);
            const dateStr = new Intl.DateTimeFormat("en-US", {
              timeZone: "America/Chicago",
              weekday: "short",
              month: "short",
              day: "numeric",
            }).format(commitDate);
            current = { hash: hash.slice(0, 7), subject: rest.join("||"), time: hhmm, date: dateStr, files: [] };
          } else if (line.trim() && current) {
            current.files.push(line.trim());
          }
        }
        if (current) commits.push(current);
      } catch (e: any) {
        console.log(`\n  Git error: ${e.message?.slice(0, 200)}\n`);
        return;
      }

      if (commits.length === 0) {
        console.log(`\n  No commits in the last ${hours} hours.\n`);
        return;
      }

      commits.reverse();

      // Categorize files into risk buckets
      const riskBuckets: Record<string, Set<string>> = {
        "FIELD APP (tech-facing)": new Set(),
        "DISPATCHER (office-facing)": new Set(),
        "FIREBASE RULES": new Set(),
        "BUILD TOOLS / SDK": new Set(),
        "WORKBENCH (dev)": new Set(),
        "DOCS / STATUS": new Set(),
      };

      function categorize(file: string): string {
        if (/^technician\//.test(file)) return "FIELD APP (tech-facing)";
        if (/^(index\.html|service_call\.js|dispatcher\/)/.test(file)) return "DISPATCHER (office-facing)";
        if (/\.(rules)$/.test(file)) return "FIREBASE RULES";
        if (/^tools\//.test(file)) return "BUILD TOOLS / SDK";
        if (/^workbench\//.test(file)) return "WORKBENCH (dev)";
        if (/^PROJECT_STATUS\/|\.md$/.test(file)) return "DOCS / STATUS";
        return "FIELD APP (tech-facing)";
      }

      for (const c of commits) {
        for (const f of c.files) {
          riskBuckets[categorize(f)].add(f);
        }
      }

      // Build test checklist from file patterns
      const tests: string[] = [];
      const allFiles = commits.flatMap((c) => c.files);

      if (allFiles.some((f) => f === "storage.rules")) {
        tests.push("Upload a photo from the tech app → confirm no permission-denied error");
        tests.push("Upload a video to field_evidence or service_call_addendums → confirm it saves");
        tests.push("Try uploading a .pdf to a photo-only path → confirm it's REJECTED");
      }
      if (allFiles.some((f) => /service_call\.js|index\.html/.test(f) && !/technician/.test(f))) {
        tests.push("Toggle Office Override on/off → confirm tech iframe responds");
      }
      if (allFiles.some((f) => /technician\/index\.html/.test(f))) {
        tests.push("Open the tech app on mobile → check debug overlay shows latest VC_BUILD stamp");
        if (allFiles.some((f) => f === "service_call.js")) {
          tests.push("Test postMessage: shadow tech switch → confirm parent receives it");
        }
      }
      if (allFiles.some((f) => /workbench\//.test(f))) {
        tests.push("Start workbench server locally → confirm http://localhost:<port> responds");
      }
      if (allFiles.some((f) => /model_selector\.ts|build_runner\.ts/.test(f))) {
        tests.push("Run /cost in the build runner → confirm output shows per-model estimates");
        tests.push("Run: npx tsc --noEmit (from tools/) → confirm clean compile");
      }
      if (allFiles.some((f) => /firestore\.rules/.test(f))) {
        tests.push("Create/edit a service call → confirm Firestore writes succeed");
      }

      // Print summary
      const title = `BUILD SUMMARY — last ${hours}h (${commits.length} commit${commits.length > 1 ? "s" : ""})`;
      const boxWidth = 62;
      const padded = title + " ".repeat(Math.max(0, boxWidth - 4 - title.length));
      console.log(`\n  ╔${"═".repeat(boxWidth - 2)}╗`);
      console.log(`  ║ ${padded} ║`);
      console.log(`  ╚${"═".repeat(boxWidth - 2)}╝\n`);

      console.log(`  WHAT CHANGED:\n`);
      const archivedIds = new Set(ARCHIVED_SLICES.map((s) => s.id));
      let lastDate = "";

      for (const c of commits) {
        // Print date header when the date changes
        if (c.date !== lastDate) {
          if (lastDate) console.log();
          console.log(`    ── ${c.date} ──`);
          lastDate = c.date;
        }
        // Match "Slice XXx" references (e.g. "Slice 61c")
        const sliceMatch = /Slice (\d+\w+)/.exec(c.subject);
        if (sliceMatch) {
          const sliceId = sliceMatch[1];
          const phaseMatch = /Phase\s*(\d+)/.exec(c.subject);
          const phaseNum = phaseMatch ? phaseMatch[1] : sliceId.replace(/\D+$/, "");

          let tag: string;
          if (state.slices[sliceId]?.status === "passed") tag = "✓ passed";
          else if (state.slices[sliceId]?.status === "failed") tag = "✗ FAILED";
          else if (state.slices[sliceId]?.status === "running") tag = "▶ running";
          else if (state.slices[sliceId]?.status === "pending") tag = "○ pending";
          else if (archivedIds.has(sliceId)) tag = "✓ archived";
          else tag = "✓ committed";

          // Strip the original "Phase XX:" and "(Slice XXx)" from the subject to rebuild cleanly
          let description = c.subject
            .replace(/Phase\s*\d+:\s*/i, "")
            .replace(/\(Slice \d+\w+\)\s*/i, "")
            .replace(/Slice \d+\w+\s*/i, "")
            .replace(/^[\s—–-]+/, "")
            .trim();

          console.log(`    ${c.hash}  Phase ${phaseNum}, Slice ${sliceId} (${tag}: ${c.time}): ${description}`);
        } else {
          console.log(`    ${c.hash}  (${c.time}) ${c.subject}`);
        }
      }

      if (tests.length > 0) {
        // Persist checklist so /p and /f can reference it by number
        state.lastChecklist = tests;
        if (!state.checklistResults) state.checklistResults = {};
        // Clear results for items that no longer exist
        for (const key of Object.keys(state.checklistResults)) {
          if (parseInt(key) > tests.length) delete state.checklistResults[parseInt(key)];
        }
        saveState(state);

        console.log(`\n  ${"─".repeat(58)}`);
        console.log(`  TEST CHECKLIST\n`);
        tests.forEach((t, i) => {
          const num = i + 1;
          const result = state.checklistResults?.[num];
          const icon = result === "passed" ? "✓" : result === "failed" ? "✗" : " ";
          const label = result === "passed" ? " passed" : result === "failed" ? " FAILED" : "";
          console.log(`    [${icon}] ${num}. ${t}${label}`);
        });
        console.log();
        const doneCount = Object.keys(state.checklistResults || {}).length;
        if (doneCount < tests.length) {
          console.log(`  /p1,2,3 = mark passed  |  /f1,2,3 = mark failed\n`);
        }
      } else {
        console.log(`  No field-app or rules changes detected — likely safe (tools/docs only).\n`);
      }

      // Check for unpushed commits
      try {
        const unpushed = execSync("git log origin/main..HEAD --oneline", {
          cwd: PROJECT_ROOT,
          stdio: "pipe",
        }).toString().trim();
        if (unpushed) {
          const count = unpushed.split("\n").length;
          console.log(`  ⚠  ${count} commit${count > 1 ? "s" : ""} NOT yet pushed to origin/main.`);
          console.log(`     Run /push unpushed when satisfied.\n`);
        } else {
          console.log(`  ✓ All commits pushed to origin/main.\n`);
        }
      } catch {
        console.log(`  ⚠  Could not check push status.\n`);
      }
    },
  },
  {
    name: "/passed",
    alias: ["/p"],
    args: "<1,2,3>",
    description: "Mark test checklist items as passed (e.g. /p1,2,3)",
    handler: async (args, state) => {
      const nums = args.join(",").split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      if (nums.length === 0) {
        console.log("\n  Usage: /p1,2,3  or  /passed 1,2,3\n");
        return;
      }
      if (!state.lastChecklist || state.lastChecklist.length === 0) {
        console.log("\n  No checklist loaded — run /b first.\n");
        return;
      }
      if (!state.checklistResults) state.checklistResults = {};
      for (const n of nums) {
        if (n < 1 || n > state.lastChecklist.length) {
          console.log(`  ⚠  Item ${n} out of range (1–${state.lastChecklist.length})`);
          continue;
        }
        state.checklistResults[n] = "passed";
        console.log(`  ✓ ${n}. ${state.lastChecklist[n - 1]}`);
      }
      saveState(state);
      console.log();
    },
  },
  {
    name: "/failed",
    alias: ["/f"],
    args: "<1,2,3>",
    description: "Mark test checklist items as failed (e.g. /f1,2,3)",
    handler: async (args, state) => {
      const nums = args.join(",").split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      if (nums.length === 0) {
        console.log("\n  Usage: /f1,2,3  or  /failed 1,2,3\n");
        return;
      }
      if (!state.lastChecklist || state.lastChecklist.length === 0) {
        console.log("\n  No checklist loaded — run /b first.\n");
        return;
      }
      if (!state.checklistResults) state.checklistResults = {};
      for (const n of nums) {
        if (n < 1 || n > state.lastChecklist.length) {
          console.log(`  ⚠  Item ${n} out of range (1–${state.lastChecklist.length})`);
          continue;
        }
        state.checklistResults[n] = "failed";
        console.log(`  ✗ ${n}. ${state.lastChecklist[n - 1]}`);
      }
      saveState(state);
      console.log();
    },
  },
  {
    name: "/quit",
    alias: ["/q", "/exit"],
    args: "",
    description: "Exit the build runner",
    handler: async () => {
      console.log("\n  Goodbye.\n");
      process.exit(0);
    },
  },
];

function printHelp(): void {
  console.log("\n  ═══ Vertex Build Runner — Commands ═══\n");
  console.log("  Type / to see this list at any time.\n");

  const groups: Record<string, SlashCommand[]> = {
    "Build": commands.filter((c) => ["/next", "/all", "/run"].includes(c.name)),
    "Info": commands.filter((c) => ["/status", "/build", "/plan", "/inspect", "/preview", "/errors", "/log"].includes(c.name)),
    "Cost": commands.filter((c) => ["/cost", "/models"].includes(c.name)),
    "Manage": commands.filter((c) => ["/reset", "/push", "/passed", "/failed", "/preflight", "/archive"].includes(c.name)),
    "Other": commands.filter((c) => ["/help", "/stop", "/quit"].includes(c.name)),
  };

  for (const [group, cmds] of Object.entries(groups)) {
    console.log(`  ${group}:`);
    for (const cmd of cmds) {
      const aliasStr = cmd.alias.filter((a) => a !== "/").length > 0
        ? ` (${cmd.alias.filter((a) => a !== "/").join(", ")})`
        : "";
      const nameAndArgs = `${cmd.name} ${cmd.args}`.trim();
      console.log(`    ${nameAndArgs.padEnd(28)} ${cmd.description}${aliasStr}`);
    }
    console.log();
  }
}

function requireApiKey(): boolean {
  if (!process.env.CURSOR_API_KEY) {
    console.log(
      "\n  CURSOR_API_KEY not set.\n" +
        "  Get your key at: https://cursor.com/dashboard/integrations\n" +
        "  Then: set CURSOR_API_KEY=your_key_here  (Windows)\n" +
        "    or: export CURSOR_API_KEY=your_key_here (Mac/Linux)\n"
    );
    return false;
  }
  return true;
}

// ─── Preflight Check ───

async function runPreflight(): Promise<boolean> {
  console.log("\n  ═══ Preflight Check ═══\n");
  let allGood = true;

  // 1. CURSOR_API_KEY
  if (process.env.CURSOR_API_KEY) {
    console.log(`  ✓ CURSOR_API_KEY: set (${process.env.CURSOR_API_KEY.length} chars)`);
  } else {
    console.log("  ✗ CURSOR_API_KEY is NOT set");
    console.log("    Fix: set CURSOR_API_KEY=your_key_here");
    console.log("    Get key: https://cursor.com/dashboard/integrations");
    allGood = false;
  }

  // 2. Node.js
  try {
    const nodeVersion = execSync("node -v", { stdio: "pipe" }).toString().trim();
    console.log(`  ✓ Node.js ${nodeVersion}`);
  } catch {
    console.log("  ✗ Node.js not found");
    allGood = false;
  }

  // 3. @cursor/sdk installed
  const sdkPath = path.join(__dirname, "node_modules", "@cursor", "sdk");
  if (fs.existsSync(sdkPath)) {
    console.log("  ✓ @cursor/sdk installed");
  } else {
    console.log("  ✗ @cursor/sdk not installed");
    console.log("    Fix: cd tools && npm install");
    allGood = false;
  }

  // 4. Git repo clean
  try {
    const status = execSync("git status --porcelain", {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
    }).toString().trim();
    if (status) {
      console.log(`  ⚠ Git has uncommitted changes (${status.split("\n").length} files)`);
      console.log("    This is OK but slices will commit on top of your changes.");
    } else {
      console.log("  ✓ Git working tree is clean");
    }
  } catch {
    console.log("  ✗ Not a git repo or git not found");
    allGood = false;
  }

  // 5. Git can push
  try {
    execSync("git remote get-url origin", { cwd: PROJECT_ROOT, stdio: "pipe" });
    console.log("  ✓ Git remote 'origin' configured");
  } catch {
    console.log("  ✗ No git remote 'origin' — safe slices won't auto-push");
    allGood = false;
  }

  // 6. technician/index.html exists (main file we modify)
  const techHtml = path.join(PROJECT_ROOT, "technician", "index.html");
  if (fs.existsSync(techHtml)) {
    const lines = fs.readFileSync(techHtml, "utf-8").split("\n").length;
    console.log(`  ✓ technician/index.html exists (${lines} lines)`);
  } else {
    console.log("  ✗ technician/index.html not found — are you in the right repo?");
    allGood = false;
  }

  // 7. MODEL_LOOKUP.md exists
  const lookupPath = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_LOOKUP.md");
  if (fs.existsSync(lookupPath)) {
    console.log("  ✓ MODEL_LOOKUP.md found");
  } else {
    console.log("  ✗ MODEL_LOOKUP.md not found");
    allGood = false;
  }

  // 8. Firebase CLI (optional — for preview deploys)
  try {
    const fbVersion = execSync("npx firebase --version", {
      stdio: "pipe",
      timeout: 15000,
    }).toString().trim();
    console.log(`  ✓ Firebase CLI ${fbVersion} (preview deploys will work)`);
  } catch {
    console.log("  ⚠ Firebase CLI not found (preview deploys will be skipped — builds still work)");
  }

  // 9. Slice state
  const stateExists = fs.existsSync(STATE_FILE);
  if (stateExists) {
    const state = loadState();
    const passed = SLICES.filter((s) => state.slices[s.id]?.status === "passed").length;
    const failed = SLICES.filter((s) => state.slices[s.id]?.status === "failed").length;
    const pending = SLICES.length - passed - failed;
    console.log(`  ✓ Build state found: ${passed} passed, ${failed} failed, ${pending} pending`);
  } else {
    console.log("  ✓ Fresh start — no previous build state");
  }

  // Summary
  console.log();
  if (allGood) {
    console.log("  ✓ All checks passed. Ready to build!");
    console.log("    Type /next for one slice, or /all to build everything.\n");
  } else {
    console.log("  ✗ Some checks failed. Fix the issues above before running.\n");
  }

  return allGood;
}

// ═══════════════════════════════════════════════════════════
//  INTERACTIVE REPL
// ═══════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const state = loadState();

  // Handle one-shot CLI args for backwards compatibility
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const mapped = args[0].startsWith("--") ? `/${args[0].slice(2)}` : `/run ${args[0]}`;
    const parts = mapped.split(" ");
    const cmdName = parts[0];
    const cmdArgs = parts.slice(1);
    const cmd = commands.find(
      (c) => c.name === cmdName || c.alias.includes(cmdName)
    );
    if (cmd) {
      await cmd.handler(cmdArgs, state);
      return;
    }
  }

  // Interactive mode — run preflight on startup
  console.log("\n  ╔══════════════════════════════════════════╗");
  console.log(`  ║   Vertex Build Runner  v${VERSION}            ║`);
  console.log("  ╚══════════════════════════════════════════╝");

  const ready = await runPreflight();

  const passed = SLICES.filter((s) => state.slices[s.id]?.status === "passed").length;
  const failed = SLICES.filter((s) => state.slices[s.id]?.status === "failed").length;
  const pending = SLICES.length - passed - failed;

  const next = getNextSlice(state);
  if (next) {
    const ladder = buildEscalationLadder(next.patterns);
    console.log(`  Next up: Slice ${next.id} — ${next.title} [${ladder[0]}]`);
  }

  if (ready) {
    console.log("  Type / for commands, /next to build one, /all to build everything.");
    console.log("  While building: press S to finish current slice then pause.\n");
  } else {
    console.log("  Fix the issues above, then type /preflight to re-check.\n");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "  vertex> ",
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const parts = input.split(/\s+/);
    let cmdName = parts[0];
    const cmdArgs = parts.slice(1);

    // Bare "/" shows help
    if (cmdName === "/") cmdName = "/help";

    // Add / prefix if missing
    if (!cmdName.startsWith("/")) cmdName = `/${cmdName}`;

    // Handle /b<N> shorthand (e.g. /b4, /b12, /b24) → /build <N>
    const buildShorthand = /^\/b(\d+)$/.exec(cmdName);
    if (buildShorthand) {
      cmdName = "/build";
      cmdArgs.unshift(buildShorthand[1]);
    }

    // Handle /p<nums> and /f<nums> shorthand (e.g. /p1,2,3 → /passed 1,2,3)
    const passShorthand = /^\/p([\d,]+)$/.exec(cmdName);
    if (passShorthand) { cmdName = "/passed"; cmdArgs.unshift(passShorthand[1]); }
    const failShorthand = /^\/f([\d,]+)$/.exec(cmdName);
    if (failShorthand) { cmdName = "/failed"; cmdArgs.unshift(failShorthand[1]); }

    const cmd = commands.find(
      (c) => c.name === cmdName || c.alias.includes(cmdName)
    );

    if (!cmd) {
      console.log(`\n  Unknown command: ${cmdName}. Type / for help.\n`);
      rl.prompt();
      return;
    }

    try {
      await cmd.handler(cmdArgs, state);
    } catch (e: any) {
      console.log(`\n  Error: ${e.message}\n`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\n  Goodbye.\n");
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
