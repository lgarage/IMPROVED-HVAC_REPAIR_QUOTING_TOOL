# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phase 39 — Unit Work Parser (Smart Unit Link). All 4 slices + Add Equipment from unmatched card shipped.
- **Last shipped (2026-05-09):** Equipment Hub photo consistency — blob URL optimistic inject so photos from "Add Additional Equipment" and UWP inline form appear immediately on hub cards/detail before Firebase Storage upload completes; `_pendingInjects` map preserves optimistic cards across async Firestore fetch; card-level thumbnails tap-to-expand lightbox; `equipment_manager.js?v=16`, `equipment_hub.js?v=15`, `unit_work_parser.js?v=10`; `VC_BUILD = "EHub-PhotoConsistency-2026-05-09"`.
- **Prior (2026-05-09):** Storage rules completed — 10 explicit prefix blocks, default deny; added missing `field_evidence/` + `service_call_addendums/` prefixes.
- **Prior (2026-05-09):** Storage rules scoped + Firebase Storage stub — `storage.rules` + `firebase.json`; **still requires Firebase Console → Storage → Get Started + `firebase deploy --only storage`.**
- **Prior (2026-05-09):** UWP photo upload fix, per-card OK button, Equipment photo previews + full-parity inline form, Equipment Hub card thumbnails — multiple slices shipped (see `PROJECT_MAP_HISTORY.md` for detail).
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding dead; bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; now also covers Phase 34e access photos — same `firebase.storage().ref().put()` pattern).

## Immediate Next Step

**⚠ Blocker — manual Firebase Console step required before photos work:**
1. Go to [console.firebase.google.com/project/twin-pillars-app/storage](https://console.firebase.google.com/project/twin-pillars-app/storage) → click **Get Started** → choose region (us-central1) → Done.
2. Then run: `firebase deploy --only storage` (from project root) to push the scoped `storage.rules`.
3. Hard-reload the field app → add equipment with photos → Equipment Hub should now show thumbnails.

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
