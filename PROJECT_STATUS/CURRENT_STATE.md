# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phase 41 — Conversational Field Capture (New Field Tech UX). Planning shipped; Slice 41a next.
- **Last shipped (2026-05-14):** Workbench paused + documented (`PAUSE_NOTES.md`); README corrected (port, UI description). Vertex next: Phase 41a (conversational timeline UI).
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume; last sandbox (invoice fixes, confidence 100%) is ready to Review/Merge when wanted.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None.

## Immediate Next Step

- 📋 See `PROJECT_STATUS/NEW_FIELDTECH_UX_PLAN.md` for full slice detail.
- **Next slice:** Phase 41a — Timeline container + message rendering (new `conversational_timeline.js`, `technician/index.html` container + CSS). Re-gate per §6B1.
- Phase 40 (Field Chronicle) Phase 1 remains shipped; future slices (Gemini compile, Firestore persistence) deferred — may fold into Phase 48 (Compile Notes) per plan.
- Migration carry-over still applies (roster, optional data import).

Smoke-tests carried over (non-blocking): Phase 34e Field Access Notes on iPhone; Phase 33 Field-Add Equipment OCR on Vision Hub.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
