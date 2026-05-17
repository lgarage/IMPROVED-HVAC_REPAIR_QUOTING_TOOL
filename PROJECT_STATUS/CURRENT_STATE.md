# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 (ChatGPT UI redesign). Phase 64 slices ready.
- **Last shipped (2026-05-17):** VC DEBUG overlay is now draggable — grab the "VC DEBUG" title and drag to any screen corner. Position persists in `sessionStorage`. `VC_BUILD: Phase65-DebugDrag-2026-05-17`.
- **Prior (2026-05-17):** Idea Tracker Slack sync. Phase65-ChatGPTUI (minimal nav, waveform mic). Phase65-SpacePolish.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Immediate Next Step:** Hard-refresh the field app on iPhone to get `Phase65-DebugDrag`. Grab "VC DEBUG" text and drag to a corner that doesn't block the dock. Verify: buttons (Copy, −/+) still work after dragging.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.