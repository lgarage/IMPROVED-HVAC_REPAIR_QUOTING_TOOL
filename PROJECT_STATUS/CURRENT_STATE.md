# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 AI Quote Pipeline — queue verified, preflight passed, ready for overnight SDK run (`/a`). Phase 66/63 live. KI-004 core shipped.
- **Last shipped (2026-05-18):** Build runner archive-strip fix + Phase 64 queue restored (64a–64e). Same day: KI-004 outbox wiring; `#issues-found` triage → filed **KI-005–007** (schedule loading blocker + field UX backlog).
- **Prior (2026-05-18):** Phase 66 complete — admin login, job creation FAB, historical mode, checklist full-list, compile guard.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

**KI-005** — Field schedule/board stuck on **"Loading…"** (reported `#issues-found` 2026-05-17, persists 2026-05-18 AM). Blocks normal use until fixed or ruled cache/deploy.

## Immediate Next Step

- **Now (daytime):** Investigate/fix **KI-005** schedule loading — check `technician/index.html` roster/ticket listeners, force-reload + `VC_BUILD` on device; rule out stale cache vs JS error. Source: Slack `#issues-found` triage 2026-05-18.
- **Verify on device (not blocking Phase 64):** Phase 66 — admin orange FAB job create (#5, user not tested yet); checklist full-list on trigger (#4, `checklist_reminder_engine.js?v=7`).
- **Product/design queue:** **KI-006** past-day job UX (card tap → workspace, compiled report first, timestamped "add additional notes" in chat). **KI-007** historical-mode edit scope (#3 — what should/shouldn't be editable).
- **Tonight at bedtime only — do not run Phase 64 before then:** SDK build runner `/a` from `tools/` — Phase 64 slices 64a→64b→64c→64e→64d (all review; push at end of run). User saves this for when they go to bed.
- **After overnight run:** Check `.build_state.json` + runner log; human-verify review checklist; reconcile Slack #6 (what the ask changed).
- **Optional (not blocking):** KI-004 URL-patch (`contextHook` on `VCStorageOutbox.drain()`). Deferred: compiled report edit persistence.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the NEXT session should do — not what this session just completed. Ask yourself: "If a fresh agent reads only this file, will it do the right thing?" If no, rewrite.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.

