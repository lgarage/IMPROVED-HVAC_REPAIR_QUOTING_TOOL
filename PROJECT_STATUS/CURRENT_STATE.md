# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phase 39 — Unit Work Parser (Smart Unit Link). All 4 slices + Add Equipment from unmatched card shipped.
- **Last shipped (2026-05-11):** Firebase/GCP project migration — `twin-pillars-app` → `vertex-core-db` (personal account). Updated `firebase-config.js`, `.firebaserc`, CI workflow, `service_call.js` fallback. Manual steps remain (see Immediate Next Step).
- **Prior (2026-05-09):** Equipment Hub photo consistency, Storage rules (10 prefix blocks), UWP photo upload fix, per-card OK, inline form parity, card thumbnails — multiple slices (see `PROJECT_MAP_HISTORY.md`).
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project migrated from `twin-pillars-app` → `vertex-core-db` (personal account).

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; now also covers Phase 34e access photos — same `firebase.storage().ref().put()` pattern).

## Immediate Next Step

**⚠ Post-migration steps (vertex-core-db):**
1. Enable Storage in [console.firebase.google.com/project/vertex-core-db/storage](https://console.firebase.google.com/project/vertex-core-db/storage) → **Get Started** → choose region → Done.
2. Deploy rules: `firebase deploy --only firestore:rules,storage` (from project root).
3. Seed Firestore `app_config/api_keys` doc with `{ gemini: "YOUR_NEW_GEMINI_KEY" }`.
4. Enable **Generative Language API** + **Maps JavaScript API** in GCP Console for `vertex-core-db`.
5. Update GitHub secret `FIREBASE_SERVICE_ACCOUNT_JSON` with new project's service account key.
6. Run data migration (Firestore export/import, Storage rsync, Auth export/import) — see migration commands below.

**Next build candidates (pick one):**
- **KI-004** — offline photo outbox (`shared/offline_storage_outbox.js`, ADR-012). Re-gate → **Sonnet 4.6**.
- **KI-003** — Live Workspace Mirror / Office Override iframe parity (ADR-013). Re-gate → **Codex 5.3**.
- **Phase 39 follow-up** — cross-unit search (query `work_history` across all units for keyword). Re-gate → **Sonnet 4.6**.

Smoke-tests carried over (non-blocking): Phase 34e Field Access Notes on iPhone; Phase 33 Field-Add Equipment OCR on Vision Hub.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
