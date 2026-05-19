# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 foundation shipped. **KI-006 past-day job UX shipped** 2026-05-19. Phase 63 live. KI-004 core shipped.
- **Last shipped (2026-05-19):** KI-006 — past-day card tap, compiled report first, chat addendum with date stamps (`KI006-PastDayUX-2026-05-19`). Deployed + Playwright verified.
- **Prior (2026-05-19):** Status reconciliation — issues-found tracker + docs aligned to Slack/git.
- **Prior (2026-05-18 20:56:18 CDT):** Phase 64 SDK slices 64a–64e passed.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **User device verify:** KI-006 on physical iPhone — force-reload PWA, open yesterday job, confirm report-first + addendum chat flow.
- **Product queue:** issues-found tracker **#6** (historical edit matrix design) or **#11** (KI-009 May 19 Slack triage).
- **Optional:** Phase 64 quote/vendor device smoke-test; build-runner checklist items 3–5.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
