# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Trust hardening sprint (pilot-readiness). KI-004 hooks + B6 SW cache shipped prior.
- **Last shipped (2026-05-21 12:15 CDT):** Trust hardening sprint COMPLETE — all 20 items shipped. Final batch: dark theme unification (login, schedule chips, modals, dropdowns), SW precache `?v=` busting (`CACHE_NAME` → `vertex-cache-v5`), Gemini key restriction deferred (needs anon-auth). Commit `803b379`.
- **Prior (2026-05-20):** KI-004 contextHook callbacks, B6 SW cache, nav guard z-index, Customer Confirmation.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

Deploy (`firebase deploy --only hosting`), then on-device smoke test: force-reload PWA, verify dark-themed splash + login + schedule, open a job, confirm workspace loads. Append `?vc_debug=1` to verify debug overlay still works on demand. Test offline photo flow. Trust hardening sprint is 100% complete — no remaining items. See `.cursor/plans/trust_hardening_sprint_020363b3.plan.md`.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
