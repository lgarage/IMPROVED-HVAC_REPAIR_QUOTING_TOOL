/**
 * Smart model selector — reads MODEL_LOOKUP.md and picks the cheapest
 * safe model for a given set of task patterns.
 *
 * v2: Tracks verified/unverified status and cheapest-failed model per
 * pattern so the table learns downward over time instead of staying
 * stuck on optimistic guesses.
 *
 * v3: Per-model guard rails (MODEL_GUARDS) define capability ceilings
 * for every model — max riskLevel, max file count, forbidden patterns.
 * Auto-tightening writes learnings to model_guard_overrides.json so
 * guards improve after each run without touching source files.
 */

import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOOKUP_PATH = path.join(PROJECT_ROOT, "PROJECT_STATUS", "MODEL_LOOKUP.md");
const GUARD_OVERRIDES_PATH = path.join(__dirname, "model_guard_overrides.json");

// All slugs here must be verified against Cursor.models.list() output.
// Invalid slugs cause immediate SDK failure — do not add "-medium" or other
// invented suffixes. Verified 2026-05-16 from SDK error available-models list.
const MODEL_COST_RANK: Record<string, number> = {
  "composer-2": 2,
  "gpt-5.4-mini": 3,
  "gemini-3-flash": 4,
  "gpt-5-mini": 5,
  "composer-2.5": 6,           // verified SDK slug — after Mini/Flash; before Sonnet/Opus
  "gpt-5.3-codex-spark": 7,
  "claude-sonnet-4-6": 8,
  "kimi-k2.5": 9,
  "gpt-5.3-codex": 10,
  "gpt-5.2": 11,
  "gpt-5.4": 12,
  "gpt-5.5": 13,
  "claude-opus-4-6": 14,
};

/** Inserted before Sonnet/Opus on escalation — not before cheaper Fast-tier models. */
const COMPOSER_25_SLUG = "composer-2.5";

// ── Per-model capability guard rails ─────────────────────────────────────────
// maxRiskLevel: highest slice riskLevel this model is allowed to run.
// maxFiles:     max (filesToCreate + filesToModify) count before the guard fires.
// forbiddenPatterns: task patterns this model must never handle.
// Auto-tightening adds entries to model_guard_overrides.json after failures.
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelGuard {
  maxRiskLevel: "safe" | "review" | "critical";
  maxFiles: number;
  forbiddenPatterns: string[];
  notes: string;
}

export const MODEL_GUARDS: Record<string, ModelGuard> = {
  "composer-2": {
    maxRiskLevel: "safe",
    maxFiles: 4,
    forbiddenPatterns: [
      "Firestore write path (new collection/doc)",
      "Firestore rules / auth changes",
      "Firebase config / project migration",
      "Shadow Mode / Office Override",
      "Gemini prompt integration",
      "Cross-module wiring (3+ files)",
    ],
    notes: "T0-T1 mechanical. Known reasoning weakness — skip multi-step logic.",
  },
  "composer-2.5": {
    maxRiskLevel: "critical",
    maxFiles: 15,
    forbiddenPatterns: [
      "Firebase config / project migration",
      "Shadow Mode / Office Override",
    ],
    notes:
      "After Mini/Flash on escalation ladder; before Sonnet/Opus (dossier ~95% on admin/T2).",
  },
  "gpt-5.4-mini": {
    maxRiskLevel: "safe",
    maxFiles: 8,
    forbiddenPatterns: [
      "Firestore rules / auth changes",
      "Firebase config / project migration",
      "Shadow Mode / Office Override",
      "Gemini prompt integration",
    ],
    notes: "T0-T1. Read-only Firestore and single-file bugfixes OK.",
  },
  "gemini-3-flash": {
    maxRiskLevel: "safe",
    maxFiles: 6,
    forbiddenPatterns: [
      "Firestore write path (new collection/doc)",
      "Firestore rules / auth changes",
      "Firebase config / project migration",
      "Shadow Mode / Office Override",
      "Gemini prompt integration",
      "Cross-module wiring (3+ files)",
      "Multi-file UI feature (no Firestore writes)",
    ],
    notes: "T0-T1 only. Partial-completion risk on multi-item review slices — see 62b incident 2026-05-16 where it committed after completing 2/5 items and stopped.",
  },
  "gpt-5-mini": {
    maxRiskLevel: "review",
    maxFiles: 10,
    forbiddenPatterns: [
      "Firestore rules / auth changes",
      "Firebase config / project migration",
      "Shadow Mode / Office Override",
    ],
    notes: "T1 reasoning capable. Avoid all Vertex Core paths.",
  },
  "gpt-5.3-codex-spark": {
    maxRiskLevel: "review",
    maxFiles: 8,
    forbiddenPatterns: [
      "Firestore rules / auth changes",
      "Firebase config / project migration",
      "Shadow Mode / Office Override",
    ],
    notes: "Strong at regex/pure code. Avoid auth and tenant changes.",
  },
  "claude-sonnet-4-6": {
    maxRiskLevel: "review",
    maxFiles: 15,
    forbiddenPatterns: [
      "Firestore rules / auth changes",
      "Firebase config / project migration",
    ],
    notes: "T1-T2 daily driver. Avoid Vertex Core auth/config changes.",
  },
  "kimi-k2.5": {
    maxRiskLevel: "review",
    maxFiles: 12,
    forbiddenPatterns: [
      "Firestore rules / auth changes",
      "Firebase config / project migration",
      "Shadow Mode / Office Override",
    ],
    notes: "Experimental T2 alt. Treat conservatively until more verified rows exist.",
  },
  "gpt-5.3-codex": {
    maxRiskLevel: "review",
    maxFiles: 15,
    forbiddenPatterns: [
      "Firestore rules / auth changes",
      "Firebase config / project migration",
    ],
    notes: "T3 code-heavy. Avoid tenant/auth paths.",
  },
  "gpt-5.2": {
    maxRiskLevel: "review",
    maxFiles: 12,
    forbiddenPatterns: [
      "Firestore rules / auth changes",
      "Firebase config / project migration",
    ],
    notes: "T2-T3 capable.",
  },
  "gpt-5.4": {
    maxRiskLevel: "review",
    maxFiles: 12,
    forbiddenPatterns: [],
    notes: "T2-T3 capable.",
  },
  "gpt-5.5": {
    maxRiskLevel: "critical",
    maxFiles: 20,
    forbiddenPatterns: [],
    notes: "Strong reasoning. Suitable for critical-path work.",
  },
  "claude-opus-4-6": {
    maxRiskLevel: "critical",
    maxFiles: 20,
    forbiddenPatterns: [],
    notes: "Current ceiling. Vertex Core, tenant paths, field critical path.",
  },
};

// Risk level order for comparison
const RISK_ORDER: Record<string, number> = { safe: 0, review: 1, critical: 2 };

/** Read auto-tightened overrides from the JSON sidecar file. */
function loadGuardOverrides(): Record<string, Partial<ModelGuard>> {
  try {
    if (fs.existsSync(GUARD_OVERRIDES_PATH)) {
      return JSON.parse(fs.readFileSync(GUARD_OVERRIDES_PATH, "utf-8"));
    }
  } catch {
    // corrupt/missing — treat as empty
  }
  return {};
}

/**
 * Check if a model is allowed to run a given slice.
 * Merges base MODEL_GUARDS with any auto-tightened overrides.
 */
export function checkModelGuard(
  model: string,
  sliceRiskLevel: string,
  fileCount: number,
  patterns: string[]
): { allowed: boolean; reason: string } {
  const base = MODEL_GUARDS[model];
  const overrides = loadGuardOverrides();
  const over = overrides[model] || {};

  const maxRisk = over.maxRiskLevel ?? base?.maxRiskLevel ?? "critical";
  const maxFiles = over.maxFiles ?? base?.maxFiles ?? 99;
  const forbidden = [
    ...(base?.forbiddenPatterns ?? []),
    ...(over.forbiddenPatterns ?? []),
  ];

  const sliceRisk = RISK_ORDER[sliceRiskLevel] ?? 0;
  const ceilRisk = RISK_ORDER[maxRisk] ?? 2;

  if (sliceRisk > ceilRisk) {
    return {
      allowed: false,
      reason: `riskLevel "${sliceRiskLevel}" exceeds ${model} ceiling "${maxRisk}"`,
    };
  }

  if (fileCount > maxFiles) {
    return {
      allowed: false,
      reason: `${fileCount} files exceeds ${model} max (${maxFiles})`,
    };
  }

  for (const pattern of patterns) {
    if (forbidden.includes(pattern)) {
      return {
        allowed: false,
        reason: `pattern "${pattern}" is forbidden for ${model}`,
      };
    }
  }

  return { allowed: true, reason: "" };
}

/**
 * Auto-tighten: called after a model fails on a slice.
 * Records the failing pattern as forbidden for this model in the overrides file
 * once it has failed GUARD_FAILURE_THRESHOLD times.
 */
const GUARD_FAILURE_THRESHOLD = 2;

interface GuardOverrideEntry extends Partial<ModelGuard> {
  _failureCounts?: Record<string, number>;
  _notes_last_failure?: string;
}

export function recordModelGuardFailure(
  model: string,
  sliceId: string,
  patterns: string[],
  reason: string
): void {
  let overrides: Record<string, GuardOverrideEntry> = {};
  try {
    if (fs.existsSync(GUARD_OVERRIDES_PATH)) {
      overrides = JSON.parse(fs.readFileSync(GUARD_OVERRIDES_PATH, "utf-8"));
    }
  } catch { /* start fresh */ }

  if (!overrides[model]) overrides[model] = {};
  if (!overrides[model]._failureCounts) overrides[model]._failureCounts = {};

  for (const pattern of patterns) {
    const counts = overrides[model]._failureCounts!;
    counts[pattern] = (counts[pattern] || 0) + 1;

    if (counts[pattern] >= GUARD_FAILURE_THRESHOLD) {
      const existing = overrides[model].forbiddenPatterns || [];
      if (!existing.includes(pattern)) {
        overrides[model].forbiddenPatterns = [...existing, pattern];
        console.log(
          `  🔒 Guard auto-tightened: ${model} → added forbidden pattern "${pattern}" ` +
          `(failed ${counts[pattern]}x, last: slice ${sliceId})`
        );
      }
    }
  }

  overrides[model]._notes_last_failure = `slice ${sliceId}: ${reason} (${new Date().toISOString().slice(0, 10)})`;
  fs.writeFileSync(GUARD_OVERRIDES_PATH, JSON.stringify(overrides, null, 2), "utf-8");
}

/** Return merged guard for a model (base + overrides), for display/audit purposes. */
export function resolvedGuard(model: string): ModelGuard & { overrideActive: boolean } {
  const base = MODEL_GUARDS[model] ?? {
    maxRiskLevel: "critical" as const,
    maxFiles: 20,
    forbiddenPatterns: [],
    notes: "No guard defined — unrestricted.",
  };
  const overrides = loadGuardOverrides();
  const over = overrides[model] || {};
  return {
    maxRiskLevel: over.maxRiskLevel ?? base.maxRiskLevel,
    maxFiles: over.maxFiles ?? base.maxFiles,
    forbiddenPatterns: [...new Set([...base.forbiddenPatterns, ...(over.forbiddenPatterns ?? [])])],
    notes: base.notes,
    overrideActive: Object.keys(over).filter(k => !k.startsWith("_")).length > 0,
  };
}

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
  let bestModel = "gpt-5.4-mini";
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
    if (rank > baseRank && added < 3) {
      if (rank >= floorRank) {
        ladder.push(name);
        added++;
      }
    }
  }

  // Guarantee at least 4 rungs (base + 3 escalations) by adding the highest-ranked
  // distinct models we already know about. Never hard-code a possibly-missing slug.
  const sortedDesc = Object.entries(MODEL_COST_RANK)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  for (const name of sortedDesc) {
    if (ladder.length >= 4) break;
    if (!ladder.includes(name)) ladder.push(name);
  }

  return normalizeSdkLadder([...new Set(ladder)]);
}

/**
 * Cheapest-first order; C2.5 before Sonnet/Opus; Sonnet before Opus.
 * Does not prepend C2.5 ahead of Mini/Flash (cost policy 2026-05-18).
 */
function normalizeSdkLadder(ladder: string[]): string[] {
  const sonnet = "claude-sonnet-4-6";
  const opus = "claude-opus-4-6";
  const c25 = COMPOSER_25_SLUG;
  let out = [...new Set(ladder)];

  const maxRank = out.length
    ? Math.max(...out.map((m) => MODEL_COST_RANK[m] ?? 0))
    : 0;
  const sonnetRank = MODEL_COST_RANK[sonnet] ?? 99;

  // Ensure we can escalate past mid-tier to C2.5 → Sonnet → Opus when needed
  if (maxRank < sonnetRank) {
    if (MODEL_COST_RANK[c25] && !out.includes(c25)) out.push(c25);
    if (!out.includes(sonnet)) out.push(sonnet);
    if (!out.includes(opus)) out.push(opus);
  } else {
    const premIdx = out.findIndex((m) => m === sonnet || m === opus);
    if (premIdx >= 0 && MODEL_COST_RANK[c25] && !out.includes(c25)) {
      out.splice(premIdx, 0, c25);
    }
  }

  if (out.includes(opus) && !out.includes(sonnet)) {
    const i = out.indexOf(opus);
    out.splice(i, 0, sonnet);
  }

  out.sort((a, b) => (MODEL_COST_RANK[a] ?? 99) - (MODEL_COST_RANK[b] ?? 99));
  return [...new Set(out)];
}

export { MODEL_COST_RANK, COMPOSER_25_SLUG };
