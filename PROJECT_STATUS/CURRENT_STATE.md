# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 65 (Space Polish). Phase 64 slices ready.
- **Last shipped (2026-05-17):** Phase65-SpacePolish — Slack-feel spacing pass: message gap 8→12px, side margins 12→16px, softer nav divider, lighter customer name, open input box, softer dock shadow.
- **Prior (2026-05-17):** Phase 63 (Field Intelligence) + Agent Architecture Separation. Idea Tracker system.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Field-test Phase 65 polish** — Load workspace on mobile. Messages should feel airier (more gap, wider side margins), nav less heavy, input box more open.
- **Phase 64 (Quote Pipeline Foundation)** ready in `tools/slices.ts` — 5 slices (64a–64e). Run via SDK build runner (`vertex` → `/a`).

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.