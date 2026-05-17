# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 (ChatGPT UI). Phase 63/64 testing in progress.
- **Last shipped (2026-05-17):** Bug fixes from code trace review — (1) 63c checklist reminders: added `scanEntryForWorkflow()` to `checklist_reminder_engine.js` so trigger-word matching scans entry text not ticket type; (2) 64g quote pipeline: fixed silent async failure (`getActiveFormTemplates` is async, was called synchronously — quote card never appeared); (3) 64i badge: removed duplicate `id` from `vc-quote-ready-badge`. `VC_BUILD: Phase65-QuotePipelineFix-2026-05-17`.
- **Prior (2026-05-17):** Phase 64 slices 64a–64i all passed (AI Quote Pipeline). Phase 63 slices 63a–63h all passed (Field Intelligence). Roadmap: VC Admin Voice Layer added to icebox.
- **Prior (2026-05-17):** Header & Composer polish / HeaderV7 floating pill chrome. VC DEBUG draggable. Phase65-ChatGPTUI.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Immediate Next Step:** Continue 63/64 test pass on device — priority order: (1) 63c checklist reminder card now fixed, test with "replacing supply fan motor on RTU 3"; (2) 64g quote card now fixed, test compile → "🔖 Repair quote detected" card appears; (3) 64h write → check Firebase Console for `quote_data` on service call; (4) 64i badge → dispatcher card shows "🔖 Quote Ready" → click → draft quote created. Then 63b, 63d, 64f.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.