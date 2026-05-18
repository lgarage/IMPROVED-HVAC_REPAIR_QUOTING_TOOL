# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase 64 AI Quote Pipeline — active queue restored for overnight build. Phase 66/65/63 live.
- **Last shipped (2026-05-18):** Phase 64 queue repair — restored 64a/64b/64c/64e into `tools/slices.ts` so 64d now has its full dependency chain in the active runner queue.
- **Prior (2026-05-18):** Phase 66 complete — Admin Job Creation, historical mode, checklist full-list, compile guard.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

- **KI-004 enhancement (optional T2):** The outbox currently uploads the file on drain but does not patch the Firestore doc with the download URL. Adding `contextHook` callbacks to `VCStorageOutbox.drain()` would complete the end-to-end flow (file uploaded + Firestore doc updated). Not blocking — files are preserved in Storage, just need manual re-save to get the URL into the doc.
- **Phase 64 — AI Quote Pipeline:** Active slice queue restored (64a/64b/64c/64d/64e). Run SDK runner `/a` overnight for unattended execution.
- **Deferred:** Compiled report edit persistence (save corrections back to `completed_reports` doc with "Edited" badge) — separate T2 item, requires new Firestore write path in `conversational_timeline.js`.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the NEXT session should do — not what this session just completed. Ask yourself: "If a fresh agent reads only this file, will it do the right thing?" If no, rewrite.
- When a phase ships: one-line pointer here; full detail -> `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md -> Open` to `-> Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.


