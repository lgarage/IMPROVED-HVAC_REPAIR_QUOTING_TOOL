# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Per-User Feature Toggles (Slices 1–4 shipped; Slice 5 post-MVP; design in `DECISIONS.md → ADR-015`).
- **Last shipped (2026-05-06):** Slices 2–4 — `shared/user_entitlements.js` resolver (`VCUserEntitlements.has(featureId, userProfile)` — 4-step precedence: tenant ceiling → role jail → user override → tenant default; `vc:user-entitlements-changed` event; localStorage cold-boot cache); Dispatcher Settings "👤 Per-User Feature Access" section (user search, three-state Inherit/Force ON/Force OFF grid, admin sign-in card, save to `users/{docId}.featureOverrides`); `#scAiReportReviewerBtn` show/hide gated by `VCUserEntitlements.has("aiReportReviewer", ...)` + live re-sync on `vc:user-entitlements-changed`; `ai_report_reviewer.js?v=3` `openModal` guards via `isFeatureEnabled()`; `VC_BUILD = "Slice4-UserGate-aiReviewer-2026-05-06"`.
- **Prior (2026-05-06):** Slice 1 — Auth + Rules foundation. **Rules NOT auto-deployed** — add email to `isBootstrapAdmin()` + `bootstrapAdminEmails` then `firebase deploy --only firestore:rules`.
- **Prior (2026-05-06):** Customer Entitlements Platform (`shared/entitlements.js` + dispatcher Settings "Plan & Feature Entitlements" admin section); Inter-Office Feed re-gated by `vcHasFeature("interOfficeFeed")`; `VC_BUILD = "Gated-InterOffice-Feed-2026-05-06"` superseded by Slice 1 stamp above.
- **Prior (2026-05-02):** Phase **34e** — Site Intel **Field Access Notes** rename + **Access Photos** in the Site Intel modal (`technician/js/workspace_ui.js?v=11`). Detail in `PROJECT_MAP.md → Field Operations → Site Intel — Field Access Notes & Access Photos (Phase 34e)`.
- **Prior (2026-04-27):** 34a (form-builder schema), 34b (9 seed templates), 34c (`#acc-svc-repair` repair branching), 34d (`#acc-tstat-label` thermostat labeling). All in `PROJECT_MAP.md → Build History`.
- **Phase 33 verification** still pending on-device (smoke-tests a/b/c per former `PHASE_34_HANDOFF.md → §2`); not blocking.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding is dead (per user 2026-04-25); lazy-migration bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; now also covers Phase 34e access photos — same `firebase.storage().ref().put()` pattern).

## Immediate Next Step

Verify Slices 2–4 in browser (no deploy needed — no Firestore rules changed):
1. Dispatcher Settings → Admin tools → "👤 Per-User Feature Access" appears after PIN unlock.
2. Sign in as admin email → search a staff member → toggle feature → Save → `#scAiReportReviewerBtn` shows/hides live without reload.
3. Force OFF for your own profile → AI Reviewer button disappears; Force ON → reappears.
4. **Slice 5** (post-MVP, next): standalone `admin/index.html`. Re-gate → **Opus 4.7**.

Smoke-tests carried over (non-blocking): Phase 34e Field Access Notes on iPhone; Phase 33 Field-Add Equipment OCR on Vision Hub.

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
