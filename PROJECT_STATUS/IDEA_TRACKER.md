# Idea Tracker — Icebox Cross-Reference

Cross-references raw ideas from `#icebox` (Slack) against Cursor session history and ROADMAP.
**Update this file whenever a Cursor session discusses, plans, or ships an icebox idea.**

## Statuses
- `fresh` — not yet discussed in any Cursor session
- `discussed` — talked about, no build work started
- `in-progress` — active slice or phase exists / being built
- `shipped` — implemented and deployed
- `tracked` — promoted to ROADMAP.md; build not yet started
- `parked` — explicitly deferred; needs re-evaluation before picking up

---

## Ideas

| Idea | Status | Last Touched | Session / Notes |
|------|--------|--------------|-----------------|
| **Vertex Field Intelligence System** — Core vision doc: quiet apprentice model, 3 operating modes (Listen/Compile/Reflect), 3 memory layers (Job/Site/Skill), multi-tech learning, long-term AR interface | `in-progress` | 2026-05-17 | Phase 63 (Contextual Checklists) shipped 2026-05-17 — includes nameplate OCR, adaptive reminders, and equipment history. Full vision (AR, multi-tech learning) still pending. |
| **Grounded Field Intelligence Build Direction** — Phase 1: Capture & Compile Notes with structured service report sections. Phase 2: Memory separation in Firestore. Specific AI behavior rules (no invented measurements, preserve raw notes, flag confidence). | `in-progress` | 2026-05-17 | Implementation doc discussed May 14. Phase 63 covers Compile + equipment history. Agent Architecture Separation (63-agent-modules, shipped 2026-05-17) covers the agent-chain pattern. |
| **Multi-Agent Architecture** — Specialized agents (Quoting, Tech Notes Parsing, HVAC Parts Expert) that chain together instead of one monolithic AI | `shipped` | 2026-05-17 | Shipped 2026-05-17: extracted 5 agent modules + shared Gemini client from `conversational_timeline.js`. See outcome log row "Agent Architecture Separation." |
| **Quote from Tech Notes** — Mechanism to turn technician field findings directly into a repair quote | `in-progress` | 2026-05-16 | Phase 64 (AI Quote Pipeline). Spec at `PROJECT_STATUS/ai_quote_pipeline_spec.md`. Slices 64a–64e authored 2026-05-16. Quoting Agent is part of multi-agent chain above. |
| **E-Ink Parts Staging System** — MinewTag e-ink shelf labels + painted floor squares in shop. Distributors deliver to labeled spots. Tech bins for van restock. AI bin assignment via vendor API + AI inference + historical learning. Parts Lookup Agent (part num resolution + physical dims + staging slot). | `fresh` | — | Not yet discussed in any Cursor session. Detailed notes in #icebox (3 messages). Remote door unlock already set up; demo kit arriving. |
| **Van Restock / Tool Tracking** — Complete the half-built van restock tool. Dynamic lists (jman/apprentice tools + consumables). Techs report broken tools, request replacements. System knows tool, vendor, cost. Dispatcher approves orders. | `tracked` | — | In ROADMAP.md as "Field Inventory (Truck Stock)." Not yet in active build. Related to E-Ink staging above. |
| **Vertex Projects (Progress Photos & Notes)** — Chat interface for project documentation: photos, videos, install notes. Geofence-based daily report auto-compile. Sync to project folder. Track parts and supplies needed. | `tracked` | — | Related to ROADMAP "Architecture Epic: Unified Contextual Modes (Service vs. Project)" — Project Workspace concept. See ROADMAP Icebox section. |
| **Toggle-Recording Voice Input (Whisper-backed)** — Replace PTT hold with toggle button (press once to start, press again to stop — no thumb holding). Animated sine wave while capturing. On stop: send audio blob to **OpenAI Whisper API** with an HVAC vocabulary prompt (belt sizes, filter dims, part names pre-loaded) for accurate domain-specific transcription. Replaces native iPhone speech-to-text (Web Speech API) which mishears HVAC terms. Solves both the PTT slipping bug (#issues-found) and the "heard me wrong" accuracy bug simultaneously. | `discussed` | 2026-05-17 | Fully scoped in chat 2026-05-17. ChatGPT voice UX is the interaction model reference (tap-toggle + waveform, not ChatGPT's conversation style). Whisper + HVAC domain prompt is the accuracy fix. No Cursor build session yet. |
| **Streamlined / Less-Cramped UI** — Continue the clean direction started in the May 15 redesign. Goal: app feels airy and easy to read, nothing competing for attention. "Slack-style" was the reference for the *feel* (comfortable spacing, clean lines) — not a literal Slack copy. The ChatGPT-style v1–v8 redesign was a step in the right direction; this is about continuing to push that. | `discussed` | 2026-05-17 | Clarified in chat 2026-05-17. Not a UI framework swap — a polish direction. No specific Cursor build session yet. |
| **Parallel Slice Execution** — Run non-overlapping slices concurrently via cloud runtime. File-overlap detection, concurrent Agent.create runs, merge/cherry-pick logic, build_state.json locking. | `parked` | 2026-05-16 | Flagged in #icebox as "revisit when batch sizes grow." Sequential runner is working fine. No Cursor session on this yet. |

---

## How to maintain this file

1. When a Cursor session **discusses** an icebox idea for the first time → update `Status` to `discussed`, set `Last Touched`, add session context in `Notes`.
2. When a **slice or phase** is authored for an idea → update to `in-progress`, link the phase.
3. When work **ships** → update to `shipped` with date.
4. When an idea is **added to ROADMAP.md** without active build → set `tracked`.
5. When an idea is **explicitly deferred** → set `parked` with reason.
6. New ideas from Slack that haven't been triaged yet → add a row with `fresh` and the date first seen in Slack.
