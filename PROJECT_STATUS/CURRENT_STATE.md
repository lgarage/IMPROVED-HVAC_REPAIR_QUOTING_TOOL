# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** None. Phase 34 fully shipped (34a/b/c/d/e).
- **Last shipped (2026-05-02):** Phase **34e** — Site Intel **Field Access Notes** rename (was "Field Bible") + **Access Photos** in the Site Intel modal (`technician/js/workspace_ui.js?v=11`; new `accessPhotoUrls[]` + `accessPhotoUpdatedAt` on `site_intelligence/{siteDocId}`). `VC_BUILD = "Phase34e-2026-05-02"`. ADR-014 appended (form_templates stays at root; tenant scoping deferred). `PHASE_34_HANDOFF.md` deleted. Detail in `PROJECT_MAP.md → Field Operations → Site Intel — Field Access Notes & Access Photos (Phase 34e)`.
- **Prior (2026-04-27):** 34a (form-builder schema), 34b (9 seed templates), 34c (`#acc-svc-repair` repair branching), 34d (`#acc-tstat-label` thermostat labeling). All in `PROJECT_MAP.md → Build History`.
- **Phase 33 verification** still pending on-device (smoke-tests a/b/c per former `PHASE_34_HANDOFF.md → §2`); not blocking.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding is dead (per user 2026-04-25); lazy-migration bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; now also covers Phase 34e access photos — same `firebase.storage().ref().put()` pattern).

## Immediate Next Step — Phase 33 verification, then user-picks-from-On-Deck

1. **Smoke-test Phase 34e on iPhone** — open Site Intel modal: confirm "Field Access Notes" label, capture a photo with rear camera (or pick a file), verify thumbnail + caption editor + delete button render correctly, confirm Firestore `site_intelligence/{siteDocId}.accessPhotoUrls` is populated.
2. **Phase 33 on-device verification** — Field-Add Equipment OCR smoke-tests (`PROJECT_MAP.md → Phase 33`). Use Vision Hub: capture nameplate photo → verify OCR fills manufacturer / model / serial / capacity (BTU / tons), edit Unit ID, save, confirm `tenants/{tenantId}/imported_equipment/{docId}` write + nameplate photo at `tenants/{tenantId}/imported_equipment_photos/{customerId}/{siteId}/{unitTag}/nameplate-{ts}.{ext}`.
3. After Phase 33 confirms: pick next from **On Deck** below.

## On Deck

- `ROADMAP.md → Next Up` — Command Map TV Mode, Field Inventory Truck Stock.
- `KI-004` follow-up patch (offline photo outbox per ADR-012) — picks up access photos from Phase 34e too.
- `KI-003` — Office Override iframe parity (Phase 34 candidate per ADR-013).
- `ROADMAP.md → Minor Tweaks & Polish` — KI-002 leftovers (B5/B6/B7, C1, C2, C4, E1, E3, E4); opportunistic only.
- `ROADMAP.md → Icebox` — `ticketClass` (Service vs Project) epic; ADR before code.
- Standing maintenance: Firestore rules for `portal_tokens` / `labor_logs`, optional short URL for Proof of Service, optional composite index for `labor_logs`, print/PDF chart timing, legacy `dispatcher/index.html` redirect-stub archive.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session, even if "no progress."
- When a phase ships: full detail goes into `PROJECT_MAP.md → Build History` (flip `[ ]` to `[v]`); keep only a one-line pointer here.
- When a blocker resolves: move entry from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Hard size cap:** if this file exceeds ~30 content lines, immediately migrate excess.
