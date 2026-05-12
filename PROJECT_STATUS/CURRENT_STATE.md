# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phase 40 — Field Chronicle (Experimental). Phase 1 shipped.
- **Last shipped (2026-05-12):** Field Chronicle Phase 1 — chronological field note capture, localStorage persistence, deterministic Compile Notes, editable preview modal, Copy Summary button. New file `field_chronicle.js`; additive HTML/CSS/hook in `technician/index.html`. `VC_BUILD = "FieldChronicle-Phase1-2026-05-12"`.
- **Prior (2026-05-11):** Firebase/GCP migration complete — `vertex-core-db`. All services live.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None. Migration console errors (empty-collection reads) are non-blocking.

## Immediate Next Step

- **Smoke-test Field Chronicle on device:** open a job → add 3–4 chronological notes → tap Compile Notes → verify editable summary → tap Copy Summary → paste elsewhere.
- **Disable if needed:** set `window.VC_FIELD_CHRONICLE_ENABLED = false` before app boot, or remove `field_chronicle.js` script tag.
- **Phase 40 future slices (not started):** Gemini-powered compile, category detection, Firestore persistence, dispatcher visibility. Re-gate each slice.
- Migration carry-over still applies (roster, optional data import).

Smoke-tests carried over (non-blocking): Phase 34e Field Access Notes on iPhone; Phase 33 Field-Add Equipment OCR on Vision Hub.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
