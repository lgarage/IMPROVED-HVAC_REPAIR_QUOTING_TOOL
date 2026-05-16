# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (`PROJECT_MAP.md` for shipped detail, `KNOWN_ISSUES.md` for bugs, `ROADMAP.md` for ideas, `DECISIONS.md` for ADRs). Read protocol lives in `.cursorrules` §1A.

---

## Snapshot

- **Active Phase:** Phases 58–61 — KI-002 Hygiene + Security + Archive + Security Polish. Review slices pending human verification.
- **Last shipped (2026-05-15):** **Video upload error handling** (`conversational_timeline.js?v=26`). `openMediaViewer` now checks `uploadStatus`; `openVideoPlayer` displays "Video upload failed" instead of "still uploading" when `uploadStatus === "error"`. Previous: swipe-delete polish + remove overlay.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14** to focus on Vertex 30-day field-readiness. See `workbench/PAUSE_NOTES.md` to resume.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db` (personal account).

## Active Blocker

None (59b regression deployed — verify on phone).

## Immediate Next Step

- **Verify media viewer:** Tap any photo bubble in the timeline → fullscreen dark overlay with the photo + ✕ close. Tap backdrop or ✕ to dismiss. Tap any video bubble → video player modal with native play/pause/scrub controls. If video still uploading, shows "Still uploading" message instead. Hard-reload `v=22`.
- **Verify timeline:** No dashed **Which unit?** box or that phrase in Vertex bubbles when messages lack a unit reference; escalation may still show **What were you working on?** (Gemini low-confidence path). Hard-reload (`conversational_timeline.js?v=18`).
- **Review pending slices on-device** (checklists in `tools/slices.ts` → `reviewChecklist`): 58b, 58d, 58e, 59a, 60a, 61b.
- **Phase 61 overnight slices queued:** 61a (Storage MIME types), 61b (postMessage sender tighten), 61c (workbench localhost bind), 61d (runner key log scrub), 61e (cost map dedup). Run `vertex` → `/a` to execute.
- **Future:** Re-tighten Firestore rules ONLY after implementing anonymous-auth or custom-token flow for field techs.

> **On Deck / future ideas:** see `ROADMAP.md`. Do not duplicate here.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- When a phase ships: one-line pointer here; full detail → `PROJECT_MAP.md` + `PROJECT_MAP_HISTORY.md`.
- When a blocker resolves: move from `KNOWN_ISSUES.md → Open` to `→ Resolved`; clear **Active Blocker** here.
- **Compress Snapshot after 3 sessions:** collapse Prior entries older than 3 sessions into a single "Prior history: see `PROJECT_MAP_HISTORY.md`" line.
- **Hard size cap — mechanical trigger:** if this file's total line count exceeds 55, migrate the oldest Prior entries immediately before adding new content.
