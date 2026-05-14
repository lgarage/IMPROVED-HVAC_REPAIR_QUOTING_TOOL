# New Field Tech UX — Phased Build Plan

> **Source spec:** `PROJECT_STATUS/new_fieldtech_ux.md` (Conversational Field Capture System — Master Architecture & Build Specification).
> **Archive destination:** When every item below is shipped, move `new_fieldtech_ux.md` → `PROJECT_STATUS/ARCHIVE/`.
> **Handoff protocol:** Per `.cursorrules` §1D — update this file at end of every session that ships a slice; delete when last slice ships.

---

## Existing Codebase Overlap (what already ships today)

Before slicing, acknowledge what the current field app already delivers against the spec:

| Spec phase | Existing coverage | Gap |
|------------|-------------------|-----|
| Ph 1 — Timeline UI | **Field Chronicle** (`field_chronicle.js`): append-only chronological notes, localStorage CRUD, deterministic compile, editable preview modal, Copy Summary. **Dictation Hub** (`dictation_hub.js`): voice/text capture, Rosetta AI parse, Improve-with-AI. | No ChatGPT-style conversational timeline; no Vertex follow-up prompts; no unified media+voice+text stream. |
| Ph 2 — Local Context | `openWorkspace` preloads active ticket, site intel, equipment list. `equipment_hub.js` shows unit history. `workspace_ui.js` renders previous submission, field evidence. | No offline-first full preload (12-month history, open quotes, recurring problems). No local context tracking object. |
| Ph 3 — Edge Intent | Dictation Hub `SYSTEM_INSTRUCTION_DIAGNOSTICS` prompt parses diagnosis/recs via Gemini. `unit_work_parser.js` extracts per-unit JSON. | All parsing is cloud (Gemini) — no local/edge intent engine, no HVAC vocab correction layer, no confidence tiers. |
| Ph 5 — Checklists | `field_forms.js` renders dynamic forms from `form_templates` Firestore collection. Dispatcher Settings has Form Builder. | Forms are static renders, not conversational reminders. No "Vertex notices missing capacitor" flow. |
| Ph 7 — Media tagging | Equipment Manager photos attach to equipment. Field evidence photos attach to job. | No automatic equipment-context tagging from timeline position. No office/customer visibility split. |
| Ph 8 — Compile Notes | Field Chronicle "Compile Notes" = deterministic compile. Dictation Hub "Complete & Sync" = Gemini-powered report. | Two separate compile paths; neither produces the full "office package" described in spec. |
| Ph 9 — Dispatcher Review | AI Report Reviewer (`ai_report_reviewer.js`) reviews/edits AI-generated reports. | No learn-from-edits feedback loop. No customer-facing report approval workflow. |
| Ph 11 — Site Notes | Site Intel (`workspace_ui.js`) stores site-level notes, inter-office notes, field evidence. | No "operational memory" (recurring failures, historical deficiencies loaded locally). |

**Phases with zero existing coverage:** Ph 4 (Voice follow-ups), Ph 6 (Corrections + editable timeline), Ph 10 (Post-job learning sync), Ph 12 (Teaching layer), Ph 13 (Knowledge lookup ladder).

---

## Build Phases (mapped to project Phase numbering)

Each build phase below gets its own project Phase number (per `.cursorrules` §1C — new user-facing capability = new number). Slices within a phase use sub-letters (41a, 41b, …).

### Phase 41 — Conversational Timeline UI (Spec Ph 1)

**Goal:** Replace the current form-driven workspace with a single scrollable conversational timeline. This is the foundational UI that everything else builds on.

#### Slice 41a — Timeline container + message rendering

- **Scope:** New `#conversational-timeline` container inside `#screen-workspace` (replaces or overlays the current dictation hub + field chronicle). Render a scrollable list of "timeline entries" (tech message bubbles, system response bubbles). Seed with existing `activeTicket` data on `openWorkspace`. CSS: chat-bubble layout, auto-scroll, obsidian/cyan theme match.
- **Files to touch:** `technician/index.html` (HTML container + CSS), new `conversational_timeline.js` (IIFE: timeline state, `addEntry()`, `renderTimeline()`, scroll management).
- **Cache-busts:** `conversational_timeline.js?v=1` (new), `technician/index.html` VC_BUILD bump.
- **Recommended model:** Opus 4.6 (new module, field critical path, foundational UI)
- **Confidence:** ~72%
- **Out of scope:** Voice input, media capture, follow-up prompts, Vertex AI responses.

#### Slice 41b — Hold-to-Talk + live STT in timeline

- **Scope:** Bottom action bar with Hold-to-Talk button (right). Press-and-hold triggers `MediaRecorder` + Web Speech API (`webkitSpeechRecognition`). Live transcript appears in a "draft" bubble. Release → finalize entry → add to timeline. Fallback: text input field for type-to-add.
- **Files to touch:** `conversational_timeline.js` (speech recognition, draft bubble), `technician/index.html` (action bar HTML + CSS).
- **Cache-busts:** `conversational_timeline.js?v=2`.
- **Recommended model:** Opus 4.6 (speech API integration, mobile edge cases)
- **Confidence:** ~68%
- **Out of scope:** Photo/video capture button, Vertex AI responses.

#### Slice 41c — Media capture button + timeline attachment

- **Scope:** Left button in action bar — tap for photo, hold for video. Captured media appears as a timeline entry (thumbnail + timestamp). Auto-attaches to active job + active equipment context. Uses existing `firebase.storage()` upload pattern.
- **Files to touch:** `conversational_timeline.js` (media capture, timeline media entry), `technician/index.html` (button HTML + CSS).
- **Cache-busts:** `conversational_timeline.js?v=3`.
- **Recommended model:** Sonnet 4.6 (known patterns from Equipment Manager photo capture)
- **Confidence:** ~78%
- **Out of scope:** Equipment-context auto-detection, office/customer visibility split.

#### Slice 41d — Vertex system responses (confirmation + short follow-ups)

- **Scope:** After tech adds an entry, Vertex responds with a system bubble. v1: deterministic responses ("Got it.", timestamp confirmation). Follow-up prompt stubs for missing context (equipment reference). No AI yet — rule-based.
- **Files to touch:** `conversational_timeline.js` (response engine, follow-up rules).
- **Cache-busts:** `conversational_timeline.js?v=4`.
- **Recommended model:** Sonnet 4.6 (rule-based logic, no AI/Firestore writes)
- **Confidence:** ~80%
- **Out of scope:** AI-powered follow-ups, checklist reminders, confidence-based escalation.

---

### Phase 42 — Local Job Context Engine (Spec Ph 2)

**Goal:** Preload site/equipment/history data locally at job check-in so most work functions offline.

#### Slice 42a — Context preload on openWorkspace

- **Scope:** Extend `openWorkspace` to bulk-fetch and cache: site notes, equipment list, unresolved issues, open quotes, previous tech notes, last 12 months of completed reports. Store in `localStorage` or `IndexedDB` keyed by `ticketId`. Expose `window.VCJobContext` object.
- **Files to touch:** `technician/index.html` (openWorkspace hook), new `job_context_engine.js` (IIFE: preload, cache, context object).
- **Recommended model:** Opus 4.6 (multiple Firestore reads, offline architecture, field critical path)
- **Confidence:** ~65%
- **Out of scope:** Conversational context persistence ("this unit" = RTU4), offline writes.

#### Slice 42b — Active equipment context tracking

- **Scope:** `VCJobContext.activeEquipment` tracks which unit the tech is currently working on. Updated by timeline entries mentioning equipment references. Exposed to timeline UI for auto-tagging.
- **Files to touch:** `job_context_engine.js`, `conversational_timeline.js`.
- **Recommended model:** Sonnet 4.6 (state management, no Firestore writes)
- **Confidence:** ~75%

---

### Phase 43 — Edge Intent Engine (Spec Ph 3)

**Goal:** Local parsing layer before cloud AI. HVAC vocabulary correction. Confidence-based escalation.

#### Slice 43a — HVAC vocabulary correction + local entity extraction

- **Scope:** New `edge_intent_engine.js`: dictionary-based HVAC term correction (capacitor, microfarad, economizer, etc.); regex-based entity extraction (temperatures, amp draws, equipment references like RTU4/RTU7, refrigerant types, belt sizes). Returns structured `{entities[], confidence}`.
- **Files to touch:** New `edge_intent_engine.js`, `conversational_timeline.js` (wire extracted entities into timeline metadata).
- **Recommended model:** Codex 5.3 (pure code logic, no UI/Firestore)
- **Confidence:** ~70%

#### Slice 43b — Confidence-based cloud escalation

- **Scope:** When edge engine confidence < threshold, silently send to Gemini for structured parse (reuse `dictation_hub.js` Gemini pattern). High confidence → "Got it." Medium → short clarification. Low → cloud escalation → ask if still uncertain.
- **Files to touch:** `edge_intent_engine.js`, `conversational_timeline.js`.
- **Recommended model:** Opus 4.6 (Gemini integration, confidence routing)
- **Confidence:** ~65%

---

### Phase 44 — Voice + Text Follow-Ups (Spec Ph 4)

**Goal:** Tech answers all prompts verbally. "Yes" / "No" / "Skip" / "RTU6" etc.

- **Scope:** Wire speech recognition to active follow-up prompts. Parse spoken responses against expected answer types. Settings: Voice+Text / Text Only / Silent modes.
- **Files to touch:** `conversational_timeline.js` (follow-up response handler), `technician/index.html` (settings UI).
- **Recommended model:** Sonnet 4.6
- **Confidence:** ~75%

---

### Phase 45 — Dynamic Checklist Reminder Engine (Spec Ph 5)

**Goal:** Vertex loads workflows from dispatcher checklist system and reminds tech of missing items conversationally.

- **Scope:** Read `form_templates` collection (already used by `field_forms.js`). Map template items to workflow completion state tracked in `VCJobContext`. When tech moves to next unit, check missing items on previous unit and surface as timeline follow-up.
- **Files to touch:** `conversational_timeline.js`, `job_context_engine.js`, new `checklist_reminder_engine.js`.
- **Recommended model:** Opus 4.6 (cross-module orchestration, field critical path)
- **Confidence:** ~62%
- **Critical constraint:** Do NOT hardcode PM checklists — must load dynamically from dispatcher-defined templates.

---

### Phase 46 — Corrections + Editable Timeline (Spec Ph 6)

- **Scope:** Tap timeline entry to edit. Voice correction ("correction, that was RTU6"). Store original transcript + corrected version. Use corrections for vocabulary learning.
- **Files to touch:** `conversational_timeline.js`, `edge_intent_engine.js` (learning updates).
- **Recommended model:** Sonnet 4.6
- **Confidence:** ~75%

---

### Phase 47 — Media + Context Tagging (Spec Ph 7)

- **Scope:** Photos/videos auto-tag with job, equipment (from `VCJobContext.activeEquipment`), timestamp, technician. Office sees all media grouped by equipment. Customer sees only approved media.
- **Files to touch:** `conversational_timeline.js`, `job_context_engine.js`, dispatcher-side viewer.
- **Recommended model:** Opus 4.6 (visibility model, Firestore writes)
- **Confidence:** ~68%

---

### Phase 48 — Compile Notes Workflow (Spec Ph 8)

- **Scope:** "Compile Notes" button at end of work creates: structured office package, equipment history updates, quote recommendations, unresolved issue tracking, dispatcher review package. Merges Field Chronicle compile + Dictation Hub Complete & Sync into one unified flow.
- **Files to touch:** `conversational_timeline.js`, `job_context_engine.js`, possibly Gemini compile prompt.
- **Recommended model:** Opus 4.6 (multi-output compilation, Firestore writes, Gemini)
- **Confidence:** ~60%

---

### Phase 49 — Dispatcher Review + Customer Report (Spec Ph 9)

- **Scope:** Dispatcher receives structured package. AI generates customer-facing report. Dispatcher reviews/edits/approves. Vertex learns from dispatcher edits (future weighting adjustment). Customer portal shows approved report.
- **Files to touch:** Dispatcher-side: `ai_report_reviewer.js`, `service_call.js`, `index.html`. Learning: new Firestore collection for edit history.
- **Recommended model:** Opus 4.6 (Firestore writes, learning model, customer-facing)
- **Confidence:** ~55%

---

### Phase 50 — Post-Job Learning Sync (Spec Ph 10)

- **Scope:** After checkout, upload transcripts, corrections, confidence scores, parse failures, vocabulary corrections, workflow patterns. System learns quietly — no manual training.
- **Recommended model:** Opus 4.6
- **Confidence:** ~58%

---

### Phase 51 — Site Notes + Operational Memory (Spec Ph 11)

- **Scope:** Extend Site Intel with full operational memory: unresolved issues, recurring failures, previous quotes, historical deficiencies. Load locally on job check-in. Maintain across years.
- **Recommended model:** Sonnet 4.6 (extends existing Site Intel pattern)
- **Confidence:** ~72%

---

### Phase 52 — Technician Teaching Layer (Spec Ph 12)

- **Scope:** Senior techs save photos, videos, voice explanations, procedures at site/equipment/model/company scope levels. Junior techs see relevant teaching material surfaced contextually.
- **Recommended model:** Opus 4.6 (new Firestore schema, media + knowledge model)
- **Confidence:** ~55%

---

### Phase 53 — Knowledge Lookup Ladder (Spec Ph 13)

- **Scope:** When tech asks for help: search current job notes → site notes → equipment history → company knowledge → uploaded manuals → internet. Cache successful lookups for future techs.
- **Recommended model:** Opus 4.6 (multi-source retrieval, Gemini, knowledge graph)
- **Confidence:** ~50%

---

## Build Order & Dependencies

```
Phase 41 (Timeline UI) ← FOUNDATION — everything else depends on this
  └─ Phase 42 (Local Context) ← needed by 43, 45, 47, 48
       ├─ Phase 43 (Edge Intent) ← needed by 44, 46
       │    └─ Phase 44 (Voice Follow-Ups)
       │    └─ Phase 46 (Corrections)
       ├─ Phase 45 (Checklist Reminders)
       └─ Phase 47 (Media Tagging)
            └─ Phase 48 (Compile Notes) ← needed by 49
                 └─ Phase 49 (Dispatcher Review) ← needed by 50
                      └─ Phase 50 (Learning Sync)
Phase 51 (Operational Memory) ← can start after Phase 42
Phase 52 (Teaching Layer)     ← can start after Phase 42
Phase 53 (Knowledge Lookup)   ← can start after Phase 51 + 52
```

---

## Multitask Mode (Cursor background agents) — when and how to use

### Rule: sequential first, parallel later

Phases 41–42 (slices 41a through 42b) **must be built sequentially by a single agent**. These are foundation slices — every one writes to `conversational_timeline.js` and/or `technician/index.html`. Parallel agents editing the same files will create merge conflicts.

**Do not offer or use multitask mode until Phase 42b is shipped and stable.**

### When multitask becomes safe (after Phase 42b ships)

Once the timeline UI + local context engine are stable, the dependency graph opens independent branches. The following phase groups can run as **parallel background agents** because they touch **different files** and have **no data-path overlap**:

| Agent slot | Phase(s) | Key files (exclusive) | Model |
|------------|----------|-----------------------|-------|
| Agent A | **43** (Edge Intent) | `edge_intent_engine.js` (NEW) | Codex 5.3 |
| Agent B | **45** (Checklist Reminders) | `checklist_reminder_engine.js` (NEW) | Opus 4.6 |
| Agent C | **51** (Operational Memory) | Extends `workspace_ui.js`, `job_context_engine.js` reads | Sonnet 4.6 |
| Agent D | **52** (Teaching Layer) | New `teaching_layer.js` + new Firestore collection | Opus 4.6 |

**Later parallel window (after Phase 43 ships):**

| Agent slot | Phase(s) | Key files (exclusive) | Model |
|------------|----------|-----------------------|-------|
| Agent E | **44** (Voice Follow-Ups) | `conversational_timeline.js` (speech handler section) | Sonnet 4.6 |
| Agent F | **46** (Corrections + Editable Timeline) | `conversational_timeline.js` (edit handler section) | Sonnet 4.6 |

> **Warning:** Agents E and F both touch `conversational_timeline.js`. Only run them in parallel if the file is large enough that their edit regions are clearly separated. If in doubt, run sequentially.

**Dispatcher-side parallel window (after Phase 48 ships):**

| Agent slot | Phase(s) | Key files (exclusive) | Model |
|------------|----------|-----------------------|-------|
| Agent G | **49** (Dispatcher Review) | `ai_report_reviewer.js`, `service_call.js`, `index.html` | Opus 4.6 |
| Agent H | **50** (Learning Sync) | New `learning_sync.js` + Firestore collection | Opus 4.6 |

### Hard rules for any multitask session

1. **Never run two agents against `technician/index.html` at the same time.** This file is ~10,750 lines of combined HTML/CSS/JS — concurrent edits will conflict.
2. **Each agent must follow `.cursorrules` §6B1** — model gate required per slice before implementation. The user must clear the gate for each agent's task.
3. **Each agent must specify its model** in the Task tool `model` parameter when the recommended model differs from the parent chat's model.
4. **Firestore-write slices stay on Opus 4.6.** Do not delegate Firestore schema or write-path work to a Fast or Balanced model agent, even in multitask.
5. **After all parallel agents finish:** run a single sequential agent to integration-test, bump `VC_BUILD`, update `CURRENT_STATE.md`, and commit+push. Do not let individual agents push independently.

### Prompt template for the user (copy/paste when ready)

When the user is ready to use multitask mode after Phase 42b ships, suggest they use this pattern:

```
I want to build the following phases in parallel using multitask mode:
- Phase [X]: [description]
- Phase [Y]: [description]

Pre-approved model: Opus 4.6 — proceed

Use background agents. Each agent should follow .cursorrules §6B1 
and the rules in NEW_FIELDTECH_UX_PLAN.md § Multitask Mode.
```

The agent receiving this prompt should:
1. Verify the requested phases are in an independent branch per the dependency graph above.
2. Verify no two agents will edit the same file.
3. Launch background Task agents with explicit `model` parameters matching the table above.
4. After all agents complete, run integration + commit as a single sequential step.

---

## Invariants (every slice must not break)

- Existing workspace flow (`openWorkspace`, `switchScreen`, schedule) must keep working throughout — new timeline is additive, not a rip-and-replace until stable.
- Existing Firestore write paths (`Complete & Sync`, `field_forms`, `equipment_manager`) remain functional.
- Offline behavior must not regress — new features degrade gracefully when offline.
- `VC_BUILD` stamp must bump on every slice ship.
- No React, no Node backend, no build tools — vanilla HTML/JS/CSS only.
- Dynamic checklists load from `form_templates` — never hardcode PM items in tech app.

---

## Immediate next: Phase 41a

Start with **Slice 41a — Timeline container + message rendering**. This establishes the visual foundation. Re-gate per `.cursorrules` §6B1 before implementation.
