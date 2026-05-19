# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 AI Quote Pipeline — **SDK ready tonight:** 5 slices queued (64a→64b→64c→64e→64d), preflight ✓, passed Phase 66 archived out of active queue. Phase 63 live. KI-004 core shipped.
- **Last shipped (2026-05-18 20:56:18 CDT):** SDK build runner completed 5 slice(s) at 2026-05-18 20:56:18 CDT. Passed: 64d, 64a, 64b, 64c, 64e.
- **Prior (2026-05-18):** Admin checklist cards + editor; admin full AI chat; debug overlay drag.
- **Prior (2026-05-18):** Admin workspace full AI (`VCAdminAgent` bypasses intent engine); admin job tech roster picker.
- **Prior (2026-05-18):** Admin job create assigned-tech dropdown loads full roster; voice search CRM numbers.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.
- **Immediate Next Step:** Test the deployed changes on device. Verify slices 64d, 64a, 64b, 64c, 64e work correctly in the field app. Check for regressions.

## Active Blocker

None.

## Immediate Next Step

- **Product queue:** **KI-006** past-day job UX (issues-found tracker **#5** next).
- **Tonight at bedtime only:** `cd tools` → `npm start` → `/a` (Phase 64 only). Cheapest eligible model first; **pattern Floor** skips doomed Mini/Flash (e.g. 64a starts at **composer-2.5**). Escalates on fail; each slice updates **`MODEL_LOOKUP.md`** + appends **`MODEL_DOSSIER.md`** (SDK automated row). Do not run before bed unless user asks.
- **After overnight run:** `.build_state.json` + runner log; reconcile what changed.
- **Optional:** KI-004 URL-patch on outbox drain; compiled report edit persistence.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
