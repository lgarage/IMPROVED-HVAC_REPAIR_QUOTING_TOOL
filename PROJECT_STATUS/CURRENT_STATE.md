# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 61 complete. Phase 62 hygiene slices complete.
- **Last shipped (2026-05-16):** **Gemini 403 deep fix (Slice 62e)** — replaced all remaining hardcoded `gemini-2.5-flash` fallbacks with `gemini-2.0-flash` in `technician/index.html` and `workbench/`; cache-busted `firebase-config.js` v6→v7 in both HTML files; updated `PROJECT_MAP.md` + `AI_CONTEXT_PROJECT_OVERVIEW.md`. `VC_BUILD: Phase62-Slice62e-2026-05-16`.
- **Prior (2026-05-16):** **`tools/model_selector.ts` v3** — `MODEL_GUARDS` for all 14 models; `checkModelGuard()` enforced; `/guards` command; slice 62d (periodic audit).
- **Prior (2026-05-16):** Guard rail riskLevel floor (`RISK_LEVEL_FLOOR`) + slice 62b remaining scope fix.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Test Compile Notes on phone** to verify the 403 is gone (cache-bust v7 should force the fix).
- **Run the build runner** before leaving: `vertex` -> `/a` (to run remaining slices if any).
- **Future:** Re-tighten Firestore rules ONLY after implementing anonymous-auth or custom-token flow for field techs.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.