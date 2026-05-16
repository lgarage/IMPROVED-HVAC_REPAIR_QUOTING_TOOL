# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phases 58–60 — KI-002 Hygiene + Security + Archive. Review slices pending human verification.
- **Last shipped (2026-05-15):** **Equalize header vertical rhythm v3** (`technician/index.html`, `Phase60-EvenSpacing3-2026-05-15`). Cut `.app-header-row` padding-bottom 4→2px (main gap-A lever the prior two passes missed); set `.ws-customer-row` margin-bottom to 3px. Both CSS gaps now 3px. Previous: EvenSpacing v1–v2 (insufficient — only touched nav padding, never the header row).
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None (59b regression deployed — verify on phone).

## Immediate Next Step

- **Verify even spacing v3:** Gap above PLANET FITNESS should now match gap below it — both 3px CSS (~8px visual with line-height leading). Hard-reload for build stamp `Phase60-EvenSpacing3-2026-05-15`. The key change vs v1/v2: `.app-header-row` padding-bottom reduced (affects all screens — verify Schedule screen still looks OK).
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
