# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 foundation shipped. **KI-006 past-day job UX shipped** 2026-05-19. Phase 63 live. KI-004 core shipped.
- **Last shipped (2026-05-19):** Dossier cost-tuning update — `MODEL_DOSSIER.md` now recommends C2.5 first for low-risk T2 standard dev and points to hook-based scorecard sync.
- **Prior (2026-05-19):** issues-found **#13** composer overlap — `syncComposerClearance()` dynamically measures dock height. `ComposerClearance-2026-05-19`. Deployed + verified.
- **Prior (2026-05-19):** issues-found **#7** screen glitch — compile modal no longer overlays schedule (`ScreenGlitchFix7-2026-05-19` · `v=77`).
- **Prior (2026-05-19):** Compile-notes-first — `saveCompileCache` after every `compileNotes()` (`v=76`).
- **Prior (2026-05-19):** KI-006 UX polish — View Compiled Notes pinned; full date+time on historical bubbles (`v=75`).
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **User device verify:** issues-found **#13** — composer clearance (`BUILD: ComposerClearance-2026-05-19`).
- **Product queue:** use the updated dossier to start the next low-risk T2 task on **C2.5** first; escalate only if needed.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
