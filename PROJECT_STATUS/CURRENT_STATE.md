# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** AI Checklist Intent Detection (Phase 63+) — new agent module shipped.
- **Last shipped (2026-05-21 ~19:40 CDT):** AI Checklist Intent Agent (`agents/checklist_intent_agent.js`). Tech says "RT one has a failed supply fan motor" → Gemini detects intent → suggestion chip appears in chat → tap Open → `renderDynamicForm()`. Non-blocking async, fire-and-forget pattern.
- **Prior (2026-05-21 ~15:30 CDT):** T2 bug batch #29-#35; background agent T0 batch #28, #32, #37-#39.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

On-device test the AI checklist suggestion: open a job, type "RT one has a failed supply fan motor" → expect a blue "Suggested checklist: supply fan motor replacement — Open" chip within ~5 seconds. Tap Open → should open the full form. Also verify the Vendors tab is hidden in the dispatcher (background agent shipped that).

> **On Deck / future ideas:** `ROADMAP.md` + **`ICEBOX_FUTURE_IMPROVEMENTS.md`**. Next pending: #36 customer info sync everywhere (Opus 4.6). Fix tracker: `canvases/bug-report-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
