# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 foundation shipped. **KI-006 past-day job UX shipped** 2026-05-19. Phase 63 live. KI-004 core shipped.
- **Last shipped (2026-05-19):** issues-found **#7** screen glitch — compile modal no longer overlays schedule after leaving workspace (`onWorkspaceClose` → `closeCompileModal` + paint-gen cancel for stale auto-open). `ScreenGlitchFix7-2026-05-19` · `conversational_timeline.js?v=77`. Deployed.
- **Prior (2026-05-19):** Compile-notes-first — `saveCompileCache` after every `compileNotes()`; `submitted` cache flag (`v=76`).
- **Prior (2026-05-19):** KI-006 UX polish — View Compiled Notes pinned; compiled report opens first; × dismisses to addendum chat; full date+time on historical bubbles (`KI006-PastDayUX4-2026-05-19`, `v=75`).
- **Prior (2026-05-19):** KI-006 initial past-day card tap + addendum flow.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **User device verify:** issues-found **#7** — open job with compile modal visible → tap Schedule → schedule must show with no compile overlay (`BUILD: ScreenGlitchFix7-2026-05-19`).
- **Product queue:** tracker **#6** (historical edit matrix) or **#11** (KI-009 triage) or **#13** (composer overlap).
- **Optional:** Phase 64 quote/vendor device smoke-test; build-runner checklist items 3–5.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
