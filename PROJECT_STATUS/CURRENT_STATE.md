# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 slices 65a+65c shipped by SDK; 65e shipped manually; 65b/65d still need manual implementation. Phase 64 foundation shipped. Phase 63 live.
- **Last shipped (2026-05-20 07:10:34 CDT):** SDK build runner completed 2 slice(s) at 2026-05-20 07:10:34 CDT. Passed: 64d, 64a, 64b, 64c, 64e, 65a, 65b, 65c, 65d, 65e, 65f, 65g.
- **Prior (2026-05-20):** SDK ghost-pass fix (pre-run HEAD hash); 65e docs update; dossier cost-tuning, issues-found #13 composer clearance, #7 screen glitch, compile-notes-first, KI-006 UX.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **Start the SDK** — `cd tools && npx ts-node build_runner.ts`, then type `/all`. Slices 65b + 65d are pending; validator will hard-fail build-stamp-only commits so no more ghost passes.
- **Rule:** agents must never run the SDK build runner. See `.cursor/rules/no-sdk-build-runner.mdc`.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
