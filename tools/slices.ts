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
  reviewChecklist?: string[];   // required for review slices — specific steps for human to verify before push
  filesToCreate: string[];
  filesToModify: string[];
  expectedIds: string[];    // HTML element IDs to verify after build
  expectedExports: Record<string, string[]>;  // file → exported function names
  scope: string;            // detailed scope description for the agent prompt
  outOfScope: string;
  cacheBusts: string[];     // e.g. "conversational_timeline.js?v=1"
  htmlTarget?: string;      // which HTML file to validate IDs/scripts against (default: "technician/index.html")
}

// Slices 41a–57a have been moved to slices_archive.ts (all passed).
// Add new slices here; they will be auto-archived once they pass and
// SLICES.length exceeds MAX_ACTIVE_SLICES in build_runner.ts.

export const SLICES: Slice[] = [
  // ═══════════════════════════════════════════════════════════
  //  Phase 58: KI-002 Hygiene Leftovers
  //  All items from ROADMAP.md → Minor Tweaks & Polish
  // ═══════════════════════════════════════════════════════════

  
  
  
  
  
  

  // ═══════════════════════════════════════════════════════════
  //  Phase 59: Security Hardening
  // ═══════════════════════════════════════════════════════════

  
  
  

  // ═══════════════════════════════════════════════════════════
  //  Phase 61: Security Polish & Tooling Hygiene
  //  Overnight-safe hardening: no app logic changes, no auth
  //  rollout required. Pure rules / sender tightening / tooling.
  // ═══════════════════════════════════════════════════════════

  

  

  

  

  

  // ═══════════════════════════════════════════════════════════
  //  Phase 60: Memory & Archive Hygiene
  // ═══════════════════════════════════════════════════════════

  
  // ═══════════════════════════════════════════════════════════
  //  Phase 62: Hygiene & Regression Fixes
  // ═══════════════════════════════════════════════════════════
  
  
  
  // ═══════════════════════════════════════════════════════════
  //  Phase 63: Field Intelligence — Contextual Checklists
  //  Multi-trigger words, adaptive reminders during
  //  conversational capture, experience-based prompting,
  //  photo auto-tie to equipment, post-compile history write.
  // ═══════════════════════════════════════════════════════════

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
