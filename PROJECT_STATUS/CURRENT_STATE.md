# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Trust hardening sprint (pilot-readiness). KI-004 hooks + B6 SW cache shipped prior.
- **Last shipped (2026-05-21 11:50 CDT):** Trust hardening sprint — 15 items across field app + dispatcher: debug overlay opt-in, 46+ alerts→toasts, branded splash screen + login logo, PWA manifest with real icons, board loading/empty states, crash guards (openWorkspace, onload, loadServiceCall, Firebase init, schedule watchdog, global error handlers), insights loading skeletons, dev copy cleanup, admin PINs hardened.
- **Prior (2026-05-20):** KI-004 contextHook callbacks, B6 SW cache, nav guard z-index, Customer Confirmation.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

Deploy (`firebase deploy --only hosting`) then on-device smoke test: force-reload PWA, verify splash screen shows Vertex Core logo on load, schedule loads, open a job, confirm workspace opens without crash. Test debug overlay is hidden by default (append `?vc_debug=1` to verify it still works). Test offline photo flow. Remaining hardening: theme unification (T3), Gemini key restriction (T4), SW cache busting (T4).

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
