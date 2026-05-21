# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Bug batch sprint (#29–#35 all shipped; background agent on #28, #32, #37–#39).
- **Last shipped (2026-05-21 ~15:30 CDT):** T2 bug batch: #29 compile modal z-index 11k (× tappable), #30 context bubble adds description + dispatch photos, #31 gantt text z-index+fit fix, #33 compact cards, #34 sidebar date-filtered, #35 Generate Invoice from AI report. Background agent (GPT-5.4 Mini) running T0 batch: #28 save closes modal, #32 data-id, #37-#38-#39 icebox F1-F3 nav hides.
- **Prior (2026-05-21 ~13:15 CDT):** Transparent header + chrome autocomplete off (#40) + icebox F1-F3 registry + ICEBOX_FUTURE_IMPROVEMENTS.md.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

Verify background agent T0 batch (#28, #32, #37–#39) completed and deployed. Then: on-device verify key changes — (1) compile modal × is tappable after opening a job, (2) first context bubble shows description + photos, (3) gantt day view shows clean text at rest, (4) sidebar cards are compact, (5) sidebar filters by board day.

> **On Deck / future ideas:** `ROADMAP.md` + **`ICEBOX_FUTURE_IMPROVEMENTS.md`**. Next pending: #36 customer info sync everywhere (Opus 4.6). Fix tracker: `canvases/bug-report-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
