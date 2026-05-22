# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase B — Raw Notes → Quote Detection Pipeline shipped.
- **Last shipped (2026-05-21 ~21:30 CDT):** Fix #43 — Customer tab stuck on "Loading customers…". renderCustomersView + filterCustomersView were defined inside vcSettingsNav IIFE but never exposed globally; switchTab threw ReferenceError. Fixed: window.renderCustomersView + window.filterCustomersView added. VC_BUILD → IndigoBook-2026-05-21b. Deployed + verified via Playwright.
- **Prior (2026-05-21 ~21:20 CDT):** Checklist form 2-step unit onboarding (field_forms.js v10).
- **Prior (2026-05-21 ~21:10 CDT):** Smooth card reorder (service_call.js, index.html).
- **Prior (2026-05-21 ~21:20 CDT):** Checklist form 2-step unit onboarding (field_forms.js v10).
- **Prior (2026-05-21 ~21:10 CDT):** Smooth card reorder.
- **Prior (2026-05-21 ~20:45 CDT):** RTU context awareness (#42). "rt1"/"rt one" normalized. Sonnet-no-gate rule added.
- **Prior (2026-05-21 ~20:25 CDT):** Phase B quote pipeline.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

Test Customer tab fix (#43): hard-refresh dispatcher → confirm BUILD shows IndigoBook-2026-05-21b → click Customer Directory in left sidebar → cards should render (e.g. Planet Fitness with locations). Also test search box filters by name/address. Then verify prior task: checklist 2-step unit onboarding (see #42 notes).

> **On Deck / future ideas:** `ROADMAP.md` + **`ICEBOX_FUTURE_IMPROVEMENTS.md`**. Next pending: #36 customer info sync everywhere (Opus 4.6). Fix tracker: `canvases/bug-report-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
