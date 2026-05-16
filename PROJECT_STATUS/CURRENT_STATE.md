# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phases 58–60 — KI-002 Hygiene + Security + Archive. Review slices pending human verification.
- **Last shipped (2026-05-15):** **Equalize header vertical rhythm v5 — real root cause** (`technician/index.html`, `Phase60-EvenSpacing5-2026-05-15`). Removed `.app-top-shell` box-shadow (`0 4px 20px rgba(0,0,0,0.35)` was casting a dark gradient onto the top 16px of the banner via z-index stacking, creating fake visual gap that no padding adjustment could touch). Reverted v4's flex-end + display:contents experiments. Set padding 4/0 + margin 5 for matching CSS gaps. Previous: v1–v4 all chased CSS spacing while ignoring the shadow.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None (59b regression deployed — verify on phone).

## Immediate Next Step

- **Verify even spacing v5:** Hard-reload for `Phase60-EvenSpacing5-2026-05-15`. The dark gradient under the Schedule pill should be GONE (box-shadow removed). Gap above PLANET FITNESS should now visibly match gap below it. If the shell looks too flat without the shadow, we can add back a subtle hairline (`0 1px 0 rgba(0,0,0,0.4)`).
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
