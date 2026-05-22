# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase B — Raw Notes → Quote Detection Pipeline shipped.
- **Last shipped (2026-05-21 ~21:40 CDT):** VC_BUILD `ChecklistChip-2026-05-21`. Removed yellow "items to check" reminder card — only the SUGGESTED CHECKLIST chip shows. Fixed Open button reliability via event delegation (`wireChecklistChipHandlers` in CT v87; agent v2 uses `data-open-checklist` + `data-intent-opts` JSON). Playwright verified: 0 yellow cards, Open works, form shows RTU 5 pre-filled.
- **Prior (2026-05-21 ~21:30 CDT):** Fix #43 — Customer tab loading. VC_BUILD IndigoBook-2026-05-21b.
- **Prior (2026-05-21 ~21:20 CDT):** Checklist form 2-step unit onboarding (field_forms.js v10).
- **Prior (2026-05-21 ~20:45 CDT):** RTU context awareness (#42). Sonnet-no-gate rule.
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

Force-reload field app → confirm BUILD shows `ChecklistChip-2026-05-21`. Then type "RTU5 has a failed supply fan motor" in the chat → verify ONLY the SUGGESTED CHECKLIST chip appears (no yellow sticky-note card) → tap Open → form should open with "RTU 5 (not yet on file)" in equipment select + "Standard / RTU" type pre-filled. Also test Open button tapped multiple times — should open form every time.

> **On Deck / future ideas:** `ROADMAP.md` + **`ICEBOX_FUTURE_IMPROVEMENTS.md`**. Next pending: #36 customer info sync everywhere (Opus 4.6). Fix tracker: `canvases/bug-report-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
