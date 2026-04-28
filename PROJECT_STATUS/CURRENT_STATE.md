# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** None.
- **Last shipped (2026-04-27):** Phase **34d** — Thermostat labeling accordion `#acc-tstat-label` in `technician/index.html` (single placement before shared Complete & Sync FAB; covers PM / Service / Quote). Pillbar + optional not-labeled reasons; persists via `VCFirestore.setServiceCallMerged`; soft toast + scroll on FAB if unset. `VC_BUILD = "Phase34d-2026-04-27"`. `equipment_smart_select.js?v=2` adds `data-unit-tag` on equipment options. Full spec: `PHASE_34_HANDOFF.md → §4`.
- **Prior (2026-04-27):** Phase 34c — `#acc-svc-repair` in `technician/index.html` wired by `field_forms.js?v=3`… (see `PROJECT_MAP.md → Build History → Phase 34c`).
- **Also shipped:** Phase 34b (2026-04-27, dispatcher seeder), Phase 34a (2026-04-26, form-builder schema). Detail in `PROJECT_MAP.md → Build History`.
- **Phase 33 verification** still pending on-device (smoke-tests a/b/c per `PHASE_34_HANDOFF.md → §2`); not blocking.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding is dead (per user 2026-04-25); lazy-migration bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`; sequenced behind 34 ship).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; ships as 33 follow-up patch).

## Immediate Next Step — Phase 34d on-device verification; then 34e when ready

1. **Smoke-test Phase 34d on iPhone** per on-device checklist in the 34d commit / handoff §4 (thermostat accordion, pills, Firestore fields, soft toast only).
2. **Phase 34e** on deck — `PHASE_34_HANDOFF.md → §5` (roof access + doc sync).

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
