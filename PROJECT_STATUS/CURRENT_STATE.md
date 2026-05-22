# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase B — Raw Notes → Quote Detection Pipeline shipped.
- **Last shipped (2026-05-21 ~21:45 CDT):** Fix #44 — Customer Directory: restored modal (nav-customers onclick reverted to openCustomerDirectory()), merged ticket-only customers (Acme HVAC, Playwright Test Co) into directory with "from tickets" badge. VC_BUILD → IndigoBook-2026-05-21c.
- **Prior (2026-05-21 ~21:40 CDT):** ChecklistChip-2026-05-21 — removed yellow reminder card, fixed Open button.
- **Prior (2026-05-21 ~21:30 CDT):** Fix #43 — Customer tab loading. VC_BUILD IndigoBook-2026-05-21b.
- **Prior (2026-05-21 ~21:20 CDT):** Checklist form 2-step unit onboarding (field_forms.js v10).
- **Prior (2026-05-21 ~20:45 CDT):** RTU context awareness (#42). Sonnet-no-gate rule.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

Hard-refresh dispatcher → confirm BUILD shows IndigoBook-2026-05-21c → click Customer Directory (address book icon) → modal should open → expect Planet Fitness with CST-6580 + Acme HVAC / Playwright Test Co with "from tickets" badge and their addresses.

> **On Deck / future ideas:** `ROADMAP.md` + **`ICEBOX_FUTURE_IMPROVEMENTS.md`**. Next pending: #36 customer info sync everywhere (Opus 4.6). Fix tracker: `canvases/bug-report-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
