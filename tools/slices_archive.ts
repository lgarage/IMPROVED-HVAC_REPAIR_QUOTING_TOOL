// Passed slices archived from slices.ts. Import and search if you need
//  dependency or scope info for a completed slice.

import type { Slice } from "./slices";

export const ARCHIVED_SLICES: Slice[] = [
  // ─── Phase 41: Conversational Timeline UI ───
  {
    id: "41a",
    phase: 41,
    title: "Timeline container + message rendering",
    dependsOn: [],
    patterns: ["UI container / HTML+CSS layout", "New JS module (IIFE, no Firestore)"],
    riskLevel: "safe",
    filesToCreate: ["conversational_timeline.js"],
    filesToModify: ["technician/index.html"],
    expectedIds: ["conversational-timeline", "ct-message-list"],
    expectedExports: { "conversational_timeline.js": ["addEntry", "renderTimeline"] },
    scope: `Create a new conversational timeline UI inside #screen-workspace in technician/index.html. 
New file: conversational_timeline.js (IIFE pattern matching existing modules like field_chronicle.js).
The timeline is a single scrollable container showing message bubbles — tech messages on right (cyan), system responses on left (gray). 
Seed the timeline with activeTicket data on openWorkspace (job info, customer, site).
CSS: chat-bubble layout, auto-scroll to bottom, obsidian background (#1a1a2e) with cyan accents matching existing theme.
Wire: add <script src="../conversational_timeline.js?v=1"></script> before closing </body> in technician/index.html.
The timeline container sits ABOVE the existing dictation hub section — additive, not replacing anything yet.
Export window.ConversationalTimeline = { init, addEntry, renderTimeline, scrollToBottom }.
Use localStorage keyed by ticketId for timeline persistence between reloads.`,
    outOfScope: "Voice input, media capture, follow-up prompts, Vertex AI responses, Firestore writes.",
    cacheBusts: ["conversational_timeline.js?v=1"],
  },
  {
    id: "41b",
    phase: 41,
    title: "Hold-to-Talk + live STT in timeline",
    dependsOn: ["41a"],
    patterns: ["Speech API / media capture integration", "Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "technician/index.html"],
    expectedIds: ["ct-action-bar", "ct-talk-btn"],
    expectedExports: { "conversational_timeline.js": ["startListening", "stopListening"] },
    scope: `Add a bottom action bar to the conversational timeline with a Hold-to-Talk button (right side).
Press-and-hold triggers webkitSpeechRecognition (or SpeechRecognition). Live transcript appears as a "draft" bubble (pulsing border).
Release → finalize entry → add to timeline as a tech message.
Fallback: text input field between the buttons for type-to-add.
The action bar is fixed at the bottom of #conversational-timeline, always visible.
CSS: large circular talk button (56px), glove-friendly tap target, cyan glow while recording.
Handle: permission denied, not-supported browser, and interim vs final results.
Must work on mobile Safari (iOS) and Chrome Android.`,
    outOfScope: "Photo/video capture button (that's 41c). Vertex AI responses.",
    cacheBusts: ["conversational_timeline.js?v=2"],
  },
  {
    id: "41c",
    phase: 41,
    title: "Media capture button + timeline attachment",
    dependsOn: ["41b"],
    patterns: ["Speech API / media capture integration", "UI container / HTML+CSS layout"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "technician/index.html"],
    expectedIds: ["ct-media-btn"],
    expectedExports: { "conversational_timeline.js": ["capturePhoto", "captureVideo"] },
    scope: `Add a media capture button (left side of action bar, beside the talk button).
Tap → open camera for photo (input type="file" accept="image/*" — NO capture attribute so iOS shows full picker).
Hold (500ms) → start video recording via MediaRecorder API.
Captured media appears as a timeline entry with thumbnail (80px wide), timestamp, and file size.
Upload to Firebase Storage using existing pattern: firebase.storage().ref().child('field_evidence/{ticketId}/{timestamp}_{filename}').
Show upload progress bar on the timeline entry.
Auto-attach metadata: activeTicketId, technicianName, timestamp.
CSS: camera icon button (56px), same style as talk button. Dashed border placeholder while uploading.`,
    outOfScope: "Equipment-context auto-detection (that's Phase 42). Office/customer visibility split (Phase 47).",
    cacheBusts: ["conversational_timeline.js?v=3"],
  },
  {
    id: "41d",
    phase: 41,
    title: "Vertex system responses (confirmation + short follow-ups)",
    dependsOn: ["41c"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js"],
    expectedIds: [],
    expectedExports: { "conversational_timeline.js": ["processEntry", "generateResponse"] },
    scope: `After tech adds a timeline entry, Vertex responds with a system bubble on the left side.
v1 is rule-based (no AI):
- Entry contains text → "Got it." + timestamp
- Entry contains photo/video → "📷 Saved." or "🎥 Saved."
- Entry mentions equipment reference (regex: RTU\\d+, Unit\\s*\\d+, AHU\\d+, etc.) → "Got it. [equipment ref]."
- Entry is very short (<5 words, no equipment) → "Got it."
Follow-up stub: if the last 3 entries have no equipment reference, show a subtle prompt: "Which unit?" (gray italic, dismissible).
System bubbles have a small Vertex icon (use a simple "V" monogram in a circle).
Add a 300ms delay before system response appears (feels more natural than instant).`,
    outOfScope: "AI-powered follow-ups, checklist reminders, confidence-based escalation. Those are Phases 43-45.",
    cacheBusts: ["conversational_timeline.js?v=4"],
  },

  // ─── Phase 42: Local Job Context Engine ───
  {
    id: "42a",
    phase: 42,
    title: "Context preload on openWorkspace",
    dependsOn: ["41a"],
    patterns: ["Firestore multi-read (query, no writes)", "New JS module (IIFE, no Firestore)"],
    riskLevel: "review",
    filesToCreate: ["job_context_engine.js"],
    filesToModify: ["technician/index.html"],
    expectedIds: [],
    expectedExports: { "job_context_engine.js": ["preloadContext", "getContext", "clearContext"] },
    scope: `New file: job_context_engine.js (IIFE, exports window.JobContextEngine).
On openWorkspace(ticketId), bulk-fetch and cache in localStorage (keyed by ticketId):
- Site intel notes (existing site_intelligence doc)
- Equipment list (Customers/{custId}/Equipment collection)
- Last 10 completed reports for this site (completed_reports where customerName + locationAddress match)
- Previous tech notes from activeTicket.techNotes and internal_comms
- Open quotes (if field exists on activeTicket)
Use Promise.all for parallel Firestore reads. Total: 4-5 reads max.
Expose window.VCJobContext = { siteNotes, equipment[], recentReports[], techNotes, quotes[], activeEquipment: null }.
Cache expires after 4 hours (store timestamp, re-fetch if stale).
Graceful offline: if reads fail, use cached version with a subtle "Offline — using cached data" indicator.
Wire: add <script src="../job_context_engine.js?v=1"></script> in technician/index.html before conversational_timeline.js.`,
    outOfScope: "12-month history (too expensive for v1). Offline writes. Equipment context tracking (42b).",
    cacheBusts: ["job_context_engine.js?v=1"],
  },
  {
    id: "42b",
    phase: 42,
    title: "Active equipment context tracking",
    dependsOn: ["42a", "41d"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["job_context_engine.js", "conversational_timeline.js"],
    expectedIds: ["ct-active-equipment"],
    expectedExports: { "job_context_engine.js": ["setActiveEquipment", "getActiveEquipment"] },
    scope: `Add active equipment tracking to JobContextEngine.
When a timeline entry mentions an equipment reference (RTU4, Unit 7, AHU2, etc.), 
auto-set VCJobContext.activeEquipment to that reference.
Show a small sticky chip at the top of the timeline: "🔧 RTU4" (tappable to change/clear).
All subsequent timeline entries are tagged with the active equipment until changed.
The conversational_timeline.js processEntry function should call JobContextEngine.setActiveEquipment() 
when it detects an equipment reference.
Media captures auto-tagged with active equipment in their metadata.
Regex patterns for equipment: /\\b(RTU|AHU|FCU|MAU|CU|HP|Unit|Chiller|Boiler)\\s*#?\\d+/i`,
    outOfScope: "Persisting equipment context to Firestore. Full offline context engine.",
    cacheBusts: ["job_context_engine.js?v=2", "conversational_timeline.js?v=5"],
  },

  // ─── Phase 43: Edge Intent Engine ───
  {
    id: "43a",
    phase: 43,
    title: "HVAC vocabulary correction + local entity extraction",
    dependsOn: ["42b"],
    patterns: ["Pure regex / dictionary logic", "New JS module (IIFE, no Firestore)"],
    riskLevel: "safe",
    filesToCreate: ["edge_intent_engine.js"],
    filesToModify: ["technician/index.html", "conversational_timeline.js"],
    expectedIds: [],
    expectedExports: { "edge_intent_engine.js": ["parse", "correctVocab", "extractEntities"] },
    scope: `New file: edge_intent_engine.js (IIFE, exports window.EdgeIntentEngine).
Dictionary-based HVAC term correction: map common speech-to-text errors to correct terms.
Include at least 30 mappings: "cat pastor"→"capacitor", "mc ferry"→"microfarad", "colonizer"→"economizer",
"connector fan"→"condenser fan", "shiv"→"sheave", "compress her"→"compressor", etc.
Regex-based entity extraction returning { entities[], confidence: 0-1 }:
- Equipment refs: RTU/AHU/FCU/MAU/Unit + number
- Temperatures: numbers followed by degrees/°F/°C or preceded by "temp"/"supply"/"return"
- Amp draws: numbers followed by "amps"/"A" or preceded by "amps"/"draw"
- Refrigerant: R-22, R-410A, R-407C, etc.
- Belt sizes: AX##, BX##, A##, B##
- Parts: capacitor, contactor, relay, motor, belt, filter, etc.
- Capacitance: numbers followed by "microfarad"/"µF"/"mfd"
Wire into conversational_timeline.js processEntry: run EdgeIntentEngine.parse(text) before generateResponse.`,
    outOfScope: "Cloud escalation (43b). Learning from corrections. Persisting dictionary updates.",
    cacheBusts: ["edge_intent_engine.js?v=1", "conversational_timeline.js?v=6"],
  },
  {
    id: "43b",
    phase: 43,
    title: "Confidence-based cloud escalation",
    dependsOn: ["43a"],
    patterns: ["Gemini prompt integration", "Cross-module wiring (3+ files)"],
    riskLevel: "review",
    filesToCreate: [],
    filesToModify: ["edge_intent_engine.js", "conversational_timeline.js"],
    expectedIds: [],
    expectedExports: { "edge_intent_engine.js": ["escalateToCloud"] },
    scope: `Add confidence-based escalation to EdgeIntentEngine.
When parse() returns confidence < 0.6, silently send to Gemini for structured parse.
Reuse the existing Gemini API pattern from dictation_hub.js (getGeminiApiKey from firebase-config.js, 
fetch to generativelanguage.googleapis.com).
Gemini prompt: "Extract structured HVAC field data from this technician note. Return JSON with: 
equipment, temperatures, ampDraws, parts, deficiencies, actions. Note: {text}"
High confidence (≥0.8) → "Got it." 
Medium confidence (0.6-0.8) → short clarification bubble ("RTU4?" or "Capacitor reading?")
Low confidence (<0.6) → cloud escalation → use Gemini result → if still uncertain, ask shortest follow-up.
Important: do NOT constantly ask technicians to confirm obvious things.`,
    outOfScope: "Learning from escalation patterns. Offline escalation queue.",
    cacheBusts: ["edge_intent_engine.js?v=2", "conversational_timeline.js?v=7"],
  },

  // ─── Phase 44: Voice + Text Follow-Ups ───
  {
    id: "44a",
    phase: 44,
    title: "Voice responses to follow-up prompts",
    dependsOn: ["43a"],
    patterns: ["Speech API / media capture integration", "Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "technician/index.html"],
    expectedIds: ["ct-settings-voice"],
    expectedExports: { "conversational_timeline.js": ["handleFollowUpResponse"] },
    scope: `When Vertex shows a follow-up prompt ("RTU4?", "Capacitor?"), tech can answer by voice.
Speech recognition stays active for 3 seconds after a follow-up appears.
Parse spoken responses: "yes", "no", "skip", "correct"/"correction", number values, equipment refs.
Also allow tapping quick-reply buttons below the follow-up: [Yes] [No] [Skip].
Settings (stored in localStorage):
- Voice + Text mode (default): spoken prompts + text bubbles
- Text Only mode: text bubbles + ding/vibration notification
- Silent mode: visual only, no sound
Add a small gear icon in the timeline header that opens a bottom-sheet with these 3 options.`,
    outOfScope: "Settings sync to Firestore. Custom wake words.",
    cacheBusts: ["conversational_timeline.js?v=8"],
  },

  // ─── Phase 45: Dynamic Checklist Reminder Engine ───
  {
    id: "45a",
    phase: 45,
    title: "Checklist reminder engine from form_templates",
    dependsOn: ["42b"],
    patterns: ["Cross-module wiring (3+ files)", "Firestore multi-read (query, no writes)"],
    riskLevel: "review",
    filesToCreate: ["checklist_reminder_engine.js"],
    filesToModify: ["technician/index.html", "conversational_timeline.js", "job_context_engine.js"],
    expectedIds: [],
    expectedExports: { "checklist_reminder_engine.js": ["loadWorkflow", "checkMissing", "getReminders"] },
    scope: `New file: checklist_reminder_engine.js (IIFE, exports window.ChecklistReminderEngine).
CRITICAL: Do NOT hardcode PM checklists. Load dynamically from form_templates Firestore collection
(same collection used by field_forms.js).
On job check-in, load the relevant workflow template based on ticket type (PM, service call, etc.).
Track completion state per equipment in VCJobContext: which checklist items have been mentioned
in timeline entries (match by EdgeIntentEngine entity extraction).
When tech says "moving onto RTU7", check RTU6's workflow state for missing items.
If items missing, surface as a timeline follow-up: "RTU6 capacitor?" (short, not aggressive).
Reminder philosophy: assist and remind, never hard-block or force forms.
Wire into conversational_timeline when equipment context changes.`,
    outOfScope: "Custom workflow editor. Escalation logic. Quote triggers from checklist.",
    cacheBusts: ["checklist_reminder_engine.js?v=1", "conversational_timeline.js?v=9"],
  },

  // ─── Phase 46: Corrections + Editable Timeline ───
  {
    id: "46a",
    phase: 46,
    title: "Editable timeline entries + voice corrections",
    dependsOn: ["43a"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js"],
    expectedIds: [],
    expectedExports: { "conversational_timeline.js": ["editEntry", "handleCorrection"] },
    scope: `Allow corrections to timeline entries.
Tap a timeline entry → inline edit mode (contenteditable, save/cancel buttons).
Voice correction: if entry text starts with "correction" or "actually", parse the correction
and update the most recent relevant entry (match by equipment ref or recency).
Example: "correction, that was RTU6" → update last entry's equipment tag from RTU4 to RTU6.
Store both original transcript and corrected version in the entry object.
Corrected entries show a small "edited" indicator.
Corrections feed back to EdgeIntentEngine vocabulary (if "cat pastor" was corrected to "capacitor",
remember that mapping for this session in localStorage).`,
    outOfScope: "Persisting corrections to Firestore for long-term learning. Undo history beyond current session.",
    cacheBusts: ["conversational_timeline.js?v=10"],
  },

  // ─── Phase 47: Media + Context Tagging ───
  {
    id: "47a",
    phase: 47,
    title: "Auto-tag media with equipment context + visibility",
    dependsOn: ["42b"],
    patterns: ["Firestore write path (new collection/doc)", "Cross-module wiring (3+ files)"],
    riskLevel: "review",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "job_context_engine.js"],
    expectedIds: [],
    expectedExports: { "conversational_timeline.js": ["tagMedia"] },
    scope: `Enhance media capture to auto-tag with full context.
When a photo/video is captured, attach metadata:
- jobId (activeTicketId)
- equipmentRef (from VCJobContext.activeEquipment)
- technicianName
- timestamp
- visibility: "internal" (default — office can see, customer cannot)
Write metadata to Firestore: Customers/{custId}/Equipment/{equipId}/media/{autoId}
(or field_evidence/{ticketId}/media/{autoId} if no equipment context).
Office view: group media by equipment in the dispatcher's service call view.
Customer view: only show media marked as visibility:"customer" (future — dispatcher toggles this).
Timeline entry for media shows the equipment tag badge if active equipment was set.`,
    outOfScope: "Dispatcher UI for toggling customer visibility. Video thumbnails. Media compression.",
    cacheBusts: ["conversational_timeline.js?v=11", "job_context_engine.js?v=3"],
  },

  // ─── Phase 48: Compile Notes Workflow ───
  {
    id: "48a",
    phase: 48,
    title: "Compile Notes — unified structured output",
    dependsOn: ["47a"],
    patterns: ["Gemini prompt integration", "Firestore write path (new collection/doc)"],
    riskLevel: "review",
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "technician/index.html"],
    expectedIds: ["ct-compile-btn", "ct-compile-modal"],
    expectedExports: { "conversational_timeline.js": ["compileNotes"] },
    scope: `Add "Compile Notes" button at bottom of timeline (appears after ≥3 entries exist).
Tap → gather all timeline entries + equipment context + checklist state.
Send to Gemini with a structured prompt requesting:
1. Per-equipment findings summary (diagnosis, measurements, actions taken)
2. Quote recommendations (parts mentioned, labor estimates)
3. Unresolved issues (items flagged but not resolved)
4. Equipment history updates (new data points per unit)
Show result in an editable modal (like Field Chronicle's compile preview).
Copy Summary button for clipboard. 
On "Submit to Office" → write structured package to Firestore:
- completed_reports/{autoId} with structured JSON
- Update each equipment's work_history subcollection
- Flag unresolved issues on site_intelligence doc
This merges the Field Chronicle compile + Dictation Hub Complete & Sync into one flow.`,
    outOfScope: "Customer-facing report generation (Phase 49). Quote creation.",
    cacheBusts: ["conversational_timeline.js?v=12"],
  },

  // ─── Phase 49: Dispatcher Review + Customer Report ───
  {
    id: "49a",
    phase: 49,
    title: "Dispatcher review workflow + customer report",
    dependsOn: ["48a"],
    patterns: ["Firestore write path (new collection/doc)", "Gemini prompt integration"],
    riskLevel: "review",
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["dispatcher/js/ai_report_reviewer.js", "service_call.js", "index.html"],
    expectedIds: ["vc-review-package"],
    expectedExports: {},
    scope: `Extend the dispatcher's AI Report Reviewer to receive the structured package from Phase 48.
When a technician submits via Compile Notes, the structured package appears in the dispatcher's
service call view as a "Review Package" card.
Dispatcher can:
- View per-equipment findings
- Edit AI-generated wording
- Remove findings or mark as internal-only
- Approve for customer report
On approval → generate customer-facing report (clean prose, approved photos only).
Track dispatcher edits in a Firestore subcollection: completed_reports/{id}/review_edits/{autoId}
with { original, edited, field, editedBy, timestamp }.
Human review is REQUIRED before any customer-facing release.`,
    outOfScope: "AI learning from edits (Phase 50). Customer portal delivery.",
    cacheBusts: ["ai_report_reviewer.js?v=4", "service_call.js?v=70"],
  },

  // ─── Phase 50: Post-Job Learning Sync ───
  {
    id: "50a",
    phase: 50,
    title: "Post-job learning upload",
    dependsOn: ["49a"],
    patterns: ["Firestore write path (new collection/doc)", "Cross-module wiring (3+ files)"],
    riskLevel: "review",
    filesToCreate: ["learning_sync.js"],
    filesToModify: ["technician/index.html", "conversational_timeline.js"],
    expectedIds: [],
    expectedExports: { "learning_sync.js": ["uploadLearningData"] },
    scope: `New file: learning_sync.js (IIFE, exports window.LearningSync).
After job checkout (Compile Notes submitted), silently upload:
- Vocabulary corrections made during session (from EdgeIntentEngine)
- Confidence scores per entity extraction
- Cloud escalation results
- Dispatcher edit history (from review_edits subcollection)
Write to Firestore: tenants/{tid}/learning_data/{autoId}
System learns from: corrections, reviews, repeated patterns, dispatcher edits.
Technicians should NOT manually train the system — learning is passive.
Include a simple weight adjustment: if a dispatcher consistently removes a finding type,
reduce its default inclusion weight in future Gemini compile prompts.`,
    outOfScope: "ML model retraining. Real-time learning during active job.",
    cacheBusts: ["learning_sync.js?v=1"],
  },

  // ─── Phase 51: Site Notes + Operational Memory ───
  {
    id: "51a",
    phase: 51,
    title: "Extended site notes + operational memory",
    dependsOn: ["42a"],
    patterns: ["Firestore multi-read (query, no writes)", "Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["job_context_engine.js", "conversational_timeline.js", "technician/index.html"],
    expectedIds: ["ct-site-memory"],
    expectedExports: { "job_context_engine.js": ["getSiteMemory", "getUnresolvedIssues"] },
    scope: `Extend JobContextEngine preload to include full operational memory:
- Unresolved issues from previous visits (from site_intelligence doc)
- Recurring failures (equipment with ≥2 deficiency entries in work_history)
- Previous quotes (from service calls at this site)
- Historical deficiencies (aggregated from completed_reports)
Surface on workspace open: a collapsible "Site Memory" panel at top of timeline showing:
- ⚠️ Unresolved from last visit: [list]
- 🔄 Recurring: [equipment + issue pattern]
- 📝 Site notes: [access codes, ladder info, parking, etc.]
Load locally from cached context — no additional Firestore reads beyond 42a preload.
Goal: maintain operational continuity across years and technician turnover.`,
    outOfScope: "Editing site memory from timeline. Writing new site notes to Firestore.",
    cacheBusts: ["job_context_engine.js?v=4", "conversational_timeline.js?v=13"],
  },

  // ─── Phase 52: Technician Teaching Layer ───
  {
    id: "52a",
    phase: 52,
    title: "Knowledge capture + contextual surfacing",
    dependsOn: ["42a"],
    patterns: ["Firestore write path (new collection/doc)", "New JS module (IIFE, no Firestore)"],
    riskLevel: "review",
    filesToCreate: ["teaching_layer.js"],
    filesToModify: ["technician/index.html", "conversational_timeline.js"],
    expectedIds: ["ct-teaching-btn", "ct-knowledge-panel"],
    expectedExports: { "teaching_layer.js": ["saveTeaching", "findTeaching", "getRelevantKnowledge"] },
    scope: `New file: teaching_layer.js (IIFE, exports window.TeachingLayer).
Senior techs can save teaching notes via a "💡 Teach" button in the action bar:
- Photo + voice explanation
- Text procedure
- Video walkthrough
Scope levels for each teaching note:
- Site-specific (ladder access, thermostat location)
- Equipment-specific (RTU6 black-box economizer quirk)
- Model-specific (Honeywell 8000 setup procedure)
- Company-wide (PM best practices, bearing identification)
Write to Firestore: tenants/{tid}/knowledge/{autoId} with { scope, scopeRef, mediaUrls[], text, 
createdBy, timestamp, tags[] }.
Contextual surfacing: when tech opens a workspace, check knowledge collection for:
- Matching site (by customerName + locationAddress)
- Matching equipment model/brand
- Company-wide tips for current work type
Show relevant knowledge as a subtle "💡 Tips available" chip — tap to expand panel.`,
    outOfScope: "Knowledge approval workflow. Gamification. Video transcription.",
    cacheBusts: ["teaching_layer.js?v=1"],
  },

  // ─── Phase 53: Knowledge Lookup Ladder ───
  {
    id: "53a",
    phase: 53,
    title: "Hierarchical knowledge retrieval",
    dependsOn: ["51a", "52a"],
    patterns: ["Gemini prompt integration", "Cross-module wiring (3+ files)"],
    riskLevel: "review",
    filesToCreate: [],
    filesToModify: ["teaching_layer.js", "job_context_engine.js", "conversational_timeline.js"],
    expectedIds: ["ct-ask-btn"],
    expectedExports: { "teaching_layer.js": ["lookupKnowledge"] },
    scope: `Add a "❓ Ask" button to the action bar. Tech types or speaks a question.
Lookup ladder (stop at first hit):
1. Current job notes (search timeline entries)
2. Site notes (from VCJobContext.siteNotes)
3. Equipment history (from VCJobContext.equipment work_history)
4. Company-wide knowledge (from TeachingLayer.findTeaching with company-wide scope)
5. Uploaded manuals (future — stub this level, return "No manual found")
6. Cloud lookup via Gemini (send question + context, get answer)
If cloud lookup succeeds, offer to save the answer:
- "Save as company knowledge?" → writes to knowledge collection with company-wide scope
- "Save as site note?" → writes to site_intelligence
Display answer as a system bubble with source badge: "📖 Site notes" / "🏢 Company" / "☁️ Cloud".
Future techs at the same site or with same equipment benefit automatically.`,
    outOfScope: "Manual upload system. Full-text search across all knowledge. Embedding/vector search.",
    cacheBusts: ["teaching_layer.js?v=2", "conversational_timeline.js?v=14"],
  },

  // ═══════════════════════════════════════════════════════════
  //  Phase 54: Integration & Hardening
  // ═══════════════════════════════════════════════════════════

  {
    id: "54a",
    phase: 54,
    title: "Integration smoke test — all modules load cleanly",
    dependsOn: ["50a", "51a", "52a", "53a"],
    patterns: ["Cross-module wiring (3+ files)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["technician/index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `Integration verification pass across all Phase 41–53 modules.
In technician/index.html, verify:
- All new script tags present and loading in correct order (dependencies before dependents):
  conversational_timeline.js, job_context_engine.js, edge_intent_engine.js,
  checklist_reminder_engine.js, teaching_layer.js, learning_sync.js
- All expected window.* IIFE exports exist: ConversationalTimeline, VCJobContext,
  EdgeIntentEngine, ChecklistReminder, TeachingLayer, LearningSync
- Add a self-test block at bottom of technician/index.html that runs on load (gated by
  window.VC_INTEGRATION_TEST flag) and logs pass/fail for each module to console.
- Fix any broken cross-references between modules (e.g. timeline calling EdgeIntentEngine
  but function name doesn't match).
- Consolidate VC_BUILD stamp to a single current value.
Do NOT change module logic — only fix wiring, load order, and export mismatches.`,
    outOfScope: "Changing module behavior. Adding new features. Firestore writes.",
    cacheBusts: [],
  },
  {
    id: "54b",
    phase: 54,
    title: "Offline graceful degradation for all new modules",
    dependsOn: ["54a"],
    patterns: ["Multi-file UI feature (no Firestore writes)", "Cross-module wiring (3+ files)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: [
      "conversational_timeline.js", "job_context_engine.js", "edge_intent_engine.js",
      "checklist_reminder_engine.js", "teaching_layer.js", "learning_sync.js",
      "technician/index.html",
    ],
    expectedIds: [],
    expectedExports: {},
    scope: `Add offline guards to every new module created in Phases 41–53.
For each module:
- Wrap all Firestore reads/writes in try/catch with fallback to localStorage cache
- job_context_engine.js: if Firestore preload fails, load from localStorage last-cached snapshot
- edge_intent_engine.js: local-only parsing must work without any network calls
- checklist_reminder_engine.js: if form_templates fetch fails, skip reminders gracefully
- teaching_layer.js: if knowledge fetch fails, hide "Tips available" chip
- learning_sync.js: if upload fails, queue to localStorage, retry on next online event
- conversational_timeline.js: timeline must render from localStorage if Firestore unavailable
- Add navigator.onLine check before cloud escalation in edge_intent_engine.js
- Add a subtle "offline" indicator CSS class to the timeline header when !navigator.onLine
Pattern: addEventListener("online"/"offline") to toggle state.
Do NOT add IndexedDB — use localStorage only for now.`,
    outOfScope: "IndexedDB migration. Service worker changes. Full offline-first rewrite.",
    cacheBusts: [
      "conversational_timeline.js?v=15", "job_context_engine.js?v=5",
      "edge_intent_engine.js?v=3", "checklist_reminder_engine.js?v=2",
      "teaching_layer.js?v=3", "learning_sync.js?v=2",
    ],
  },
  {
    id: "54c",
    phase: 54,
    title: "Push review slices + consolidate VC_BUILD",
    dependsOn: ["54a"],
    patterns: ["UI container / HTML+CSS layout"],
    riskLevel: "review",
    filesToCreate: [],
    filesToModify: ["technician/index.html", "index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `Consolidation pass:
1. In technician/index.html: find all VC_BUILD assignments and consolidate to a single
   window.VC_BUILD = "Phase54-Integration-YYYY-MM-DD" (use today's date).
2. In index.html (dispatcher): bump VC_BUILD to match.
3. Run git add -A, git commit with message "Phase 54c: consolidate VC_BUILD after Phases 41-53".
4. Run git push origin main.
This pushes ALL previously committed-but-not-pushed review slices (42a, 43b, 45a, 47a, 48a)
along with the integration and offline fixes.`,
    outOfScope: "Code changes beyond VC_BUILD stamp. New features.",
    cacheBusts: [],
  },

  // ═══════════════════════════════════════════════════════════
  //  Phase 55: Field Deployment Readiness
  // ═══════════════════════════════════════════════════════════

  {
    id: "55a",
    phase: 55,
    title: "Firebase Hosting deploy with all new JS files",
    dependsOn: ["54c"],
    patterns: ["Cross-module wiring (3+ files)"],
    riskLevel: "review",
    filesToCreate: [],
    filesToModify: ["firebase.json"],
    expectedIds: [],
    expectedExports: {},
    scope: `Verify firebase.json hosting config includes all new JS files in the public directory.
Check that the following files are accessible after deploy:
- conversational_timeline.js
- job_context_engine.js
- edge_intent_engine.js
- checklist_reminder_engine.js
- teaching_layer.js
- learning_sync.js
If firebase.json "public" points to root or a subfolder, verify all new files are inside that path.
Add rewrites/headers if needed for cache-control on new JS files (match existing pattern).
Run: npx firebase deploy --only hosting
Verify the live URL loads technician/index.html with no 404s for new scripts (check Network tab).
If any file is missing from the deploy, fix the path or firebase.json config.`,
    outOfScope: "Firestore rules deploy (that's 55b). Cloud Functions. Auth changes.",
    cacheBusts: [],
  },
  {
    id: "55b",
    phase: 55,
    title: "Firestore rules for new collections",
    dependsOn: ["55a"],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    filesToCreate: [],
    filesToModify: ["firestore.rules"],
    expectedIds: [],
    expectedExports: {},
    scope: `Add Firestore security rules for new collections created by Phases 47–52.
New paths that need rules:
- completed_reports/{id}/review_edits/{autoId} — write: admin only; read: authenticated
- tenants/{tid}/learning_data/{autoId} — write: authenticated (field app auto-uploads); read: admin
- tenants/{tid}/knowledge/{autoId} — write: authenticated (techs create teaching notes); read: authenticated
Follow the existing pattern in firestore.rules: explicit allow per path, no catch-all.
Use isStoredAdmin(tid) for admin-only paths (matches existing auth.js pattern).
Use request.auth != null for authenticated-user paths.
Do NOT deploy rules automatically — commit only. User reviews and deploys manually with:
npx firebase deploy --only firestore:rules`,
    outOfScope: "Storage rules. Auth provider changes. Cloud Functions.",
    cacheBusts: [],
  },
  {
    id: "55c",
    phase: 55,
    title: "Auth + roster verification for field test accounts",
    dependsOn: ["55a"],
    patterns: ["Cross-module wiring (3+ files)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["technician/index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `Field deployment verification pass:
1. In technician/index.html, add a diagnostic block (gated by window.VC_FIELD_DIAG flag) that
   on load checks and logs:
   - Firebase Auth state (signed in / anonymous / error)
   - app_config/technicians document accessible (read succeeds or fails)
   - Current tech matched in roster (payroll name found)
   - Schedule subscription active (onSnapshot fires)
   - VCJobContext available (window.VCJobContext exists)
   - ConversationalTimeline available (window.ConversationalTimeline exists)
2. Display results as a dismissible banner at top of schedule screen when VC_FIELD_DIAG is true.
3. Log all results to console for remote debugging via Shadow Mode.
This is a diagnostic tool for field testing — not user-facing in production.`,
    outOfScope: "Creating Firebase Auth accounts. Populating roster data. UI changes beyond diagnostic banner.",
    cacheBusts: [],
  },

  // ═══════════════════════════════════════════════════════════
  //  Phase 56: Offline Photo Outbox + SW Cache
  // ═══════════════════════════════════════════════════════════

  {
    id: "56a",
    phase: 56,
    title: "Offline photo outbox (KI-004)",
    dependsOn: ["55a"],
    patterns: ["New JS module (IIFE, no Firestore)", "Cross-module wiring (3+ files)"],
    riskLevel: "review",
    filesToCreate: ["shared/offline_storage_outbox.js"],
    filesToModify: [
      "technician/index.html", "equipment_manager.js",
      "technician/js/workspace_ui.js", "unit_work_parser.js",
    ],
    expectedIds: ["vcPendingSyncChip"],
    expectedExports: { "shared/offline_storage_outbox.js": ["enqueue", "drain", "getPendingCount"] },
    scope: `New file: shared/offline_storage_outbox.js (IIFE, exports window.VCStorageOutbox).
Implements an IndexedDB-backed queue for Firebase Storage uploads that fail offline.
API: enqueue(storagePath, blob, metadata) → stores in IDB; drain() → retries all pending;
getPendingCount() → number of items waiting.
Auto-drain on 'online' event. Manual drain on app foreground (visibilitychange).
UI: #vcPendingSyncChip — small pill showing pending count, pulses when draining, hides when empty.
Wire into the 8 existing ref.put() call sites in:
- equipment_manager.js (equipment photos — plate + overall)
- technician/index.html (field evidence photos, addendum file uploads)
- unit_work_parser.js (inline equipment photos)
- workspace_ui.js (field evidence uploads)
Pattern at each call site: wrap ref.put(blob) in try/catch → on failure, call
VCStorageOutbox.enqueue(ref.fullPath, blob, metadata) instead of silently dropping.
Design per ADR-012 in DECISIONS.md.`,
    outOfScope: "Firestore document write queuing (only Storage uploads). Service worker integration.",
    cacheBusts: ["shared/offline_storage_outbox.js?v=1"],
  },
  {
    id: "56b",
    phase: 56,
    title: "Service worker cache hygiene",
    dependsOn: ["55a"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["sw.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Update sw.js with proper cache lifecycle management:
1. Bump CACHE_NAME to include a version number or date stamp (e.g. "vertex-cache-v2")
2. Add an 'activate' event handler that deletes all caches whose name !== current CACHE_NAME
   (prevents stale cached resources from being served indefinitely)
3. Change caching strategy for index.html and technician/index.html to network-first
   (try network, fall back to cache) — all other assets can stay cache-first
4. Add the new JS files from Phases 41–53 to the precache list if one exists
Document the dispatcher-has-SW vs tech-app-no-SW asymmetry in a comment block.`,
    outOfScope: "Adding a service worker to the tech app. PWA manifest changes. Push notifications.",
    cacheBusts: [],
  },

  // ═══════════════════════════════════════════════════════════
  //  Phase 57: Dispatcher Polish
  // ═══════════════════════════════════════════════════════════

  {
    id: "57a",
    phase: 57,
    title: "Dispatcher ticket details Save button",
    dependsOn: ["55a"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["index.html", "service_call.js"],
    expectedIds: ["vcTicketDetailsSaveBtn"],
    expectedExports: {},
    scope: `Add an explicit Save button to the ticket details modal (#ticketDetailsModal) footer in index.html.
Refactor the persist logic currently inside closeTicketDetails() in service_call.js:
- Extract the persist body into persistTicketDetailsModal({ closeAfter: boolean })
- Wire Save button to call persistTicketDetailsModal({ closeAfter: false })
- Wire existing Close to call persistTicketDetailsModal({ closeAfter: true })
- On successful save, show the existing showSaveCue("✓ Saved") feedback
- Save button stays enabled, Close button unchanged
This gives dispatchers visible save confirmation without closing the modal.
Pure UX polish — no data model change, no new Firestore paths.`,
    outOfScope: "Auto-save. Undo. New fields in ticket details.",
    cacheBusts: ["service_call.js?v=71"],
  },
  {
    id: "58a",
    phase: 58,
    title: "B5 — report_builder.css duplicate load consolidation",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["dispatcher/js/report_builder.js", "index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix KI-002 B5: dispatcher/js/report_builder.js dynamically loads report_builder.css?v=1
(see lines ~138-140, in a function that builds a URL to the CSS file) while index.html line ~20
already loads <link rel="stylesheet" href="dispatcher/css/report_builder.css?v=4">.
The JS-loaded version is stale (v=1 vs v=4) and causes a redundant network request.
Fix: in report_builder.js, remove or skip the dynamic CSS load if the stylesheet is already
present in the document. Check document.querySelector('link[href*="report_builder.css"]') —
if it exists, skip the dynamic injection. If it doesn't exist (e.g. the report builder runs
in a standalone context), keep the dynamic load but bump the version to match (?v=4).
In index.html, bump the cache-bust on the report_builder.js script tag if one exists.`,
    outOfScope: "Changing report_builder.css content. Modifying the report builder UI. Any Firestore changes.",
    cacheBusts: ["dispatcher/js/report_builder.js"],
  },
  {
    id: "58b",
    phase: 58,
    title: "C1 — shadow_mode.js subscriber refcount + unsubscribe",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Open Dispatcher, open any active job, enable Shadow Mode — modal opens and roster loads normally.",
      "Close Shadow Mode modal → open DevTools → Network → WS/EventSource tab → confirm no live_presence Firestore stream stays open after close.",
      "Reopen Shadow Mode → stream reconnects; close again → stream stops. Repeat 3× to confirm refcount holds.",
      "Navigate away from the dispatcher view entirely → confirm no live_presence listener activity in DevTools.",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["dispatcher/js/shadow_mode.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix KI-002 C1: dispatcher/js/shadow_mode.js subscribeLivePresenceIdle() (line ~187)
creates an onSnapshot listener on the live_presence collection but never stores the unsubscribe
function. Multiple consumers call it (shadow modal, take-over button, syncDispatcherTicketIdToActiveTech)
but the .wired flag means only one listener is created.
Fix:
1. Store the unsubscribe function returned by onSnapshot in a module-level variable
   (e.g. _livePresenceIdleUnsub).
2. Add an unsubscribeLivePresenceIdle() function that calls the unsub and resets the .wired flag.
3. Call unsubscribeLivePresenceIdle() when the shadow modal is closed or when the user navigates
   away from views that need live presence data.
4. This is a memory/connection leak fix — the listener currently persists for the lifetime of the page
   even when shadow mode is not in use.
Do NOT change the behavior of the listener callback — only add proper lifecycle management.
Bump cache-bust on the shadow_mode.js script tag in index.html.`,
    outOfScope: "Changing shadow mode behavior. Adding new shadow features. Firestore write changes.",
    cacheBusts: ["dispatcher/js/shadow_mode.js"],
  },
  {
    id: "58c",
    phase: 58,
    title: "C2 — field_forms.js listener cleanup on tab leave",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["field_forms.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix KI-002 C2: field_forms.js (lines ~496-510) creates an onSnapshot listener on
the form_templates Firestore collection but does not store the unsubscribe function.
Fix:
1. Store the unsubscribe function returned by db.collection("form_templates").onSnapshot(...)
   in a module-level variable (e.g. _formTemplatesUnsub).
2. When the tech navigates away from the forms tab/screen (look for existing switchScreen or
   tab-leave logic in field_forms.js or technician/index.html), call _formTemplatesUnsub()
   to release the Firestore listener.
3. Re-subscribe when the forms tab is opened again (the existing .wired flag pattern or similar
   should handle re-initialization).
This prevents an orphaned Firestore listener from consuming reads when forms are not in use.
Do NOT change the form_templates data handling logic — only add lifecycle cleanup.
Bump field_forms.js cache-bust version in technician/index.html.`,
    outOfScope: "Changing form template rendering. Adding new form features. Modifying form_templates writes.",
    cacheBusts: ["field_forms.js"],
  },
  {
    id: "58d",
    phase: 58,
    title: "E1 — Normalize internal_comms type on write",
    dependsOn: [],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "In Dispatcher, open any active job and add an internal note via the comms area.",
      "In Firebase Console → Firestore → internal_comms → find the just-written doc → confirm `type` field is exactly `\"internal_comms\"` (not \"note\", \"notes\", \"internal\", or \"inter-office\").",
      "Add a second internal note via a different trigger path (if one exists) and repeat the Firestore check.",
      "Confirm the activity feed still displays internal notes correctly after the type normalization.",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["dispatcher/js/activity_feed.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix KI-002 E1: dispatcher/js/activity_feed.js normalizeInternal function (lines ~44-55)
should normalize internal_comms to a single canonical type on every write.
Currently, internal_comms documents can have inconsistent type fields (e.g. "note", "notes",
"internal", "inter-office") depending on which code path created them.
Fix:
1. In the normalizeInternal function, ensure every internal_comms document written has a
   consistent type field. Pick one canonical value: type: "internal_comms".
2. Before writing, map any variant types to the canonical value:
   - "note" → "internal_comms"
   - "notes" → "internal_comms"
   - "internal" → "internal_comms"
   - "inter-office" → "internal_comms"
   - "interOffice" → "internal_comms"
3. Read the full normalizeInternal function and any callers to understand the current flow
   before making changes.
This is a data normalization fix — do NOT change what data is written, only ensure the type
field is consistently "internal_comms".
Bump activity_feed.js cache-bust version in index.html.`,
    outOfScope: "Migrating existing documents. Changing the activity feed UI. Adding new comms types.",
    cacheBusts: ["dispatcher/js/activity_feed.js"],
  },
  {
    id: "58e",
    phase: 58,
    title: "E3 — WriteBatch for roster + on-call dual writes",
    dependsOn: [],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Open Dispatcher → Settings → change the on-call technician assignment and save.",
      "In Firebase Console → Firestore → tenants/{tid}/roster → confirm the tech doc updated with the new on-call flag.",
      "In Firebase Console → Firestore → tenants/{tid}/on_call_state → confirm the matching on-call doc also updated in the same timestamp window (< 1s apart = batch).",
      "Confirm no JavaScript console errors during the save operation.",
      "Change on-call back to the original tech and confirm both docs again update together.",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["settings.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix KI-002 E3: settings.js (lines ~614-617 and ~632-635) performs two sequential
Firestore writes (roster + on_call_state) that should succeed atomically.
Currently, if the first write succeeds but the second fails, the data is left in an
inconsistent state.
Fix:
1. Find the two locations in settings.js where roster and on-call data are saved together.
2. Replace the sequential .set() or .update() calls with a Firestore WriteBatch:
   var batch = firebase.firestore().batch();
   batch.set(rosterRef, rosterData, { merge: true });
   batch.set(onCallRef, onCallData, { merge: true });
   await batch.commit();
3. Keep the same error handling — if batch.commit() fails, surface the error the same way
   the current code does (look for existing .catch or try/catch patterns).
4. Read the surrounding code carefully to understand the exact refs and data shapes before
   modifying. The roster doc path is typically tenants/{tid}/roster/{techId} and on_call
   is tenants/{tid}/on_call_state/{docId}.
Do NOT change what data is written — only wrap existing writes in a batch.
Bump settings.js cache-bust version in index.html.`,
    outOfScope: "Changing roster data shape. Adding new settings features. UI changes.",
    cacheBusts: ["settings.js"],
  },
  {
    id: "58f",
    phase: 58,
    title: "E4 — Remove redundant syncSingleServiceCallToCloud",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["dispatcher/js/ai_report_reviewer.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix KI-002 E4: dispatcher/js/ai_report_reviewer.js (lines ~563-583) calls
syncSingleServiceCallToCloud(localRow) after calling setServiceCallMerged(memo).
The syncSingleServiceCallToCloud call is redundant because setServiceCallMerged already
writes the data to Firestore via the bridge (VCFirestore.setServiceCallMerged).
Fix:
1. Find the code block around lines 563-583 in ai_report_reviewer.js.
2. Remove or comment out the syncSingleServiceCallToCloud(localRow) call that follows
   the setServiceCallMerged(memo) call.
3. Verify by reading setServiceCallMerged in shared/firebase_logic.js to confirm it
   already writes to both the tenant-scoped and root-level service_calls paths.
4. If setServiceCallMerged does NOT write to both paths, keep the sync call and add a
   comment explaining why it's needed.
This removes a redundant Firestore write that doubles the write cost for AI-reviewed reports.
Bump ai_report_reviewer.js cache-bust version in index.html.`,
    outOfScope: "Changing AI report reviewer logic. Modifying setServiceCallMerged. UI changes.",
    cacheBusts: ["dispatcher/js/ai_report_reviewer.js"],
  },
  {
    id: "59a",
    phase: 59,
    title: "C4 — postMessage origin validation on all receivers",
    dependsOn: [],
    patterns: ["Cross-module wiring (3+ files)"],
    riskLevel: "review",
    reviewChecklist: [
      "Open Dispatcher and activate Shadow Mode with a real tech → confirm the iframe loads and roster data appears (same-origin postMessage still works).",
      "Confirm Office Override flow works: trigger a take-over from shadow modal → tech app reflects the override (same-origin message still processed).",
      "In DevTools console on the tech app, run: `window.dispatchEvent(new MessageEvent('message', {data: JSON.stringify({type:'VC_OFFICE_OVERRIDE', payload:{}}), origin:'https://evil.example.com'}))` → confirm nothing happens (no override triggered, no console error).",
      "Repeat the spoofed message test on the dispatcher page for the `vc_shadow_tech_changed` message type → confirm no state change occurs.",
    ],
    filesToCreate: [],
    filesToModify: ["technician/js/workspace_ui.js", "technician/index.html", "dispatcher/js/shadow_mode.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix KI-002 C4 (SECURITY): Three postMessage receivers accept messages without
validating event.origin. Any iframe or window could inject messages that the app trusts.
Fix all three receivers:

1. technician/js/workspace_ui.js (~line 807): window.addEventListener("message", handler)
   that listens for VC_OFFICE_OVERRIDE messages. Add at the top of the handler:
   if (event.origin !== window.location.origin) return;

2. technician/index.html (~line 7672): window.addEventListener("message", handler)
   that listens for vc_shadow_parent_roster messages. Add at the top of the handler:
   if (event.origin !== window.location.origin) return;

3. dispatcher/js/shadow_mode.js (~line 411): window.addEventListener("message", handler)
   that listens for vc_shadow_tech_changed messages. Add at the top of the handler:
   if (event.origin !== window.location.origin) return;

IMPORTANT: The origin check must use window.location.origin (not a hardcoded URL) because
the app runs on multiple domains (localhost, Firebase Hosting preview channels, production).
The check ensures only same-origin iframes (like the Shadow Mode iframe) can send messages.
Bump cache-bust versions on workspace_ui.js and shadow_mode.js.`,
    outOfScope: "Adding CSP headers. Changing postMessage data formats. Adding new message types.",
    cacheBusts: [],
    // NOTE: cacheBusts intentionally empty. workspace_ui.js lives in technician/index.html
    // (as "js/workspace_ui.js") while shadow_mode.js lives in index.html (as
    // "dispatcher/js/shadow_mode.js"). The validator only supports a single htmlTarget,
    // so cross-HTML cache-bust verification would cause false failures. The scope text
    // instructs the agent to bump both.
  },
  {
    id: "59b",
    phase: 59,
    title: "Firestore rules — tighten open paths to require auth",
    dependsOn: [],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Use Firebase Console → Firestore → Rules → Rules Playground: test a READ on `tenants/test-tenant/service_calls/doc1` with auth = unauthenticated → expect DENIED.",
      "Rules Playground: test same READ with a valid simulated user (any UID) → expect ALLOWED.",
      "Rules Playground: test READ on `form_templates/doc1` unauthenticated → expect ALLOWED (public read kept).",
      "Rules Playground: test WRITE on `form_templates/doc1` unauthenticated → expect DENIED.",
      "Deploy rules to staging only (`firebase deploy --only firestore:rules --project staging`) and confirm the Dispatcher and Tech app still load all data when logged in.",
      "Open the app in an incognito window (not logged in) → Dispatcher should redirect to login, not show any data.",
    ],
    filesToCreate: [],
    filesToModify: ["firestore.rules"],
    expectedIds: [],
    expectedExports: {},
    scope: `SECURITY: Tighten Firestore rules from 'allow read, write: if true' to require
Firebase Auth on all tenant-scoped and data paths.
In firestore.rules, replace 'if true' with 'if request.auth != null' on these paths:
- tenants/{tid}/service_calls/{document=**}
- tenants/{tid}/site_intelligence/{document=**}
- tenants/{tid}/live_presence/{document=**}
- tenants/{tid}/imported_equipment/{document=**}
- tenants/{tid}/imported_equipment_photos/{document=**}
- tenants/{tid}/labor_logs/{document=**}
- tenants/{tid}/roster/{document=**}
- tenants/{tid}/field_quotes/{document=**}
- tenants/{tid}/pm_records/{document=**}
- tenants/{tid}/field_form_submissions/{document=**}
- tenants/{tid}/on_call_state/{document=**}
- tenants/{tid}/completed_reports/{docId}
- tenants/{tid}/sandbox/{document=**}
- service_calls/{document=**}
- site_intelligence/{document=**}
- completed_reports/{document=**}
- Customers/{document=**}
- customers/{document=**}
- customers/{cid}/sites/{sid}/assets/{document=**}
- ParentCompanies/{document=**}
- MappedLocations/{document=**}
- invoices/{document=**}
- metadata/{document=**}

KEEP 'if true' (public read needed) on:
- tenants/{tid}/config/entitlements — read: if true (non-sensitive config, already has admin-gated write)
- app_config/{document=**} — read: if true (public config like technician roster)
- form_templates/{document=**} — read: if true (public form definitions)

KEEP 'if true' on portal_tokens:
- tenants/{tid}/portal_tokens/{document=**} — read: if true (customer portal uses unauthenticated links)
  But tighten write to: if request.auth != null

For the paths that keep 'if true' read, split into separate read/write rules:
  allow read: if true;
  allow write: if request.auth != null;

DO NOT run 'firebase deploy' — commit only. Add a comment at the top of firestore.rules
noting the date of the security tightening and that manual deploy is required.`,
    outOfScope: "Role-based access control (admin vs tech). Per-field validation rules. Storage rules. Deploying rules.",
    cacheBusts: [],
  },
  {
    id: "59c",
    phase: 59,
    title: "Storage rules — verify new upload paths from Phases 41-57",
    dependsOn: [],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Open the tech app → start a job workspace → use the media capture button (Phase 41c) to attach a photo → confirm upload succeeds with no permission-denied errors in DevTools console.",
      "In Firebase Console → Storage → browse to `field_evidence/` → confirm the uploaded file appears under the correct ticket subfolder.",
      "Try attaching a file > 10MB via the same upload path → expect it to be rejected by rules (upload fails, no file appears in Storage).",
      "Open the offline photo outbox flow (Phase 56a) → take a photo while offline → go back online → confirm the queued photo uploads successfully to Storage.",
      "Check DevTools Network tab during the above uploads — all Storage requests should return 200, no 403s.",
    ],
    filesToCreate: [],
    filesToModify: ["storage.rules"],
    expectedIds: [],
    expectedExports: {},
    scope: `SECURITY: Audit storage.rules against all ref.put() / ref.child() call sites
to ensure new upload paths from Phases 41-57 are covered by explicit prefix rules.
Steps:
1. Grep the entire codebase for firebase.storage().ref().child( and ref.put( and storageRef
   to find ALL Storage upload paths currently in use.
2. Read storage.rules to see which prefixes are explicitly allowed.
3. For any upload path NOT covered by an existing prefix rule, add a new match block:
   match /new_prefix/{allPaths=**} {
     allow read: if request.auth != null;
     allow write: if request.auth != null
                  && request.resource.size < 10 * 1024 * 1024;
   }
4. Specifically check for:
   - field_evidence/{ticketId}/ (from conversational_timeline.js media capture, Phase 41c)
   - Any paths used by offline_storage_outbox.js (Phase 56a)
   - Any paths used by teaching_layer.js (Phase 52a) for knowledge media
5. Ensure NO catch-all rule exists that allows writes to arbitrary paths.
6. Keep the 10MB file size limit on all write rules.
DO NOT deploy — commit only. Add a comment in storage.rules noting the audit date.`,
    outOfScope: "Firestore rules (that's 59b). Adding CDN or image compression. Changing upload logic in JS files.",
    cacheBusts: [],
  },
  {
    id: "61a",
    phase: 61,
    title: "Storage rules — MIME type + file-type restrictions on upload paths",
    dependsOn: [],
    patterns: ["Storage rules / upload paths"],
    riskLevel: "review",
    reviewChecklist: [
      "Tech app → workspace → tap Take a Photo → approve → confirm upload succeeds (no permission-denied in DevTools console or #vcDebugOverlay).",
      "Tech app → take a video → confirm upload succeeds to field_evidence/.",
      "Tech app → Equipment Manager → save equipment with a photo → confirm upload to equipment_photos/ succeeds.",
      "In Firebase Console → Storage → Rules Playground: attempt a write to equipment_photos/test.html with contentType: text/html → expect DENIED.",
      "Rules Playground: write to equipment_photos/test.jpg with contentType: image/jpeg, size 5MB → expect ALLOWED.",
      "Rules Playground: write to field_evidence/test.mp4 with contentType: video/mp4, size 8MB → expect ALLOWED.",
      "Rules Playground: write to teaching_media/test.pdf with contentType: application/pdf → expect DENIED (teaching media should only allow image or video).",
      "If any legitimate iOS HEIC upload was blocked, check iOS Safari reports contentType image/heic — add image/heic to allowed patterns if needed.",
    ],
    filesToCreate: [],
    filesToModify: ["storage.rules"],
    expectedIds: [],
    expectedExports: {},
    scope: `SECURITY: Add MIME type restrictions to storage.rules upload paths so only
legitimate file types can be written to each prefix.

For each match block in storage.rules, add a contentType check to the write rule:

PHOTO-ONLY paths (accept image/* only):
  equipment_photos/, dictation_hub_assets/, customer_evidence/,
  field_quote_evidence/, field_form_evidence/, quote_evidence/,
  site_access_photos/, tenants/{tenantId}/imported_equipment_photos/

  allow write: if true
               && request.resource.size < 10 * 1024 * 1024
               && request.resource.contentType.matches('image/.*');

MEDIA paths (accept image/* OR video/*):
  field_evidence/, service_call_addendums/

  allow write: if true
               && request.resource.size < 10 * 1024 * 1024
               && (request.resource.contentType.matches('image/.*')
                   || request.resource.contentType.matches('video/.*'));

MEDIA + DOCUMENT paths (teaching_media — image, video, or audio):
  teaching_media/

  allow write: if true
               && request.resource.size < 10 * 1024 * 1024
               && (request.resource.contentType.matches('image/.*')
                   || request.resource.contentType.matches('video/.*')
                   || request.resource.contentType.matches('audio/.*'));

IMPORTANT notes:
- Keep read rules unchanged (allow read: if true on all paths).
- iOS Safari may report HEIC as image/heic or image/heif — these match image/.* so they pass.
- DO NOT use request.resource.contentType == 'image/jpeg' (exact match) — use .matches() for
  prefix patterns so all image subtypes are covered.
- DO NOT deploy — commit only. Add a comment in storage.rules noting the audit date and
  that MIME types were added.`,
    outOfScope: "Firestore rules. Adding Firebase Auth to upload paths. Changing JS upload code. Deploying rules.",
    cacheBusts: [],
  },
  {
    id: "61b",
    phase: 61,
    title: "postMessage senders — tighten '*' targetOrigin to explicit origin",
    dependsOn: [],
    patterns: ["Cross-module wiring (3+ files)"],
    riskLevel: "review",
    reviewChecklist: [
      "Dispatcher → open any active job → toggle Office Override ON → confirm the tech app iframe immediately shows the orange override chrome (postMessage still reaches the iframe).",
      "In Shadow Mode: switch tech selection → confirm the parent window's shadow panel reflects the new tech (vc_shadow_tech_changed message still works).",
      "Dispatcher → Settings → confirm roster names sync to the phone preview iframe (the existing smart-origin logic in index.html must remain untouched).",
      "DevTools → Application → Service Workers: confirm no new console errors after the postMessage calls.",
    ],
    filesToCreate: [],
    filesToModify: ["service_call.js", "technician/index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `SECURITY: Two postMessage senders still use '*' as the targetOrigin, which
means any origin that can embed the page could intercept the message.
Tighten both to use window.location.origin.

1. service_call.js line ~3673:
   Find: f.contentWindow.postMessage(payload, "*");
   Replace: f.contentWindow.postMessage(payload, window.location.origin);
   Context: This is inside a loop over iframes for the Office Override toggle. The
   iframes are same-origin (both on Firebase Hosting), so window.location.origin is correct.

2. technician/index.html line ~11499:
   Find:
     window.parent.postMessage(
       { type: "vc_shadow_tech_changed", presenceKey: pk, displayName: name },
       "*"
     );
   Replace:
     window.parent.postMessage(
       { type: "vc_shadow_tech_changed", presenceKey: pk, displayName: name },
       window.location.origin
     );
   Context: This sends a message from the tech app iframe back to the dispatcher parent.
   Both are same-origin, so window.location.origin is correct.

DO NOT touch index.html lines ~7857-7860 — that sender already has smart fallback logic
(uses window.location.origin with a "null" guard for file:// contexts). Leave it unchanged.

Bump cache-bust versions on service_call.js in index.html and on the technician/index.html
inline script version constant (VC_BUILD) if you change the inline script block there.`,
    outOfScope: "postMessage receiver hardening (already done in 59a). Adding message encryption. Changing message data formats.",
    cacheBusts: ["service_call.js"],
    htmlTarget: "index.html",
  },
  {
    id: "61c",
    phase: 61,
    title: "Workbench server — localhost bind + block HTTP API key injection",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["workbench/src/server.ts"],
    expectedIds: [],
    expectedExports: {},
    scope: `SECURITY: The workbench Express server currently binds to 0.0.0.0 (all interfaces)
and allows API key injection via req.body.apiKey. Harden it:

1. LOCALHOST BIND (workbench/src/server.ts line ~505):
   Find: app.listen(port, '0.0.0.0', ...)  OR  app.listen(port, ...)
   Change the bind address to '127.0.0.1':
   app.listen(port, '127.0.0.1', () => { ... })
   Reason: The workbench is a local developer tool. Binding to 0.0.0.0 exposes it on
   all network interfaces (LAN, Tailscale). Localhost-only prevents accidental exposure.
   Add a comment: "// Localhost-only — use an SSH tunnel or reverse proxy for Tailscale access."

2. BLOCK API KEY INJECTION (workbench/src/server.ts ~line 222):
   Find the route POST /api/sandbox/:id/run (or similar) that reads:
   apiKey: req.body.apiKey || process.env.CURSOR_API_KEY
   Replace with:
   apiKey: process.env.CURSOR_API_KEY
   Remove the req.body.apiKey fallback entirely.
   Add a comment: "// Never accept API key over HTTP — use CURSOR_API_KEY env var only."

3. GENERIC ERROR RESPONSES (~lines 118-119, ~361-362 and any other handler that does
   res.status(500).json({ error: e.message })):
   Replace e.message with a generic string for the HTTP response, and log the real error
   to console.error. Pattern:
   Before: res.status(500).json({ error: e.message })
   After:  console.error('[workbench] route error:', e); res.status(500).json({ error: 'Internal server error' })
   Apply this pattern consistently to all error handlers in the file.

Read the file carefully to find all three patterns before editing. The workbench is
paused (see CURRENT_STATE.md) but these are safe pre-emptive hardening changes.`,
    outOfScope: "Adding authentication middleware. Changing sandbox runner logic. Fixing path traversal in /api/browse-dirs (separate concern). App code changes outside workbench/.",
    cacheBusts: [],
  },
  {
    id: "61d",
    phase: 61,
    title: "Build runner — scrub API key prefix from preflight log output",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["tools/build_runner.ts"],
    expectedIds: [],
    expectedExports: {},
    scope: `SECURITY / HYGIENE: build_runner.ts preflight check (~lines 920-930) currently
prints the first 10 characters of CURSOR_API_KEY to the console:
  e.g. console.log(\`  ✓ CURSOR_API_KEY: \${key.substring(0, 10)}...\`)
This leaks a partial key in screenshots, log files, and screen shares.

Fix:
1. Find the preflight section that logs the API key.
2. Replace the key-prefix log with a simple "set" confirmation:
   Before: console.log(\`  ✓ CURSOR_API_KEY: \${key.substring(0, 10)}...\`)
   After:  console.log(\`  ✓ CURSOR_API_KEY: set (\${key.length} chars)\`)
   This confirms the key is present and hints at whether it's plausibly the right length
   (Cursor API keys are typically ~50+ chars) without revealing any content.

Read the file to find the exact line(s) before editing — there may be more than one
place where the key is logged (e.g. in error messages). Apply the same pattern to all.`,
    outOfScope: "Changing how the API key is loaded. Adding key rotation. Modifying agent prompt logic.",
    cacheBusts: [],
  },
  {
    id: "61e",
    phase: 61,
    title: "Build runner — consolidate duplicate cost map into model_selector",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["tools/build_runner.ts", "tools/model_selector.ts"],
    expectedIds: [],
    expectedExports: {},
    scope: `HYGIENE / ANTI-BLOAT: build_runner.ts defines its own costEstimates map (used by
the /cost command, ~lines 769-777) that duplicates the MODEL_COST_RANK data already
maintained in model_selector.ts. These two sources will drift over time as models are
added or removed.

KNOWN BUG: The /cost map uses STALE model slugs (e.g. "claude-4.6-sonnet", "claude-4.6-opus",
"gpt-5.4-medium", "gpt-5.5-medium") while MODEL_COST_RANK in model_selector.ts uses the
CORRECT slugs (e.g. "claude-sonnet-4-6", "claude-opus-4-6", "gpt-5.4", "gpt-5.5"). The cost
command frequently falls through to the default [10,20] range because of this mismatch.

Fix:
1. Read both files carefully. Note the slug mismatches between the two maps.
2. In model_selector.ts, export a function getCostEstimates() that returns a
   Record<string, [number, number]> mapping each model slug from MODEL_COST_RANK to
   a [low, high] cost-per-slice estimate in cents. Use the existing MODEL_COST_RANK
   keys as the canonical slug names. Approximate cost ranges:
   - rank 1-2 (haiku, composer): [3, 8]
   - rank 3-4 (mini, spark): [4, 10]
   - rank 5 (sonnet): [5, 15]
   - rank 6-7 (codex, gpt-5.2): [8, 20]
   - rank 8-9 (gpt-5.4, gpt-5.5): [10, 25]
   - rank 10 (opus): [15, 35]
3. In build_runner.ts /cost command handler, replace the inline costEstimates object
   literal with a call to getCostEstimates() from model_selector.ts:
   import { getCostEstimates } from './model_selector';
   ...
   const costEstimates = getCostEstimates();
4. Remove the now-redundant inline costEstimates definition from build_runner.ts.

Ensure the /cost command output is unchanged in format — same display layout.
The model slugs in the output should now be CORRECT (matching MODEL_COST_RANK).
Run npx tsc --noEmit from the tools/ directory to confirm the change compiles cleanly.`,
    outOfScope: "Changing model recommendations. Updating MODEL_LOOKUP.md. Changing the /cost display format.",
    cacheBusts: [],
  },
  {
    id: "60a",
    phase: 60,
    title: "Archive passed slices + dossier overflow + build state cleanup",
    dependsOn: [],
    patterns: ["Cross-module wiring (3+ files)"],
    riskLevel: "review",
    reviewChecklist: [
      "Run `vertex` → `/status` → confirm it shows the correct archived count (e.g. '27 archived (see slices_archive.ts)') and only 58a–60a in the active list.",
      "Open `tools/slices.ts` → confirm slice definitions 41a–57a are gone; only Phase 58–60 slices remain.",
      "Open `tools/slices_archive.ts` → confirm all 27 passed slices (41a–57a) are present.",
      "Run `npx tsc --noEmit` from the `tools/` folder → expect zero compile errors.",
      "Open `PROJECT_STATUS/MODEL_DOSSIER.md` → count rows in `§ Outcome log` → expect ≤ 30 rows.",
      "Confirm `PROJECT_STATUS/MODEL_DOSSIER_ARCHIVE.md` exists and contains the overflow rows.",
    ],
    filesToCreate: ["tools/slices_archive.ts", "PROJECT_STATUS/MODEL_DOSSIER_ARCHIVE.md"],
    filesToModify: ["tools/slices.ts", "tools/build_runner.ts", "PROJECT_STATUS/MODEL_DOSSIER.md"],
    expectedIds: [],
    expectedExports: { "tools/slices_archive.ts": ["ARCHIVED_SLICES"] },
    scope: `Memory hygiene: move completed data to archive files so hot files stay small and fast.
Three changes:

1. SLICE ARCHIVE (tools/slices_archive.ts):
   - Create new file: tools/slices_archive.ts
   - Export const ARCHIVED_SLICES: Slice[] (import the Slice interface from ./slices).
   - Move ALL slices from tools/slices.ts whose id is in the set of passed slices in
     tools/.build_state.json (status === "passed") INTO slices_archive.ts.
   - Keep ONLY pending/failed slices in the main SLICES array in slices.ts.
   - IMPORTANT: Read .build_state.json to determine which slices have passed.
     Currently passed slices are: 41a through 57a (all 28 of them).
     Slices 58a-60a are new/pending — keep those in slices.ts.
   - The interface definition and all imports stay in slices.ts.
   - Add a comment at the top of slices_archive.ts:
     "// Passed slices archived from slices.ts. Import and search if you need
     //  dependency or scope info for a completed slice."

2. BUILD RUNNER UPDATE (tools/build_runner.ts):
   - In loadState(), after initializing new slices from SLICES, also import ARCHIVED_SLICES
     from './slices_archive' and strip any entries in state.slices whose id exists in
     ARCHIVED_SLICES (they are done — no need to track in .build_state.json).
   - After stripping, saveState() so the .build_state.json shrinks immediately on next run.

   AUTO-ARCHIVE TRIGGER (critical — prevents bloat):
   - Add a constant MAX_ACTIVE_SLICES = 20.
   - At the START of the /a (automated run) command, BEFORE processing any slices, check:
     if SLICES.length > MAX_ACTIVE_SLICES, run the archive routine automatically.
   - The auto-archive routine:
     (a) Reads .build_state.json for all slices with status "passed"
     (b) Reads tools/slices.ts as a text file
     (c) For each passed slice: extracts its full object literal from the SLICES array in
         slices.ts (match by id field, grab everything from the opening { to the closing },)
     (d) Appends those object literals to the ARCHIVED_SLICES array in slices_archive.ts
     (e) Removes those object literals from slices.ts
     (f) Removes their entries from .build_state.json
     (g) Logs: "Auto-archived N passed slices (SLICES had M > MAX_ACTIVE_SLICES=20)"
   - This means the user never has to think about archival — it just happens.
   - Also run the same check at the END of /a after all slices finish (in case the run
     itself pushed the count over the threshold).

   MANUAL /archive COMMAND:
   - Add a /archive command to the REPL that forces the same routine regardless of count.
   - The /status command should show archived count: "N archived (see slices_archive.ts)"

3. DOSSIER OUTCOME LOG OVERFLOW (PROJECT_STATUS/MODEL_DOSSIER_ARCHIVE.md):
   - Create new file: PROJECT_STATUS/MODEL_DOSSIER_ARCHIVE.md with header:
     "# Model Dossier — Archived Outcome Log Rows"
     "Overflow rows from MODEL_DOSSIER.md § Task outcome log. Newest first within each batch."
     Then a blank table with the same columns as the dossier outcome log.
   - In PROJECT_STATUS/MODEL_DOSSIER.md, count the rows in § Outcome log (newest first).
     If there are more than 30 rows, move the OLDEST rows (beyond the newest 30) into
     MODEL_DOSSIER_ARCHIVE.md. Leave the 30 most recent in the dossier.
   - Under the dossier § Retention subsection, add a line:
     "Older rows: see MODEL_DOSSIER_ARCHIVE.md (archived up to YYYY-MM-DD)."
     with the date of the oldest moved row.

VERIFICATION: After changes, confirm:
- tools/slices.ts has ONLY pending/failed slice definitions (58a-60a range)
- tools/slices_archive.ts has all 28 passed slice definitions (41a-57a)
- tools/slices_archive.ts compiles (run: npx tsc --noEmit slices_archive.ts from tools/)
- PROJECT_STATUS/MODEL_DOSSIER_ARCHIVE.md exists and has the overflow rows
- PROJECT_STATUS/MODEL_DOSSIER.md outcome log has ≤30 rows
- tools/build_runner.ts compiles (run: npx tsc --noEmit build_runner.ts from tools/)`,
    outOfScope: "Changing slice behavior or runner logic beyond archival. App code changes. MODEL_LOOKUP.md pruning (future). Deleting .build_state.json entries for active slices.",
    cacheBusts: [],
  },
  {
    id: "62a",
    phase: 62,
    title: "Gemini 403 fallback fix (10 files)",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: [
      "conversational_timeline.js",
      "dictation_hub.js",
      "edge_intent_engine.js",
      "unit_work_parser.js",
      "equipment_manager.js",
      "field_forms.js",
      "invoice.js",
      "service_call.js",
      "dispatcher/js/ai_report_reviewer.js",
      "shared/client_portal_logic.js",
      "functions/index.js"
    ],
    expectedIds: [],
    expectedExports: {},
    scope: `Fix Gemini 403 fallback regression: change all hardcoded "gemini-2.5-flash"
fallback strings to "gemini-2.0-flash" across the codebase.
Root cause: firebase-config.js sets GEMINI_GENERATE_MODEL = "gemini-2.0-flash" globally,
but every other file has a hardcoded fallback of "gemini-2.5-flash" that fires when
the variable is not in scope (e.g. on mobile field app).
Files to fix (fallback-only, exact replace):
1. conversational_timeline.js (~2768)
2. dictation_hub.js (~418)
3. edge_intent_engine.js (~290)
4. unit_work_parser.js (~55)
5. equipment_manager.js (~12)
6. field_forms.js (~1147)
7. invoice.js (~342)
8. service_call.js (~3042)
9. dispatcher/js/ai_report_reviewer.js (~143)
10. shared/client_portal_logic.js (~98)
11. functions/index.js (~7): DEFAULT_MODEL = "gemini-2.5-flash" -> "gemini-2.0-flash"
Do NOT touch firebase-config.js.`,
    outOfScope: "Changing Gemini logic. Modifying firebase-config.js. Any other model changes.",
    cacheBusts: ["conversational_timeline.js", "field_forms.js", "service_call.js"],
  },
  {
    id: "62b",
    phase: 62,
    title: "KI-002 Minor Tweaks: B5 B6 B7 C4 E1 E3",
    dependsOn: ["62a"],
    patterns: ["Multi-file UI feature (no Firestore writes)", "Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "B7: sw.js has a comment explaining why tech app skips the service worker.",
      "C4: shadow_mode.js postMessage receiver checks event.origin === window.location.origin.",
      "C4: technician/index.html postMessage receiver checks event.origin === window.location.origin.",
      "E3: settings.js uses db.batch() WriteBatch for roster + on-call writes (atomic).",
      "VERIFY: settings.js version in index.html is still v19 (not bumped again).",
      "VERIFY: shadow_mode.js version in index.html is still v10 (not bumped again)."
    ],
    filesToCreate: [],
    filesToModify: [
      "sw.js",
      "dispatcher/js/shadow_mode.js",
      "technician/index.html",
      "settings.js"
    ],
    expectedIds: [],
    expectedExports: {},
    scope: `Apply REMAINING KI-002 hygiene fixes (B5/B6/E1 already committed in 844d63f):
B7: Add a comment block in sw.js header explaining the dispatcher-uses-SW vs technician-no-SW asymmetry (why the tech app skips the service worker entirely).
C4: Add postMessage origin guards (check event.origin === window.location.origin before processing) to receivers in dispatcher/js/shadow_mode.js and technician/index.html.
E3: Replace individual Firestore set() calls for roster + on-call writes in settings.js with a single WriteBatch (db.batch()) so both writes are atomic.
NOTE: cacheBusts is intentionally empty — settings.js v19 and shadow_mode.js v10 were already bumped in index.html by the prior partial run (commit 844d63f). Do NOT bump them again.`,
    outOfScope: "B5 (already done — report_builder.css is at ?v=4). B6 (already done — sw.js is at cache-v3). E1 (already done — activity_feed.js normalization committed). Any refactoring beyond the specific fixes. UI changes.",
    cacheBusts: [],
    htmlTarget: "index.html",
  },
  {
    id: "62d",
    phase: 62,
    title: "Guard rail audit: tighten MODEL_GUARDS from build log outcomes",
    dependsOn: [],
    patterns: ["Governance / docs-only edits"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["tools/model_guard_overrides.json"],
    expectedIds: [],
    expectedExports: {},
    scope: `Perform a guard rail audit against the build log and update tools/model_guard_overrides.json.

Steps:
1. Read tools/build_log.txt — find all lines matching "failed for slice" and "Guard blocked" from the last 30 days.
2. For each model+pattern failure, check whether that combination is already in the base MODEL_GUARDS.forbiddenPatterns in tools/model_selector.ts.
3. If a model has failed on a pattern 2+ times and the pattern is NOT already forbidden, add it to the forbiddenPatterns array in tools/model_guard_overrides.json.
4. Also review tools/.build_state.json: for any slice with status "failed", note the model and patterns, and apply step 3.
5. Write an updated tools/model_guard_overrides.json that merges existing overrides with any newly tightened entries.
6. Do NOT modify tools/model_selector.ts — only write to tools/model_guard_overrides.json.
7. Summarize what was tightened in the commit message.`,
    outOfScope: "Modifying model_selector.ts. Changing MODEL_GUARDS base config. Any app code changes.",
    cacheBusts: [],
  },
  {
    id: "62c",
    phase: 62,
    title: "Build runner UX: 'pause' -> 'stop' wording fix",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    filesToCreate: [],
    filesToModify: ["tools/build_runner.ts"],
    expectedIds: [],
    expectedExports: {},
    scope: `Update the build runner STOP message wording to be more accurate.
File: tools/build_runner.ts line ~64
Find: console.log(\`\\n\\n  ⏸  STOP received — will finish current slice then pause.\`);
Replace: console.log(\`\\n\\n  ⏸  STOP received — will finish current slice then stop.\`);
Reason: The runner fully stops after the slice; it doesn't pause for resumption.`,
    outOfScope: "Changing stop logic. Modifying any other strings.",
    cacheBusts: [],
  },
  {
    id: "63a",
    phase: 63,
    title: "Multi-trigger words — Firestore data model + Settings Builder UI",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Dispatcher → Settings → Field Forms → Edit an existing template → confirm the new 'Additional Trigger Words' tag input appears below the AI Trigger Word field.",
      "Type a trigger phrase (e.g. 'blower motor') and press Enter → chip appears; type another → second chip appears; click × on first chip → it removes.",
      "Save the template → open Firebase Console → form_templates/{id} → confirm `triggerWords` array contains the entered phrases AND `targetKeyword` still has the original value.",
      "Reopen the template for editing → confirm saved trigger word chips reload correctly.",
      "Create a NEW template → add 3 trigger words → save → verify Firestore doc has all 3 in `triggerWords` array.",
      "In the template list view, confirm the card now shows 'AI trigger: supply fan motor (+3 more)' style display.",
      "Template with NO triggerWords added → confirm card still shows 'AI trigger: supply fan motor' (backward compat, no '(+0 more)').",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["settings.js", "index.html"],
    expectedIds: ["ffbTriggerWordsContainer", "ffbTriggerWordInput"],
    expectedExports: {},
    scope: `Add multi-trigger-word support to the Field Form & Checklist Builder in the dispatcher Settings UI.

Currently each form_templates document has a single \`targetKeyword\` string field. This slice adds a
\`triggerWords: string[]\` array field alongside it (NOT replacing it — \`targetKeyword\` stays as the
primary trigger for backward compatibility).

## Firestore data model change

When saving a template (settings.js ~line 2559-2570, the \`payload\` object in saveFieldFormTemplate),
add: triggerWords: getTriggerWordChips()
where getTriggerWordChips() reads from the new tag input UI and returns a string[].

The \`triggerWords\` array should always INCLUDE the \`targetKeyword\` value as the first element
(deduped) so downstream matching code only needs to check one array. If the user enters
"supply fan motor" as the AI Trigger Word and adds "blower motor", "fan motor" as additional
trigger words, the saved array should be: ["supply fan motor", "blower motor", "fan motor"].

## Settings UI changes (index.html)

In index.html, find the Field Form Builder modal (search for id="ffbTargetKeyword", around line 6641-6660).
Below the existing AI Trigger Word input, add a new section:

<label style="display:block;font-size:13px;font-weight:600;margin:12px 0 4px;color:#0ea5e9">
  Additional Trigger Words
</label>
<p style="font-size:12px;color:#64748b;margin:0 0 6px;line-height:1.45">
  Add synonyms or alternate phrases techs might use for this repair type.
  These help the AI match this checklist more accurately during field notes.
</p>
<div id="ffbTriggerWordsContainer" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;min-height:28px;"></div>
<div style="display:flex;gap:6px;">
  <input type="text" id="ffbTriggerWordInput" placeholder='e.g. "blower motor"'
    style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;" />
  <button type="button" id="ffbTriggerWordAddBtn"
    style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;">
    + Add
  </button>
</div>

## Settings JS changes (settings.js)

Add these functions near the existing getFfbChipValues/setFfbChipValues block (~line 2406):

function getTriggerWordChips():
  Read all .ffb-trigger-chip elements inside #ffbTriggerWordsContainer,
  return their data-value attributes as a string[] (trimmed, deduped, lowercased).

function setTriggerWordChips(words):
  Given a string[], render chip elements inside #ffbTriggerWordsContainer.
  Each chip: <span class="ffb-trigger-chip" data-value="..." style="background:#e0f2fe;color:#0c4a6e;
  padding:4px 10px;border-radius:999px;font-size:12px;display:inline-flex;align-items:center;gap:4px;">
  word <button type="button" style="border:none;background:none;cursor:pointer;font-size:14px;color:#64748b;"
  onclick="this.parentElement.remove()">×</button></span>

function addTriggerWordFromInput():
  Read #ffbTriggerWordInput value, trim, lowercase. If not empty and not already present,
  append a chip to #ffbTriggerWordsContainer. Clear the input.
  Wire this to #ffbTriggerWordAddBtn click AND Enter keypress on #ffbTriggerWordInput.

In openFieldFormBuilderEdit (~line 2455), after setting kwEl.value, add:
  setTriggerWordChips(Array.isArray(d.triggerWords) ? d.triggerWords : []);

In openFieldFormBuilderCreate (~line 2428), add:
  setTriggerWordChips([]);

In saveFieldFormTemplate (~line 2559), add to the payload object:
  triggerWords: buildTriggerWordsArray(kw, getTriggerWordChips())

function buildTriggerWordsArray(primaryKw, additionalWords):
  Combine primaryKw (lowercased, trimmed) as the first element with additionalWords.
  Deduplicate. Return string[]. This ensures targetKeyword is always in triggerWords[0].

## Template list card update

In hydrateFieldFormTemplatesList (~line 2889-2907), where the template card is rendered,
update the "AI trigger:" display. Currently it shows:
  AI trigger: <strong>\${kw}</strong>
Change to show the primary keyword plus a count of additional trigger words:
  const extraCount = Array.isArray(r.triggerWords) ? Math.max(0, r.triggerWords.length - 1) : 0;
  const kwDisplay = kw + (extraCount > 0 ? ' (+' + extraCount + ' more)' : '');
  Then use kwDisplay in the template card HTML.

Bump settings.js cache-bust in index.html. Bump VC_BUILD.`,
    outOfScope: "Changing how checklist_reminder_engine matches trigger words (that's 63b). Changing field_forms.js matching (that's 63b). Changing conversational_timeline.js. Any Firestore rules changes.",
    cacheBusts: ["settings.js"],
  },
  {
    id: "63b",
    phase: 63,
    title: "Multi-trigger matching — checklist_reminder_engine + field_forms",
    dependsOn: ["63a"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "In Firebase Console, manually add triggerWords: ['supply fan motor', 'blower motor', 'fan motor'] to an existing form_templates document.",
      "Open the field tech app → start a workspace on any ticket → type a note mentioning 'blower motor' → confirm the checklist reminder engine loads the matching template workflow (check DevTools console for [checklist] logs or observe gentle reminder bubbles).",
      "Type a note mentioning 'fan motor' (a different trigger word from the same template) → confirm it also matches the same template.",
      "Type a note with the original targetKeyword ('supply fan motor') → confirm it still matches (backward compat).",
      "Test with a template that has NO triggerWords array (only targetKeyword) → confirm matching still works via legacy path.",
      "Test offline: disconnect network → type a note with a trigger word → confirm localStorage-cached workflow still matches.",
    ],
    filesToCreate: [],
    filesToModify: ["checklist_reminder_engine.js", "field_forms.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Update the matching logic in checklist_reminder_engine.js and field_forms.js to check the
new \`triggerWords[]\` array from form_templates in addition to the single \`targetKeyword\`.

## checklist_reminder_engine.js changes

In loadWorkflow() (~line 133-187), the current matching logic at line ~156-170 does:
  var kw = String(data.targetKeyword || "").trim().toLowerCase();
  var matches = typeKey.indexOf(kw) !== -1 || kw.indexOf(typeKey) !== -1;

Replace this with a function that checks BOTH triggerWords[] AND targetKeyword:

function matchesTriggerWords(data, typeKey):
  1. Build a combined list: if data.triggerWords is a non-empty array, use it.
     Otherwise fall back to [data.targetKeyword] (backward compat for templates
     without triggerWords).
  2. For each word in the list (trimmed, lowercased):
     if typeKey.indexOf(word) !== -1 || word.indexOf(typeKey) !== -1 → match.
  3. Return { matched: boolean, bestKwLen: number } where bestKwLen is the
     length of the longest matching trigger word (for "most specific" ranking).

Update the snap.forEach loop to use matchesTriggerWords() instead of the inline check.
Keep the existing "prefer longest keyword" ranking logic but use bestKwLen from the
multi-word match.

Also update saveWorkflowCache/loadWorkflowCache to include the triggerWords in the
cached workflow object so offline matching works against the full trigger word list.

## field_forms.js changes

In the Gemini keyword intent matching (~line 1111-1188, where it fetches active templates
and matches answer against targetKeyword), update the matching logic:

Currently at line ~1185:
  var kw = String(t.data.targetKeyword || "").trim();
  if (answer.toLowerCase() === kw.toLowerCase()) matched = t;
  if (answer.toLowerCase().indexOf(kw.toLowerCase()) >= 0) matched = t;

Add triggerWords matching:
  var words = Array.isArray(t.data.triggerWords) && t.data.triggerWords.length
    ? t.data.triggerWords
    : [t.data.targetKeyword || ""];
  for (var w = 0; w < words.length; w++) {
    var tw = String(words[w]).trim().toLowerCase();
    if (!tw) continue;
    if (answerLower === tw || answerLower.indexOf(tw) >= 0) { matched = t; break; }
  }

Also update the formTemplatesCache localStorage persistence (if not already done by
the onSnapshot handler) to include triggerWords so offline form-intent matching works.

## Edge intent engine integration note

The edge_intent_engine.js correctVocab() already runs BEFORE the checklist matching
(updateFromEntry receives post-correction text). No changes needed to edge_intent_engine.js
in this slice — the corrected text flows naturally into the expanded trigger word matching.

Bump cache-bust versions on checklist_reminder_engine.js and field_forms.js in technician/index.html.`,
    outOfScope: "Changing the Settings UI (that's 63a). Adding new trigger words to existing templates. Changing edge_intent_engine.js. Conversational timeline changes (that's 63c).",
    cacheBusts: ["checklist_reminder_engine.js", "field_forms.js"],
  },
  {
    id: "63c",
    phase: 63,
    title: "Contextual checklist reminders in conversational timeline",
    dependsOn: ["63b"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Open field tech app → workspace → type 'replacing supply fan motor on RTU 3' → confirm a gentle system bubble appears after ~800ms with the first 2 unchecked checklist items (e.g. 'RTU 3 check belt condition?', 'RTU 3 verify rotation?').",
      "Type a follow-up note addressing one of the reminded items (e.g. 'belt looks good') → on next equipment reference, confirm that item no longer appears in reminders.",
      "Switch equipment context: type 'now looking at RTU 5' → confirm reminders fire for RTU 5's unchecked items (separate from RTU 3's state).",
      "Go back to RTU 3: type 'back at RTU 3' → confirm previously-addressed items are still marked as mentioned (state persisted).",
      "Test with a template that has 8+ checklist items → confirm at most 2 reminders appear per equipment switch (MAX_REMINDERS_PER_SWITCH cap).",
      "Test with NO matching template for the job type → confirm no reminders fire and no errors in console.",
      "Verify the gentle reminders do NOT block typing or interrupt the conversational flow — they appear as system bubbles only.",
    ],
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Enhance the existing checklist reminder integration in conversational_timeline.js to surface
contextual checklist items more naturally during the conversational capture flow.

The core wiring already exists (Slice 45a):
- onWorkspaceOpen calls ChecklistReminderEngine.onJobCheckin(ticket) — ALREADY DONE
- processEntry calls ChecklistReminderEngine.updateFromEntry() — ALREADY DONE
- scheduleChecklistReminders fires gentle system bubbles — ALREADY DONE

This slice improves the integration:

## 1. Trigger reminders on FIRST equipment mention (not just equipment switch)

Currently scheduleChecklistReminders() only fires when equipment CHANGES (previousEquipment
differs from eqRef). But it should also fire on the FIRST equipment mention in a session
(when previousEquipment is null/empty and eqRef is set for the first time).

In processEntry() (~line 1680-1703), find the equipment switch logic. Add a condition:
  if (eqRef && (!previousEquipment || eqRef !== previousEquipment)) {
    scheduleChecklistReminders(eqRef, id);
  }
This ensures reminders fire on initial equipment identification, not just on switch.

## 2. Show checklist items as a lightweight card (not just text bubbles)

Update scheduleChecklistReminders() (~line 1580) to render reminders as a single
grouped card instead of individual system bubbles. This is less intrusive:

Instead of multiple addEntry() calls, create one system entry with HTML content:
  var html = '<div class="ct-checklist-remind" style="background:#fef9c3;border-radius:10px;padding:10px 14px;font-size:13px;color:#713f12;">';
  html += '<div style="font-weight:600;margin-bottom:6px;">📋 ' + equipment + ' — items to check:</div>';
  html += '<ul style="margin:0;padding-left:18px;line-height:1.6;">';
  reminders.forEach(function(r) { html += '<li>' + r + '</li>'; });
  html += '</ul></div>';
  addEntry(html, "system", ticketId, { isHtml: true });

Check if addEntry supports an isHtml flag or similar — if not, add a simple check:
if the entry text starts with '<div' or contains HTML tags, set innerHTML instead of textContent
on the bubble element in renderTimeline. Keep it minimal — just enough to render the card.

## 3. Debounce rapid equipment mentions

If the tech types 3 notes in a row mentioning the same equipment, don't fire reminders
3 times. Add a simple debounce:
  var _lastReminderEquipment = null;
  var _lastReminderTime = 0;
  In scheduleChecklistReminders, check:
  if (equipment === _lastReminderEquipment && (Date.now() - _lastReminderTime) < 30000) return;
  After firing reminders, set _lastReminderEquipment = equipment; _lastReminderTime = Date.now();

Bump conversational_timeline.js cache-bust in technician/index.html.`,
    outOfScope: "Changing checklist_reminder_engine.js logic (done in 63b). Adding new form templates. Firestore writes. Settings UI. Experience-based prompting (that's 63d).",
    cacheBusts: ["conversational_timeline.js"],
  },
  {
    id: "63d",
    phase: 63,
    title: "Experience level on tech profiles + adaptive reminder verbosity",
    dependsOn: ["63c"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Dispatcher → Settings → Technicians → confirm each tech card now shows an 'Experience Level' dropdown with options: Apprentice, Journeyman, Senior.",
      "Change a tech's level to 'Apprentice' and save → Firebase Console → roster/default → profiles → confirm the tech's profile now has experienceLevel: 'apprentice'.",
      "Change to 'Senior' and save → confirm Firestore updates to 'senior'.",
      "Field tech app: sign in as an Apprentice-level tech → workspace → mention equipment → confirm FULL checklist reminders appear (all items, up to MAX).",
      "Sign in as a Senior-level tech → workspace → mention same equipment → confirm NO reminders appear (silent mode for seniors).",
      "Sign in as a Journeyman-level tech → workspace → confirm reminders appear but capped at 1 item (abbreviated).",
      "Tech with NO experienceLevel set in Firestore (legacy profile) → confirm defaults to 'journeyman' behavior.",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["settings.js", "index.html", "checklist_reminder_engine.js", "technician/index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `Add an experience level field to technician profiles and use it to control
how verbose the checklist reminders are during field work.

## Roster data model (settings.js)

The roster is stored at tenants/{tenantId}/roster/default with structure:
  { names: string[], profiles: { [techName]: { onCallEligible, ptoDates, availability } } }

Add \`experienceLevel\` to the tech profile shape. Valid values:
  "apprentice" | "journeyman" | "senior"
Default: "journeyman" (for existing techs with no value set).

In getTechProfile() (~line 275-285), add experienceLevel to the returned object:
  experienceLevel: p.experienceLevel || "journeyman"

In setTechProfile() (~line 296-302), add experienceLevel to the stored object.

In syncTechnicianRosterToFirestore() (~line 606-613), the profiles are already
written to Firestore as-is — no change needed since the profile object now includes
experienceLevel.

## Settings UI (index.html + settings.js)

In renderTechSettings() (settings.js ~line 800-812), where each tech card is rendered,
add an Experience Level dropdown after the on-call eligible checkbox:

<select data-tech-exp-index="\${index}" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">
  <option value="apprentice" \${level === 'apprentice' ? 'selected' : ''}>Apprentice</option>
  <option value="journeyman" \${level === 'journeyman' ? 'selected' : ''}>Journeyman</option>
  <option value="senior" \${level === 'senior' ? 'selected' : ''}>Senior</option>
</select>

Add a change handler (in initTechSettingsUi or inline) that calls:
  setTechProfile(name, { experienceLevel: selectEl.value });
  syncTechnicianRosterToFirestore();

## Adaptive reminder verbosity (checklist_reminder_engine.js)

Add a function getMaxReminders() that returns the reminder cap based on experience level:
  function getMaxReminders() {
    var level = "journeyman";
    try {
      if (window.VCJobContext && window.VCJobContext.techExperienceLevel) {
        level = String(window.VCJobContext.techExperienceLevel).toLowerCase();
      }
    } catch (e) {}
    if (level === "apprentice") return 4;
    if (level === "senior") return 0;
    return 2; /* journeyman default */
  }

In getReminders() (~line 218-229), replace:
  return missing.slice(0, MAX_REMINDERS_PER_SWITCH)
with:
  var cap = getMaxReminders();
  if (cap <= 0) return [];
  return missing.slice(0, cap)

## Field tech app — expose experience level (technician/index.html)

When the tech signs in / is identified, the app reads roster data. Find where
the tech's identity is resolved (search for VCJobContext or techName or payrollKey
initialization). After the tech is identified, set:
  window.VCJobContext.techExperienceLevel = profileData.experienceLevel || "journeyman";

This value feeds into checklist_reminder_engine.js getMaxReminders() above.
The exact location depends on how the tech app resolves identity — search for where
VCJobContext is populated and add the experienceLevel field there.

Bump cache-bust on settings.js and checklist_reminder_engine.js.`,
    outOfScope: "Changing the reminder card UI (done in 63c). Changing form template data model (done in 63a). Adding new experience levels beyond the three. AI-powered experience detection.",
    cacheBusts: ["settings.js", "checklist_reminder_engine.js"],
  },
  {
    id: "63e",
    phase: 63,
    title: "Photo auto-tie to equipment via edge intent engine entities",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Field tech app → workspace → type 'checking RTU 3 condenser' → take a photo → confirm the photo entry in the timeline includes metadata showing equipmentRef: 'RTU 3'.",
      "Type another note without mentioning equipment → take a photo → confirm the photo still tags with the last-active equipment ('RTU 3').",
      "Switch context: type 'now at RTU 5' → take a photo → confirm photo tags with 'RTU 5'.",
      "Compile Notes → confirm the compiled report groups photos under their associated equipment.",
      "Check Firebase Console → site_intelligence → confirm no writes happened yet (that's slice 63f).",
      "Take a photo with NO equipment context (no equipment mentioned in session) → confirm photo saves normally without equipment tag (graceful fallback).",
    ],
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Auto-tag photos with the currently active equipment reference so they can be
associated with the correct unit in equipment history.

## How equipment tracking already works

In conversational_timeline.js processEntry(), the edge intent engine extracts equipment
entities (e.g. "RTU 3", "AHU 1") from note text. The function setActiveEquipment()
stores the current equipment reference, and it persists across entries until the tech
mentions a different unit.

## Photo tagging changes

When a photo or video is captured and added to the timeline, the entry should include
the currently active equipment reference in its metadata.

Find where media entries are created in conversational_timeline.js — look for the
capturePhotoNative / media action sheet flow that calls addEntry() with an image.
The entry object should include:
  meta: { ...existingMeta, equipmentRef: getActiveEquipment() || null }

where getActiveEquipment() returns the current equipment string (e.g. "RTU 3") or null.

If getActiveEquipment() is not already exported, find the variable that stores the
active equipment reference (set by setActiveEquipment in processEntry) and add a
getter function:
  function getActiveEquipment() { return _activeEquipment || null; }

## Compile integration

In the compile notes prompt (buildCompilePrompt or buildDeltaCompilePrompt), the entries
with equipmentRef should be included so the compiled report can group photos by unit:

In the prompt that lists entries for compilation, include the equipmentRef in the entry
representation:
  "- [PHOTO] (equipment: RTU 3) taken at 2:15 PM"
instead of just:
  "- [PHOTO] taken at 2:15 PM"

This ensures the compiled report can say "RTU 3 — Photos: [1], [2]" under the equipment
section. The actual grouping is done by Gemini during compile — just feed it the data.

Bump conversational_timeline.js cache-bust in technician/index.html.`,
    outOfScope: "Writing photos to site_intelligence (that's 63f). Changing the photo upload path in Firebase Storage. Changing the edge intent engine. Settings UI changes.",
    cacheBusts: ["conversational_timeline.js"],
  },
  {
    id: "63f",
    phase: 63,
    title: "Post-compile classification + equipment history write to site_intelligence",
    dependsOn: ["63e"],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Field tech app → workspace → add 3+ notes mentioning equipment (e.g. 'RTU 3 compressor amp draw 18.5A', 'replaced contactor on RTU 3', 'verified operation') → tap Compile Notes.",
      "After compile finishes, confirm a prompt appears: 'Save findings to RTU 3 equipment history?' with a preview of what will be saved.",
      "Tap 'Save to Equipment History' → check Firebase Console → site_intelligence → confirm a new document was created with the equipment-relevant findings.",
      "Verify the site_intelligence document contains: equipmentRef, findings summary, measurements, replaced parts, date, techName, sourceTicketId.",
      "Decline the prompt ('Skip') → confirm NO write to site_intelligence occurred.",
      "Compile notes for a job with NO equipment mentioned → confirm the equipment history prompt does NOT appear.",
      "Compile notes mentioning 2 different units (RTU 3 and RTU 5) → confirm the prompt asks about BOTH units separately or as a batch.",
    ],
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `After notes are compiled, classify findings as job-specific vs equipment-relevant
and offer to write equipment-relevant data to site_intelligence for permanent unit history.

## Post-compile hook

In conversational_timeline.js, find where compileNotes() finishes (after the Gemini
compile call returns and the compiled report is displayed in the modal). After the
report is shown, add a post-compile step:

function classifyEquipmentFindings(compiledReport, entries):
  1. Scan all timeline entries for unique equipmentRef values (from 63e metadata).
  2. If no equipment references found, return early (nothing to save).
  3. For each unique equipment unit, extract equipment-relevant findings from the
     compiled report sections:
     - Measurements (temperatures, amp draws, pressures)
     - Parts replaced or identified
     - Verified repair outcomes
     - Follow-up recommendations for this unit
  4. Build a prompt for Gemini (or do it rule-based if the compiled report already
     has structured sections):
     "From this compiled service report, extract findings specific to [equipmentRef]
      that should be saved to the unit's permanent history. Return JSON with:
      { measurements: [], partsReplaced: [], repairOutcome: string, followUp: string, summary: string }"
  5. Use the same getGeminiApiKey() + fetch pattern as the existing compile flow.

## User confirmation before write

NEVER auto-write to site_intelligence. Always show a confirmation:

After classification, display a lightweight card at the bottom of the compile modal
(or as a follow-up prompt after the modal closes):
  <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 16px;">
    <div style="font-weight:600;color:#166534;">Save to equipment history?</div>
    <div style="font-size:13px;color:#15803d;margin:6px 0;">RTU 3: replaced contactor, amp draw 18.5A, verified operation</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="ct-equip-save-btn" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;">Save to Equipment History</button>
      <button class="ct-equip-skip-btn" style="background:none;border:1px solid #cbd5e1;border-radius:8px;padding:8px 16px;cursor:pointer;color:#64748b;">Skip</button>
    </div>
  </div>

## Firestore write path

On "Save to Equipment History" click, write to site_intelligence using the existing
VCFirestore helper:

  var db = firebase.firestore();
  var ref = window.VCFirestore
    ? window.VCFirestore.siteIntelligence(db)
    : db.collection("site_intelligence");

  ref.add({
    equipmentRef: equipmentRef,
    type: "service_findings",
    summary: classifiedFindings.summary,
    measurements: classifiedFindings.measurements || [],
    partsReplaced: classifiedFindings.partsReplaced || [],
    repairOutcome: classifiedFindings.repairOutcome || "",
    followUp: classifiedFindings.followUp || "",
    sourceTicketId: ticketId,
    techName: techName,
    date: new Date().toISOString(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

This uses the tenant-scoped site_intelligence path (VCFirestore handles the tenant prefix).

Bump conversational_timeline.js cache-bust in technician/index.html.`,
    outOfScope: "Changing compile notes UI or logic beyond the post-compile hook. Modifying site_intelligence Firestore rules. Equipment hub display of saved history. Changing the edge intent engine.",
    cacheBusts: ["conversational_timeline.js"],
  },
  {
    id: "63g",
    phase: 63,
    title: "Unit tag nameplate OCR — auto-populate model/serial on equipment record",
    dependsOn: ["63e"],
    patterns: ["Multi-file UI feature (no Firestore writes)", "Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Field tech app → workspace → type 'working on RTU 3' (so RTU 3 is the active equipment) → take a photo of a unit nameplate/data plate.",
      "Confirm a classification card appears within ~3 seconds: 'Nameplate detected — RTU 3' with extracted fields (Model, Serial, Manufacturer). If fields are empty the card should not appear.",
      "Verify the extracted Model and Serial fields look plausible (Gemini Vision reading real or test nameplate image).",
      "Tap 'Save to Equipment Record' → open Firebase Console → find the equipment document for this customer/location/unit → confirm modelNumber and serialNumber fields are now populated.",
      "Tap 'Dismiss' instead → confirm NO write occurs and no equipment fields are modified.",
      "Take a regular (non-nameplate) photo while RTU 3 is active → confirm NO classification card appears (false positive guard: Gemini returns null fields).",
      "Take a nameplate photo with NO active equipment context → confirm the card still shows extracted fields but prompts user to confirm the unit name before saving (fallback: text input for unit name).",
      "Verify existing equipment fields (Mfg Year, Health Score, etc.) are preserved — the write is a merge, not an overwrite.",
    ],
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js", "equipment_manager.js"],
    expectedIds: ["ct-nameplate-confirm-card"],
    expectedExports: {},
    scope: `When a technician photographs a unit nameplate/data plate while an equipment unit is
active, use Gemini Vision to extract model number, serial number, and manufacturer, then
offer to save those fields to the unit's equipment record in Firestore.

## Detection flow (conversational_timeline.js)

After a photo is saved to the timeline (in capturePhotoNative / the media action sheet
save path), add a post-save classification step:

function classifyNameplate(dataUrl, equipmentRef):
  1. Build a Gemini Vision request using the existing getGeminiApiKey() + fetch pattern.
     Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
     Send the image as a base64 inlineData part (strip the "data:image/...;base64," prefix).
  2. Prompt (system + user):
     "You are an HVAC unit data extraction assistant.
      Look at this image. If it shows a manufacturer nameplate, data plate, or model label
      for an HVAC unit (RTU, AHU, chiller, boiler, etc.), extract the following fields.
      If the image is NOT a nameplate, return all fields as null.
      Return ONLY valid JSON:
      { \\"manufacturer\\": string|null, \\"modelNumber\\": string|null, \\"serialNumber\\": string|null,
        \\"voltage\\": string|null, \\"tonnage\\": string|null }"
  3. Parse the JSON response. If modelNumber AND serialNumber are both null → return null
     (not a nameplate or unreadable). Otherwise return the parsed object.

This classification should run silently in the background. Use a try/catch so any
Gemini error is swallowed — the photo is already saved; this is best-effort enrichment.

## Confirmation card (conversational_timeline.js)

If classifyNameplate() returns non-null results, inject a confirmation card immediately
after the photo entry in the timeline:

  var html = '<div id="ct-nameplate-confirm-card" style="background:#f0f9ff;border:1px solid #7dd3fc;'
    + 'border-radius:10px;padding:12px 16px;font-size:13px;margin:4px 0;">'
    + '<div style="font-weight:600;color:#0369a1;margin-bottom:6px;">🏷️ Nameplate detected'
    + (equipmentRef ? ' — ' + equipmentRef : '') + '</div>'
    + '<div style="color:#0c4a6e;line-height:1.7;">'
    + (result.manufacturer ? '<div><strong>Manufacturer:</strong> ' + result.manufacturer + '</div>' : '')
    + (result.modelNumber ? '<div><strong>Model:</strong> ' + result.modelNumber + '</div>' : '')
    + (result.serialNumber ? '<div><strong>Serial:</strong> ' + result.serialNumber + '</div>' : '')
    + (result.voltage ? '<div><strong>Voltage:</strong> ' + result.voltage + '</div>' : '')
    + (result.tonnage ? '<div><strong>Tonnage:</strong> ' + result.tonnage + '</div>' : '')
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:10px;">'
    + '<button class="ct-nameplate-save-btn" data-eq="' + (equipmentRef||'') + '" data-result=\\'\\''
    + ' style="background:#0284c7;color:#fff;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;">'
    + 'Save to Equipment Record</button>'
    + '<button class="ct-nameplate-dismiss-btn"'
    + ' style="background:none;border:1px solid #cbd5e1;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:12px;color:#64748b;">'
    + 'Dismiss</button></div></div>';

Store the result JSON on the save button via a data attribute (data-result) so the click
handler can read it without a closure over a shared var.

Wire delegated click handlers (add once to #ct-message-list or document):
- .ct-nameplate-save-btn → call saveNameplateToEquipment(equipmentRef, result) then remove the card
- .ct-nameplate-dismiss-btn → remove the card (no write)

## Firestore write (equipment_manager.js)

Add a new exported function: window.VCEquipmentManager.saveNameplateFields(equipmentRef, fields)

  function saveNameplateFields(equipmentRef, fields):
    1. Look up the equipment document by name. In equipment_manager.js, equipment records are
       stored per customer+location. Search the in-memory cache or re-query:
       Find the collection path where equipment is stored (grep for "Equipment" collection
       or the collection name used in saveEquipmentRecord / getEquipmentList).
    2. Find the document where the unit name (e.g. "RTU 3") matches equipmentRef
       (case-insensitive, trimmed). Use the first match.
    3. Write a Firestore MERGE (update, not set-overwrite) with only non-null fields:
       { modelNumber, serialNumber, manufacturer, voltage, tonnage } — only include keys
       where fields[key] is a non-empty string.
    4. On success, refresh the equipment hub list if it's open: call
       window.VCEquipmentHub && window.VCEquipmentHub.refresh && window.VCEquipmentHub.refresh()
    5. On error, log to console but do NOT alert — silent best-effort.

In conversational_timeline.js saveNameplateToEquipment():
  Call window.VCEquipmentManager.saveNameplateFields(equipmentRef, result) if the module
  is available. If VCEquipmentManager is not loaded, log a warning and skip the write.

Bump conversational_timeline.js cache-bust in technician/index.html.`,
    outOfScope: "Changing how equipment photos are stored in Firebase Storage. Modifying the Equipment Hub display of model/serial (that will update automatically via existing hub rendering). Adding OCR to non-HVAC contexts. Changing the camera capture flow itself.",
    cacheBusts: ["conversational_timeline.js"],
  },
  {
    id: "64a",
    phase: 64,
    title: "Migrate office quotes from localStorage to Firestore",
    dependsOn: [],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Dispatcher app → Quoting Tool → Start New Quote → fill customer name, add 2 parts, click Create Quote → verify quote saved. Open Firebase Console → tenants/TWIN_PILLARS/office_quotes → confirm a document exists with matching quoteNum, customerName, parts array, subtotal, grandTotal.",
      "Quoting Tool → Recent Quotes Database → confirm the new quote appears in the list with correct date, customer, total, status.",
      "Click Edit on the quote → modify labor hours → click Create Quote again → verify Firestore document updated (not duplicated).",
      "Click Delete → confirm quote removed from Firestore and list.",
      "Open a second browser/device → Quoting Tool → confirm the quote appears in Recent Quotes (proving Firestore sync, not localStorage-only).",
      "Ticket Details → click Create Quote → confirm customer/location pre-fills from ticket and quote saves to Firestore.",
      "Verify quoting.js still writes a localStorage backup copy (fallback for offline).",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["quoting.js", "shared/firebase_logic.js", "firestore.rules", "index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `Migrate office quotes from browser localStorage to Firestore so quotes persist across
devices and can be accessed by the AI quote pipeline.

## Firestore collection helper (shared/firebase_logic.js)

Add a new collection helper function after fieldQuotes (~line 146):

  function officeQuotes(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "office_quotes");
    }
    return tenantCollection(db, "office_quotes");
  }

Add a new collection helper for vendors (needed for 64d but define the path now):

  function vendors(db) {
    if (isSandboxDataPath()) {
      return sandboxDefaultSubcollection(db, "vendors");
    }
    return tenantCollection(db, "vendors");
  }

Add both to the VCFirestore export object (~line 771, after fieldQuotes):
  officeQuotes: officeQuotes,
  vendors: vendors,

## Firestore rules (firestore.rules)

Add after the field_quotes rule block (~line 166):

  match /tenants/{tid}/office_quotes/{document=**} {
    allow read, write: if true;
  }
  match /tenants/{tid}/vendors/{document=**} {
    allow read, write: if true;
  }

## quoting.js changes

The file currently uses localStorage key "twinPillarsQuotesDB" for all quote persistence.
Migrate to Firestore while keeping localStorage as a write-through offline backup.

### saveQuoteToDatabase (~line 391-416)

Replace the localStorage-only save with Firestore write:

1. Keep the existing gatherFormData() call and validation.
2. After gathering data, write to Firestore:
   - Get db reference: var db = firebase.firestore();
   - Get collection ref: var ref = window.VCFirestore ? window.VCFirestore.officeQuotes(db) : db.collection("office_quotes");
   - For NEW quotes (no currentQuoteId or id starts with DB-ID-):
     * Use ref.add(quoteData) to create a new Firestore doc.
     * Store the returned doc.id as the quote's id.
     * Set the hidden #currentQuoteId value to the doc.id.
     * incrementQuoteNumber() as before.
   - For EXISTING quotes (editing):
     * Use ref.doc(currentId).set(quoteData, { merge: true }) to update.
3. Also write to localStorage as a backup (keep existing twinPillarsQuotesDB logic).
4. On Firestore write error, fall back to localStorage-only and log warning.
5. Add updatedAt: new Date().toISOString() to every saved quote.
6. Add createdAt: new Date().toISOString() only on new quote creation.

### renderQuoteHistory (~line 418-457)

Replace localStorage read with Firestore query:

1. var db = firebase.firestore();
   var ref = window.VCFirestore ? window.VCFirestore.officeQuotes(db) : db.collection("office_quotes");
2. ref.orderBy("createdAt", "desc").limit(100).get() — then render the rows.
3. Keep the existing table HTML structure (Preview / Edit / Delete actions).
4. Fall back to localStorage if Firestore query fails (offline resilience).

### loadQuoteForEditing (~line 151-203)

Update to read from Firestore by doc.id instead of scanning localStorage array.
Fall back to localStorage search if Firestore read fails.

### deleteQuote (~line 466-473)

Update to delete from Firestore (ref.doc(id).delete()) AND remove from localStorage backup.

### convertToQuote (service_call.js ~line 3213-3255)

No changes needed — it calls startNewQuote() and populateQuoteFromServiceCall() which
ultimately go through saveQuoteToDatabase. The Firestore write happens transparently.

### Quote counter

Keep tp_quote_counter in localStorage for now (simple, works offline).
The counter is only used for QT- number generation and doesn't need Firestore.

## index.html

Bump quoting.js cache-bust: quoting.js?v=6 → quoting.js?v=7 (~line 9737).
Bump firebase_logic.js cache-bust if present.
Bump VC_BUILD.`,
    outOfScope: "Changing the quote form UI fields (that's 64b/64c). Adding vendor directory UI (that's 64d). Changing convertToQuote logic. Migrating existing localStorage quotes (that's 64e). PDF preview changes.",
    cacheBusts: ["quoting.js"],
  },
  {
    id: "64b",
    phase: 64,
    title: "Port display toggles from standalone quoting tool",
    dependsOn: ["64a"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Quoting Tool → new quote → confirm 4 new toggle controls appear in Section 3 (Labor & Truck Charges): 'Show SERVICE & DISPATCH FEE as Separate Line Item' checkbox, 'Show Itemized Parts to Customer' checkbox, 'Parts Summary Description' textarea, 'Include Sales Tax (5.5%) on Quote' checkbox.",
      "'Show Itemized Parts' unchecked → Preview Quote → customer-facing view shows parts summary text instead of individual line items. Internal view still shows full parts detail.",
      "'Show Itemized Parts' checked → Preview Quote → customer-facing view shows individual part lines with Unit Price and Amount.",
      "'Include Sales Tax' unchecked → Preview Quote → no tax line shown, total = subtotal. Check quote saved to Firestore with includeSalesTax: false.",
      "'Show DISPATCH FEE as Separate Line Item' checked → Preview Quote → dispatch fee appears as its own line item in the customer view.",
      "'Show DISPATCH FEE as Separate Line Item' unchecked → dispatch fee is NOT a separate line (rolled into total).",
      "Edit a saved quote → confirm all toggles reload correctly from saved state.",
      "Parts Summary Description edited → confirm custom text appears in preview when itemized parts are hidden.",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["quoting.js", "index.html"],
    expectedIds: ["showDispatchFeeSeparate", "showItemizedParts", "partsSummaryDescription", "includeSalesTax"],
    expectedExports: {},
    scope: `Add four display toggle controls to the quoting tool that match the standalone tool
at lgarage.github.io/HVAC_REPAIR_QUOTING_TOOL/. These control how the customer-facing
quote PDF looks without changing the internal data.

## index.html UI additions (#view-quoting, ~line 4402-4789)

In Section 3 (Labor & Truck Charges), after the TRUCK / DISPATCH CHARGE input (~line 4630),
add the following controls:

1. Show SERVICE & DISPATCH FEE as Separate Line Item:
   <label style="display:flex;align-items:center;gap:8px;margin:12px 0;font-size:13px;cursor:pointer;">
     <input type="checkbox" id="showDispatchFeeSeparate" onchange="triggerQuoteAutoSave()">
     Show SERVICE & DISPATCH FEE as Separate Line Item
   </label>

2. Show Itemized Parts to Customer:
   <label style="display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px;cursor:pointer;">
     <input type="checkbox" id="showItemizedParts" checked onchange="triggerQuoteAutoSave(); togglePartsSummary();">
     Show Itemized Parts to Customer
   </label>

3. Parts Summary Description (shown when itemized parts are hidden):
   <div id="partsSummaryGroup" style="display:none;margin:8px 0 12px 26px;">
     <label style="font-size:12px;color:#64748b;display:block;margin-bottom:4px;">
       Parts Summary Description (shown to customer instead of itemized list)
     </label>
     <textarea id="partsSummaryDescription" rows="2"
       style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;resize:vertical;"
       onchange="triggerQuoteAutoSave()"
     >All parts and materials required to complete the repair are included in the quoted price. Only OEM-quality or equivalent components will be used.</textarea>
   </div>

4. Include Sales Tax:
   <label style="display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px;cursor:pointer;">
     <input type="checkbox" id="includeSalesTax" checked onchange="triggerQuoteAutoSave()">
     Include Sales Tax (5.5%) on Quote
     <span style="font-size:11px;color:#94a3b8;">(uncheck for real property improvements / new construction)</span>
   </label>

## quoting.js changes

### togglePartsSummary (new function)
  function togglePartsSummary() {
    var show = !document.getElementById('showItemizedParts').checked;
    document.getElementById('partsSummaryGroup').style.display = show ? 'block' : 'none';
  }

### gatherFormData (~line 102-149)
Add these fields to the returned quote object:
  showDispatchFeeSeparate: document.getElementById('showDispatchFeeSeparate').checked,
  showItemizedParts: document.getElementById('showItemizedParts').checked,
  partsSummaryDescription: document.getElementById('partsSummaryDescription').value,
  includeSalesTax: document.getElementById('includeSalesTax').checked,

Update the tax calculation (~line 135-140):
  var includeTax = document.getElementById('includeSalesTax').checked;
  var tax = includeTax ? subtotal * 0.055 : 0;

### loadQuoteForEditing (~line 151-203)
After loading existing fields, restore toggle states:
  document.getElementById('showDispatchFeeSeparate').checked = q.showDispatchFeeSeparate || false;
  document.getElementById('showItemizedParts').checked = q.showItemizedParts !== false; // default true
  document.getElementById('partsSummaryDescription').value = q.partsSummaryDescription || 'All parts and materials...';
  document.getElementById('includeSalesTax').checked = q.includeSalesTax !== false; // default true
  togglePartsSummary();

### startNewQuote (~line 60-100)
Reset toggles to defaults:
  document.getElementById('showDispatchFeeSeparate').checked = false;
  document.getElementById('showItemizedParts').checked = true;
  document.getElementById('includeSalesTax').checked = true;
  togglePartsSummary();

### updatePreviewHTML (~line 313-381)
Update the CUSTOMER-FACING preview (not the internal view) to respect toggles:

1. If showDispatchFeeSeparate is checked, add a "SERVICE & DISPATCH FEE" line item
   to the customer table (printTableBody) with the truck charge amount.
   If unchecked, do NOT add it as a separate line (it's already in the total).

2. If showItemizedParts is unchecked, replace the individual part rows in the
   CUSTOMER-facing table with a single summary row:
   <tr><td>1</td><td colspan="2">{partsSummaryDescription}</td><td>{parts total}</td><td>{parts total}</td></tr>
   The INTERNAL view always shows full itemized parts regardless of this toggle.

3. If includeSalesTax is unchecked, hide the "Sales Tax (5.5%)" row in both views
   and set tax amount to $0.00.

Bump quoting.js cache-bust in index.html. Bump VC_BUILD.`,
    outOfScope: "Changing Firestore persistence (done in 64a). Vendor directory (64d). Quote status changes (64c). Parts grid column additions. PDF print flow changes beyond toggle-driven visibility.",
    cacheBusts: ["quoting.js"],
  },
  {
    id: "64c",
    phase: 64,
    title: "Quote status + workflow enhancements for AI pipeline",
    dependsOn: ["64a"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Quoting Tool → Quote Status dropdown → confirm new options appear: Draft, Awaiting Vendor Pricing, Pricing Received, Sent to Customer, Approved, Rejected, Requote Requested (7 total).",
      "Select 'Awaiting Vendor Pricing' → confirm the status pill in the Recent Quotes Database row shows with an orange/amber style.",
      "Select 'Sent to Customer' → confirm status saves correctly to Firestore.",
      "Existing quotes with old statuses (Draft, Pending, Approved, Rejected) → confirm they still load and display correctly (backward compat).",
      "Verify handleQuoteStatusChange still auto-syncs workflow dropdown when quote is Approved.",
      "Recent Quotes Database → confirm the Status column shows the new status values correctly.",
      "Preview Quote → confirm the new status values appear in the quote header (e.g. 'Status: AWAITING VENDOR PRICING').",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["quoting.js", "index.html"],
    expectedIds: [],
    expectedExports: {},
    scope: `Update the quote status options to support the AI quote pipeline workflow.
The pipeline spec (PROJECT_STATUS/ai_quote_pipeline_spec.md) defines these statuses:
Draft, Awaiting Vendor Pricing, Pricing Received, Sent to Customer, Approved, Rejected, Requote Requested.

## index.html changes (#view-quoting)

Find the Quote Status select element (~line 4550-4560, id="quoteStatusInput").
Replace the current options:
  <option value="Draft">Draft</option>
  <option value="Pending">Pending</option>
  <option value="Approved">Approved</option>
  <option value="Rejected">Rejected</option>
  <option value="Requote Requested">Requote Requested</option>

With the expanded set:
  <option value="Draft">Draft</option>
  <option value="Awaiting Vendor Pricing">Awaiting Vendor Pricing</option>
  <option value="Pricing Received">Pricing Received</option>
  <option value="Pending">Pending</option>
  <option value="Sent to Customer">Sent to Customer</option>
  <option value="Approved">Approved</option>
  <option value="Rejected">Rejected</option>
  <option value="Requote Requested">Requote Requested</option>

Keep "Pending" for backward compatibility with existing saved quotes that use it.

## quoting.js changes

### handleQuoteStatusChange (~line 13-21)
Update to handle new statuses. Specifically:
- "Awaiting Vendor Pricing" and "Pricing Received" should NOT auto-change job workflow.
- "Sent to Customer" should NOT auto-change job workflow.
- "Approved" continues to work as before (enables job workflow changes).
- Add logic: if status is "Awaiting Vendor Pricing" or "Pricing Received", show the
  requote note history section (useful for tracking vendor communication notes).

### renderQuoteHistory (~line 418-457)
Update the status display in the Recent Quotes Database table rows to include
color-coded status pills:
  Draft → gray
  Awaiting Vendor Pricing → amber/orange
  Pricing Received → blue
  Pending → yellow
  Sent to Customer → purple
  Approved → green
  Rejected → red
  Requote Requested → orange

Use inline styles on a <span> element:
  var statusColors = {
    'Draft': '#94a3b8', 'Awaiting Vendor Pricing': '#f59e0b',
    'Pricing Received': '#3b82f6', 'Pending': '#eab308',
    'Sent to Customer': '#8b5cf6', 'Approved': '#22c55e',
    'Rejected': '#ef4444', 'Requote Requested': '#f97316'
  };
  var color = statusColors[q.status] || '#94a3b8';
  // In the row HTML: '<span style="color:' + color + ';font-weight:600;">' + q.status + '</span>'

### updatePreviewHTML (~line 313-381)
The quote header already shows "Status: {status}". Ensure the new status values
display correctly in both internal and customer-facing preview views.

Bump quoting.js cache-bust in index.html. Bump VC_BUILD.`,
    outOfScope: "Adding vendor email send functionality (Phase C). Auto-status transitions (future). Firestore persistence changes (done in 64a). Display toggles (done in 64b).",
    cacheBusts: ["quoting.js"],
  },
  {
    id: "64e",
    phase: 64,
    title: "localStorage quote import tool — one-time migration",
    dependsOn: ["64a"],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Manually add 2-3 test quotes to localStorage key 'twinPillarsQuotesDB' (or use existing saved quotes if present).",
      "Quoting Tool → Recent Quotes Database section → confirm an 'Import Local Quotes' button appears.",
      "Click Import → confirm a summary dialog shows: 'Found X quotes in local storage. Import to cloud?'",
      "Confirm Import → verify all quotes appear in the Firestore-backed Recent Quotes list.",
      "Firebase Console → office_quotes → confirm imported documents have correct data and an 'importedFrom: localStorage' field.",
      "Click Import again → confirm the tool says 'No new quotes to import' (prevents double-import by checking existing quoteNum values in Firestore).",
      "Verify original localStorage data is NOT deleted (kept as backup).",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["quoting.js", "index.html"],
    expectedIds: ["importLocalQuotesBtn"],
    expectedExports: {},
    scope: `Add a one-time migration utility that reads existing quotes from localStorage
(twinPillarsQuotesDB) and writes them to the new Firestore office_quotes collection.

## index.html changes

In the Recent Quotes Database section of #view-quoting (~line 4730-4750), add an
import button next to the existing Export/Import backup buttons:

<button id="importLocalQuotesBtn" onclick="importLocalQuotesToFirestore()"
  style="background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:8px 16px;
  font-size:13px;cursor:pointer;margin-left:8px;">
  ⬆ Import Local Quotes to Cloud
</button>

## quoting.js — importLocalQuotesToFirestore (new function)

function importLocalQuotesToFirestore():
  1. Read twinPillarsQuotesDB from localStorage. Parse JSON. If empty/null, alert "No local quotes found." and return.

  2. Query existing Firestore office_quotes to get all quoteNum values:
     var ref = getVendorsRef... (use the office quotes ref pattern from 64a)
     ref.get() → build a Set of existing quoteNum values.

  3. Filter localStorage quotes: only import those whose quoteNum is NOT already in Firestore.
     If all already imported, alert "No new quotes to import. All X quotes already in cloud."

  4. Show confirm dialog: "Found {count} new quotes in local storage. Import to cloud?"

  5. On confirm, for each quote:
     - Add importedFrom: "localStorage" field
     - Add importedAt: new Date().toISOString()
     - Add createdAt based on quoteDate or current time
     - ref.add(quoteData)

  6. Use Promise.all or sequential writes with error handling.

  7. On complete: alert "Imported {count} quotes to cloud." and call renderQuoteHistory() to refresh.

  8. Do NOT delete localStorage data — keep it as a backup.

  9. On partial failure: alert which quotes failed and which succeeded.

Bump quoting.js cache-bust. Bump VC_BUILD.`,
    outOfScope: "Deleting localStorage after import. Importing customer directory to Firestore. Importing service tickets. Changing the export/import backup buttons' behavior. Auto-triggering import on first load.",
    cacheBusts: ["quoting.js"],
  },
  {
    id: "64f",
    phase: 64,
    title: "Checklist template enhancements — quoteRelevant toggle + associatedParts list",
    dependsOn: ["64a"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Dispatcher → Settings → Field Forms → Edit any template → confirm a 'Quote-Relevant' toggle appears below the AI Trigger Word section.",
      "Enable 'Quote-Relevant' → confirm an 'Associated Parts' section appears with an '+ Add Part' button.",
      "Click '+ Add Part' → fill Part Description ('Supply Fan Motor'), Specs ('3/4 HP, 208-230V, Frame 48Y'), Qty (1), check 'Always Include' → confirm a row appears in the parts list.",
      "Add a second part without 'Always Include' checked. Save the template → Firebase Console → form_templates/{id} → confirm document has quoteRelevant: true, associatedParts: [{description, specs, qty, alwaysInclude}, ...].",
      "Reopen template for editing → confirm quoteRelevant toggle is checked and both parts rows reload correctly.",
      "Disable 'Quote-Relevant' → confirm associatedParts section hides → save → Firestore doc has quoteRelevant: false.",
      "Template list view → confirm quote-relevant templates show a 'QUOTE' badge chip beside the category chip.",
      "Template with quoteRelevant: false (or missing) → confirm NO 'QUOTE' badge appears (backward compat).",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["settings.js", "index.html"],
    expectedIds: ["ffbQuoteRelevantToggle", "ffbAssociatedPartsSection", "ffbAssociatedPartsRows", "ffbAddPartBtn"],
    expectedExports: {},
    scope: `Add quoteRelevant and associatedParts fields to the Field Form & Checklist Builder in the
dispatcher Settings UI. These fields are the institutional knowledge layer the AI uses in slice
64g to know which repairs trigger quotes and what parts typically accompany them.

## Firestore data model additions

In saveFieldFormTemplate (settings.js ~line 2616, payload built at lines 2661–2673), add to the payload:
  quoteRelevant: document.getElementById('ffbQuoteRelevantToggle').checked,
  associatedParts: getAssociatedPartsRows(),

where getAssociatedPartsRows() reads all rows from #ffbAssociatedPartsRows and returns:
  [ { description: string, specs: string, qty: number, alwaysInclude: boolean }, ... ]
Only include rows where description is non-empty (trim, filter).

In openFieldFormBuilderEdit (settings.js ~line 2556), after loading existing fields, restore:
  document.getElementById('ffbQuoteRelevantToggle').checked = d.quoteRelevant || false;
  setAssociatedPartsRows(Array.isArray(d.associatedParts) ? d.associatedParts : []);
  toggleAssociatedPartsSection();

In openFieldFormBuilderCreate (settings.js ~line 2428), reset:
  document.getElementById('ffbQuoteRelevantToggle').checked = false;
  setAssociatedPartsRows([]);
  toggleAssociatedPartsSection();

## Settings UI (index.html — Field Form Builder modal)

In index.html, find the Field Form Builder modal section. The Additional Trigger Words section was
added in slice 63a (search for id="ffbTriggerWordsContainer"). Below that section, add:

<div style="border-top:1px solid #e2e8f0;margin-top:14px;padding-top:14px;">
  <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;
    color:#0ea5e9;cursor:pointer;">
    <input type="checkbox" id="ffbQuoteRelevantToggle"
      onchange="toggleAssociatedPartsSection()"
      style="width:16px;height:16px;accent-color:#0ea5e9;">
    Quote-Relevant (triggers AI repair quote when this checklist fires)
  </label>
  <p style="font-size:12px;color:#64748b;margin:4px 0 10px 24px;line-height:1.45;">
    When checked, a repair quote will automatically be drafted when this checklist
    is used during a field job. Add the parts that typically accompany this repair below.
  </p>

  <div id="ffbAssociatedPartsSection" style="display:none;">
    <label style="display:block;font-size:13px;font-weight:600;margin:0 0 6px;color:#1e293b;">
      Associated Parts
    </label>
    <p style="font-size:12px;color:#64748b;margin:0 0 8px;line-height:1.45;">
      Parts that typically accompany this repair type. The AI will suggest these
      on the draft quote (tech can confirm or dismiss each one).
    </p>

    <!-- Header row -->
    <div style="display:grid;grid-template-columns:1fr 1fr 48px 80px 24px;gap:4px;
      font-size:11px;font-weight:600;color:#94a3b8;padding:0 4px 4px;">
      <span>Part Description</span><span>Specs</span><span>Qty</span>
      <span style="text-align:center;">Always<br>Include</span><span></span>
    </div>

    <div id="ffbAssociatedPartsRows"></div>

    <button type="button" id="ffbAddPartBtn" onclick="addAssociatedPartRow()"
      style="margin-top:8px;background:none;border:1px dashed #cbd5e1;border-radius:8px;
      padding:7px 16px;font-size:13px;color:#64748b;cursor:pointer;width:100%;">
      + Add Part
    </button>
  </div>
</div>

## Settings JS functions (settings.js)

Add these functions near the getTriggerWordChips/setTriggerWordChips block (~line 2418):

function toggleAssociatedPartsSection():
  var show = document.getElementById('ffbQuoteRelevantToggle').checked;
  document.getElementById('ffbAssociatedPartsSection').style.display = show ? 'block' : 'none';

function addAssociatedPartRow(data):
  data = data || {};
  var row = document.createElement('div');
  row.className = 'ffb-part-row';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 48px 80px 24px;gap:4px;margin-bottom:4px;align-items:center;';
  row.innerHTML =
    '<input type="text" class="ffb-part-desc" placeholder="Supply Fan Motor" value="' + (data.description || '') + '"' +
    ' style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;">' +
    '<input type="text" class="ffb-part-specs" placeholder="3/4 HP, 48Y frame" value="' + (data.specs || '') + '"' +
    ' style="padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;">' +
    '<input type="number" class="ffb-part-qty" min="1" value="' + (data.qty || 1) + '"' +
    ' style="padding:6px 4px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;text-align:center;">' +
    '<label style="display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;cursor:pointer;">' +
    '<input type="checkbox" class="ffb-part-always"' + (data.alwaysInclude ? ' checked' : '') +
    ' style="accent-color:#0ea5e9;"> Always</label>' +
    '<button type="button" onclick="this.closest(\'.ffb-part-row\').remove()"' +
    ' style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:16px;line-height:1;">×</button>';
  document.getElementById('ffbAssociatedPartsRows').appendChild(row);

function setAssociatedPartsRows(parts):
  document.getElementById('ffbAssociatedPartsRows').innerHTML = '';
  (parts || []).forEach(function(p) { addAssociatedPartRow(p); });

function getAssociatedPartsRows():
  var rows = document.querySelectorAll('#ffbAssociatedPartsRows .ffb-part-row');
  var result = [];
  rows.forEach(function(row) {
    var desc = (row.querySelector('.ffb-part-desc').value || '').trim();
    if (!desc) return;
    result.push({
      description: desc,
      specs: (row.querySelector('.ffb-part-specs').value || '').trim(),
      qty: parseInt(row.querySelector('.ffb-part-qty').value) || 1,
      alwaysInclude: row.querySelector('.ffb-part-always').checked
    });
  });
  return result;

## Template list card update

In hydrateFieldFormTemplatesList (settings.js ~line 2964), in the card rendering loop (~line 3024),
after the category chip, add a QUOTE badge if quoteRelevant is true:
  var quoteBadge = r.quoteRelevant
    ? '<span style="background:#fef9c3;color:#713f12;font-size:10px;font-weight:700;' +
      'padding:2px 6px;border-radius:4px;margin-left:4px;">QUOTE</span>'
    : '';
Then include quoteBadge in the card HTML next to the category display.

Bump settings.js cache-bust in index.html (settings.js?v=22 → v=23). Bump VC_BUILD.`,
    outOfScope: "Changing how field_forms.js reads these template fields (that's 64g). Changing the conversational timeline. Adding quote pipeline logic. Any Firestore rules changes (office_quotes and vendors rules already added in 64a).",
    cacheBusts: ["settings.js"],
  },
  {
    id: "64g",
    phase: 64,
    title: "Quote Data Builder agent — parse compile output into structured quote_data",
    dependsOn: ["64f"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Field tech app → workspace on a ticket → type notes mentioning a repair ('replacing supply fan motor on RTU 3, belt drive, 3/4 HP') → hit Compile Notes.",
      "After compile modal opens, within ~3 seconds confirm a 'Quote Data' card appears below the compiled notes: '🔖 Repair quote detected — Supply Fan Motor Replacement'.",
      "Verify the card shows: repair type, equipment (RTU 3), labor hours input (pre-filled if mentioned, empty if not), list of parts (confirmed from speech + suggested from template).",
      "If a quote-relevant template with associatedParts was matched during the session, confirm suggested parts (from template) appear with a 'Suggested' badge. Confirmed parts (tech mentioned them) show no badge.",
      "Labor hours field empty → type '2' → confirm the card now has complete data.",
      "Click 'Include in Quote' → confirm the card closes and a green success message appears: 'Quote data saved — dispatcher will see a Draft Quote.'",
      "If NO quote-relevant checklist was triggered during the session → compile → confirm NO quote data card appears (no false positives).",
      "Test with notes that have NO labor hours and NO equipment — confirm the card either asks for both or does not appear (graceful handling of insufficient data).",
    ],
    htmlTarget: "technician/index.html",
    filesToCreate: ["agents/quote_data_builder.js"],
    filesToModify: ["conversational_timeline.js", "technician/index.html"],
    expectedIds: ["ct-quote-data-card"],
    expectedExports: { "agents/quote_data_builder.js": ["buildQuoteData"] },
    scope: `Create a new Quote Data Builder agent and wire it into the post-compile hook in
conversational_timeline.js. When the compile finishes and a quote-relevant checklist was
triggered during the session, this agent parses the compiled report and generates a
structured quote_data object, then shows a confirmation card asking for any missing info
(primarily labor hours) before the tech confirms "Include in Quote."

## agents/quote_data_builder.js (new file)

Create as a self-contained IIFE module (same pattern as agents/notes_parser.js):

(function() {
  "use strict";

  /**
   * buildQuoteData(compiledText, matchedTemplates, equipmentContext)
   *
   * Uses Gemini to parse the compiled service report and extract repair-related data.
   * Returns a Promise resolving to a quote_data object or null if no repairs detected.
   *
   * @param {string} compiledText - The full compiled service report text
   * @param {Array}  matchedTemplates - Templates that fired during this session
   *                  Each: { id: string, data: { templateName, quoteRelevant, associatedParts, targetKeyword } }
   * @param {Object} equipmentContext - { activeEquipment: string, nameplateFields: Object|null }
   * @param {string} apiKey - Gemini API key
   */
  function buildQuoteData(compiledText, matchedTemplates, equipmentContext, apiKey) {
    if (!compiledText || !apiKey) return Promise.resolve(null);

    // Only proceed if at least one matched template is quote-relevant
    var quoteTemplates = (matchedTemplates || []).filter(function(t) {
      return t && t.data && t.data.quoteRelevant;
    });
    if (!quoteTemplates.length) return Promise.resolve(null);

    var templateSummary = quoteTemplates.map(function(t) {
      var parts = (t.data.associatedParts || []).map(function(p) {
        return p.description + (p.specs ? ' (' + p.specs + ')' : '') + ' x' + (p.qty || 1) +
               (p.alwaysInclude ? ' [always include]' : '');
      }).join(', ');
      return 'Template: ' + t.data.templateName +
             (parts ? '. Associated parts: ' + parts : '');
    }).join('\n');

    var equipment = (equipmentContext && equipmentContext.activeEquipment) || '';
    var nameplate = equipmentContext && equipmentContext.nameplateFields
      ? JSON.stringify(equipmentContext.nameplateFields) : '';

    var prompt = 'You are an HVAC repair quoting assistant. Read this compiled service report ' +
      'and extract structured repair data for a quote.\n\n' +
      'COMPILED REPORT:\n' + compiledText + '\n\n' +
      'ACTIVE EQUIPMENT: ' + (equipment || 'unknown') + '\n' +
      (nameplate ? 'NAMEPLATE DATA: ' + nameplate + '\n\n' : '\n') +
      'QUOTE-RELEVANT CHECKLIST TEMPLATES THAT FIRED THIS SESSION:\n' + templateSummary + '\n\n' +
      'Instructions:\n' +
      '1. Identify each distinct repair the tech performed or is recommending.\n' +
      '2. For each repair, extract: repairType (descriptive name), equipmentRef (unit name), ' +
      'laborHours (number or null if not mentioned), ' +
      'confirmedParts (parts the tech explicitly mentioned — array of {description, specs}), ' +
      'fieldNotes (brief summary of findings for this repair).\n' +
      '3. For each repair, also include the suggestedParts from the matching template ' +
      '(alwaysInclude parts are always in, others are optional suggestions).\n' +
      '4. If NO clear repair work was done or recommended (diagnostic only, no action needed), ' +
      'return {"repairs": []}.\n' +
      'Return ONLY valid JSON: {"repairs": [{"repairType": string, "equipmentRef": string, ' +
      '"laborHours": number|null, "confirmedParts": [...], "suggestedParts": [...], ' +
      '"fieldNotes": string}], "totalLaborHours": number|null}';

    return fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        })
      }
    ).then(function(r) { return r.json(); }).then(function(resp) {
      var text = resp && resp.candidates && resp.candidates[0] &&
                 resp.candidates[0].content && resp.candidates[0].content.parts &&
                 resp.candidates[0].content.parts[0] && resp.candidates[0].content.parts[0].text;
      if (!text) return null;
      var parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.repairs) || !parsed.repairs.length) return null;
      return parsed;
    }).catch(function() { return null; });
  }

  window.VCAgents = window.VCAgents || {};
  window.VCAgents.QuoteDataBuilder = { buildQuoteData: buildQuoteData };
}());

## conversational_timeline.js — wire into post-compile hook

The post-compile hook currently runs at line 2831–2832:
  /* Slice 63f: post-compile equipment classification */
  classifyEquipmentFindings(_compiledResult, entries, compileTicketId);

Add quote data generation AFTER classifyEquipmentFindings, still inside compileNotes():

  /* Slice 64g: quote data generation */
  try {
    var _quoteMatchedTemplates = (typeof window.getActiveFormTemplates === 'function')
      ? (window.getActiveFormTemplates() || []).filter(function(t) { return t && t.data && t.data.quoteRelevant; })
      : [];
    if (_quoteMatchedTemplates.length && window.VCAgents && window.VCAgents.QuoteDataBuilder) {
      var _quoteEquipCtx = {
        activeEquipment: (window.VCJobContext && window.VCJobContext.activeEquipment) || '',
        nameplateFields: window._lastNameplateFields || null
      };
      var _quoteTicketId = compileTicketId;
      typeof getGeminiApiKey === 'function' && getGeminiApiKey().then(function(apiKey) {
        if (!apiKey) return;
        return window.VCAgents.QuoteDataBuilder.buildQuoteData(
          _compiledResult, _quoteMatchedTemplates, _quoteEquipCtx, apiKey
        );
      }).then(function(quoteData) {
        if (!quoteData || !quoteData.repairs || !quoteData.repairs.length) return;
        showQuoteDataCard(quoteData, _quoteTicketId);
      }).catch(function() {});
    }
  } catch (_qe) {}

## showQuoteDataCard function (conversational_timeline.js — new function)

Add near classifyEquipmentFindings (~line 2857):

function showQuoteDataCard(quoteData, ticketId):
  1. Build HTML for the confirmation card and inject it into the compile modal container
     (append inside #ct-compile-modal or the equip-save-container sibling):

  var repairs = quoteData.repairs;
  var laborMissing = repairs.some(function(r) { return r.laborHours === null; });
  var html = '<div id="ct-quote-data-card" style="background:#fefce8;border:1px solid #fde047;' +
    'border-radius:10px;padding:14px 16px;margin-top:12px;">';
  html += '<div style="font-weight:700;color:#713f12;margin-bottom:8px;">🔖 Repair quote detected</div>';

  repairs.forEach(function(r, idx) {
    html += '<div style="font-size:13px;color:#422006;margin-bottom:6px;">' +
      '<strong>' + (r.repairType || 'Repair') + '</strong>' +
      (r.equipmentRef ? ' — ' + r.equipmentRef : '') + '</div>';

    if (r.confirmedParts && r.confirmedParts.length) {
      r.confirmedParts.forEach(function(p) {
        html += '<div style="font-size:12px;color:#78350f;padding-left:12px;">✓ ' + p.description +
          (p.specs ? ' <span style="color:#a16207;">(' + p.specs + ')</span>' : '') + '</div>';
      });
    }
    if (r.suggestedParts && r.suggestedParts.length) {
      r.suggestedParts.forEach(function(p) {
        html += '<div style="font-size:12px;color:#a16207;padding-left:12px;">◦ ' + p.description +
          (p.specs ? ' <span style="color:#ca8a04;">(' + p.specs + ')</span>' : '') +
          ' <span style="font-size:10px;background:#fef08a;border-radius:3px;padding:1px 4px;">suggested</span></div>';
      });
    }

    // Labor hours input if missing
    html += '<div style="margin-top:6px;display:flex;align-items:center;gap:8px;">' +
      '<label style="font-size:12px;color:#713f12;font-weight:600;">Labor hours:</label>' +
      '<input type="number" class="ct-quote-labor-input" data-repair-idx="' + idx + '"' +
      ' min="0.25" step="0.25" value="' + (r.laborHours !== null ? r.laborHours : '') + '"' +
      ' placeholder="e.g. 2"' +
      ' style="width:70px;padding:4px 8px;border:1px solid #fcd34d;border-radius:6px;font-size:13px;">' +
      '</div>';
  });

  html += '<div style="display:flex;gap:8px;margin-top:12px;">' +
    '<button id="ct-quote-include-btn" data-ticket-id="' + ticketId + '"' +
    ' style="background:#ca8a04;color:#fff;border:none;border-radius:8px;padding:9px 18px;' +
    'cursor:pointer;font-size:13px;font-weight:600;">Include in Quote</button>' +
    '<button onclick="document.getElementById(\'ct-quote-data-card\').remove()"' +
    ' style="background:none;border:1px solid #d97706;border-radius:8px;padding:9px 14px;' +
    'cursor:pointer;font-size:13px;color:#92400e;">Skip</button>' +
    '</div></div>';

  2. Store quoteData on window._pendingQuoteData = quoteData so the click handler can read it.

  3. Inject the HTML into the compile modal. Find the modal container (search for the element
     that holds .ct-compile-textarea — it's inside #ct-compile-modal). Append the card HTML
     after the equip-save-container if present, otherwise append directly to the modal body.
     Use insertAdjacentHTML('beforeend', html) on the modal's inner container.

  4. Wire the "Include in Quote" button click handler (delegated, add once near the existing
     .ct-nameplate-save-btn / .ct-equip-save-btn delegated listeners):
     On #ct-quote-include-btn click:
       a. Read labor hours from each .ct-quote-labor-input and update window._pendingQuoteData.repairs[idx].laborHours.
       b. Recalculate totalLaborHours = sum of all repair laborHours.
       c. Call saveQuoteDataToTicket(window._pendingQuoteData, ticketId).
       d. Replace the card HTML with a green confirmation:
          '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 16px;' +
          'margin-top:12px;color:#166534;font-size:13px;">✅ Quote data saved — dispatcher will see a Draft Quote.</div>'

## technician/index.html — script include

Add the new agent script after the other agent includes (search for "agents/nameplate_ocr.js"):
  <script src="../agents/quote_data_builder.js?v=1"></script>

Bump conversational_timeline.js?v=49 → v=50 in technician/index.html (line 12436).
Bump VC_BUILD.`,
    outOfScope: "Writing quote_data to Firestore (that's 64h). Sending vendor emails (Phase C). Changing the compile prompt itself. Modifying field_forms.js matching logic. Settings UI changes (done in 64f).",
    cacheBusts: ["conversational_timeline.js"],
  },
  {
    id: "64h",
    phase: 64,
    title: "Write quote_data to service call Firestore doc on tech confirmation",
    dependsOn: ["64g"],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Complete the 64g flow: tech compiles notes → quote data card appears → fill in labor hours → click 'Include in Quote'.",
      "Firebase Console → service_calls/{ticketId} (or tenant path) → confirm the document now has a 'quote_data' field with the full repairs array and totalLaborHours.",
      "Confirm the document also has 'quotePending: true' and 'quotePendingAt' timestamp.",
      "Click 'Include in Quote' a second time (or refresh + re-confirm) → confirm the write is idempotent (updates the existing field, doesn't duplicate).",
      "Compile a session with NO quote-relevant repairs → confirm NO quote_data or quotePending field is written.",
      "If the Firestore write fails (e.g. network offline) → confirm a console warning is logged but no alert/crash in the field app.",
      "Check that existing fields on the service call doc are NOT overwritten — the write must be a merge (set with merge:true).",
    ],
    filesToCreate: [],
    filesToModify: ["conversational_timeline.js"],
    expectedIds: [],
    expectedExports: {},
    scope: `Implement saveQuoteDataToTicket() in conversational_timeline.js — the function that
slice 64g's "Include in Quote" button calls. Writes the confirmed quote_data payload to the
service call's Firestore document using a merge write so no existing fields are overwritten.

## saveQuoteDataToTicket function (conversational_timeline.js — new function)

Add near the existing writeEquipmentToSiteIntelligence function (~line 2978):

function saveQuoteDataToTicket(quoteData, ticketId):
  1. Validate inputs. If no quoteData or no ticketId, log warning and return.

  2. Build the write payload:
     var payload = {
       quote_data: quoteData,
       quotePending: true,
       quotePendingAt: firebase.firestore.FieldValue.serverTimestamp(),
       quoteDataUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
     };

  3. Resolve the service call document reference. The service call is identified by ticketId.
     The field app reads the schedule from service_calls via VCFirestore or direct collection access.
     Use the same tenant-scoped path pattern as other writes in this file:

     var db = firebase.firestore();
     var scRef;
     if (window.VCFirestore && typeof window.VCFirestore.serviceCall === 'function') {
       scRef = window.VCFirestore.serviceCall(db, ticketId);
     } else if (window.VCFirestore && typeof window.VCFirestore.tenantCollection === 'function') {
       scRef = window.VCFirestore.tenantCollection(db, 'service_calls').doc(ticketId);
     } else {
       // Fallback: direct collection (no-auth field app uses root path)
       scRef = db.collection('service_calls').doc(ticketId);
     }

  4. Perform the write:
     scRef.set(payload, { merge: true })
       .then(function() {
         console.log('[QuotePipeline] quote_data written to ticket', ticketId);
       })
       .catch(function(err) {
         console.warn('[QuotePipeline] Failed to write quote_data:', err);
       });

  Note: The write is intentionally fire-and-forget (no await). The confirmation UI in 64g
  updates immediately on click; the Firestore write happens in the background.

## Firestore rules

No new rule needed — service_calls already has allow read, write: if true per the existing
field app rules (confirmed during the Firestore rules hotfix in May 2026).

Bump conversational_timeline.js?v=50 → v=51 in technician/index.html.
Bump VC_BUILD.`,
    outOfScope: "Showing quote notifications in the dispatcher app (that's 64i). Sending vendor emails (Phase C). Modifying the quote_data structure itself (64g defines it). Reading quote_data in the office app.",
    cacheBusts: ["conversational_timeline.js"],
  },
  {
    id: "64i",
    phase: 64,
    title: "Dispatcher quote notification + auto-draft quote from quote_data",
    dependsOn: ["64h"],
    patterns: ["Firestore write path (new collection/doc)", "Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Dispatcher app → Scheduled Calls or Service Calls list → find a ticket where the tech confirmed 'Include in Quote' (i.e. Firestore doc has quotePending: true) → confirm a yellow '🔖 Quote Ready' badge appears on the ticket card.",
      "Click the '🔖 Quote Ready' badge (or a 'Create Draft Quote' button on the ticket detail) → confirm the Quoting Tool opens pre-populated: customer name, location, repair type as the first line item, parts pre-filled (confirmed + suggested from quote_data), labor hours set.",
      "Firebase Console → tenants/{tid}/office_quotes → confirm a new document was created with status: 'Draft', linked ticketId, repairs array from quote_data.",
      "Confirm the draft quote's repair line items show 'confirmed' vs 'suggested' source badges — confirmed parts have source:'confirmed', suggested have source:'suggested'.",
      "Ticket with quotePending: false (or field missing) → confirm NO '🔖 Quote Ready' badge appears.",
      "Click 'Create Draft Quote' twice → confirm a second duplicate draft is NOT created (check for existing draft with same ticketId before creating).",
      "Verify existing ticket card fields (customer name, status, address, tech assigned) are not affected by this change.",
    ],
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["service_call.js", "quoting.js", "index.html"],
    expectedIds: ["quote-ready-badge"],
    expectedExports: {},
    scope: `Wire the dispatcher app to detect when a ticket has quote_data and allow one-click
creation of a draft quote in office_quotes Firestore. The tech-side pipeline (64g + 64h)
writes quotePending: true and quote_data to the service call doc. This slice reads that and
surfaces it in the dispatcher UI.

## service_call.js — detect quotePending and show badge

Find where service call cards are rendered in service_call.js (search for the function that
builds card HTML for the schedule list / service call rows — it likely reads from a Firestore
snapshot and builds a card with customer name, status, address, etc.).

When building a card, check if the doc has quotePending: true. If so, add a badge:
  var quoteBadge = data.quotePending
    ? '<span id="quote-ready-badge" class="vc-quote-ready-badge" data-ticket-id="' + docId + '"' +
      ' style="display:inline-flex;align-items:center;gap:4px;background:#fef9c3;color:#713f12;' +
      'font-size:11px;font-weight:700;padding:3px 8px;border-radius:5px;cursor:pointer;' +
      'margin-left:6px;border:1px solid #fde047;">🔖 Quote Ready</span>'
    : '';
Append quoteBadge to the card HTML near the status/title area.

Add a delegated click handler (add once, near other delegated handlers in service_call.js):
  document.addEventListener('click', function(e) {
    var badge = e.target.closest('.vc-quote-ready-badge');
    if (!badge) return;
    var ticketId = badge.getAttribute('data-ticket-id');
    if (!ticketId) return;
    createDraftQuoteFromTicket(ticketId);
  });

## createDraftQuoteFromTicket function (service_call.js — new)

function createDraftQuoteFromTicket(ticketId):
  1. Read the service call doc from Firestore to get quote_data:
     var db = firebase.firestore();
     var scRef = ... (same tenant-path resolution as in 64h — check VCFirestore.serviceCall or
                      tenantCollection('service_calls').doc(ticketId) or root service_calls/{id});
     scRef.get().then(function(snap) {
       if (!snap.exists) return;
       var data = snap.data();
       var quoteData = data.quote_data;
       if (!quoteData) return;
       createOfficeDraftQuote(quoteData, ticketId, data);
     });

## createOfficeDraftQuote function (quoting.js — new)

function createOfficeDraftQuote(quoteData, ticketId, ticketDoc):
  1. Check for existing draft quote with same ticketId:
     var db = firebase.firestore();
     var qRef = window.VCFirestore ? window.VCFirestore.officeQuotes(db) : db.collection('office_quotes');
     qRef.where('ticketId', '==', ticketId).where('status', '==', 'Draft').limit(1).get()
       .then(function(existing) {
         if (!existing.empty) {
           // Draft already exists — open it instead of creating duplicate
           alert('A draft quote already exists for this ticket. Opening it.');
           // Switch to quoting tab and load existing quote
           switchTab && switchTab('quoting');
           var existId = existing.docs[0].id;
           typeof loadQuoteForEditing === 'function' && loadQuoteForEditing(existId);
           return;
         }
         _doCreateDraftQuote(quoteData, ticketId, ticketDoc, qRef);
       });

  2. _doCreateDraftQuote(quoteData, ticketId, ticketDoc, qRef):
     Build the office_quotes document from quoteData:
     var repairs = quoteData.repairs || [];
     var lineItems = [];
     repairs.forEach(function(r) {
       var parts = [];
       (r.confirmedParts || []).forEach(function(p) {
         parts.push({ description: p.description, specs: p.specs || '', qty: 1,
           source: 'confirmed', vendorCost: 0, markupPercent: 30, retailPrice: 0 });
       });
       (r.suggestedParts || []).forEach(function(p) {
         parts.push({ description: p.description, specs: p.specs || '', qty: p.qty || 1,
           source: 'suggested', vendorCost: 0, markupPercent: 30, retailPrice: 0 });
       });
       lineItems.push({
         repairType: r.repairType || 'Repair',
         equipment: { unitNumber: r.equipmentRef || '', model: '', serial: '', manufacturer: '' },
         laborHours: r.laborHours || 0,
         parts: parts,
         fieldNotes: r.fieldNotes || ''
       });
     });

     var quoteNum = 'QT-' + String(Date.now()).slice(-6);
     var draft = {
       quoteNumber: quoteNum,
       ticketId: ticketId,
       customerId: ticketDoc.customerId || ticketDoc.customer_id || '',
       customerName: ticketDoc.customerName || ticketDoc.customer || '',
       locationAddress: ticketDoc.address || ticketDoc.serviceAddress || '',
       status: 'Draft',
       jobWorkflow: 'N/A',
       customerType: 'commercial',
       laborRate: 175,
       repairs: lineItems,
       totalLaborHours: quoteData.totalLaborHours || 0,
       serviceDispatchFee: 0,
       showDispatchFeeSeparate: false,
       showItemizedParts: true,
       partsSummaryDescription: 'All parts and materials required to complete the repair are included in the quoted price.',
       includeSalesTax: true,
       salesTaxRate: 0.055,
       subtotal: 0,
       salesTax: 0,
       grandTotal: 0,
       vendorRequests: [],
       autoGeneratedFrom: 'field_pipeline',
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString()
     };

     qRef.add(draft).then(function(docRef) {
       console.log('[QuotePipeline] Draft quote created:', docRef.id);
       // Switch to Quoting Tool and load the new draft
       typeof switchTab === 'function' && switchTab('quoting');
       typeof renderQuoteHistory === 'function' && renderQuoteHistory();
       // Optionally load into the form for immediate review
       typeof loadQuoteForEditing === 'function' && loadQuoteForEditing(docRef.id);
     }).catch(function(err) {
       console.warn('[QuotePipeline] Failed to create draft quote:', err);
       alert('Could not create draft quote. Check console for details.');
     });

## index.html — no new elements needed

The quote-ready badge is dynamically injected into service call cards by service_call.js.
The Quoting Tool (#view-quoting) and switchTab() already exist from Phase A slices.

Bump service_call.js and quoting.js cache-busts in index.html. Bump VC_BUILD.`,
    outOfScope: "Vendor email drafting (Phase C). AI-parsed vendor pricing (Phase C). Customer PDF delivery (Phase C). Changing the quote form UI beyond loading the pre-populated draft. Modifying the field tech app (done in 64g + 64h).",
    cacheBusts: ["service_call.js", "quoting.js"],
  },
  {
    id: "63h",
    phase: 63,
    title: "Cross-job equipment history view in Equipment Hub",
    dependsOn: ["63f", "63g"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Field tech app → Equipment Hub → tap any equipment unit card → confirm the detail view now has a 'Service History' section below the specs.",
      "Verify the Service History section shows past findings from site_intelligence for this unit (if 63f has been used to save findings). Each entry should show: date, tech name, repair summary.",
      "Tap an entry → confirm it expands to show full detail: measurements, parts replaced, follow-up notes.",
      "Unit with NO history in site_intelligence → confirm the section shows 'No service history recorded yet' (empty state, not an error).",
      "Verify the history loads asynchronously — the unit detail view opens immediately; history appears after the query resolves.",
      "Confirm only history for THIS specific unit is shown (equipmentRef exact match) — not all site_intelligence records.",
      "Verify the list is sorted newest-first (most recent service at top).",
      "Confirm no console errors when site_intelligence has no records for the unit.",
    ],
    filesToCreate: [],
    filesToModify: ["equipment_hub.js", "technician/index.html"],
    expectedIds: ["ehub-service-history-section"],
    expectedExports: {},
    scope: `Add a Service History section to the Equipment Hub unit detail view that shows
all past service findings for the selected unit, pulled from the site_intelligence
collection. This is a read-only aggregated view across all past jobs for that unit.

## Where to add it (equipment_hub.js)

The Equipment Hub renders a detail view when a unit card is tapped. Find the function
that builds the detail panel HTML (search for openEquipmentDetail or the function that
renders the full unit spec card with photos, health score, etc. — likely in
equipment_hub.js ~line 200-400).

At the bottom of the detail panel (after photos, after specs), add a Service History
section:

  <div id="ehub-service-history-section" style="margin-top:20px;">
    <div style="font-weight:600;font-size:14px;color:#1e293b;margin-bottom:10px;
      padding-bottom:8px;border-bottom:1px solid #e2e8f0;">
      🔧 Service History
    </div>
    <div id="ehub-history-list" style="font-size:13px;color:#64748b;">
      Loading...
    </div>
  </div>

## Firestore query (equipment_hub.js)

After rendering the detail panel, run a background query to populate the history:

function loadEquipmentHistory(equipmentRef):
  1. Get the Firestore db reference (use the same pattern as existing equipment_hub.js
     Firestore calls — likely firebase.firestore() or window.db).
  2. Query the site_intelligence collection where equipmentRef matches.
     Use VCFirestore.siteIntelligence(db) if available, else db.collection("site_intelligence").
     Filter: where("equipmentRef", "==", equipmentRef)
     Order: orderBy("createdAt", "desc")
     Limit: 20 (enough for a mobile scroll without pagination complexity)
  3. On success, call renderEquipmentHistory(docs) to populate #ehub-history-list.
  4. On error or empty result, set #ehub-history-list innerHTML to the empty state.

## Rendering (equipment_hub.js)

function renderEquipmentHistory(docs):
  If docs is empty:
    #ehub-history-list.innerHTML = '<div style="color:#94a3b8;font-style:italic;padding:8px 0;">
      No service history recorded yet.</div>';
    return;

  For each doc, render a collapsible card:
    var d = doc.data();
    var dateStr = d.date ? new Date(d.date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : 'Unknown date';
    var html = '<div class="ehub-history-entry" style="border:1px solid #e2e8f0;border-radius:8px;'
      + 'margin-bottom:8px;overflow:hidden;">'
      + '<div class="ehub-history-header" style="padding:10px 14px;cursor:pointer;'
      + 'background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">'
      + '<div>'
      + '<div style="font-weight:600;color:#1e293b;">' + (d.repairOutcome || d.summary || 'Service visit') + '</div>'
      + '<div style="font-size:12px;color:#94a3b8;margin-top:2px;">' + dateStr + ' · ' + (d.techName || 'Unknown tech') + '</div>'
      + '</div>'
      + '<span style="color:#94a3b8;font-size:16px;">›</span>'
      + '</div>'
      + '<div class="ehub-history-detail" style="display:none;padding:10px 14px;background:#fff;'
      + 'border-top:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.7;">'
      + (d.measurements && d.measurements.length ? '<div><strong>Measurements:</strong> ' + d.measurements.join(', ') + '</div>' : '')
      + (d.partsReplaced && d.partsReplaced.length ? '<div><strong>Parts replaced:</strong> ' + d.partsReplaced.join(', ') + '</div>' : '')
      + (d.followUp ? '<div><strong>Follow-up:</strong> ' + d.followUp + '</div>' : '')
      + (d.sourceTicketId ? '<div style="color:#94a3b8;margin-top:4px;">Ticket: ' + d.sourceTicketId + '</div>' : '')
      + '</div>'
      + '</div>';
    append to #ehub-history-list.

Wire click on .ehub-history-header to toggle .ehub-history-detail display:
  Add a delegated click listener on #ehub-service-history-section (or document):
  if (e.target.closest('.ehub-history-header')) {
    var detail = e.target.closest('.ehub-history-entry').querySelector('.ehub-history-detail');
    detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
  }

## Integration point

Call loadEquipmentHistory(equipmentRef) immediately after the detail panel HTML is
injected into the DOM. The equipmentRef should be the unit name string (e.g. "RTU 3")
from the equipment document — the same value stored in site_intelligence.equipmentRef by 63f.

Make sure loadEquipmentHistory() is called with the right unit identifier. If the equipment
doc stores the unit name under a field like \`unitName\` or \`name\`, use that field value.
Grep equipment_hub.js for the field name used when rendering the unit card title.

Bump equipment_hub.js cache-bust in technician/index.html.`,
    outOfScope: "Writing to site_intelligence (done in 63f). Editing or deleting history entries — this is append-only. Changing the Equipment Hub list view. Pagination beyond 20 entries. Cross-customer history (each Equipment Hub is already customer-scoped).",
    cacheBusts: ["equipment_hub.js"],
  },
];