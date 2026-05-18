# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 66 (Admin Conversational Checklist Builder) slices queued. Phase 65/63/64 live.
- **Last shipped (2026-05-17):** SDK build runner Playwright auto-verify — `uiChange?: boolean` on `Slice` interface; runner takes BEFORE screenshot before SDK agent fires + AFTER screenshot from preview URL on pass, then calls `gpt-5.4-mini` to compare and report PASS/FAIL. Non-blocking. Phase 66 slices (66a–66d) authored with `uiChange: true` on 66a, 66b, 66d.
- **Prior (2026-05-17):** Bug + speed fixes (schedule show-all, compile cache); Phase 66 slices authored; Gemini JSON parsing fix; Sync Ticket fields wired; nav guard; Header/Composer polish.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

**Fix tracker canvas:** `canvases/phase66-fix-tracker.canvas.tsx` — 6 tracked issues from overnight SDK run. Fix #1 (missing `}` in init) is a production blocker. Read the canvas for exact file/line/before/after details. Work items one at a time; wait for user go-ahead between each.

## Immediate Next Step

- **Immediate Next Step:** Run Phase 66 slices via SDK build runner (`vertex` → `/a`). Start with 66a (admin PIN gate) → 66b (Admin Agent) → 66c (save) → 66d (preview). Each is `review` risk except 66d (safe). Verify 66c Firestore write in Firebase Console after run.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.


