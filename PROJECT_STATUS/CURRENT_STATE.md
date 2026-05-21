# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 ALL slices shipped. Customer Appointment Confirmation feature shipped.
- **Last shipped (2026-05-20 18:30 CDT):** Issues-found #22 follow-up — nav guard z-index raised to 100001 (was 9999, below header 10000 — caused infinite re-trigger); nav guard skipped when compile modal is already open; compile modal now cleanly dismissed when tapping top Schedule pill.
- **Prior (2026-05-20):** Customer Confirmation feature — dispatcher checkbox, tech card badge + workspace banner. `VC_BUILD: CustomerConfirm-2026-05-20`.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

**Schedule pill broken for first job of day (May 17 + May 18)** — after compile modal auto-opens and user taps ×, Schedule pill does nothing. Subagent investigation running (Playwright). Root cause suspected: `hasUnsubmittedReport()` returns true for historical jobs on first workspace open because `_compileSubmittedForTicket` resets each session. Fix pending subagent report.

## Immediate Next Step

- **Wait for subagent result** on "first job of day" Schedule bug — then apply fix + deploy.
- **KI-004 completion:** `drain()` uploads but doesn't patch Firestore docs with download URLs. Fix: add post-upload URL patching in `offline_storage_outbox.js`.
- **B6 — SW cache hygiene:** bump `CACHE_NAME` in `sw.js`, add `activate` handler for old-cache cleanup.
- **On-device field test:** user plans to smoke-test Thu/Fri 2026-05-21/22.
- **Rule:** agents must never run the SDK build runner. See `.cursor/rules/no-sdk-build-runner.mdc`.

> **On Deck / future ideas:** see `ROADMAP.md`. Fix tracker: `canvases/issues-found-fix-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
