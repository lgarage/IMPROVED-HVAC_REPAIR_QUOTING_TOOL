# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 (ChatGPT UI). Phase 63/64 testing in progress.
- **Last shipped (2026-05-17):** Checklist trigger-word wiring fix — `scanEntryForWorkflow` was trapped inside the equipment-switch guard, so trigger words only scanned when equipment changed, not when the repair type was mentioned on already-active equipment (e.g. "RTU7 needs a new supply fan motor"). Moved scan to an independent block that fires on every entry when no workflow loaded, covering both same-equipment messages and multi-message context. `conversational_timeline.js?v=54`. `VC_BUILD: Phase65-ChecklistTriggerFix-2026-05-17`.
- **Prior (2026-05-17):** Phase 64 slices 64a–64i all passed (AI Quote Pipeline). Phase 63 slices 63a–63h all passed (Field Intelligence). Roadmap: VC Admin Voice Layer added to icebox.
- **Prior (2026-05-17):** Header & Composer polish / HeaderV7 floating pill chrome. VC DEBUG draggable. Phase65-ChatGPTUI.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Immediate Next Step:** Test the checklist trigger-word fix on device — say "RTU7 needs a new supply fan motor" in the chat (with RTU7 already active or as first message). The yellow 📋 checklist card should appear. If the form template has `active: true` and `triggerWords: ["supply fan motor"]` set in Settings → Forms, it will fire. Then continue 63/64 test pass: (2) 64g quote card — compile → "🔖 Repair quote detected" card appears; (3) 64h write → Firebase Console `quote_data`; (4) 64i badge.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.