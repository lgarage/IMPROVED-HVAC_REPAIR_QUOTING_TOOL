# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 (ChatGPT UI). Phase 63/64 testing complete — live on device.
- **Last shipped (2026-05-17):** 5 bug fixes in one session: (1) checklist trigger-word scan moved out of equipment-switch guard → fires on every entry; (2) spoken number normalization ("RTU seven" → "RTU7") so voice-dictated equipment names are detected; (3) trigger-word scan no longer requires equipment context upfront — resolves at callback time; (4) skip intent pipeline for photo/video/file entries (was generating "What were you working on?" on every photo); (5) compile modal moved to `<body>` root — backdrop-filter on pill ancestors was clipping `position:fixed` to a narrow left-side sliver. `conversational_timeline.js v53→v57`. `VC_BUILD: Phase65-ChecklistTriggerFix+MediaFix+CompileModalFix-2026-05-17`.
- **Prior (2026-05-17):** Phase 64 slices 64a–64i all passed (AI Quote Pipeline). Phase 63 slices 63a–63h all passed (Field Intelligence). Header & Composer polish / HeaderV7 floating pill chrome. VC DEBUG draggable. Phase65-ChatGPTUI.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Immediate Next Step:** Wire diagnosis/repairs/recommendations into the service call ticket fields on Sync. See handoff prompt below for full spec.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.