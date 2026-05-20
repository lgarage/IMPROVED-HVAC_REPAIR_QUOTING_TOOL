# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 ALL slices shipped. Customer Appointment Confirmation feature shipped.
- **Last shipped (2026-05-20 17:20 CDT):** Issues-found #22 — removed in-modal Schedule btn; raised header z-index to 10000 so Schedule pill is tappable above compile modal backdrop; compile modal auto-closes in `switchScreen`. Deployed.
- **Prior (2026-05-20):** Customer Confirmation feature — dispatcher checkbox, tech card badge + workspace banner. `VC_BUILD: CustomerConfirm-2026-05-20`.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **Verify on device:** force-reload PWA, confirm `VC_BUILD: CustomerConfirm-2026-05-20`. Create a test ticket with "Customer Confirmed" checked + window text, verify green badge on dispatcher card, green pill on tech job card, green banner in tech workspace.
- Phase 66 slices not yet defined — add next features to `tools/slices.ts` when ready.
- **Rule:** agents must never run the SDK build runner. See `.cursor/rules/no-sdk-build-runner.mdc`.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
