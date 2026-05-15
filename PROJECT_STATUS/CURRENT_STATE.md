# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phases 58–60 — KI-002 Hygiene + Security + Archive. Review slices pending human verification.
- **Last shipped (2026-05-15):** **Field app mobile UI v8** (`VC_BUILD: Phase60-MobileUIv8-2026-05-15`). Root-fixed auto-scroll: `#screen-workspace.active` changed from `min-height` to `height` (bounded flex chain) + removed `scroll-behavior: smooth` (iOS drop) + `scrollIntoView` fallback. `conversational_timeline.js?v=17`. Previous: v7 (same day).
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None (59b regression deployed — verify on phone).

## Immediate Next Step

- **Verify mobile UI v8:** Long chat should jump to the newest bubble after you send, after STT, and after Vertex replies; Compile/Sync should still work after many messages. https://vertex-core-db.web.app/technician/
- **Review pending slices on-device** (checklists in `tools/slices.ts` → `reviewChecklist`): 58b, 58d, 58e, 59a, 60a.
- **Future:** Re-tighten Firestore rules ONLY after implementing anonymous-auth or custom-token flow for field techs.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
