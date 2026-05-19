# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 AI Quote Pipeline — queue verified, preflight passed, ready for overnight SDK run (`/a`). Phase 66/63 live. KI-004 core shipped.
- **Last shipped (2026-05-18):** Intent escalation fallback (`VC_BUILD: IntentEscalationFallback-2026-05-18`). **KI-005** schedule loading — user-verified resolved (cause of overnight stall unclear; likely Phase 66 init brace fix).
- **Prior (2026-05-18):** Phase 66 complete — admin login, job creation FAB, historical mode, checklist full-list, compile guard.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.
- **Fix tracker canvas:** `issues-found-fix-tracker.canvas.tsx` (#issues-found backlog).

## Active Blocker

None.

## Immediate Next Step

- **Device verify (issues-found canvas #3, #4):** Checklist full-list on trigger phrase (`checklist_reminder_engine.js?v=7`); admin orange FAB job create on phone.
- **Product queue:** **KI-006** past-day job UX (card tap, report-first, timestamped addendum notes). **KI-007** checklist if verify fails.
- **Tonight at bedtime only:** SDK `/a` Phase 64 (64a→64b→64c→64e→64d). Do not run before bed unless user asks.
- **After overnight run:** `.build_state.json` + runner log; reconcile what changed.
- **Optional:** KI-004 URL-patch on outbox drain; compiled report edit persistence.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
