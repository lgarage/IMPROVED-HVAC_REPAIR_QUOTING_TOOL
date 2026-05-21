# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Trust hardening sprint (pilot-readiness). KI-004 hooks + B6 SW cache shipped prior.
- **Last shipped (2026-05-21 ~12:30 CDT):** Fix compile-modal X → Schedule double-prompt bug. After user clicks "Not yet" on compile close prompt, nav guard no longer re-asks — `_navGuardBypassed = true` set on dismiss. `conversational_timeline.js?v=82`.
- **Prior (2026-05-21):** Trust hardening sprint COMPLETE (20 items). Commit `803b379`.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

On-device verify: force-reload PWA, open a job with compiled notes, click X → "Not yet" → then click Schedule — should go to schedule directly without a second "Unsent field report" prompt. Previously it showed a nav-guard sheet (double-prompt). Already deployed.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
