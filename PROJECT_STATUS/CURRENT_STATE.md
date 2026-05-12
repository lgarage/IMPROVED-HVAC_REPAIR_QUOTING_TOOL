# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phase 39 — Unit Work Parser (Smart Unit Link). All 4 slices + Add Equipment from unmatched card shipped.
- **Last shipped (2026-05-11):** Firebase/GCP migration complete — `twin-pillars-app` → `vertex-core-db` (personal account). All services live (Firestore, Storage/Blaze, Auth, Hosting, Gemini API, Maps). App loads at `https://vertex-core-db.web.app`. Tenant doc `tenants/USA_HEATING_COOLING` seeded. Residual permissions errors = empty DB reads, not a rules issue.
- **Prior (2026-05-09):** Equipment Hub photo consistency, Storage rules (10 prefix blocks), UWP photo upload fix, per-card OK, inline form parity, card thumbnails — multiple slices (see `PROJECT_MAP_HISTORY.md`).
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project migrated from `twin-pillars-app` → `vertex-core-db` (personal account).

## Active Blocker

**Migration 90% done — one console error remaining.** App is live at `https://vertex-core-db.web.app`, signed in, Maps working, Gemini key seeded, tenant doc created. Residual `FirebaseError: Missing or insufficient permissions` errors in console — likely from empty collections the app queries on boot (Customers, service_calls, etc.) that have no docs yet. Not a blocker for creating new data.

## Immediate Next Step

**⚠ Migration carry-over (resume next session):**
- App is live: `https://vertex-core-db.web.app` — sign in with the account created in Auth Console.
- Console still shows `Missing or insufficient permissions` on some reads — these are empty-collection reads on a fresh DB, not a rules bug. Verify by creating a test service call and confirming it saves cleanly.
- **Add technician roster:** Settings → Members → add at least one technician so field app can be assigned jobs.
- **Remaining optional:** data migration from `twin-pillars-app` (Firestore export/import + Storage gsutil rsync + Auth export/import) if historical data is needed. CLI commands in session transcript.
- Re-gate next build task before any code changes.

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
