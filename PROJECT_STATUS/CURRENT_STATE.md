# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 (ChatGPT UI). Phase 63/64 testing complete — live on device.
- **Last shipped (2026-05-17):** Schedule job card status update — tappable dropdown on each card (In Progress / Completed / Quote Needed / Parts Ordered) writes directly to Firestore via `VCFirestore.setServiceCallMerged`. CSS-styled with per-status color coding. `technician/index.html`. `VC_BUILD: Phase65-ScheduleStatusUpdate-2026-05-17`.
- **Prior (2026-05-17):** Sync Ticket fields wired; Compiled Report auto-close; 5 bug fixes; Phase 64/63 all passed; Header/Composer polish; HeaderV7 floating pill chrome.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Immediate Next Step:** Test schedule card status dropdown on device — change status from In Progress → Completed/Quote Needed and verify Firestore update reflects in dispatcher view.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.