# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 AI Quote Pipeline — queue verified, preflight passed, ready for overnight SDK run (`/a`). Phase 66/63 live. KI-004 core shipped.
- **Last shipped (2026-05-18):** Build runner archive-strip fix (`loadState` no longer deletes re-queued slices) + Phase 64 active queue restored (64a–64e). Prior same day: KI-004 outbox wiring deployed (`VC_BUILD: KI004-OfflineOutboxWiring-2026-05-18`).
- **Prior (2026-05-18):** Phase 66 complete — admin login, job creation FAB, historical mode, checklist full-list, compile guard.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **Tonight:** Run SDK build runner `/a` from `tools/` — Phase 64 slices 64a→64b→64c→64e→64d (all review; push at end of run).
- **After overnight run:** Check `.build_state.json` + runner log for pass/fail; human-verify review checklist items before promoting to production.
- **Optional (not blocking):** KI-004 URL-patch — add `contextHook` callbacks to `VCStorageOutbox.drain()` so Firestore docs get download URLs after offline replay.
- **Deferred:** Compiled report edit persistence — save corrections back to `completed_reports` with "Edited" badge.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the NEXT session should do — not what this session just completed. Ask yourself: "If a fresh agent reads only this file, will it do the right thing?" If no, rewrite.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.

