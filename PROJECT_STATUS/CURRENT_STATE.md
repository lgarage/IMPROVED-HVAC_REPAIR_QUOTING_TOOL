# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 66 (Admin Conversational Checklist Builder) — **deployed** overnight (66a–66d all passed via SDK runner). Phase 65/63/64 live.
- **Last shipped (2026-05-18):** Fixes #1–#3 from phase66-fix-tracker deployed. Init brace (Fix #1), compile modal screen guard (Fix #2), full checklist on first equipment mention (Fix #3). All committed and pushed to Firebase.
- **Prior (2026-05-17):** SDK Playwright auto-verify; bug/speed fixes; Gemini JSON parse; Sync Ticket; nav guard; Header/Composer polish.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None. Fixes #1–#3 deployed. Remaining tracker items (#4 historical edit design, #5 admin job creation T3, #6 Phase 66 test pass) are non-blocking.

## Immediate Next Step

- **Remaining canvas items** — see `canvases/phase66-fix-tracker.canvas.tsx`. #4 (historical job editing, design discussion) and #5 (admin job creation, T3/Opus 4.6) are next. #6 is a manual test pass — try the admin login + checklist builder flow on device now that #1–#3 are live.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the NEXT session should do — not what this session just completed. Ask yourself: "If a fresh agent reads only this file, will it do the right thing?" If no, rewrite.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.


