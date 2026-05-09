# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** OCR Cloud Function now live end-to-end. Next: pick from build candidates below.
- **Last shipped (2026-05-08):** `callGeminiVision` Cloud Run auth fix — added `invoker: "public"` to v2 `onCall` options; Cloud Run was rejecting all calls with "not authenticated" before function code ran (field app has no Firebase Auth). `VC_BUILD = "ScheduleFastBoot-b-2026-05-08"` (function deploy, no HTML bump needed).
- **Prior (2026-05-08):** Schedule fast-boot b — `applyVcFieldEntitlements()` moved to `Promise.all` alongside `loadUserProfile()`.
- **Prior (2026-05-08):** Phase 37b — Shadow consent gate iframe-sync race fix (`shadow_mode.js?v=7`).
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. TWIN_PILLARS branding dead; bridge in `shared/firebase_logic.js` left quiet.

## Active Blocker

None. Two non-blocking carry-overs:
- `KI-003` — Office Override iframe parity gap (design `ADR-013`).
- `KI-004` — Field-app photo uploads dropped offline (design `ADR-012`; now also covers Phase 34e access photos — same `firebase.storage().ref().put()` pattern).

## Immediate Next Step

**Test OCR on the phone** — the function is live. Open the field app → Add Equipment → scan a data plate. If you see parsed JSON back, OCR is working end-to-end.

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
