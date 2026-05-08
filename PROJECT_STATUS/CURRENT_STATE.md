# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Equipment Hub UX polish + AI memory system optimization complete. Next: pick from build candidates below.
- **Last shipped (2026-05-08):** Field app workspace hamburger — renamed "Site Intel" → "Site Notes"; new "Add additional equipment" menu item wired to `openAddEquipmentDirect()` exported from `equipment_hub.js?v=10`. `VC_BUILD = "Phase34t-2026-05-08"`. Also completed: AI memory system audit — Feature Index added to `PROJECT_MAP.md`, Build History split to `PROJECT_MAP_HISTORY.md`, KI-002 archived to `KNOWN_ISSUES_ARCHIVE.md`, tier quick card added to `MODEL_DOSSIER.md`, ADR index added to `DECISIONS.md`, ROADMAP compressed.
- **Prior (2026-05-07):** Members pane in Settings (search/list/editor, `tenants/{tid}/users` CRUD); Manage Admins UI (grant/revoke isAdmin); Settings inner sidebar nav + pane switching; Auth status badge in `.tool-header`; `shared/auth.js` `emailVerified` bootstrap fix. `VC_BUILD = "Slice4e-AuthStatusBadge-2026-05-07"`.
- **Prior (2026-05-06):** Slices 1–4 Per-User Feature Toggles shipped; bootstrap admin `dan.day@blackduckpartners.com` configured + rules deployed.
- **Prior (2026-05-02):** Phase 34e — Site Intel Access Photos + Field Access Notes rename. Phase 33 on-device verification still pending (non-blocking).
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding dead; bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; now also covers Phase 34e access photos — same `firebase.storage().ref().put()` pattern).

## Immediate Next Step

**Next build candidates (pick one):**
- **Equipment Hub UX** — additional polish (on-device verification of hamburger menu items, photo thumbnails, lightbox). T2, **Sonnet 4.6**.
- **Slice 5** — standalone `admin/index.html` + audit log. Re-gate → **Opus 4.6**.
- **KI-004** — offline photo outbox (`shared/offline_storage_outbox.js`, ADR-012). Re-gate → **Sonnet 4.6**.
- **KI-003** — Live Workspace Mirror / Office Override iframe parity (ADR-013). Re-gate → **Codex 5.3**.

Smoke-tests carried over (non-blocking): Phase 34e Field Access Notes on iPhone; Phase 33 Field-Add Equipment OCR on Vision Hub.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
