# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Equipment Hub full unit history. Next: on-device test.
- **Last shipped (2026-05-09):** Equipment Hub unit history now queries **all 5 collections** — `service_calls`, `pm_records`, `field_quotes`, `completed_reports`, `field_form_submissions`. Queries run in parallel via `Promise.all`. Timeline renders completed reports (green badge, status, full report text) and custom form submissions (purple badge, field values). `equipment_hub.js?v=11`, `VC_BUILD = "EquipHubFullHistory-2026-05-09"`.
- **Prior (2026-05-09):** OCR reverted to direct client-side Gemini API call (Cloud Functions blocked by GCP org policy).
- **Prior (2026-05-08):** Schedule fast-boot b, Shadow consent gate race fix.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding dead; bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; now also covers Phase 34e access photos — same `firebase.storage().ref().put()` pattern).

## Immediate Next Step

**Deploy and test on phone:** hard-reload the field app, open any job → Equipment Hub → tap a unit card. The timeline should now show completed reports (green "Completed report" badge) and custom form submissions (purple badge) alongside the existing service calls, PM checklists, and repair quotes.

**Next build candidates (pick one):**
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
