# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 63 (Field Intelligence). **Phase 64 slices authored** (AI Quote Pipeline — Foundation). **Agent Architecture Separation** shipped.
- **Last shipped (2026-05-17):** Idea Tracker system — `PROJECT_STATUS/IDEA_TRACKER.md` created (10 icebox ideas cross-referenced with statuses); `slack-icebox.mdc` rule updated to overlay tracker status when reading icebox.
- **Prior (2026-05-17):** Agent Architecture Separation — `gemini_client.js` + 5 agent modules under `agents/`. Prior (2026-05-16): AI Quote Pipeline spec + Phase 64 slices; 63a–63f + 63e shipped.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Deploy + field-test agent separation** — `firebase deploy --only hosting` to push the new agent modules. Test compile notes, nameplate OCR, location/parts parsing on mobile.
- **Run Phase 63 slices via SDK build runner** — `vertex` → `/a` to execute remaining slices (including retrying `63g`).
- **Phase 64 (Quote Pipeline Foundation)** ready in `tools/slices.ts` — 5 slices (64a–64e).

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.