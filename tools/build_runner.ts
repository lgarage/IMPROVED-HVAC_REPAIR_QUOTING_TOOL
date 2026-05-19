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
import {
  selectModel,
  updateLookupRow,
  buildEscalationLadder,
  getPatternMinimum,
  filterLadderByGuards,
  MODEL_COST_RANK,
  COMPOSER_25_SLUG,
  checkModelGuard,
  recordModelGuardFailure,
  resolvedGuard,
  MODEL_GUARDS,
} from "./model_selector";
import { validateSlice } from "./validator";
import { buildPrompt } from "./prompt_builder";

const MAX_ACTIVE_SLICES = 20;

// Minimum model tier per slice riskLevel — prevents cheap/fast models from
// running slices that require judgment or multi-file reasoning.
const RISK_LEVEL_FLOOR: Record<string, string> = {
  safe: "",                    // cheapest per pattern (MODEL_LOOKUP) tries first
  review: "",                  // same — escalate on fail; C2.5 before Sonnet in ladder
  critical: "",                // same — Opus only reached after cheaper rungs fail
};

/** Ladder after pattern Floor, risk floor, and MODEL_GUARDS (no doomed Mini/Flash runs). */
function resolveSliceLadder(slice: Slice): string[] {
  const fileCount = (slice.filesToCreate?.length || 0) + (slice.filesToModify?.length || 0);
  const rawLadder = buildEscalationLadder(slice.patterns);

  const riskFloor = RISK_LEVEL_FLOOR[slice.riskLevel || "safe"] || "";
  const riskFloorRank = riskFloor ? MODEL_COST_RANK[riskFloor] || 0 : 0;
  let ladder = riskFloor
    ? [
        ...rawLadder.filter((m) => (MODEL_COST_RANK[m] || 0) >= riskFloorRank),
        ...(!rawLadder.some((m) => (MODEL_COST_RANK[m] || 0) >= riskFloorRank)
          ? [riskFloor]
          : []),
      ].filter((m, i, arr) => arr.indexOf(m) === i)
    : rawLadder;

  ladder = filterLadderByGuards(ladder, slice.riskLevel || "safe", fileCount, slice.patterns);
  return ladder;
}

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
        console.log(`\n\n  ⏸  STOP received — will finish current slice then stop.`);
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
  // Strip archived slices — they're done and don't need to be tracked.
  // Keep state for any archived slice that is also back in active SLICES (e.g. Phase 64 re-queued from archive).
  const activeIds = new Set(SLICES.map((s) => s.id));
  const archivedIds = new Set(ARCHIVED_SLICES.map((s) => s.id));
  let stripped = 0;
  for (const id of Object.keys(state.slices)) {
    if (archivedIds.has(id) && !activeIds.has(id)) {
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
    const ss = state.slices[slice.id] || { status: "pending", attempts: 0 };
    if ((ss.status === "pending" || ss.status === "failed") && canRun(slice, state)) {
      return slice;
    }
  }
  return null;
}

// ─── Playwright UI Verification ───
//
// When a slice sets uiChange: true, the runner:
//   1. Takes a BEFORE screenshot from the live URL before the SDK agent runs.
//   2. After the slice passes + deploys, takes an AFTER screenshot from the preview URL.
//   3. Sends both to a cheap model (not a flagship) to compare and report.
//
// This mirrors the manual Playwright rule in .cursor/rules/ui-ux-screenshot-check.mdc
// but runs automatically without needing the developer to do it by hand.

const PLAYWRIGHT_VERIFY_MODEL = "gpt-5.4-mini"; // Fast/cheap — vision comparison is T0

const LIVE_APP_URL = "https://vertex-core-db.web.app/technician/index.html?vc_debug=0";
const PW_SCRIPT_PATH = path.join(PROJECT_ROOT, "_vc_pw_verify.mjs");
const PW_BEFORE_SCHEDULE  = path.join(PROJECT_ROOT, "_pw_before_schedule.png");
const PW_BEFORE_WORKSPACE = path.join(PROJECT_ROOT, "_pw_before_workspace.png");
const PW_AFTER_SCHEDULE   = path.join(PROJECT_ROOT, "_pw_after_schedule.png");
const PW_AFTER_WORKSPACE  = path.join(PROJECT_ROOT, "_pw_after_workspace.png");

function writePwScript(url: string, schedulePath: string, workspacePath: string, extraSteps?: string[]): void {
  // Forward slashes for the .mjs script (works on all platforms)
  const scheduleOut = schedulePath.replace(/\\/g, "/");
  const workspaceOut = workspacePath.replace(/\\/g, "/");

  // If the slice provides custom interaction steps, inject them after login and
  // before the final workspace screenshot so the cheap model sees the result of
  // the actual click flow being tested — not just the default schedule view.
  const customSteps = extraSteps && extraSteps.length > 0
    ? [`try {`, ...extraSteps.map(s => `  ${s}`), `} catch (_customStep) {}`]
    : [];

  const script = [
    `import { chromium } from 'playwright';`,
    `const browser = await chromium.launch({ headless: true });`,
    `const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });`,
    `const page = await ctx.newPage();`,
    `await page.goto('${url}', { waitUntil: 'domcontentloaded', timeout: 20000 });`,
    `await page.waitForTimeout(3000);`,
    `try {`,
    `  await page.locator('select').first().selectOption({ label: 'DAN DAY' });`,
    `  await page.waitForTimeout(500);`,
    `  await page.locator('#loginContinueBtn').click({ timeout: 5000 });`,
    `  await page.waitForTimeout(4000);`,
    `} catch (_e) { /* login step optional — continue even if it fails */ }`,
    `await page.screenshot({ path: '${scheduleOut}' });`,
    // Inject custom interaction steps here (after schedule screenshot, before workspace screenshot)
    ...customSteps,
    `try {`,
    `  const jobCard = page.locator('.job-card').first();`,
    `  if (await jobCard.isVisible({ timeout: 3000 }).catch(() => false)) {`,
    `    await jobCard.click();`,
    `    await page.waitForTimeout(3000);`,
    `    await page.screenshot({ path: '${workspaceOut}' });`,
    `  }`,
    `} catch (_e) {}`,
    `await browser.close();`,
  ].join("\n");
  fs.writeFileSync(PW_SCRIPT_PATH, script);
}

function takePlaywrightScreenshot(url: string, schedulePath: string, workspacePath: string, extraSteps?: string[]): boolean {
  try {
    writePwScript(url, schedulePath, workspacePath, extraSteps);
    log(`📸 Taking Playwright screenshot: ${url}`);
    execSync(`node "${PW_SCRIPT_PATH}"`, {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
      timeout: 35000,
    });
    const ok = fs.existsSync(schedulePath);
    if (ok) {
      log(`📸 Screenshot saved: ${path.basename(schedulePath)}`);
    } else {
      log(`⚠  Schedule screenshot missing — login or network issue`);
    }
    return ok;
  } catch (e: any) {
    log(`⚠  Playwright screenshot failed (non-blocking): ${e.message?.slice(0, 200)}`);
    return false;
  } finally {
    try { fs.unlinkSync(PW_SCRIPT_PATH); } catch { /* ignore */ }
  }
}

async function verifyUiChangeWithCheapModel(slice: Slice): Promise<void> {
  if (!fs.existsSync(PW_AFTER_SCHEDULE)) {
    log(`⚠  AFTER screenshot missing — skipping cheap-model visual verification`);
    return;
  }

  const hasBefore = fs.existsSync(PW_BEFORE_SCHEDULE);
  const beforeNote = hasBefore
    ? `BEFORE schedule screenshot: _pw_before_schedule.png`
    : `(No BEFORE screenshot available — first run or capture failed)`;

  log(`🔍 Running cheap-model visual verification with ${PLAYWRIGHT_VERIFY_MODEL}...`);

  const prompt = `Pre-approved model: ${PLAYWRIGHT_VERIFY_MODEL} — proceed

You are verifying a UI change in the Vertex field tech web app (a mobile service dispatch app).
Use your file-reading tools to read the PNG screenshots, then compare them.

## Change just implemented
Slice ${slice.id}: ${slice.title}

Summary of what changed:
${slice.scope.slice(0, 600).replace(/`/g, "'")}

## Screenshots to read and compare
- ${beforeNote}
- AFTER schedule screenshot: _pw_after_schedule.png
- AFTER workspace screenshot (read if it exists): _pw_after_workspace.png

## What to report (keep under 150 words total)
1. Does the AFTER look visibly different from BEFORE in a way consistent with the change above?
2. Does anything look clipped, broken, or wrong in the AFTER?
3. One sentence describing what visually changed.

End your response with EXACTLY one of these two lines:
  PLAYWRIGHT_VERDICT: PASS — <one sentence why>
  PLAYWRIGHT_VERDICT: FAIL — <one sentence what looks wrong>`.trim();

  try {
    const result = await Agent.prompt(prompt, {
      apiKey: process.env.CURSOR_API_KEY!,
      model: { id: PLAYWRIGHT_VERIFY_MODEL },
      local: { cwd: PROJECT_ROOT },
    });

    const text = (result as any).result || "";
    const match = text.match(/PLAYWRIGHT_VERDICT:\s*(PASS|FAIL)\s*[-\u2014]\s*(.+)/i);

    if (match) {
      const verdict = match[1].toUpperCase();
      const reason  = match[2].trim();
      const icon    = verdict === "PASS" ? "✓" : "⚠";
      log(`${icon} Playwright verdict [${PLAYWRIGHT_VERIFY_MODEL}]: ${verdict} — ${reason}`);
      if (verdict === "FAIL") {
        console.log(`\n  ┌── Playwright UI Check: ${slice.id} — ${slice.title}`);
        console.log(`  │  ⚠  FAIL — ${reason}`);
        console.log(`  │  Check screenshots: _pw_before_schedule.png → _pw_after_schedule.png`);
        console.log(`  └── Fix visually before pushing.\n`);
      }
    } else {
      log(`Playwright model response (no VERDICT line): ${text.slice(0, 300)}`);
    }
  } catch (e: any) {
    log(`⚠  Cheap-model UI verification failed (non-blocking): ${e.message?.slice(0, 200)}`);
  } finally {
    // Clean up all screenshot temp files regardless of outcome
    for (const p of [PW_BEFORE_SCHEDULE, PW_BEFORE_WORKSPACE, PW_AFTER_SCHEDULE, PW_AFTER_WORKSPACE]) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
    }
  }
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
  const rawLadder = buildEscalationLadder(slice.patterns);
  const patternMin = getPatternMinimum(slice.patterns);
  const ladder = resolveSliceLadder(slice);

  if (patternMin.floorRank > 0) {
    log(
      `Pattern minimum for ${slice.id}: ${patternMin.floorModel} (${patternMin.sources.join("; ")})`
    );
  }
  if (rawLadder[0] !== ladder[0]) {
    const skipped = rawLadder.filter((m) => !ladder.includes(m));
    if (skipped.length) {
      log(`⚠  Ladder adjusted — starting at ${ladder[0]} (skipped: ${skipped.join(", ")})`);
    }
  }

  log(`\nEscalation ladder for ${slice.id}: ${ladder.join(" → ")}`);

  // Take BEFORE screenshot once, before the first attempt fires the SDK agent.
  // Non-blocking — a failed screenshot does not prevent the slice from running.
  if (slice.uiChange && ss.attempts === 0) {
    takePlaywrightScreenshot(LIVE_APP_URL, PW_BEFORE_SCHEDULE, PW_BEFORE_WORKSPACE, slice.playwrightSteps);
  }

  let lastResult: RunAttemptResult | null = null;

  const fileCount = (slice.filesToCreate?.length || 0) + (slice.filesToModify?.length || 0);

  for (let i = 0; i < ladder.length; i++) {
    const model = ladder[i];

    // Per-model guard check — skip this rung if the model's guard forbids it.
    const guardResult = checkModelGuard(model, slice.riskLevel || "safe", fileCount, slice.patterns);
    if (!guardResult.allowed) {
      const skipNext = ladder[i + 1] ? ` → next: ${ladder[i + 1]}` : " (no more rungs)";
      log(`🛡  Guard blocked ${model} for slice ${slice.id}: ${guardResult.reason}${skipNext}`);
      continue;
    }

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

      // Take AFTER screenshot and run cheap-model comparison for UI-change slices.
      // Uses the preview channel URL when available; falls back to live URL.
      // Non-blocking — a failed check does not fail the slice.
      if (slice.uiChange) {
        const afterUrl = previewUrl
          ? `${previewUrl}/technician/index.html?vc_debug=0`
          : LIVE_APP_URL;
        takePlaywrightScreenshot(afterUrl, PW_AFTER_SCHEDULE, PW_AFTER_WORKSPACE, slice.playwrightSteps);
        await verifyUiChangeWithCheapModel(slice);
      }

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

    // Auto-tighten guard: accumulate failure counts; adds to forbidden list
    // after GUARD_FAILURE_THRESHOLD failures for this model+pattern combo.
    const failReason = lastResult?.errors?.[0] || "unknown failure";
    recordModelGuardFailure(model, slice.id, slice.patterns, failReason);

    if (i < ladder.length - 1) {
      const next = ladder[i + 1];
      log(
        `✗ ${model} failed for slice ${slice.id} (rung ${i + 1}/${ladder.length}). ` +
          `Escalating → ${next} (rung ${i + 2}/${ladder.length})...`
      );
      if (lastResult?.errors?.length) {
        log(`   Reason: ${lastResult.errors[0]?.slice(0, 300)}`);
      }
    } else {
      log(`✗ ${model} failed for slice ${slice.id}. No more models in ladder.`);
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

// ── Post-run governance: update CURRENT_STATE.md so the next agent knows what happened ──
function updateCurrentStateAfterRun(state: BuildState, sliceCount: number): void {
  const csPath = path.join(PROJECT_ROOT, "PROJECT_STATUS", "CURRENT_STATE.md");
  if (!fs.existsSync(csPath)) {
    console.log(`  Skipping CURRENT_STATE update — file not found.`);
    return;
  }

  let content = fs.readFileSync(csPath, "utf-8");
  const timestamp = formatChicagoTimestamp();

  // Build a summary of what ran
  const passedSlices: string[] = [];
  const failedSlices: string[] = [];
  for (const [id, ss] of Object.entries(state.slices)) {
    if (ss.status === "passed") passedSlices.push(id);
    else if (ss.status === "failed") failedSlices.push(id);
  }

  const passedStr = passedSlices.length ? passedSlices.join(", ") : "none";
  const summary = `SDK build runner completed ${sliceCount} slice(s) at ${timestamp}. Passed: ${passedStr}.${failedSlices.length ? ` Failed: ${failedSlices.join(", ")}.` : ""}`;

  // Update "Last shipped" line
  const lastShippedRe = /- \*\*Last shipped[^*]*\*\*[^\n]*/;
  const newLastShipped = `- **Last shipped (${timestamp}):** ${summary}`;
  if (lastShippedRe.test(content)) {
    content = content.replace(lastShippedRe, newLastShipped);
  }

  // Update "Immediate Next Step" to reflect what the NEXT session should do
  const nextStepRe = /- \*\*(?:Immediate Next Step|Fix)[^*]*\*\*[^\n]*/;
  let nextStep: string;
  if (failedSlices.length) {
    nextStep = `- **Immediate Next Step:** Investigate failed slices (${failedSlices.join(", ")}) — check build_log.txt for errors. Then manually test passed slices on device.`;
  } else {
    nextStep = `- **Immediate Next Step:** Test the deployed changes on device. Verify slices ${passedStr} work correctly in the field app. Check for regressions.`;
  }
  if (nextStepRe.test(content)) {
    content = content.replace(nextStepRe, nextStep);
  }

  fs.writeFileSync(csPath, content, "utf-8");

  // Commit + push the governance update
  try {
    execSync(`git add "${csPath}"`, { cwd: PROJECT_ROOT, stdio: "pipe" });
    execSync(`git commit -m "chore: post-run CURRENT_STATE update — ${sliceCount} slices completed"`, { cwd: PROJECT_ROOT, stdio: "pipe" });
    execSync("git push origin main", { cwd: PROJECT_ROOT, stdio: "pipe" });
    console.log(`  ✓ CURRENT_STATE.md updated and pushed (post-run governance).\n`);
  } catch (e: any) {
    console.log(`  Governance commit/push failed (non-blocking): ${e.message?.slice(0, 200)}\n`);
  }
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

  // Remove archived slices from the in-memory SLICES array so subsequent
  // commands (/a, /status, getNextSlice) don't reference stale entries
  // whose state was just deleted.
  const archivedSet = new Set(passedInActive.map((s) => s.id));
  for (let i = SLICES.length - 1; i >= 0; i--) {
    if (archivedSet.has(SLICES[i].id)) {
      SLICES.splice(i, 1);
    }
  }

  const msg = force
    ? `Archived ${extractedObjects.length} passed slices (/archive command)`
    : `Auto-archived ${extractedObjects.length} passed slices (SLICES had ${SLICES.length + extractedObjects.length} > MAX_ACTIVE_SLICES=${MAX_ACTIVE_SLICES})`;
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
  │  • "review" slices: committed, pushed at end of run.     │
  │  • "safe" slices: auto-push immediately after passing.  │
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
        // Auto-push everything committed-but-not-yet-pushed (review slices held back per-slice).
        try {
          const unpushed = execSync("git log origin/main..HEAD --oneline", { cwd: PROJECT_ROOT, stdio: "pipe" }).toString().trim();
          if (unpushed) {
            console.log(`  Pushing ${unpushed.split("\n").length} commit(s) to origin/main...`);
            execSync("git push origin main", { cwd: PROJECT_ROOT, stdio: "pipe" });
            console.log(`  ✓ All commits pushed to origin/main.\n`);
          } else {
            console.log(`  Nothing new to push — already up to date.\n`);
          }
        } catch (e: any) {
          console.log(`  Push failed (non-blocking): ${e.message?.slice(0, 200)}\n`);
        }

        // ── Post-run governance: update CURRENT_STATE.md ──
        // The runner must leave accurate breadcrumbs for the next agent session.
        try {
          updateCurrentStateAfterRun(state, count);
        } catch (e: any) {
          console.log(`  Governance update failed (non-blocking): ${e.message?.slice(0, 200)}\n`);
        }
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
        const ladder = resolveSliceLadder(next);
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
      const ladder = resolveSliceLadder(slice);
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
    alias: ["/usage", "/u"],
    args: "",
    description: "Show SDK model invocation counts (how many times each agent was called)",
    handler: async (_args, state) => {
      const passedActive = SLICES.filter((s) => state.slices[s.id]?.status === "passed");
      const failedActive = SLICES.filter((s) => state.slices[s.id]?.status === "failed");
      const pendingActive = SLICES.filter((s) => state.slices[s.id]?.status === "pending");

      console.log("\n  ╔══════════════════════════════════════════════════════════╗");
      console.log("  ║   SDK Model Usage                                        ║");
      console.log("  ╚══════════════════════════════════════════════════════════╝\n");

      const usage: Record<string, { passed: number; failed: number; total: number }> = {};

      // Count passed slices
      for (const slice of passedActive) {
        const model = state.slices[slice.id]?.model || "unknown";
        if (!usage[model]) usage[model] = { passed: 0, failed: 0, total: 0 };
        usage[model].passed++;
        usage[model].total++;
      }

      // Count failed slices (last attempted model)
      for (const slice of failedActive) {
        const model = state.slices[slice.id]?.model || "unknown";
        if (!usage[model]) usage[model] = { passed: 0, failed: 0, total: 0 };
        usage[model].failed++;
        usage[model].total++;
      }

      // Sort models by cost rank
      const sortedModels = Object.keys(usage).sort((a, b) => (MODEL_COST_RANK[a] || 0) - (MODEL_COST_RANK[b] || 0));

      if (sortedModels.length === 0) {
        console.log("  No model invocations recorded yet.\n");
      } else {
        console.log("  MODEL INVOCATIONS (active slices):\n");
        for (const model of sortedModels) {
          const data = usage[model];
          const passedStr = data.passed > 0 ? `${data.passed} passed` : "";
          const failedStr = data.failed > 0 ? `${data.failed} failed` : "";
          const split = passedStr && failedStr ? ` (${passedStr}, ${failedStr})` : ` (${passedStr}${failedStr})`;
          console.log(`    ${model.padEnd(26)} ${String(data.total).padStart(2)} calls${split}`);
        }
        console.log();
      }

      const totalCalls = Object.values(usage).reduce((sum, d) => sum + d.total, 0);
      console.log(`  Total SDK agent calls: ${totalCalls}`);
      console.log(`  Active slices: ${passedActive.length} passed, ${failedActive.length} failed, ${pendingActive.length} pending`);
      console.log(`  Archived slices: ${ARCHIVED_SLICES.length} (passed in prior sessions)\n`);
      console.log("  Note: For actual dollar charges, check your Cursor billing dashboard.\n");
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
    name: "/guards",
    alias: ["/guard"],
    args: "",
    description: "Show per-model guard rails (ceilings, forbidden patterns, auto-tighten status)",
    handler: async () => {
      console.log("\n  MODEL GUARD RAILS (resolved — base + any auto-tightened overrides)\n");
      const allModels = Object.keys(MODEL_GUARDS);
      for (const model of allModels) {
        const g = resolvedGuard(model);
        const tag = g.overrideActive ? " [OVERRIDE ACTIVE]" : "";
        console.log(`  ${model}${tag}`);
        console.log(`    Max risk:  ${g.maxRiskLevel}  |  Max files: ${g.maxFiles}`);
        if (g.forbiddenPatterns.length > 0) {
          console.log(`    Forbidden: ${g.forbiddenPatterns.join("; ")}`);
        }
        console.log(`    Notes:     ${g.notes}`);
        console.log();
      }
      console.log("  To see auto-tightened overrides: check tools/model_guard_overrides.json");
      console.log("  To reset overrides: delete tools/model_guard_overrides.json\n");
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
          const result = (state.checklistResults as Record<number, string> | undefined)?.[num];
          const icon  = result === "passed" ? "✓" : result === "failed" ? "✗" : result === "n/a" ? "—" : " ";
          const label = result === "passed" ? " passed" : result === "failed" ? " FAILED" : result === "n/a" ? " n/a" : "";
          console.log(`    [${icon}] ${num}. ${t}${label}`);
        });
        console.log();
        const doneCount = Object.keys(state.checklistResults || {}).length;
        if (doneCount < tests.length) {
          console.log(`  /p1,2,3 = passed  |  /f1,2,3 = failed  |  /na 3 = not applicable\n`);
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
    name: "/na",
    alias: [],
    args: "<1,2,3>",
    description: "Mark test checklist items as N/A (e.g. /na 3)",
    handler: async (args, state) => {
      const nums = args.join(",").split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
      if (nums.length === 0) {
        console.log("\n  Usage: /na 3  or  /na 1,2,3\n");
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
        (state.checklistResults as Record<number, string>)[n] = "n/a";
        console.log(`  —  ${n}. ${state.lastChecklist[n - 1]} (skipped)`);
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
    "Cost": commands.filter((c) => ["/cost", "/models", "/guards"].includes(c.name)),
    "Manage": commands.filter((c) => ["/reset", "/push", "/passed", "/failed", "/na", "/preflight", "/archive"].includes(c.name)),
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

  // 9. MODEL_DOSSIER.md encoding integrity
  // PowerShell Set-Content can corrupt Unicode (em dashes, §, →, ↓) to replacement chars.
  // These sentinels must be present; if missing, the dossier was corrupted and should be
  // restored from git before any agent run touches it.
  const dossierPath = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_DOSSIER.md");
  if (fs.existsSync(dossierPath)) {
    const dossierText = fs.readFileSync(dossierPath, "utf-8");
    const sentinels: Array<{ char: string; label: string }> = [
      { char: "\u00A7", label: "§ (section mark)" },
      { char: "\u2014", label: "— (em dash)" },
      { char: "\u2192", label: "→ (right arrow)" },
      { char: "\u2193", label: "↓ (down arrow)" },
    ];
    const missing = sentinels.filter((s) => !dossierText.includes(s.char));
    if (missing.length === 0) {
      console.log("  ✓ MODEL_DOSSIER.md encoding intact");
    } else {
      console.log("  ✗ MODEL_DOSSIER.md ENCODING CORRUPTED — Unicode characters missing:");
      missing.forEach((s) => console.log(`    Missing: ${s.label}`));
      console.log("    Fix: git checkout PROJECT_STATUS/MODEL_DOSSIER.md");
      console.log("    Then re-apply any needed log rows using the Read tool (not PowerShell Set-Content).");
      allGood = false;
    }
  } else {
    console.log("  ✗ MODEL_DOSSIER.md not found");
    allGood = false;
  }

  // 10. Slice state
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

  // 11. Model slug validation — every slug in MODEL_COST_RANK must be in the verified list.
  // The SDK rejects unknown slugs immediately; catching this at startup prevents wasted runs.
  // Update VERIFIED_SDK_SLUGS when Cursor.models.list() returns new entries.
  const VERIFIED_SDK_SLUGS = new Set([
    "default", "composer-2", "composer-2.5", "gpt-5.5", "gpt-5.3-codex", "claude-sonnet-4-6",
    "claude-opus-4-7", "grok-4.3", "gpt-5.4", "claude-opus-4-6", "claude-opus-4-5",
    "gpt-5.2", "gemini-3.1-pro", "gpt-5.4-mini", "claude-haiku-4-5",
    "claude-sonnet-4-5", "gpt-5.2-codex", "gpt-5.1-codex-max", "gpt-5.1",
    "gemini-3-flash", "gpt-5.1-codex-mini", "claude-sonnet-4", "gpt-5-mini",
    "gemini-2.5-flash", "kimi-k2.5", "gpt-5.3-codex-spark",
  ]);
  const unverifiedSlugs = Object.keys(MODEL_COST_RANK).filter((s) => !VERIFIED_SDK_SLUGS.has(s));
  if (unverifiedSlugs.length === 0) {
    console.log("  ✓ All model slugs verified against SDK list");
  } else {
    console.log(`  ✗ Unverified model slugs (will fail at runtime): ${unverifiedSlugs.join(", ")}`);
    console.log("    Fix: remove these from MODEL_COST_RANK in model_selector.ts,");
    console.log("    or add them to VERIFIED_SDK_SLUGS after confirming via Cursor.models.list().");
    allGood = false;
  }

  // 12. Escalation ladders — pattern Floor + guards, cost-sorted, C2.5 before Sonnet/Opus
  let ladderOk = true;
  const pendingSlices = SLICES.filter((s) => {
    if (!stateExists) return true;
    const st = loadState().slices[s.id]?.status;
    return st !== "passed";
  });
  const sonnetSlug = "claude-sonnet-4-6";
  const sonnetRank = MODEL_COST_RANK[sonnetSlug] || 99;
  for (const slice of pendingSlices) {
    const patternMin = getPatternMinimum(slice.patterns);
    const ladder = resolveSliceLadder(slice);
    if (ladder.length < 2) {
      console.log(`  ✗ Slice ${slice.id}: ladder has only ${ladder.length} rung — no escalation path`);
      ladderOk = false;
      continue;
    }
    if (patternMin.floorRank > 0) {
      const firstRank = MODEL_COST_RANK[ladder[0]] ?? 0;
      if (firstRank < patternMin.floorRank) {
        console.log(
          `  ✗ Slice ${slice.id}: first rung ${ladder[0]} below pattern minimum ${patternMin.floorModel}`
        );
        ladderOk = false;
      }
    }
    for (let j = 1; j < ladder.length; j++) {
      const prev = MODEL_COST_RANK[ladder[j - 1]] ?? 0;
      const cur = MODEL_COST_RANK[ladder[j]] ?? 0;
      if (cur < prev) {
        console.log(`  ✗ Slice ${slice.id}: ladder not cost-sorted at ${ladder[j - 1]} → ${ladder[j]}`);
        ladderOk = false;
      }
    }
    const sonnetIdx = ladder.indexOf(sonnetSlug);
    const c25Idx = ladder.indexOf(COMPOSER_25_SLUG);
    if (sonnetIdx >= 0 && c25Idx >= 0 && c25Idx > sonnetIdx) {
      console.log(`  ✗ Slice ${slice.id}: ${COMPOSER_25_SLUG} must run before ${sonnetSlug}`);
      ladderOk = false;
    }
    const cheapEligible = patternMin.floorRank < sonnetRank;
    if (cheapEligible && (MODEL_COST_RANK[ladder[0]] ?? 0) >= sonnetRank) {
      console.log(
        `  ✗ Slice ${slice.id}: cheap-eligible slice should start below ${sonnetSlug} (got ${ladder[0]})`
      );
      ladderOk = false;
    }
  }
  if (pendingSlices.length === 0) {
    console.log("  ✓ Escalation ladders (no pending slices)");
  } else if (ladderOk) {
    console.log(
      `  ✓ Escalation ladders OK (${pendingSlices.length} pending) — pattern floors + escalate on fail`
    );
    for (const slice of pendingSlices.slice(0, 3)) {
      const ladder = resolveSliceLadder(slice);
      const patternMin = getPatternMinimum(slice.patterns);
      const minTag =
        patternMin.floorRank > 0 ? ` [min: ${patternMin.floorModel}]` : "";
      console.log(`      ${slice.id}: ${ladder.join(" → ")}${minTag}`);
    }
    if (pendingSlices.length > 3) {
      console.log(`      … +${pendingSlices.length - 3} more (run /plan for full list)`);
    }
  } else {
    allGood = false;
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
    const ladder = resolveSliceLadder(next);
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

    // Handle /p<nums>, /f<nums>, /na<nums> shorthand (e.g. /p1,2,3 → /passed 1,2,3)
    const passShorthand = /^\/p([\d,]+)$/.exec(cmdName);
    if (passShorthand) { cmdName = "/passed"; cmdArgs.unshift(passShorthand[1]); }
    const failShorthand = /^\/f([\d,]+)$/.exec(cmdName);
    if (failShorthand) { cmdName = "/failed"; cmdArgs.unshift(failShorthand[1]); }
    const naShorthand = /^\/na([\d,]+)$/.exec(cmdName);
    if (naShorthand) { cmdName = "/na"; cmdArgs.unshift(naShorthand[1]); }

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
