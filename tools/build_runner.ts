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
import { selectModel, updateLookupRow, buildEscalationLadder, MODEL_COST_RANK } from "./model_selector";
import { validateSlice } from "./validator";
import { buildPrompt } from "./prompt_builder";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const STATE_FILE = path.join(__dirname, ".build_state.json");
const LOG_FILE = path.join(__dirname, "build_log.txt");
const VERSION = "2.1.0";

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
    ss.lastAttempt = new Date().toISOString();
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

    if (i < ladder.length - 1) {
      log(`✗ ${model} failed for slice ${slice.id}. Escalating to ${ladder[i + 1]}...`);
    } else {
      log(`✗ ${model} failed for slice ${slice.id}. No more models to try.`);
    }
  }

  for (const pattern of slice.patterns) {
    updateLookupRow(pattern, ladder[ladder.length - 1], false);
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
      const costEstimates: Record<string, [number, number]> = {
        "composer-2": [3, 8],
        "claude-4.6-sonnet": [5, 15],
        "gpt-5.3-codex": [8, 20],
        "gpt-5.2": [8, 18],
        "gpt-5.4-medium": [10, 25],
        "gpt-5.5-medium": [12, 30],
        "claude-4.6-opus": [15, 35],
      };

      let totalLow = 0;
      let totalHigh = 0;
      let spent = 0;

      console.log("\n  Cost Estimate (remaining slices):\n");
      for (const slice of SLICES) {
        const ss = state.slices[slice.id];
        if (ss?.status === "passed") {
          const range = costEstimates[ss.model || "claude-4.6-sonnet"] || [10, 20];
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
    "Info": commands.filter((c) => ["/status", "/plan", "/inspect", "/preview", "/errors", "/log"].includes(c.name)),
    "Cost": commands.filter((c) => ["/cost", "/models"].includes(c.name)),
    "Manage": commands.filter((c) => ["/reset", "/push", "/preflight"].includes(c.name)),
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
    const keyPreview = process.env.CURSOR_API_KEY.slice(0, 10) + "...";
    console.log(`  ✓ CURSOR_API_KEY is set (${keyPreview})`);
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
