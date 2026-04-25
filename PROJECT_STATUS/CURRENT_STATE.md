# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** None.
- **Last shipped (2026-04-25):** Phases 31–32c + KI-002 Plans A / B(B1–B4) / C3 / E2 + Phase 33 (Field-Add Equipment, awaiting on-device verification). Per-commit + per-file detail in `PROJECT_MAP.md → Build History`.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding is dead (per user 2026-04-25); lazy-migration bridge in `shared/firebase_logic.js` left quiet (no live consumers).

## Active Blocker

None. Two non-blocking follow-ups against Phase 33 in `KNOWN_ISSUES.md → Open`:

- `KI-003` — Office Override iframe parity gap (Phase 34 design locked 2026-04-25 in `DECISIONS.md → ADR-013`; implementation sequenced behind Phase 33 verify + KI-004 follow-up).
- `KI-004` — Field-app photo uploads dropped offline (audit-only; ships as a Phase 33 follow-up patch per user 2026-04-25; design in `DECISIONS.md → ADR-012`).

## Immediate Next Step — Phase 33 on-device verification

Build order + per-commit detail in `DECISIONS.md → ADR-011` and `PROJECT_MAP.md → Build History → Phase 33`. On next iPhone + dispatcher touch:

- **Build stamps:** tech debug overlay top line = `BUILD: Phase33-2026-04-25`; dispatcher sidebar chip = `BUILD Phase33-2026-04-25 · fb v2`.
- **Smoke-test (a):** single-field Vision Hub correction stays sticky after reload.
- **Smoke-test (b):** re-importing CSV does NOT clobber field-edited fields (per-field `fieldEdits` guard in `dispatcher/js/import_hub.js`).
- **Smoke-test (c):** brand-new field-added unit appears in dispatcher Equipment Hub via the bridge.

Once a/b/c pass: flip Phase 33 in `PROJECT_MAP.md → Build History` from `[ ]` to `[v]`, pick next from `ROADMAP.md → Next Up` (Command Map TV Mode or Field Inventory Truck Stock), then ship the KI-004 follow-up patch under `VC_BUILD = "Phase33-followup-<date>"` (smoke-tests d/e per ADR-012).

## On Deck

- `ROADMAP.md → Next Up` — next phase candidates.
- `ROADMAP.md → Minor Tweaks & Polish` — KI-002 leftovers (B5/B6/B7, C1, C2, C4, E1, E3, E4); opportunistic only, none field-impact.
- `ROADMAP.md → Icebox` — `ticketClass` (Service vs Project) epic; architectural, ADR before code.
- Standing maintenance threads (Firestore rules for `portal_tokens` / `labor_logs`, optional short URL for Proof of Service, optional composite index for `labor_logs`, print/PDF chart timing, legacy `dispatcher/index.html` redirect-stub archive).

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session, even if "no progress."
- When a phase ships: full detail goes into `PROJECT_MAP.md → Build History` (flip `[ ]` to `[v]`); keep only a one-line pointer here.
- When a blocker resolves: move entry from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Hard size cap:** if this file exceeds ~30 content lines, immediately migrate excess.
