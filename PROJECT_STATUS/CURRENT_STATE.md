# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phases 58–60 — KI-002 Hygiene + Security + Archive. Review slices pending human verification.
- **Last shipped (2026-05-15):** **Collapse sticky header — v6 structural fix** (`technician/index.html`, `Phase60-StickyMerge-2026-05-15`). Removed redundant `position: sticky` from `.workspace-site-banner-sticky` (parent already `overflow: hidden` + bounded height — sticky did nothing functional, just created stacking-context complexity); removed second `box-shadow` on `.dictation-site-nav` (v5 only caught the shell shadow); tightened padding 0→4/6 and margin 5→4. Six passes total to reach the architectural fix. Also updated model escalation policy: `Opus 4.7` is now a strict last-resort suggestion only after repeated no-measurable-change attempts. Previous: v1–v5 chased padding while two box-shadows + redundant sticky fought each other.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None (59b regression deployed — verify on phone).

## Immediate Next Step

- **Verify sticky-merge v6:** Hard-reload for `Phase60-StickyMerge-2026-05-15`. Both dark gradient bands (under Schedule pill AND under address row) should be gone. Gap above and below PLANET FITNESS should be visibly balanced at ~6–8px each. Banner still always-visible because `#screen-workspace.active` is `overflow: hidden` (no need for sticky positioning).
- **No further UI changes from this session:** the only update was the `MODEL_DOSSIER.md` policy threshold for when to suggest `Opus 4.7`.
- **Verify timeline:** No dashed **Which unit?** box or that phrase in Vertex bubbles when messages lack a unit reference; escalation may still show **What were you working on?** (Gemini low-confidence path). Hard-reload (`conversational_timeline.js?v=18`).
- **Review pending slices on-device** (checklists in `tools/slices.ts` → `reviewChecklist`): 58b, 58d, 58e, 59a, 60a.
- **Future:** Re-tighten Firestore rules ONLY after implementing anonymous-auth or custom-token flow for field techs.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
