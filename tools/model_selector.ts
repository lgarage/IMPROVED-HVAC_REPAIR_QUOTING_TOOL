/**
 * Smart model selector — reads MODEL_LOOKUP.md and picks the cheapest
 * safe model for a given set of task patterns.
 *
 * v2: Tracks verified/unverified status and cheapest-failed model per
 * pattern so the table learns downward over time instead of staying
 * stuck on optimistic guesses.
 */

import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOOKUP_PATH = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_LOOKUP.md");

const MODEL_COST_RANK: Record<string, number> = {
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
  cheapestFailed: string;
  floor: string;
  verified: boolean;
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
    if (cells.length < 6) continue;
    rows.push({
      pattern: cells[0],
      cheapestOk: cells[1],
      cheapestFailed: cells[2] === "—" || cells[2] === "" ? "" : cells[2],
      floor: cells[3] === "—" || cells[3] === "" ? "" : cells[3],
      verified: cells[4] === "yes",
      lastVerified: cells[5],
      notes: cells[6] || "",
    });
  }
  return rows;
}

export function selectModel(taskPatterns: string[]): string {
  const table = parseLookupTable();
  let bestModel = "composer-2";
  let bestRank = 0;

  for (const pattern of taskPatterns) {
    const row = table.find((r) => r.pattern === pattern);
    if (!row) {
      if (MODEL_COST_RANK["claude-sonnet-4-6"] > bestRank) {
        bestModel = "claude-sonnet-4-6";
        bestRank = MODEL_COST_RANK["claude-sonnet-4-6"];
      }
      continue;
    }

    // Floor is a hard minimum (Vertex Core safety rules etc.)
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
    if (cells.length < 6 || cells[0] !== pattern) continue;

    found = true;
    const currentOk = cells[1];
    const currentFailed = cells[2] === "—" ? "" : cells[2];
    const isVerified = cells[4] === "yes";

    const currentOkRank = MODEL_COST_RANK[currentOk] || 2;
    const newRank = MODEL_COST_RANK[newModel] || 2;
    const failedRank = currentFailed ? (MODEL_COST_RANK[currentFailed] || 0) : 0;

    if (succeeded) {
      if (!isVerified) {
        if (newRank <= currentOkRank) {
          // Passed at or below the unverified guess — verify it
          cells[1] = newModel;
          cells[4] = "yes";
          cells[6] = `Verified: ${newModel} passed`;
        }
        // If passed at a MORE expensive model (other patterns forced the
        // ladder up), keep the unverified guess — it might still work at
        // that cheaper level. Just update the date.
      } else if (newRank < currentOkRank) {
        cells[1] = newModel;
        cells[6] = `Downgraded from ${currentOk} — ${newModel} succeeded`;
      }
      cells[5] = today;
    } else {
      // ── Failure path ──
      // Record the most expensive model that failed for this pattern
      if (!currentFailed || newRank > failedRank) {
        cells[2] = newModel;
      }

      if (!isVerified && currentOkRank <= newRank) {
        // Unverified guess is at or below a model that actually failed.
        // Ratchet cheapestOk up to one tier above the failure.
        const next = getNextTierUp(newModel);
        if (next) {
          cells[1] = next;
          cells[6] = `Ratcheted from ${currentOk} — ${newModel} failed`;
        }
      } else if (isVerified && newModel === currentOk) {
        // The exact model that was verified just failed on a different
        // slice. Mark as unverified so the next pass re-verifies.
        cells[4] = "no";
        cells[6] = `De-verified: ${currentOk} failed (may be context-dependent)`;
      }
      cells[5] = today;
    }

    lines[i] = `| ${cells.join(" | ")} |`;
    break;
  }

  if (!found) {
    const table = parseLookupTable();
    const verifiedStr = succeeded ? "yes" : "no";
    const okModel = succeeded ? newModel : (getNextTierUp(newModel) || newModel);
    const failedStr = succeeded ? "—" : newModel;

    if (table.length >= 50) {
      let oldestIdx = -1;
      let oldestDate = "9999-99-99";
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith("|") || lines[i].includes("Pattern") || lines[i].includes("---")) continue;
        const cells = lines[i].split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 6 && cells[5] < oldestDate) {
          oldestDate = cells[5];
          oldestIdx = i;
        }
      }
      if (oldestIdx >= 0) {
        lines[oldestIdx] = `| ${pattern} | ${okModel} | ${failedStr} | — | ${verifiedStr} | ${today} | Auto-added, replaced stale row |`;
      }
    } else {
      let lastTableRow = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("|") && !lines[i].includes("Pattern") && !lines[i].includes("---")) {
          lastTableRow = i;
        }
      }
      if (lastTableRow >= 0) {
        const newRow = `| ${pattern} | ${okModel} | ${failedStr} | — | ${verifiedStr} | ${today} | Auto-added |`;
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
 * Respects floor constraints and cheapestFailed from all matched patterns.
 */
export function buildEscalationLadder(taskPatterns: string[]): string[] {
  const base = selectModel(taskPatterns);
  const baseRank = MODEL_COST_RANK[base] || 1;

  const table = parseLookupTable();
  let floorRank = 0;
  for (const pattern of taskPatterns) {
    const row = table.find((r) => r.pattern === pattern);
    if (row?.floor) {
      const fr = MODEL_COST_RANK[row.floor] || 0;
      if (fr > floorRank) floorRank = fr;
    }
    // Also respect cheapestFailed as a soft floor — don't start below it
    if (row?.cheapestFailed) {
      const cfr = MODEL_COST_RANK[row.cheapestFailed] || 0;
      if (cfr >= baseRank && cfr > floorRank) {
        floorRank = cfr;
      }
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

export { MODEL_COST_RANK };
