# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** None. Phase 34d on deck — full spec in `PHASE_34_HANDOFF.md → §4` (do not re-derive).
- **Last shipped (2026-04-27):** Phase 34c — `#acc-svc-repair` accordion in `technician/index.html` (between sections 2 & 3 of `#serviceSection`) wired by `field_forms.js?v=3`. Yes/No → multi-select repair-type pillbar (Supply Fan / Condenser Fan / Gas Valve / Compressor / Refrigerant Leak / Other) → per-type chip auto-resolves the Phase-34b seeded template via `getTemplatesByRepairType` (default-pref / lowest sortIndex), opens via `renderDynamicForm(tid, { triggeredBy: "repair_branch" })`, flips to "✓ Saved" on `vc:fieldFormSaved` event. Persists `additionalRepairNeeded` / `repairFormTypes[]` / `repairFormCustomLabel` / `repairFormStatus{}` onto `service_calls/{id}` via `setServiceCallMerged`. `openWorkspace` now broadcasts `vc:workspaceOpened` for hydration. `technician/index.html` `VC_BUILD = "Phase34c-2026-04-27"`. Detail in `PROJECT_MAP.md → Build History → Phase 34c`.
- **Also shipped:** Phase 34b (2026-04-27, dispatcher seeder), Phase 34a (2026-04-26, form-builder schema). Detail in `PROJECT_MAP.md → Build History`.
- **Phase 33 verification** still pending on-device (smoke-tests a/b/c per `PHASE_34_HANDOFF.md → §2`); not blocking.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding is dead (per user 2026-04-25); lazy-migration bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`; sequenced behind 34 ship).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; ships as 33 follow-up patch).

## Immediate Next Step — Phase 34c on-device verification + Phase 34d kickoff

1. **Smoke-test Phase 34c on the iPhone**: open a Service Call ticket → confirm sidebar BUILD chip reads `Phase34c-2026-04-27` → expand new "Additional repair (optional)" accordion (between Diagnostics & Repairs and Parts & Quote Info) → tap **No** → reload → state persists as collapsed → tap **Yes** → reveals the 6-pill grid → tap "Supply Fan" + "Compressor" → two chips render with "Open form" buttons (template names from Phase 34b seeds) → tap "Open form" on Supply Fan → fill required fields → Save → chip flips to green "✓ Saved" → reload page → state persists. Toggle "Other" → free-text input appears → type label → reload → label persists. Verify the dispatcher view of the same `service_calls/{id}` doc shows `additionalRepairNeeded: true`, `repairFormTypes: [...]`, `repairFormStatus: {...}` populated.
2. **Then start Phase 34d** — full spec in `PHASE_34_HANDOFF.md → §4` (thermostat labeling prompt at checkout; visible on all 3 job panels; soft-validation toast only — never a hard block). HIGH-risk, recommend Opus 4.7 escalation per `.cursorrules §6`.

## On Deck

- Phases **34d → 34e** — full specs in `PHASE_34_HANDOFF.md → §4 / §5` (do not re-derive).
- `ROADMAP.md → Next Up` — Command Map TV Mode, Field Inventory Truck Stock.
- `ROADMAP.md → Minor Tweaks & Polish` — KI-002 leftovers (B5/B6/B7, C1, C2, C4, E1, E3, E4); opportunistic only.
- `ROADMAP.md → Icebox` — `ticketClass` (Service vs Project) epic; ADR before code.
- Standing maintenance: Firestore rules for `portal_tokens` / `labor_logs`, optional short URL for Proof of Service, optional composite index for `labor_logs`, print/PDF chart timing, legacy `dispatcher/index.html` redirect-stub archive.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session, even if "no progress."
- When a phase ships: full detail goes into `PROJECT_MAP.md → Build History` (flip `[ ]` to `[v]`); keep only a one-line pointer here.
- When a blocker resolves: move entry from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Hard size cap:** if this file exceeds ~30 content lines, immediately migrate excess.
