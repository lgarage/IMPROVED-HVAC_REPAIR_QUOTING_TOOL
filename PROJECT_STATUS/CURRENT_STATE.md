# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. **Hot-tier file** — hard-capped at ~30 content lines / ~400 tokens. If it grows past that, migrate excess into the right Tier 2 file (PROJECT_MAP.md for shipped detail, KNOWN_ISSUES.md for bugs, ROADMAP.md for ideas, DECISIONS.md for ADRs). Read protocol lives in .cursorrules §1A.

---

## Snapshot

- **Active Phase:** Phase B — Raw Notes → Quote Detection Pipeline shipped.
- **Last shipped (2026-05-21 ~21:00 CDT):** Checklist form inline new-unit onboarding. When tech opens a checklist and the detected unit (e.g. "RTU 1") isn't in the equipment system, the form now shows an inline blue box with two required photo fields: "Model/serial number tag" and "Overall unit photo". Saving uploads both photos and creates the Equipment Firestore doc automatically. If the unit IS already on file, the dropdown auto-selects it. (field_forms.js v9)
- **Prior (2026-05-21 ~20:45 CDT):** RTU context awareness (#42). "rt1"/"rt one"/etc. normalized before Gemini. Checklist form auto-selects Standard/RTU equipment type. If unit not on file, timeline prompts tech for nameplate + overall unit photos. Also added sonnet-no-gate rule.
- **Prior (2026-05-21 ~20:25 CDT):** Phase B quote pipeline. Tech raw notes → Gemini compile → `quoteNeeded` signal → dual-path `quote_data_builder.js` (Path A: Gemini+templates, Path B: direct from `quoteRecommendations`) → `autoCreateDraftQuote` writes draft to `office_quotes` + patches `service_calls` on Submit to Office → dispatcher sees "🔖 Quote Ready" badge → tap opens existing draft in quoting UI. Chip shown to tech when quote detected.
- **Prior (2026-05-21 ~19:40 CDT):** AI Checklist Intent Agent (`agents/checklist_intent_agent.js`).
- Prior history: see `PROJECT_MAP_HISTORY.md`.
- **Note:** `workbench/` is a standalone tool (NOT Vertex) — **paused 2026-05-14**.
- **Default tenant:** `USA_HEATING_COOLING`. Firebase project: `vertex-core-db`.

## Active Blocker

None.

## Immediate Next Step

On-device test: type "rt1 has a failed supply fan motor" → checklist chip appears → tap Open → Equipment Type should pre-select Standard / RTU. If RTU 1 is NOT on file, expect the inline blue box "RTU 1 isn't on file yet — snap these to add it to the system:" with two photo inputs. Take both photos → tap Save → verify Equipment doc created in Firestore (Customers/{customer}/Locations/{location}/Equipment). If RTU 1 IS on file, verify it auto-selects in the dropdown. Also test Phase B quote pipeline: compile notes → dispatcher "🔖 Quote Ready" badge.

> **On Deck / future ideas:** `ROADMAP.md` + **`ICEBOX_FUTURE_IMPROVEMENTS.md`**. Next pending: #36 customer info sync everywhere (Opus 4.6). Fix tracker: `canvases/bug-report-tracker.canvas.tsx`.

## Update Protocol

- Update **Snapshot / Active Blocker / Immediate Next Step** at end of every session.
- **Accuracy rule:** "Immediate Next Step" must describe what the **NEXT** session should do — not what this session just completed.
- When a blocker resolves: move `KNOWN_ISSUES.md` entry to **Resolved**; clear **Active Blocker** here.
- **Hard size cap:** if total lines ≥ 55, collapse oldest Prior entries into `PROJECT_MAP_HISTORY.md`.
