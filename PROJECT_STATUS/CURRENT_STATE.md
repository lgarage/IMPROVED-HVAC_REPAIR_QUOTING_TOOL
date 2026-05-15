# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phases 41–57 — Conversational Field Capture (New Field Tech UX) — **ALL 28 slices passed** (41a–57a). SDK build runner v2.1 completed full automated run.
- **Last shipped (2026-05-14):** All 28 slices built, validated, deployed to Firebase preview channels, committed, and pushed via SDK build runner. Includes: timeline UI, hold-to-talk STT, media capture, context preload, HVAC vocabulary, confidence-based cloud escalation, voice responses, checklist reminders, editable entries, auto-tagged media, compile notes, dispatcher review workflow, post-job learning, site notes, knowledge capture, hierarchical retrieval, integration smoke test, offline graceful degradation, VC_BUILD consolidation, Firebase Hosting deploy, Firestore rules for new collections, auth/roster verification, offline photo outbox (KI-004), SW cache hygiene, dispatcher ticket Save button. Commit `37e6c05`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None.

## Immediate Next Step

- **Review the "review" slices** on-device: 42a, 43b, 45a, 47a, 48a, 49a, 50a, 52a, 53a, 54c, 55a, 55b, 56a (committed but tagged for manual review — all passed validator but touch Firestore writes, Gemini prompts, or cross-module wiring).
- Smoke-test the full conversational field capture flow on iPhone (timeline → hold-to-talk → media → compile notes → dispatcher review).
- Migration carry-over still applies (roster, optional data import).

Smoke-tests carried over (non-blocking): Phase 34e Field Access Notes on iPhone; Phase 33 Field-Add Equipment OCR on Vision Hub.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
