# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Trust hardening sprint (pilot-readiness). KI-004 hooks + B6 SW cache shipped prior.
- **Last shipped (2026-05-21 ~12:55 CDT):** 4-issue bugfix: (1) PWA splash screen blocking login on homescreen — splash removed when login shell shows + manifest/meta tags added; (2) workspace header bleed-through — solid blurred background on header + site banner in ws-active mode; (3) supplemental history items cut off by composer — addendum section/timeline moved inside scroll container; (4) Schedule button verified working via Playwright.
- **Prior (2026-05-21):** Trust hardening sprint COMPLETE; compile-modal X → Schedule double-prompt fix; model-selection delegation rule.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

On-device verify: force-reload PWA, open a historical job → confirm (1) no content bleeds through header, (2) supplemental history entries don't go behind text box, (3) Schedule button navigates back from chat. Also test "Add to Home Screen" on iPhone — should show login instead of stuck spinner.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
