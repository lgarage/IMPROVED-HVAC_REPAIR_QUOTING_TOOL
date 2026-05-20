#!/usr/bin/env node
/**
 * .cursor/hooks/sync-scorecard.js
 *
 * afterFileEdit hook — fires after any Write to MODEL_DOSSIER.md.
 * Reads all outcome rows (active + archive), recomputes avg Conf after % per
 * (model × job shape) cell, and rewrites the ## Scorecard table in place.
 *
 * Runs via: node .cursor/hooks/sync-scorecard.js
 * Input: Cursor afterFileEdit JSON on stdin
 * Output: { "additional_context": "..." } on stdout (non-blocking)
 */

"use strict";
const fs = require("fs");
const path = require("path");

// ── paths ──────────────────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const DOSSIER = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_DOSSIER.md");
const ARCHIVE = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_DOSSIER_ARCHIVE.md");

// ── scorecard column order (must match the table header in MODEL_DOSSIER.md) ──
const COLUMNS = [
  "GPT-5.4 Mini",
  "Gemini 3 Flash",
  "GPT-5 Mini",
  "Composer 2",
  "C2.5",
  "Sonnet 4.6",
  "Codex 5.3",
  "Opus 4.6",
];

// ── job shape rows (must match first column of Scorecard table) ────────────
const SHAPES = [
  "All logged",
  "Field app bugfix",
  "Admin / Phase 66",
  "UI / CSS layout",
  "Firestore / Vertex",
  "Build runner / SDK",
  "Governance / triage",
  "Slice authoring",
];

// ── model name extraction patterns ────────────────────────────────────────
// Maps substrings found in Note column → canonical scorecard column name.
// Order matters: more specific first (e.g. "Composer 2.5" before "Composer 2").
const MODEL_PATTERNS = [
  ["Composer 2.5", "C2.5"],
  ["composer-2.5", "C2.5"],
  ["C2.5", "C2.5"],
  ["GPT-5.4 Mini", "GPT-5.4 Mini"],
  ["gpt-5.4-mini", "GPT-5.4 Mini"],
  ["Gemini 3 Flash", "Gemini 3 Flash"],
  ["gemini-3-flash", "Gemini 3 Flash"],
  ["GPT-5 Mini", "GPT-5 Mini"],
  ["gpt-5-mini", "GPT-5 Mini"],
  ["Sonnet 4.6", "Sonnet 4.6"],
  ["claude-sonnet-4-6", "Sonnet 4.6"],
  ["Codex 5.3", "Codex 5.3"],
  ["gpt-5.3-codex", "Codex 5.3"],
  ["Opus 4.6", "Opus 4.6"],
  ["claude-opus-4-6", "Opus 4.6"],
  // "Composer 2" must come AFTER "Composer 2.5"
  ["Composer 2", "Composer 2"],
  ["composer-2", "Composer 2"],
];

// ── job shape detection from Task column ──────────────────────────────────
function detectShape(task) {
  const t = task.toLowerCase();
  // Build runner / SDK: check first (before "admin" which appears in slice IDs)
  if (/build.?runner|sdk\s+slice|dossier_logger|model_selector|validator|slices\.ts|slash\s+command|\/cost|\/status|\/archive/.test(t)) {
    return "Build runner / SDK";
  }
  // Slice authoring (must come before field-app generic)
  if (/slice\s+author|phase\s+\d+\s+slice|slices?\s+\d+[a-z]–|authoring/.test(t)) {
    return "Slice authoring";
  }
  // Governance
  if (/governance|dossier|\.cursorrules|rules\s+update|idea\s+track|icebox|triage|reconcil|current.?state|roadmap\s+update/.test(t)) {
    return "Governance / triage";
  }
  // Admin
  if (/admin|phase\s+66/.test(t)) {
    return "Admin / Phase 66";
  }
  // Firestore / Vertex (avoid matching "firestore.rules" in build runner context)
  if (/firestore.{0,20}(write|rules|schema|migrat|collection|subcollect)|vertex\s+core|firebase.{0,20}(migrat|project)/.test(t)) {
    return "Firestore / Vertex";
  }
  // UI / CSS
  if (/\bcss\b|layout|transpar|pill|spacing|glass|header.*ui|ui.*header|mobile\s+ui\s+v\d|chatgpt.style|slack.feel|floating\s+chrome/.test(t)) {
    return "UI / CSS layout";
  }
  // Default
  return "Field app bugfix";
}

// ── parse a single outcome table row ──────────────────────────────────────
function parseRow(line) {
  if (!line.startsWith("| 20")) return null;
  const cells = line.split("|").map(c => c.trim()).filter(Boolean);
  // Expected: Date | Task | Class | Arch | Tier | ConfStart% | ConfAfter% | TierFit | Outcome | Note
  if (cells.length < 10) return null;

  const confAfterRaw = cells[6].replace("%", "").trim();
  const confAfter = parseFloat(confAfterRaw);
  if (isNaN(confAfter) || confAfter < 0 || confAfter > 100) return null;

  const task = cells[1];
  const note = cells[9];
  const outcome = cells[8].toLowerCase();
  // Skip failed rows (don't count in confidence averages)
  if (outcome === "fail") return null;

  return { task, note, confAfter };
}

// ── extract canonical model name from a Note cell ─────────────────────────
function extractModel(note) {
  for (const [pattern, label] of MODEL_PATTERNS) {
    if (note.includes(pattern)) return label;
  }
  return null;
}

// ── check whether a row is SDK-automated (excluded from scorecard averages) ──
function isSdkAutomated(task, note) {
  const blob = `${task} ${note}`;
  return /\*\(SDK automated\)\*|sdk\s+automated|\(sdk\)/i.test(blob);
}

// ── parse all rows from a file's outcome log section ─────────────────────
function parseRowsFromFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const results = [];

  // Find the outcome log table (look for separator line after header)
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith("|------")) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (!line.startsWith("| 20")) {
        // Still in table region but not a data row — check for section break
        if (line.startsWith("##") || line.startsWith("---") || (line.startsWith("- Older") && line.includes("MODEL_DOSSIER_ARCHIVE"))) {
          // Don't break — archive files have one continuous table
          continue;
        }
        continue;
      }
      const row = parseRow(line);
      if (row) results.push(row);
    }
  }
  return results;
}

// ── aggregate rows into scorecard cells ───────────────────────────────────
// Returns { [shape]: { [modelLabel]: { sum, count } } }
function aggregate(rows) {
  const cells = {};
  for (const shape of SHAPES) {
    cells[shape] = {};
    for (const col of COLUMNS) {
      cells[shape][col] = { sum: 0, count: 0 };
    }
  }

  for (const { task, note, confAfter } of rows) {
    const model = extractModel(note);
    if (!model) continue;

    // SDK-automated rows use fixed 82→90% conf — not real signal (MODEL_DOSSIER gotchas)
    if (isSdkAutomated(task, note)) continue;

    const shape = detectShape(task);

    // Update the specific shape cell
    if (cells[shape] && cells[shape][model]) {
      cells[shape][model].sum += confAfter;
      cells[shape][model].count += 1;
    }

    // Always update "All logged" totals
    if (cells["All logged"] && cells["All logged"][model]) {
      cells["All logged"][model].sum += confAfter;
      cells["All logged"][model].count += 1;
    }
  }

  return cells;
}

// ── format a cell value ────────────────────────────────────────────────────
function formatCell(sum, count) {
  if (count === 0) return "—";
  const avg = Math.round(sum / count);
  return `${avg}% (${count})`;
}

// ── update scorecard table in MODEL_DOSSIER.md ────────────────────────────
function updateScorecard(cells) {
  const content = fs.readFileSync(DOSSIER, "utf-8");
  const lines = content.split(/\r?\n/);

  // Find scorecard header row (the one with column names including "Sonnet 4.6")
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("| Job shape") && lines[i].includes("Sonnet 4.6")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return false;

  // Parse column order from header
  const headerCells = lines[headerIdx].split("|").map(c => c.trim()).filter(Boolean);
  // headerCells[0] = "Job shape", headerCells[1..N-1] = model names, last = "Default pick"

  const sepIdx = headerIdx + 1;
  if (!lines[sepIdx] || !lines[sepIdx].startsWith("|---")) return false;

  let changed = false;

  // Update data rows
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) break;

    const rowCells = line.split("|").map(c => c.trim()).filter(Boolean);
    if (rowCells.length < 2) continue;

    // Match shape name (strip ** bold markers)
    const shapeName = rowCells[0].replace(/\*\*/g, "").trim();
    const shapeKey = SHAPES.find(s => s === shapeName);
    if (!shapeKey) continue;

    // Rebuild the row
    const rawParts = line.split("|");
    // rawParts[0] = "", rawParts[1] = first cell, ..., rawParts[last] = ""

    for (let c = 1; c < rawParts.length - 1; c++) {
      const colHeader = headerCells[c - 1];
      if (!colHeader || colHeader === "Job shape" || colHeader === "Default pick") continue;

      const modelLabel = COLUMNS.find(m => colHeader.includes(m));
      if (!modelLabel) continue;

      const data = cells[shapeKey][modelLabel];
      if (!data) continue;

      const newVal = formatCell(data.sum, data.count);

      // Only update if cell has data or currently shows a value (avoid replacing "—" with "—")
      const currentVal = rawParts[c].trim();
      if (currentVal === newVal) continue;

      // Preserve "⚠️ unproven" marker for C2.5 Firestore row
      if (currentVal.includes("unproven")) continue;

      // Update with same padding
      const pad = rawParts[c].match(/^\s*/)?.[0] ?? " ";
      const trailPad = rawParts[c].match(/\s*$/)?.[0] ?? " ";
      rawParts[c] = `${pad}${newVal}${trailPad}`;
      changed = true;
    }

    if (changed) {
      lines[i] = rawParts.join("|");
      // Reset changed per-row (we want to track any change across all rows)
    }
  }

  // Re-check: was anything actually different?
  const newContent = lines.join("\n");
  if (newContent === content) return false;

  fs.writeFileSync(DOSSIER, newContent, "utf-8");
  return true;
}

// ── main ──────────────────────────────────────────────────────────────────
let stdinData = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", chunk => { stdinData += chunk; });
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(stdinData || "{}");

    // Only run if MODEL_DOSSIER.md (not archive) was edited
    const filePath = JSON.stringify(event);
    if (!filePath.includes("MODEL_DOSSIER.md") || filePath.includes("ARCHIVE")) {
      process.stdout.write("{}");
      return;
    }

    // Parse rows from both files
    const activeRows = parseRowsFromFile(DOSSIER);
    const archiveRows = parseRowsFromFile(ARCHIVE);
    const allRows = [...activeRows, ...archiveRows];

    if (allRows.length === 0) {
      process.stdout.write("{}");
      return;
    }

    // Aggregate and update
    const cells = aggregate(allRows);
    const updated = updateScorecard(cells);

    const msg = updated
      ? `Scorecard auto-synced from ${allRows.length} outcome rows.`
      : `Scorecard checked (${allRows.length} rows, no change needed).`;

    process.stdout.write(JSON.stringify({ additional_context: msg }));
  } catch (err) {
    // Fail open — never block the agent
    process.stdout.write("{}");
  }
});
