/**
 * Generalized model selector — picks cheapest safe model for a task pattern.
 * Extracted from tools/model_selector.ts, decoupled from Vertex-specific paths.
 *
 * Reads/writes a MODEL_LOOKUP.md table inside the workbench data dir.
 * The escalation ladder builds from cheapest-known-good → next tier → next tier.
 */

import * as fs from "fs";
import * as path from "path";

export const MODEL_COST_RANK: Record<string, number> = {
  "claude-haiku-4-5": 1,
  "composer-2": 2,
  "gpt-5.4-mini": 3,
  "gpt-5.3-codex-spark": 4,
  "claude-sonnet-4-6": 5,
  "gpt-5.3-codex": 6,
  "gpt-5.2": 7,
  "gpt-5.4": 8,
  "gpt-5.5": 9,
  "claude-opus-4-6": 10,
};

export interface LookupRow {
  pattern: string;
  cheapestOk: string;
  floor: string;
  lastVerified: string;
  notes: string;
}

const DEFAULT_LOOKUP = `# Model Lookup Table (Workbench Automation)

> One row per task pattern. Max 50 rows.
> Updated automatically after each task. Manual edits welcome.

| Pattern | Cheapest OK | Floor | Last verified | Notes |
|---------|-------------|-------|---------------|-------|
| UI container / HTML+CSS layout | composer-2 | — | — | Default |
| Single-file JS bugfix | composer-2 | — | — | Default |
| Multi-file feature | claude-sonnet-4-6 | — | — | Default |
| New module / file creation | claude-sonnet-4-6 | — | — | Default |
| Cross-module wiring (3+ files) | claude-sonnet-4-6 | — | — | Default |
| Firestore / database writes | claude-opus-4-6 | claude-opus-4-6 | — | Safety floor |
| Auth / security changes | claude-opus-4-6 | claude-opus-4-6 | — | Safety floor |
| Config / migration | claude-sonnet-4-6 | — | — | Default |
| Docs-only edits | claude-haiku-4-5 | — | — | Default |
| Test / build script changes | composer-2 | — | — | Default |
`;

export function ensureLookupFile(lookupPath: string): void {
  if (!fs.existsSync(lookupPath)) {
    fs.mkdirSync(path.dirname(lookupPath), { recursive: true });
    fs.writeFileSync(lookupPath, DEFAULT_LOOKUP, "utf-8");
  }
}

export function parseLookupTable(lookupPath: string): LookupRow[] {
  ensureLookupFile(lookupPath);
  const raw = fs.readFileSync(lookupPath, "utf-8");
  const lines = raw.split("\n");
  const rows: LookupRow[] = [];

  for (const line of lines) {
    if (!line.startsWith("|") || line.includes("Pattern") || line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;
    rows.push({
      pattern: cells[0],
      cheapestOk: cells[1],
      floor: cells[2] === "—" || cells[2] === "" ? "" : cells[2],
      lastVerified: cells[3],
      notes: cells[4] || "",
    });
  }
  return rows;
}

export function selectModel(lookupPath: string, taskPatterns: string[]): string {
  const table = parseLookupTable(lookupPath);
  let bestModel = "composer-2";
  let bestRank = MODEL_COST_RANK["composer-2"] || 2;

  for (const pattern of taskPatterns) {
    const row = table.find((r) => r.pattern === pattern);
    if (!row) {
      const sonnetRank = MODEL_COST_RANK["claude-sonnet-4-6"] || 5;
      if (sonnetRank > bestRank) {
        bestModel = "claude-sonnet-4-6";
        bestRank = sonnetRank;
      }
      continue;
    }

    if (row.floor) {
      const floorRank = MODEL_COST_RANK[row.floor] || 2;
      if (floorRank > bestRank) {
        bestModel = row.floor;
        bestRank = floorRank;
      }
    }

    const okRank = MODEL_COST_RANK[row.cheapestOk] || 2;
    if (okRank > bestRank) {
      bestModel = row.cheapestOk;
      bestRank = okRank;
    }
  }

  return bestModel;
}

export function buildEscalationLadder(lookupPath: string, taskPatterns: string[]): string[] {
  const base = selectModel(lookupPath, taskPatterns);
  const baseRank = MODEL_COST_RANK[base] || 1;

  const table = parseLookupTable(lookupPath);
  let floorRank = 0;
  for (const pattern of taskPatterns) {
    const row = table.find((r) => r.pattern === pattern);
    if (row?.floor) {
      const fr = MODEL_COST_RANK[row.floor] || 0;
      if (fr > floorRank) floorRank = fr;
    }
  }

  const ladder: string[] = [base];
  const sorted = Object.entries(MODEL_COST_RANK).sort((a, b) => a[1] - b[1]);

  let added = 0;
  for (const [name, rank] of sorted) {
    if (rank > baseRank && added < 2) {
      if (rank >= floorRank) {
        ladder.push(name);
        added++;
      }
    }
  }

  while (ladder.length < 3) {
    ladder.push("claude-opus-4-6");
  }

  return [...new Set(ladder)];
}

export function updateLookupRow(
  lookupPath: string,
  pattern: string,
  newModel: string,
  succeeded: boolean
): void {
  ensureLookupFile(lookupPath);
  const raw = fs.readFileSync(lookupPath, "utf-8");
  const lines = raw.split("\n");
  const today = new Date().toISOString().slice(0, 10);
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("|") || lines[i].includes("Pattern") || lines[i].includes("---")) continue;
    const cells = lines[i].split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4 || cells[0] !== pattern) continue;

    found = true;
    const currentModel = cells[1];
    const currentRank = MODEL_COST_RANK[currentModel] || 2;
    const newRank = MODEL_COST_RANK[newModel] || 2;

    if (succeeded && newRank < currentRank) {
      cells[1] = newModel;
      cells[3] = today;
      cells[4] = `Downgraded from ${currentModel} — succeeded`;
    } else if (succeeded) {
      cells[3] = today;
    } else {
      const nextModel = getNextTierUp(newModel);
      if (nextModel && MODEL_COST_RANK[nextModel] > currentRank) {
        cells[1] = nextModel;
      }
      cells[3] = today;
      cells[4] = `Bumped from ${newModel} after failure`;
    }

    lines[i] = `| ${cells.join(" | ")} |`;
    break;
  }

  if (!found) {
    const table = parseLookupTable(lookupPath);
    let lastTableRow = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("|") && !lines[i].includes("Pattern") && !lines[i].includes("---")) {
        lastTableRow = i;
      }
    }
    if (lastTableRow >= 0) {
      const newRow = `| ${pattern} | ${newModel} | — | ${today} | Auto-added |`;
      lines.splice(lastTableRow + 1, 0, newRow);
    }
  }

  fs.writeFileSync(lookupPath, lines.join("\n"), "utf-8");
}

function getNextTierUp(model: string): string | null {
  const rank = MODEL_COST_RANK[model] || 0;
  const sorted = Object.entries(MODEL_COST_RANK).sort((a, b) => a[1] - b[1]);
  for (const [name, r] of sorted) {
    if (r > rank) return name;
  }
  return null;
}
