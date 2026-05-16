# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 62 complete. **Phase 63 slices authored** (Field Intelligence — Contextual Checklists).
- **Last shipped (2026-05-16):** **Phase 63 slice definitions** — 6 slices (63a–63f) authored in `tools/slices.ts` for Field Intelligence features: multi-trigger words, adaptive checklist reminders, experience-based prompting, photo auto-tie to equipment, post-compile equipment history write. No app code change — slices ready for SDK build runner.
- **Prior (2026-05-16):** Slack idea vault docs + Rolling background compile notes (Slice 62h) + Gemini 403 deep fix (62e–62g) + `MODEL_GUARDS` (62d).
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Run Phase 63 slices via SDK build runner** — `vertex` → `/a` to execute 63a–63f. 63a (multi-trigger UI) and 63e (photo auto-tie) have no dependencies and can run first. 63b→63c→63d chain sequentially. 63f depends on 63e.
- **Test Compile Notes on phone** — hard-refresh browser, add 3+ entries, wait 5 min, tap "Compile Notes" (should be instant or near-instant). Then add more entries and tap again to verify delta compile.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.