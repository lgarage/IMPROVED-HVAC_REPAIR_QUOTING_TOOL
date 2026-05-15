/**
 * Slice definitions for the New Field Tech UX phased build.
 * Each slice has scope, files, patterns (for model lookup), validation checks,
 * and push safety level.
 */

export interface Slice {
  id: string;
  phase: number;
  title: string;
  dependsOn: string[];
  patterns: string[];       // match against MODEL_LOOKUP.md Pattern column
  riskLevel: "safe" | "review";  // safe = auto-push, review = commit only
  filesToCreate: string[];
  filesToModify: string[];
  expectedIds: string[];    // HTML element IDs to verify after build
  expectedExports: Record<string, string[]>;  // file → exported function names
  scope: string;            // detailed scope description for the agent prompt
  outOfScope: string;
  cacheBusts: string[];     // e.g. "conversational_timeline.js?v=1"
  htmlTarget?: string;      // which HTML file to validate IDs/scripts against (default: "technician/index.html")
}

export const SLICES: Slice[] = [
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

  // ═══════════════════════════════════════════════════════════
  //  Phase 58: KI-002 Hygiene Leftovers
  //  All items from ROADMAP.md → Minor Tweaks & Polish
  // ═══════════════════════════════════════════════════════════

  {
    id: "58a",
    phase: 58,
    title: "B5 — report_builder.css duplicate load consolidation",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    htmlTarget: "index.html",
    filesToCreate: [],
    filesToModify: ["dispatcher/js/report_builder.js"],
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
Do NOT modify index.html — only change report_builder.js.
Bump the cache-bust version on the script tag for report_builder.js in index.html if one exists.`,
    outOfScope: "Changing report_builder.css content. Modifying the report builder UI. Any Firestore changes.",
    cacheBusts: [],
  },
  {
    id: "58b",
    phase: 58,
    title: "C1 — shadow_mode.js subscriber refcount + unsubscribe",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
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

  // ═══════════════════════════════════════════════════════════
  //  Phase 59: Security Hardening
  // ═══════════════════════════════════════════════════════════

  {
    id: "59a",
    phase: 59,
    title: "C4 — postMessage origin validation on all receivers",
    dependsOn: [],
    patterns: ["Cross-module wiring (3+ files)"],
    riskLevel: "review",
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
    cacheBusts: ["technician/js/workspace_ui.js", "dispatcher/js/shadow_mode.js"],
  },
  {
    id: "59b",
    phase: 59,
    title: "Firestore rules — tighten open paths to require auth",
    dependsOn: [],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
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

  // ═══════════════════════════════════════════════════════════
  //  Phase 60: Memory & Archive Hygiene
  // ═══════════════════════════════════════════════════════════

  {
    id: "60a",
    phase: 60,
    title: "Archive passed slices + dossier overflow + build state cleanup",
    dependsOn: [],
    patterns: ["Cross-module wiring (3+ files)"],
    riskLevel: "review",
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
   - Add a new /archive command to the REPL that:
     (a) reads .build_state.json for all slices with status "passed"
     (b) moves their definitions from slices.ts → slices_archive.ts (appends to ARCHIVED_SLICES array)
     (c) removes their entries from .build_state.json
     (d) logs how many slices were archived
     This lets the user manually trigger archival after reviewing passed slices.
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
];
