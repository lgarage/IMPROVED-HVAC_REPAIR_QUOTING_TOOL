/**
 * Smart model selector — reads MODEL_LOOKUP.md and picks the cheapest
 * safe model for a given set of task patterns.
 */

import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOOKUP_PATH = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_LOOKUP.md");

const MODEL_COST_RANK: Record<string, number> = {
  "composer-2": 1,
  "claude-4.6-sonnet": 2,
  "gpt-5.3-codex": 3,
  "gpt-5.2": 4,
  "gpt-5.4-medium": 5,
  "gpt-5.5-medium": 6,
  "claude-4.6-opus": 7,
};

export interface LookupRow {
  pattern: string;
  cheapestOk: string;
  floor: string;
  lastVerified: string;
  notes: string;
}

export function parseLookupTable(): LookupRow[] {
  const raw = fs.readFileSync(LOOKUP_PATH, "utf-8");
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

export function selectModel(taskPatterns: string[]): string {
  const table = parseLookupTable();
  let bestModel = "composer-2";
  let bestRank = 1;

  for (const pattern of taskPatterns) {
    const row = table.find((r) => r.pattern === pattern);
    if (!row) {
      // Unknown pattern — default to Sonnet as safe middle ground
      if (MODEL_COST_RANK["claude-4.6-sonnet"] > bestRank) {
        bestModel = "claude-4.6-sonnet";
        bestRank = MODEL_COST_RANK["claude-4.6-sonnet"];
      }
      continue;
    }

    // Apply floor first (hard minimum, never lower)
    if (row.floor) {
      const floorRank = MODEL_COST_RANK[row.floor] || 2;
      if (floorRank > bestRank) {
        bestModel = row.floor;
        bestRank = floorRank;
      }
    }

    // Apply cheapest known-good model
    const okRank = MODEL_COST_RANK[row.cheapestOk] || 2;
    if (okRank > bestRank) {
      bestModel = row.cheapestOk;
      bestRank = okRank;
    }
  }

  return bestModel;
}

export function updateLookupRow(
  pattern: string,
  newModel: string,
  succeeded: boolean
): void {
  const raw = fs.readFileSync(LOOKUP_PATH, "utf-8");
  const lines = raw.split("\n");
  const today = new Date().toISOString().slice(0, 10);
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("|") || lines[i].includes("Pattern") || lines[i].includes("---")) continue;
    const cells = lines[i].split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4 || cells[0] !== pattern) continue;

    found = true;
    const currentModel = cells[1];
    const floor = cells[2];
    const currentRank = MODEL_COST_RANK[currentModel] || 2;
    const newRank = MODEL_COST_RANK[newModel] || 2;

    if (succeeded && newRank < currentRank) {
      // Cheaper model worked — update to cheaper
      cells[1] = newModel;
      cells[3] = today;
      cells[4] = `Downgraded from ${currentModel} — succeeded`;
    } else if (succeeded) {
      // Same or pricier model worked — just update date
      cells[3] = today;
    } else {
      // Failed — bump up to next tier
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
    // New pattern — add row (respect 50 row cap)
    const table = parseLookupTable();
    if (table.length >= 50) {
      // Find oldest row and replace it
      let oldestIdx = -1;
      let oldestDate = "9999-99-99";
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith("|") || lines[i].includes("Pattern") || lines[i].includes("---")) continue;
        const cells = lines[i].split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 4 && cells[3] < oldestDate) {
          oldestDate = cells[3];
          oldestIdx = i;
        }
      }
      if (oldestIdx >= 0) {
        lines[oldestIdx] = `| ${pattern} | ${newModel} | — | ${today} | Auto-added, replaced stale row |`;
      }
    } else {
      // Find the last table row and append after it
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
  }

  fs.writeFileSync(LOOKUP_PATH, lines.join("\n"), "utf-8");
}

function getNextTierUp(model: string): string | null {
  const rank = MODEL_COST_RANK[model] || 0;
  const sorted = Object.entries(MODEL_COST_RANK).sort((a, b) => a[1] - b[1]);
  for (const [name, r] of sorted) {
    if (r > rank) return name;
  }
  return null;
}

/**
 * Build the escalation ladder for a slice: cheapest pick → next tier → next tier.
 * Respects floor constraints from all matched patterns.
 */
export function buildEscalationLadder(taskPatterns: string[]): string[] {
  const base = selectModel(taskPatterns);
  const baseRank = MODEL_COST_RANK[base] || 1;

  // Find the hard floor across all patterns
  const table = parseLookupTable();
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

  // Add next two tiers above the base
  let added = 0;
  for (const [name, rank] of sorted) {
    if (rank > baseRank && added < 2) {
      // Never go below floor
      if (rank >= floorRank) {
        ladder.push(name);
        added++;
      }
    }
  }

  // If we couldn't add 2 escalation steps (base was already near top), pad with ceiling
  while (ladder.length < 3) {
    ladder.push("claude-4.6-opus");
  }

  // Deduplicate
  return [...new Set(ladder)];
}

export { MODEL_COST_RANK };
