# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 ALL slices shipped (65a–65g). Phase 64 foundation shipped. Phase 63 live.
- **Last shipped (2026-05-20 07:10:34 CDT):** SDK build runner completed 2 slice(s) at 2026-05-20 07:10:34 CDT. Passed: 64d, 64a, 64b, 64c, 64e, 65a, 65b, 65c, 65d, 65e, 65f, 65g.
- **Prior (2026-05-20):** SDK ghost-pass fix (pre-run HEAD hash); 65e docs update; dossier cost-tuning, issues-found #13 composer clearance, #7 screen glitch, compile-notes-first, KI-006 UX.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **Deploy to production** — `firebase deploy --only hosting` then force-reload PWA. Verify VC_BUILD shows `IssuesFix65d-FooterStack-2026-05-19` and compile modal top-spacing + footer z-index look correct.
- Phase 66 slices not yet defined — add next features to `tools/slices.ts` when ready.
- **Rule:** agents must never run the SDK build runner. See `.cursor/rules/no-sdk-build-runner.mdc`.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
