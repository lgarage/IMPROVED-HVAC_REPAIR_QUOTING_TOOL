# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phase 41 — Conversational Field Capture (New Field Tech UX). SDK build runner v2.0 ready; 28 slices defined (41a–57a). Slice 49a needs retry (validator fixed).
- **Last shipped (2026-05-14):** Build runner v2.0 (`tools/build_runner.ts`): S-to-stop hotkey, auto-retry failed slices, time remaining ticker, version display, loadState init for new slices. Model selector fix (correct SDK model IDs). Validator dynamic `htmlTarget`. 10 new slices (54a–57a). `job_context_engine.js` siteAccessNotes + unresolvedIssues (from slice 51a). Commit `6d7d091`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None.

## Immediate Next Step

- Run `vertex` in `tools/` CLI → `/a` to start automated slice build. Slice 49a will auto-retry first (was failed, now reset).
- 📋 See `PROJECT_STATUS/NEW_FIELDTECH_UX_PLAN.md` for full slice detail (Phases 41–57).
- Press **S** during execution to gracefully stop after the current slice finishes.
- Migration carry-over still applies (roster, optional data import).

Smoke-tests carried over (non-blocking): Phase 34e Field Access Notes on iPhone; Phase 33 Field-Add Equipment OCR on Vision Hub.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
