/**
 * Bridge SDK slice outcomes → MODEL_DOSSIER.md § Task outcome log
 * so live Cursor sessions see the same calibration data as overnight runs.
 *
 * Updated 2026-05-19: MAX_ACTIVE_ROWS=10, truncation (task≤100, note≤80),
 * JOB_SHAPE_MAP. Scorecard: hook-only (sync-scorecard.js); SDK rows excluded.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type { Slice } from "./slices";
import { MODEL_COST_RANK } from "./model_selector";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DOSSIER_PATH = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_DOSSIER.md");
const ARCHIVE_PATH = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_DOSSIER_ARCHIVE.md");
const OUTCOME_SECTION = "### Outcome log (newest first)";
const MAX_ACTIVE_ROWS = 10;

// ---------------------------------------------------------------------------
// Scorecard configuration
// ---------------------------------------------------------------------------

/**
 * Maps slice patterns (as substrings) → scorecard row name.
 * Row names must match the first column of the Scorecard table in MODEL_DOSSIER.md.
 */
export const JOB_SHAPE_MAP: Record<string, string> = {
  "Firestore write path": "Firestore / Vertex",
  "Firestore rules": "Firestore / Vertex",
  "net-new Firestore": "Firestore / Vertex",
  "Firebase config": "Firestore / Vertex",
  "build_runner": "Build runner / SDK",
  "build runner": "Build runner / SDK",
  "slices.ts": "Build runner / SDK",
  "model_selector": "Build runner / SDK",
  "SDK slice": "Build runner / SDK",
  "slice authoring": "Slice authoring",
  "UI change": "UI / CSS layout",
  "CSS": "UI / CSS layout",
  "layout": "UI / CSS layout",
  "admin": "Admin / Phase 66",
  "Admin": "Admin / Phase 66",
  "Phase 66": "Admin / Phase 66",
  "governance": "Governance / triage",
  "Governance": "Governance / triage",
  "dossier": "Governance / triage",
  "triage": "Governance / triage",
};

/**
 * Map a slice to a scorecard row name (first matching pattern wins).
 * Falls back to "Field app bugfix" for unmatched field app changes.
 */
function jobShapeForSlice(slice: Slice): string {
  const searchText = [
    slice.title,
    (slice as any).description ?? "",
    slice.patterns.join(" "),
    slice.filesToCreate.join(" "),
    slice.filesToModify.join(" "),
  ].join(" ");

  for (const [pattern, shape] of Object.entries(JOB_SHAPE_MAP)) {
    if (searchText.includes(pattern)) return shape;
  }

  // Field app changes (technician/ or conversational_timeline) default to bugfix
  const isFieldApp =
    searchText.includes("technician") ||
    searchText.includes("conversational_timeline") ||
    searchText.includes("field_forms") ||
    searchText.includes("equipment");
  return isFieldApp ? "Field app bugfix" : "Build runner / SDK";
}

/**
 * Parse a scorecard cell value like "93% (86)" into { avg, count }.
 * Returns null if the cell is "—", empty, or unparseable.
 */
function parseScorecardCell(cell: string): { avg: number; count: number } | null {
  const m = cell.trim().match(/^(\d+)%\s*\((\d+)\)/);
  if (!m) return null;
  return { avg: parseInt(m[1], 10), count: parseInt(m[2], 10) };
}

/**
 * Format a scorecard cell back to "XX% (N)" or "—".
 */
function formatScorecardCell(avg: number, count: number): string {
  return `${Math.round(avg)}% (${count})`;
}

/**
 * Update one scorecard cell in MODEL_DOSSIER.md.
 * Finds the row matching `jobShape` and the column matching `modelLabel`,
 * recalculates the running average, and writes the file in place.
 *
 * @param jobShape   - Must match a value from JOB_SHAPE_MAP or "All logged"
 * @param modelLabel - Column header in the Scorecard table (e.g. "Sonnet 4.6")
 * @param newConfAfter - The new Conf after % value to fold into the running average
 */
export function updateScorecardCell(
  jobShape: string,
  modelLabel: string,
  newConfAfter: number
): void {
  if (!fs.existsSync(DOSSIER_PATH)) return;

  const lines = fs.readFileSync(DOSSIER_PATH, "utf-8").split("\n");

  // Find the scorecard section header row and separator
  const scorecardHeaderIdx = lines.findIndex((l) =>
    l.startsWith("| Job shape") && l.includes("Sonnet 4.6")
  );
  if (scorecardHeaderIdx < 0) return;

  // Parse column headers to find model column index
  const headers = lines[scorecardHeaderIdx]
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean);
  const colIdx = headers.findIndex((h) => h.includes(modelLabel));
  if (colIdx < 0) return;

  // Find "All logged" row and the specific jobShape row — update both
  const shapesToUpdate = new Set([jobShape, "All logged", "**All logged**"]);

  for (let i = scorecardHeaderIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) break;

    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const rowLabel = cells[0].replace(/\*\*/g, "");
    const matchesShape =
      shapesToUpdate.has(rowLabel) ||
      shapesToUpdate.has(`**${rowLabel}**`) ||
      (jobShape !== "All logged" && rowLabel.replace(/\*\*/g, "") === jobShape.replace(/\*\*/g, ""));

    if (matchesShape && cells.length > colIdx) {
      const current = parseScorecardCell(cells[colIdx]);
      let updated: string;
      if (current) {
        // Rolling average: new_avg = (old_avg * count + newValue) / (count + 1)
        const newCount = current.count + 1;
        const newAvg = (current.avg * current.count + newConfAfter) / newCount;
        updated = formatScorecardCell(newAvg, newCount);
      } else {
        // First entry for this cell
        updated = formatScorecardCell(newConfAfter, 1);
      }

      // Rebuild the line with the updated cell
      const allCells = line.split("|");
      // allCells[0] = "", allCells[1] = first data cell, etc.
      // colIdx maps to allCells[colIdx + 1]
      if (allCells.length > colIdx + 1) {
        const pad = allCells[colIdx + 1].match(/^\s*/)?.[0] ?? " ";
        const trailPad = allCells[colIdx + 1].match(/\s*$/)?.[0] ?? " ";
        allCells[colIdx + 1] = `${pad}${updated}${trailPad}`;
        lines[i] = allCells.join("|");
      }
    }
  }

  fs.writeFileSync(DOSSIER_PATH, lines.join("\n"), "utf-8");
}

// ---------------------------------------------------------------------------
// Existing logger helpers
// ---------------------------------------------------------------------------

const MODEL_PICKER_LABEL: Record<string, string> = {
  "composer-2": "Composer 2",
  "composer-2.5": "Composer 2.5",
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gemini-3-flash": "Gemini 3 Flash",
  "gpt-5-mini": "GPT-5 Mini",
  "gpt-5.3-codex-spark": "Codex Spark",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "kimi-k2.5": "Kimi K2.5",
  "gpt-5.3-codex": "Codex 5.3",
};

export interface SliceDossierOutcome {
  passed: boolean;
  model: string;
  attemptIndex: number;
  ladder: string[];
  failedModels?: string[];
  failReason?: string;
}

function pickerLabel(model: string): string {
  return MODEL_PICKER_LABEL[model] || model;
}

function tierForModel(model: string): string {
  const rank = MODEL_COST_RANK[model] ?? 8;
  if (rank <= 6) return "Fast";
  if (rank <= 10) return "Balanced";
  return "Strong";
}

function riskClass(slice: Slice): string {
  const high = [
    "Firestore write path",
    "Firestore rules",
    "Gemini prompt",
    "Shadow Mode",
    "Firebase config",
  ];
  if (slice.patterns.some((p) => high.some((h) => p.includes(h)))) return "HIGH";
  if (slice.riskLevel === "review") return "LOW-MEDIUM";
  return "LOW";
}

function archForSlice(slice: Slice): string {
  const fileCount = slice.filesToCreate.length + slice.filesToModify.length;
  if (riskClass(slice) === "HIGH") return fileCount > 2 ? "T2-T3" : "T2";
  if (fileCount > 3) return "T2";
  if (fileCount > 1) return "T1-T2";
  return "T1";
}

function sanitizeCell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();
}

/** Truncate to maxLen, appending "…" if cut. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

function confidenceForOutcome(outcome: SliceDossierOutcome): {
  confStart: number;
  confAfter: number;
  tierFit: string;
  result: string;
} {
  const escalated = outcome.attemptIndex > 0;
  if (outcome.passed) {
    if (escalated) {
      return { confStart: 72, confAfter: 88, tierFit: "ok", result: "ok" };
    }
    const rank = MODEL_COST_RANK[outcome.model] ?? 8;
    const confAfter = rank <= 4 ? 92 : rank <= 6 ? 90 : 93;
    return { confStart: 82, confAfter, tierFit: "ok", result: "ok" };
  }
  return {
    confStart: 78,
    confAfter: 42,
    tierFit: "needed_bigger",
    result: "fail",
  };
}

const SDK_TASK_MARKER = " *(SDK automated)*";

function buildTaskCell(slice: Slice, _outcome: SliceDossierOutcome): string {
  const patterns = slice.patterns.join(", ");
  const files = [...slice.filesToCreate, ...slice.filesToModify].slice(0, 4).join(", ");
  const fileSuffix = files ? ` Files: ${files}.` : "";
  const raw = sanitizeCell(
    `SDK slice ${slice.id} (Phase ${slice.phase}): ${slice.title}. Patterns: ${patterns}.${fileSuffix}`
  );
  const maxBody = 100 - SDK_TASK_MARKER.length;
  return truncate(raw, maxBody) + SDK_TASK_MARKER;
}

function buildNote(slice: Slice, outcome: SliceDossierOutcome): string {
  const label = pickerLabel(outcome.model);
  const ladder =
    outcome.ladder.length > 1
      ? ` Ladder: ${outcome.ladder.slice(0, 4).join(" → ")}.`
      : "";
  const raw = sanitizeCell(`${label} (SDK automated).${ladder}`);
  return truncate(raw, 80);
}

function findOutcomeTableBounds(lines: string[]): {
  sectionIdx: number;
  sepIdx: number;
  firstDataIdx: number;
  lastDataIdx: number;
} | null {
  // Support both "### Outcome log (newest first)" and inline section header
  const sectionIdx = lines.findIndex(
    (l) => l.includes(OUTCOME_SECTION) || l.includes("## Outcome log (newest first)")
  );
  if (sectionIdx < 0) return null;

  let sepIdx = -1;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith("|------|") || lines[i].startsWith("|------")) {
      sepIdx = i;
      break;
    }
    if (lines[i].startsWith("## ") && !lines[i].includes("Outcome log")) break;
  }
  if (sepIdx < 0) return null;

  const firstDataIdx = sepIdx + 1;
  let lastDataIdx = firstDataIdx - 1;
  for (let i = firstDataIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("| 20")) break;
    lastDataIdx = i;
  }

  return { sectionIdx, sepIdx, firstDataIdx, lastDataIdx };
}

function archiveOldestRow(lines: string[], rowLine: string): void {
  const today = new Date().toISOString().slice(0, 10);
  let archiveLines: string[] = [];
  if (fs.existsSync(ARCHIVE_PATH)) {
    archiveLines = fs.readFileSync(ARCHIVE_PATH, "utf-8").split("\n");
  } else {
    archiveLines = [
      "# Model Dossier — Archived Outcome Log Rows",
      "",
      "Overflow rows from MODEL_DOSSIER.md § Task outcome log. Newest first within each batch.",
      "",
      "| Date | Task (short) | Class | Arch | Tier used | Conf start % | Conf after % | Tier fit | Outcome | Note |",
      "|------|----------------|-------|------|-----------|--------------|--------------|----------|---------|------|",
    ];
  }

  let insertAt = archiveLines.findIndex((l) => l.startsWith("|------"));
  if (insertAt < 0) insertAt = archiveLines.length;
  else insertAt += 1;

  archiveLines.splice(insertAt, 0, rowLine);
  fs.writeFileSync(ARCHIVE_PATH, archiveLines.join("\n"), "utf-8");

  const retentionNote = `- Older rows: see MODEL_DOSSIER_ARCHIVE.md (append up to ${today}).`;
  const retentionIdx = lines.findIndex((l) => l.startsWith("- Older rows: see MODEL_DOSSIER_ARCHIVE"));
  if (retentionIdx >= 0) {
    lines[retentionIdx] = retentionNote;
  }
}

/**
 * Append one outcome row to MODEL_DOSSIER.md (newest first). Archives overflow per retention.
 * Scorecard averages: .cursor/hooks/sync-scorecard.js (excludes SDK-automated rows).
 */
export function appendDossierFromSlice(slice: Slice, outcome: SliceDossierOutcome): void {
  if (!fs.existsSync(DOSSIER_PATH)) {
    console.log("  ⚠  appendDossierFromSlice: MODEL_DOSSIER.md not found — skipped");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const { confStart, confAfter, tierFit, result } = confidenceForOutcome(outcome);
  const tier = tierForModel(outcome.model);
  const row =
    `| ${today} | ${buildTaskCell(slice, outcome)} | ${riskClass(slice)} | ${archForSlice(slice)} | ${tier} | ${confStart}% | ${confAfter}% | ${tierFit} | ${result} | ${buildNote(slice, outcome)} |`;

  const lines = fs.readFileSync(DOSSIER_PATH, "utf-8").split("\n");
  const bounds = findOutcomeTableBounds(lines);
  if (!bounds) {
    console.log("  ⚠  appendDossierFromSlice: outcome log table not found — skipped");
    return;
  }

  lines.splice(bounds.sepIdx + 1, 0, row);

  const updatedBounds = findOutcomeTableBounds(lines);
  if (updatedBounds && updatedBounds.lastDataIdx >= updatedBounds.firstDataIdx) {
    const rowCount = updatedBounds.lastDataIdx - updatedBounds.firstDataIdx + 1;
    if (rowCount > MAX_ACTIVE_ROWS) {
      const overflow = lines[updatedBounds.lastDataIdx];
      lines.splice(updatedBounds.lastDataIdx, 1);
      archiveOldestRow(lines, overflow);
    }
  }

  fs.writeFileSync(DOSSIER_PATH, lines.join("\n"), "utf-8");
  console.log(`  📓 Dossier log: slice ${slice.id} → ${result} on ${pickerLabel(outcome.model)}`);
}

/**
 * Commit MODEL_DOSSIER + MODEL_LOOKUP updates from this slice (non-blocking).
 */
export function commitSdkLearnings(sliceId: string, logFn: (msg: string) => void): void {
  const paths = [
    "PROJECT_STATUS/MODEL_DOSSIER.md",
    "PROJECT_STATUS/MODEL_LOOKUP.md",
    "PROJECT_STATUS/MODEL_DOSSIER_ARCHIVE.md",
  ];
  const existing = paths.filter((p) => fs.existsSync(path.join(PROJECT_ROOT, p)));
  if (existing.length === 0) return;

  try {
    for (const p of existing) {
      execSync(`git add "${p}"`, { cwd: PROJECT_ROOT, stdio: "pipe" });
    }
    const staged = execSync("git diff --cached --name-only", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    }).trim();
    if (!staged) return;

    execSync(
      `git commit -m "chore(sdk): calibration log slice ${sliceId} — MODEL_LOOKUP + MODEL_DOSSIER"`,
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    logFn(`Committed SDK learnings (lookup + dossier) for slice ${sliceId}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logFn(`SDK learnings commit skipped (non-blocking): ${msg.slice(0, 200)}`);
  }
}
