# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** None. Phase 34c on deck — full spec in `PHASE_34_HANDOFF.md → §3` (do not re-derive).
- **Last shipped (2026-04-27):** Phase 34b — `shared/repair_form_seeds.js?v=1` + admin button in `#fieldFormBuilderSection` + PIN-gated handler in `settings.js?v=17`. 9 idempotent seed templates (Service Call, Additional Diagnostic, Quoted Repair, Warranty Repair, Supply Fan / Condenser Fan / Gas Valve / Compressor / Refrigerant Leak). `index.html` `VC_BUILD = "Phase34b-2026-04-27"`. Dispatcher-only. Detail in `PROJECT_MAP.md → Build History → Phase 34b` and ship-summary in `PHASE_34_HANDOFF.md → §1.6`.
- **Also shipped (2026-04-26):** Phase 34a (form-builder schema + UI extension). Detail in `PROJECT_MAP.md → Build History → Phase 34a`.
- **Phase 33 verification** still pending on-device (smoke-tests a/b/c per `PHASE_34_HANDOFF.md → §2`); not blocking.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding is dead (per user 2026-04-25); lazy-migration bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`; sequenced behind 34 ship).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; ships as 33 follow-up patch).

## Immediate Next Step — Phase 34b on-device verification + Phase 34c kickoff

1. **Smoke-test Phase 34b** per the 6-item checklist in `PHASE_34_HANDOFF.md → §1.6 → "On-device smoke checklist"` (button visible, PIN gate, fresh-install batch creates 9, idempotent re-click reports 9 updated, user-edited template gets skipped, repair-type filter returns the right seed).
2. **On a fresh dispatcher session**, the very first time you visit Settings → Field Form & Checklist Builder, click 🌱 to seed the live tenant. That populates the dispatcher list with the 9 defaults so Phase 34c has something to render against.
3. **Then start Phase 34c** — full spec in `PHASE_34_HANDOFF.md → §3` (additional-repair accordion in the technician's Service Call panel; uses the Phase 34a `getTemplatesByRepairType` helper + the Phase 34b seeded templates). HIGH-risk, recommend Opus 4.7 escalation per `.cursorrules §6`.

## On Deck

- Phases **34c → 34d → 34e** — full specs in `PHASE_34_HANDOFF.md → §3 / §4 / §5` (do not re-derive).
- `ROADMAP.md → Next Up` — Command Map TV Mode, Field Inventory Truck Stock.
- `ROADMAP.md → Minor Tweaks & Polish` — KI-002 leftovers (B5/B6/B7, C1, C2, C4, E1, E3, E4); opportunistic only.
- `ROADMAP.md → Icebox` — `ticketClass` (Service vs Project) epic; ADR before code.
- Standing maintenance: Firestore rules for `portal_tokens` / `labor_logs`, optional short URL for Proof of Service, optional composite index for `labor_logs`, print/PDF chart timing, legacy `dispatcher/index.html` redirect-stub archive.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session, even if "no progress."
- When a phase ships: full detail goes into `PROJECT_MAP.md → Build History` (flip `[ ]` to `[v]`); keep only a one-line pointer here.
- When a blocker resolves: move entry from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Hard size cap:** if this file exceeds ~30 content lines, immediately migrate excess.
