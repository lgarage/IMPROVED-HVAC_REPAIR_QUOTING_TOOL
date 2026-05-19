/**
 * Bridge SDK slice outcomes → MODEL_DOSSIER.md § Task outcome log
 * so live Cursor sessions see the same calibration data as overnight runs.
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
const MAX_ACTIVE_ROWS = 50;

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

function buildTaskCell(slice: Slice, outcome: SliceDossierOutcome): string {
  const patterns = slice.patterns.join(", ");
  const files = [...slice.filesToCreate, ...slice.filesToModify].slice(0, 4).join(", ");
  const fileSuffix = files ? ` Files: ${files}.` : "";
  return sanitizeCell(
    `SDK slice ${slice.id} (Phase ${slice.phase}): ${slice.title}. Patterns: ${patterns}.${fileSuffix}`
  );
}

function buildNote(slice: Slice, outcome: SliceDossierOutcome): string {
  const label = pickerLabel(outcome.model);
  const parts: string[] = [
    `Cursor: **${label}** (SDK automated).`,
    `Source: tools/build_runner.ts → MODEL_LOOKUP.md + dossier_logger.`,
  ];

  if (outcome.ladder.length > 1) {
    parts.push(`Ladder: ${outcome.ladder.join(" → ")}.`);
  }
  if (outcome.passed && outcome.failedModels?.length) {
    parts.push(
      `Escalated after fail on: ${outcome.failedModels.map(pickerLabel).join(", ")}.`
    );
  }
  if (!outcome.passed && outcome.failReason) {
    parts.push(`Last error: ${sanitizeCell(outcome.failReason.slice(0, 280))}.`);
  }
  if (slice.uiChange) {
    parts.push("uiChange slice (Playwright verify when configured).");
  }
  parts.push("Live sessions: grep this row + matching MODEL_LOOKUP pattern rows.");

  return sanitizeCell(parts.join(" "));
}

function findOutcomeTableBounds(lines: string[]): {
  sectionIdx: number;
  sepIdx: number;
  firstDataIdx: number;
  lastDataIdx: number;
} | null {
  const sectionIdx = lines.findIndex((l) => l.includes(OUTCOME_SECTION));
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
 * Append one outcome row to MODEL_DOSSIER.md (newest first). Archives overflow per dossier retention.
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
