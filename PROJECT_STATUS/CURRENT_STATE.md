# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase B — Raw Notes → Quote Detection Pipeline shipped.
- **Last shipped (2026-05-21 ~21:20 CDT):** Checklist form 2-step unit onboarding (field_forms.js v10). SELECT EQUIPMENT pre-fills "RTU 1 (not yet on file)" from chat. Equipment type auto-fills Standard/RTU. Tech fills checklist → taps Save → if unit not on file: photo section slides in at bottom ("Unit name tag *" + "Overall photo *"), button becomes "Save & Add Unit". Second tap uploads photos + creates Equipment Firestore doc + saves form.
- **Prior (2026-05-21 ~21:10 CDT):** Smooth card reorder (service_call.js, index.html).
- **Prior (2026-05-21 ~21:00 CDT):** Checklist form inline new-unit onboarding v9 (superseded by v10).
- **Prior (2026-05-21 ~20:45 CDT):** RTU context awareness (#42). "rt1"/"rt one" normalized. Sonnet-no-gate rule added.
- **Prior (2026-05-21 ~20:45 CDT):** RTU context awareness (#42). "rt1"/"rt one"/etc. normalized before Gemini. Checklist form auto-selects Standard/RTU equipment type. If unit not on file, timeline prompts tech for nameplate + overall unit photos. Also added sonnet-no-gate rule.
- **Prior (2026-05-21 ~20:25 CDT):** Phase B quote pipeline. Tech raw notes → Gemini compile → `quoteNeeded` signal → dual-path `quote_data_builder.js` (Path A: Gemini+templates, Path B: direct from `quoteRecommendations`) → `autoCreateDraftQuote` writes draft to `office_quotes` + patches `service_calls` on Submit to Office → dispatcher sees "🔖 Quote Ready" badge → tap opens existing draft in quoting UI. Chip shown to tech when quote detected.
- **Prior (2026-05-21 ~19:40 CDT):** AI Checklist Intent Agent (`agents/checklist_intent_agent.js`).
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

On-device test for checklist 2-step unit onboarding: type "RT1 has a failed supply fan motor" in chat → checklist chip appears → tap Open → SELECT EQUIPMENT should show "RTU 1 (not yet on file)", EQUIPMENT TYPE "Standard / RTU". Fill in the checklist fields → tap Save → photo section should slide in at the bottom with "Unit name tag (model + serial number) *" and "Overall photo of unit *" → take both photos → tap "Save & Add Unit" → verify Equipment Firestore doc created under Customers/{cust}/Locations/{loc}/Equipment with both photo URLs.

> **On Deck / future ideas:** `ROADMAP.md` + **`ICEBOX_FUTURE_IMPROVEMENTS.md`**. Next pending: #36 customer info sync everywhere (Opus 4.6). Fix tracker: `canvases/bug-report-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
