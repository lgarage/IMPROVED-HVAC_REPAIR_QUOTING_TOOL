# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 (ChatGPT UI redesign). Phase 64 slices ready.
- **Last shipped (2026-05-17):** Header & Composer polish — normalized header pills (DAN D, Schedule) to shared 34px height/999px radius/dark-solid style; styled `+` attachment button to match "Message Vertex" pill (dark-solid background + blur + border). `VC_BUILD: Phase65-PillPolish-2026-05-17`.
- **Prior (2026-05-17):** HeaderV7 — floating pill chrome: `app-top-shell` + workspace nav both `position:fixed` on workspace (`body.ws-active`), transparent background, all elements (DAN D, Schedule, PLANET FITNESS, ···, +, input, mic) are independent solid pills over transparent chrome. `VC_BUILD: Phase65-HeaderV7-2026-05-17`.
- **Prior (2026-05-17):** VC DEBUG draggable. Mic SVG icon. Phase65-ChatGPTUI.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Immediate Next Step:** Field-test HeaderV7 on iPhone — scroll chat messages upward past the PLANET FITNESS pill and DAN D/Schedule row to verify messages are visible behind the transparent chrome. Phase 64 slices (64a–64e) in `tools/slices.ts` ready to run via SDK build runner.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.