# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 61 complete. Phase 62 hygiene slices complete.
- **Last shipped (2026-05-16):** Slack idea vault docs — added canonical `#icebox` Slack channel ID `C0B543CE4QG` to AI context so future Cursor sessions check Slack before the roadmap Icebox. No code change.
- **Last shipped (2026-05-16):** **Rolling background compile notes (Slice 62h)** — `backgroundCompile()` fires every 5 min silently via `setInterval`; `mergeCompileResults()` + `buildDeltaCompilePrompt()` keep AI calls cheap (delta only); `compileNotes()` tap opens modal instantly if report is up-to-date, otherwise runs delta/full compile; timer starts on workspace open, stops on close; button always reads "Compile Notes". `VC_BUILD: Phase62-Slice62h-2026-05-16`.
- **Prior (2026-05-16):** **Gemini 403 deep fix (Slice 62e–62g)** — fixed 403/404/credits chain; all models set to `gemini-2.5-flash`; `maxOutputTokens` 2048→8192; cache-busted v33.
- **Prior (2026-05-16):** `tools/model_selector.ts` v3 — `MODEL_GUARDS`; `/guards` command; slice 62d audit.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

(None)

## Immediate Next Step

- **Test Compile Notes on phone** — hard-refresh browser, add 3+ entries, wait 5 min, tap "Compile Notes" (should be instant or near-instant). Then add more entries and tap again to verify delta compile.
- **Use Slack for future ideas** — add raw notes to `#icebox` (`C0B543CE4QG`), then ask Cursor to read that channel instead of the roadmap Icebox section.
- **Slack idea vault active** — `#icebox` channel + Cursor Ideas bot + `~/.cursor/mcp.json` MCP config in place. Restart Cursor to load MCP, then test: ask agent to read `#icebox` channel.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.