# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 62 complete. **Phase 63 slices authored** (Field Intelligence — Contextual Checklists + Equipment Intelligence).
- **Last shipped (2026-05-16):** **Phase 63 slices 63g + 63h** added to `tools/slices.ts` — (63g) unit nameplate OCR via Gemini Vision → auto-populates model/serial/manufacturer on equipment record with confirmation gate; (63h) cross-job Equipment History view in Equipment Hub pulling from `site_intelligence`. Total Phase 63: 8 slices (63a–63h).
- **Prior (2026-05-16):** 63a–63f authored (multi-trigger words, adaptive checklists, experience-based prompting, photo auto-tie, post-compile history write) + Slice 63e shipped.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Run Phase 63 slices via SDK build runner** — `vertex` → `/a` to execute 63a–63h. 63a and 63e have no dependencies (run first). 63b→63c→63d chain. 63f depends on 63e. 63g depends on 63e. 63h depends on 63f + 63g.
- **Test Compile Notes on phone** — hard-refresh browser, add 3+ entries, wait 5 min, tap "Compile Notes" (should be instant or near-instant). Then add more entries and tap again to verify delta compile.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.