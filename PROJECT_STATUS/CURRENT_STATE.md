# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 foundation **shipped** (64a–64e passed 2026-05-18). Phase 63 live. KI-004 core shipped. **Product queue:** KI-006 past-day job UX.
- **Last shipped (2026-05-19):** Status reconciliation — issues-found tracker + `CURRENT_STATE` / `ROADMAP` / `KNOWN_ISSUES` aligned to Slack + git + `.build_state.json`.
- **Prior (2026-05-18 20:56:18 CDT):** SDK build runner — Phase 64 slices 64a, 64b, 64c, 64d, 64e passed.
- **Prior (2026-05-18):** Admin checklist cards + editor; admin full AI chat; debug overlay drag; KI-008 logout spinner.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **Product queue:** **KI-006** past-day job UX — issues-found tracker **#5** (implement card tap → report-first → timestamped addendum notes).
- **Device verify:** Phase 64 quote migration + vendor directory on phone/dispatcher; finish build-runner morning checklist items 3–5 (`.build_state.json` — 2/5 passed 2026-05-19).
- **Triage:** KI-009 — May 19 `#issues-found` audio + screenshots (tracker **#11**).
- **Optional:** KI-004 URL-patch on outbox drain; tracker **#7** screen glitch if user reproduces.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker canvas: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
