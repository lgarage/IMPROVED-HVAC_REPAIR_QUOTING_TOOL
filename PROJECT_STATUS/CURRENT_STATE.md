# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Per-User Feature Toggles — Slices 1–4 fully shipped + deployed. Bootstrap admin live. Slice 5 post-MVP.
- **Last shipped (2026-05-07):** Slice4e — Persistent auth status badge in `.tool-header` (always visible top-right of System Settings heading; three states: 🔓 Not signed in / 👤 Signed in · name (no admin access) / ✅ Signed in as Administrator · email). Also fixed `shared/auth.js` `computeIsAdmin` bootstrap check — removed stale `emailVerified &&` guard that caused `VCAuth.isAdmin()` to return false after a valid sign-in. `VC_BUILD = "Slice4e-AuthStatusBadge-2026-05-07"`. GitHub Pages live at `lgarage.github.io/IMPROVED-HVAC_REPAIR_QUOTING_TOOL/`.
- **Prior (2026-05-06):** Slice4d — Auth bar UX polish.
- **Bootstrap admin configured (2026-05-06):** `dan.day@blackduckpartners.com` in `shared/config.js → bootstrapAdminEmails` + `firestore.rules → isBootstrapAdmin()` (email_verified check removed — bootstrap list is deploy-gated). Firebase Auth user created in `twin-pillars-app` project. Rules deployed via `firebase deploy --only firestore:rules`. Firebase CLI installed (`firebase-tools v15.16.0`), logged in as `dan.day@blackduckpartners.com`.
- **Prior (2026-05-06):** Slices 2–4 — `shared/user_entitlements.js`, Per-User toggle UI, `aiReportReviewer` gated end-to-end.
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

**Smoke-test Slice4e auth badge (just deployed):**
1. Open Settings → badge in heading row shows **🔓 Not signed in** (grey pill, top-right of "System Settings" title).
2. Sign in with `dan.day@blackduckpartners.com` → badge flips to **✅ Signed in as Administrator · dan.day@blackduckpartners.com** (green).
3. While signed in: "👤 Per-User Feature Access" → search a staff member → toggle a feature → Save.
4. Sign out → badge returns to grey.

**Next build candidates (pick one):**
- **Manage Admins UI** — grant/revoke `isAdmin` on roster docs from Settings (T2, **Sonnet 4.6**). No in-app way to make others admins yet. 📋 See `PROJECT_STATUS/PERMISSIONS_PLAN.md` (roles, tags, presets, slice order — decisions locked 2026-05-07).
- **Slice 5** — standalone `admin/index.html` + audit log. Re-gate → **Opus 4.6**.
- **KI-004** — offline photo outbox (`shared/offline_storage_outbox.js`). Re-gate → **Opus 4.6**.

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
