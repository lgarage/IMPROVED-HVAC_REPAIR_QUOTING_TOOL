# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 61 complete. Phase 62 hygiene slices queued.
- **Last shipped (2026-05-16):** **`tools/slices.ts`** — Added slices 62a (Gemini 403 fix), 62b (KI-002 hygiene), and 62c (UX wording fix) to the build runner. Reset 62b to pending with corrected validator metadata.
- **Prior (2026-05-16):** **Build runner /b, /p, /f, /na, /cost commands** + field app media/video/Choose File. VC_BUILD: Phase61-ChooseFile-2026-05-16.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

Compile Notes shows Gemini 403 on mobile — `gemini-2.5-flash` fallback firing. Slice 62a passed; verify on phone. Slice 62b re-queued with correct validator.

## Immediate Next Step

- **Run the build runner** before leaving: `vertex` -> `/a` (to run pending slices 62b and 62c).
- **When back:** review `/b` summary, test Compile Notes on phone, then commit if clean.
- **Run /b in build runner** each morning after overnight SDK sessions to see what changed and what to test.
- **Future:** Re-tighten Firestore rules ONLY after implementing anonymous-auth or custom-token flow for field techs.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.