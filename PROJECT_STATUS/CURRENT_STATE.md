# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phase 39 — Unit Work Parser (Smart Unit Link). All 4 slices shipped.
- **Last shipped (2026-05-09):** Phase 39 — "Parse & Link to Equipment" button in field workspace; Gemini-powered per-unit notes extraction; confirmation card overlay with thumbnails; Firestore `work_history` subcollection writes; Equipment Hub timeline shows parsed field notes (indigo badge); Equipment Hub search/filter by unit tag/brand/model; offline guard + dedup. `unit_work_parser.js?v=1`, `equipment_hub.js?v=12`, `VC_BUILD = "UnitWorkParser-Slice1-2026-05-09"`.
- **Prior (2026-05-09):** Equipment Hub full unit history (5 collections); OCR revert to client-side Gemini.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding dead; bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; now also covers Phase 34e access photos — same `firebase.storage().ref().put()` pattern).

## Immediate Next Step

**Deploy and test on phone:** hard-reload the field app → open any SERVICE job → type findings mentioning a unit (e.g. "RTU-1 compressor short-cycling") → tap "Parse & Link to Equipment" button below the recommendations field → verify the confirmation card shows the correct unit thumbnail + tag + extracted work summary → tap "Confirm All" → open Equipment Hub → tap that unit card → timeline should show an indigo "Parsed field notes" entry with the extracted text. Also test the search bar at the top of the equipment list.

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
