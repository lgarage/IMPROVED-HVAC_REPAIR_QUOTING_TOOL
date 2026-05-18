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
  uiChange?: boolean;       // if true, build runner takes before/after Playwright screenshots and verifies with a cheap model
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

  // ═══════════════════════════════════════════════════════════
  //  Phase 64: AI Quote Pipeline — Foundation (Phase A)
  //  Migrate office quotes to Firestore, port standalone
  //  quoting tool features, add vendor directory.
  //  Full spec: PROJECT_STATUS/ai_quote_pipeline_spec.md
  //  Phase B slices (64f–64i) below.
  //  Phase C (email automation) sliced after Phase B confirmed.
  // ═══════════════════════════════════════════════════════════

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
    id: "64d",
    phase: 64,
    title: "Vendor directory — Firestore collection + CRUD UI",
    dependsOn: ["64a"],
    patterns: ["Firestore write path (new collection/doc)", "Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Dispatcher app → sidebar → confirm 'Vendors' nav item appears (below Quoting Tool or in a logical position).",
      "Click Vendors → confirm the vendor directory view loads with '+ Add Vendor' button and an empty table (or seeded data).",
      "Click + Add Vendor → fill name, email, phone, select categories (e.g. 'Motors', 'Controls') → Save → confirm vendor appears in the list.",
      "Firebase Console → tenants/TWIN_PILLARS/vendors → confirm the vendor document exists with correct fields.",
      "Click Edit on a vendor → modify the email → Save → confirm Firestore document updated.",
      "Click Delete on a vendor → confirm → verify removed from Firestore and the list.",
      "Add 3 vendors with different categories → confirm the category filter/display works correctly on vendor cards.",
      "Verify vendor data does NOT appear in the Quoting Tool yet (that integration is Phase B/C).",
    ],
    htmlTarget: "index.html",
    filesToCreate: ["vendor_directory.js"],
    filesToModify: ["index.html", "firestore.rules"],
    expectedIds: ["view-vendors", "nav-vendors", "vendorListTarget", "vendorAddBtn"],
    expectedExports: {},
    scope: `Add a vendor directory to the dispatcher app for managing parts supplier contacts.
This is the foundation for the AI-driven vendor email flow in Phase C.

## Firestore setup

The collection helper (VCFirestore.vendors) and Firestore rules were already added in 64a.
This slice only needs to use them.

## index.html — sidebar nav entry

Find the sidebar nav section (~line 2660-2690). Add a Vendors entry after Quoting Tool:
  <a id="nav-vendors" class="sidebar-nav-item" onclick="switchTab('vendors')">
    <span class="sidebar-icon">🏢</span>
    <span class="sidebar-label">Vendors</span>
  </a>

Ensure switchTab() in the existing JS handles 'vendors' — it likely uses a generic
pattern that shows #view-{tabName} and hides others. Verify this works; if not,
add 'vendors' to the tab list.

## index.html — #view-vendors section

Add a new view section after #view-quoting (~line 4789), before #view-invoice:

<div id="view-vendors" class="app-view" style="display:none;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
    <h2 style="color:#0ea5e9;margin:0;">🏢 Vendor Directory</h2>
    <button id="vendorAddBtn" onclick="openVendorForm()"
      style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:10px 20px;
      font-size:14px;cursor:pointer;font-weight:600;">
      + Add Vendor
    </button>
  </div>
  <div id="vendorListTarget"></div>

  <!-- Add/Edit Vendor Modal -->
  <div id="vendorFormModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);
    z-index:9999;display:none;align-items:center;justify-content:center;">
    <div style="background:#fff;border-radius:12px;padding:24px;max-width:500px;width:90%;
      max-height:80vh;overflow-y:auto;">
      <h3 id="vendorFormTitle" style="margin:0 0 16px;color:#1e293b;">Add Vendor</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <input type="hidden" id="vendorEditId" value="">
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Vendor Name *</label>
          <input type="text" id="vendorNameInput" placeholder="e.g. Johnstone Supply"
            style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Email</label>
          <input type="email" id="vendorEmailInput" placeholder="orders@vendor.com"
            style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Phone</label>
          <input type="tel" id="vendorPhoneInput" placeholder="920-555-1234"
            style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Categories (select all that apply)</label>
          <div id="vendorCategoriesContainer" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
            <!-- Rendered by JS: checkboxes for motors, capacitors, belts, coils, controls, refrigerant, sheet_metal, general_parts -->
          </div>
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:#475569;">Notes</label>
          <textarea id="vendorNotesInput" rows="2" placeholder="Best pricing on motors. Usually responds same day."
            style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;margin-top:4px;resize:vertical;"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
        <button onclick="closeVendorForm()"
          style="background:none;border:1px solid #cbd5e1;border-radius:8px;padding:10px 20px;cursor:pointer;color:#64748b;">
          Cancel
        </button>
        <button onclick="saveVendor()"
          style="background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:600;">
          Save Vendor
        </button>
      </div>
    </div>
  </div>
</div>

## vendor_directory.js (new file)

Create vendor_directory.js in the repo root. This is a simple CRUD module:

var VENDOR_CATEGORIES = [
  { id: "motors", label: "Motors" },
  { id: "capacitors", label: "Capacitors" },
  { id: "belts", label: "Belts & Pulleys" },
  { id: "coils", label: "Coils" },
  { id: "controls", label: "Controls & Boards" },
  { id: "refrigerant", label: "Refrigerant & Supplies" },
  { id: "sheet_metal", label: "Sheet Metal" },
  { id: "general_parts", label: "General Parts" }
];

Functions needed:

getVendorsRef():
  var db = firebase.firestore();
  return window.VCFirestore ? window.VCFirestore.vendors(db) : db.collection("vendors");

loadVendors():
  Query getVendorsRef().orderBy("name").get(), render cards into #vendorListTarget.
  Each card: vendor name (bold), email, phone, category chips, notes, Edit + Delete buttons.
  Empty state: "No vendors added yet. Click '+ Add Vendor' to get started."

openVendorForm(vendorId):
  If vendorId provided, load vendor data into form (edit mode). Otherwise clear form (add mode).
  Show #vendorFormModal (set display to 'flex').
  Render category checkboxes into #vendorCategoriesContainer from VENDOR_CATEGORIES.

closeVendorForm():
  Hide #vendorFormModal, clear form fields.

saveVendor():
  Read form fields. Validate name is non-empty.
  Build vendor object: { name, email, phone, categories: [checked category ids],
    notes, active: true, updatedAt: new Date().toISOString() }
  If editing (vendorEditId has value): getVendorsRef().doc(id).set(data, {merge:true})
  If new: add createdAt, getVendorsRef().add(data)
  On success: closeVendorForm(), loadVendors().

deleteVendor(vendorId):
  Confirm dialog. getVendorsRef().doc(vendorId).delete(). On success: loadVendors().

## index.html — script include

Add before the closing </body> tag, near other script includes (~line 9737):
  <script src="vendor_directory.js?v=1"></script>

Call loadVendors() in the switchTab handler or on DOMContentLoaded if the vendors tab
is active. The simplest approach: call loadVendors() inside the switchTab function
when tabName === 'vendors'.

Bump VC_BUILD.`,
    outOfScope: "Vendor email integration (Phase C). Vendor selection in the quoting tool (Phase B/C). AI vendor recommendation. Parts pricing history. Modifying quoting.js to use vendor data.",
    cacheBusts: [],
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

  // ═══════════════════════════════════════════════════════════
  //  Phase 64 — Phase B: AI Field Pipeline
  //  Connects field conversation → structured quote_data →
  //  auto-drafted office quote. No email yet (Phase C).
  // ═══════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════
  //  Phase 66: Admin Conversational Checklist Builder
  //  Managers/dispatchers chat (voice or text) to create and
  //  update form_templates. Tech phone preview before save.
  //  Entry point: admin PIN at sign-in → "ADMIN" session flag.
  // ═══════════════════════════════════════════════════════════

  {
    id: "66a",
    phase: 66,
    title: "Admin sign-in role gate — PIN flag + header pill + workspace switch",
    dependsOn: [],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Field app login screen → pick any name from the roster → a 'Continue as Admin' secondary button appears below the normal Continue button.",
      "Click 'Continue as Admin' → a PIN prompt appears (numeric input + Submit); enter the wrong PIN → error message 'Incorrect PIN, try again'; do NOT advance.",
      "Enter the correct PIN (stored as VC_ADMIN_PIN constant, default 1234 for local dev) → login proceeds normally (same as regular login path).",
      "After admin login: the header role pill shows 'ADMIN' in orange instead of the normal tech name first-name label.",
      "localStorage key 'vc_admin_session' is set to '1' after successful admin PIN; after switchUser() / logout it is removed.",
      "After admin login, Schedule screen loads normally (same as regular tech) — admin workspace switch happens inside openWorkspace() later (66b).",
      "Regular tech login (no admin) still works exactly as before — no PIN prompt, no ADMIN pill.",
    ],
    htmlTarget: "technician/index.html",
    filesToCreate: [],
    filesToModify: ["technician/index.html"],
    expectedIds: ["loginAdminBtn", "loginAdminPinModal", "loginAdminPinInput", "loginAdminPinSubmit", "loginAdminPinError"],
    expectedExports: {},
    scope: `Add an admin role gate to the field app sign-in flow so a manager can log in with
elevated privileges. This unlocks the Admin Conversation Engine (66b) when they open a workspace.

## Constant

At the top of the inline script block in technician/index.html (near other constants), add:
  const VC_ADMIN_PIN = "1234"; // replace with env-configured value before production

## Login HTML changes (technician/index.html)

Find the login shell section (search for id="loginContinueBtn"). Below that button, add:

<button type="button" id="loginAdminBtn"
  style="width:100%;padding:12px;border:1px solid #f97316;border-radius:10px;
  background:transparent;color:#f97316;font-size:15px;font-weight:600;
  margin-top:8px;cursor:pointer;">
  Continue as Admin
</button>

Add a PIN modal (hidden by default) after the login shell HTML:

<div id="loginAdminPinModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);
  z-index:9000;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:16px;padding:24px;width:min(320px,90vw);text-align:center;">
    <h3 style="margin:0 0 4px;font-size:18px;color:#0f172a;">Admin PIN</h3>
    <p style="font-size:13px;color:#64748b;margin:0 0 16px;">Enter your admin PIN to continue</p>
    <input id="loginAdminPinInput" type="password" inputmode="numeric" maxlength="8"
      style="width:100%;box-sizing:border-box;padding:14px;text-align:center;
      font-size:24px;letter-spacing:8px;border:1px solid #cbd5e1;border-radius:10px;
      margin-bottom:10px;" placeholder="••••" />
    <p id="loginAdminPinError" style="font-size:13px;color:#ef4444;min-height:18px;margin:0 0 10px;"></p>
    <button type="button" id="loginAdminPinSubmit"
      style="width:100%;padding:14px;border:none;border-radius:10px;
      background:#f97316;color:#fff;font-size:16px;font-weight:700;cursor:pointer;">
      Submit
    </button>
    <button type="button" onclick="document.getElementById('loginAdminPinModal').style.display='none'"
      style="width:100%;padding:12px;border:none;background:transparent;
      color:#64748b;font-size:14px;margin-top:6px;cursor:pointer;">
      Cancel
    </button>
  </div>
</div>

## Login JS changes (technician/index.html inline script)

Add a click handler for #loginAdminBtn that:
1. Reads the selected tech name from the roster picker (same as the normal Continue path).
2. If no tech selected, shows alert "Please select your name first."
3. Otherwise, shows #loginAdminPinModal (display:flex) and focuses #loginAdminPinInput.

Add a click handler for #loginAdminPinSubmit (and Enter keypress on #loginAdminPinInput) that:
1. Reads #loginAdminPinInput value.
2. If value.trim() !== VC_ADMIN_PIN → show #loginAdminPinError "Incorrect PIN, try again", clear input, return.
3. On correct PIN:
   a. Hide #loginAdminPinModal (display:none).
   b. Set localStorage.setItem('vc_admin_session', '1').
   c. Call the same login continuation path as the regular #loginContinueBtn click handler
      (resolve tech name, store to localStorage, call applyVcFieldEntitlements if present,
      hideLoginShell, loadUserProfile, switchScreen to schedule).
4. Clear #loginAdminPinError.

## Header pill update (technician/index.html)

In loadUserProfile() (around line ~8521), after setting techDisplayLabel.innerText:
  if (localStorage.getItem('vc_admin_session') === '1') {
    const tdl = document.getElementById('techDisplayLabel');
    if (tdl) {
      tdl.innerText = 'ADMIN';
      tdl.style.color = '#f97316';
      tdl.style.fontWeight = '700';
    }
  }

## Logout cleanup (technician/index.html)

In switchUser() (around line ~8538), after localStorage.removeItem('tp_saved_tech'), add:
  localStorage.removeItem('vc_admin_session');

## Cache-bust

Bump VC_BUILD to Phase66-Slice66a-<date>.`,
    outOfScope: "The Admin Conversation Engine (66b). Any Firestore reads or writes. Changing the roster data model. Changing the Schedule or Workspace screens. Actual enforcement of per-feature admin authorization beyond this PIN gate.",
    cacheBusts: [],
    uiChange: true,
  },

  {
    id: "66b",
    phase: 66,
    title: "Admin Conversation Engine — Gemini-driven checklist builder agent",
    dependsOn: ["66a"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "review",
    reviewChecklist: [
      "Admin logs in (66a) → opens any workspace → the conversation input area is identical visually, but the first system bubble reads 'Admin mode. Tell me what you'd like to do — for example: Create a supply fan motor checklist, or Update the belt replacement checklist.'",
      "Admin types 'Create a supply fan motor checklist' → Vertex replies 'Got it. What steps should the tech complete? List them one by one or all at once.'",
      "Admin types a list of steps (e.g. 'check belt tension, verify rotation, measure amp draw') → Vertex confirms each step and asks 'Anything else to add?' / 'What should the AI trigger word be for this checklist?' (if not already obvious from the name).",
      "Admin types 'done' or 'that's it' → Vertex shows a summary card: template name, trigger word, list of steps (as a preview bubble), and prompts 'Say confirm to save, or tell me what to change.'",
      "Admin types 'add a step: check capacitor' → the draft updates and shows the revised step list.",
      "Admin types 'preview' or 'show me what it looks like on a tech phone' → 66d preview bubble appears (separate slice, but the intent routing code exists here in 66b).",
      "Admin types 'cancel' or 'start over' → draft cleared, returns to idle greeting bubble.",
      "Regular tech (no admin session) opens workspace → sees normal field notes behavior, no admin bubble.",
    ],
    htmlTarget: "technician/index.html",
    filesToCreate: ["agents/admin_agent.js"],
    filesToModify: ["technician/index.html"],
    expectedIds: [],
    expectedExports: {
      "agents/admin_agent.js": ["processAdminEntry", "getAdminDraftTemplate", "resetAdminSession"]
    },
    scope: `Create agents/admin_agent.js — a stateful Gemini-driven conversation engine for
the admin role. When an admin is logged in (localStorage 'vc_admin_session' === '1') and opens
the workspace, the normal job-notes agent is bypassed and this engine handles all entries.

## agents/admin_agent.js — full module

Create the file as an IIFE following the same pattern as agents/conversation_agent.js.

\`\`\`
(function () {
  "use strict";
  window.VCAdminAgent = window.VCAdminAgent || {};
  // ... module code below
})();
\`\`\`

### State

Keep module-level state:
  var _state = "idle";          // idle | collecting | confirming
  var _intent = null;           // "create" | "update"
  var _draft = null;            // the in-progress template object (see shape below)
  var _updateTargetId = null;   // docId when updating an existing template

Draft template shape:
  {
    templateName: "",           // e.g. "Supply Fan Motor Checklist"
    targetKeyword: "",          // e.g. "supply fan motor"
    triggerWords: [],           // includes targetKeyword + any extras
    fields: [],                 // [{ label: "Check belt tension", type: "checkbox", required: false }, ...]
    active: true,
    formCategory: "general",
    assignedJobTypes: [],
    assignedRepairTypes: [],
    isDefault: false,
    sortIndex: 0,
    quoteRelevant: false,
    associatedParts: [],
  }

### processAdminEntry(text) — main entry point

Accepts the admin's message text (string), returns Promise<string|{type:'preview',html:string}>.

**Intent detection (call Gemini with a classification prompt):**
Build a prompt:
  "You are classifying an HVAC service management command. Respond with JSON only.
   Input: \\"<text>\\"
   Classify into one of: CREATE_CHECKLIST, UPDATE_CHECKLIST, ADD_STEP, REMOVE_STEP,
   SET_TRIGGER, PREVIEW, CONFIRM_SAVE, CANCEL, QUERY, UNKNOWN.
   Also extract: { templateName, triggerWord, steps: string[], fieldToAdd, fieldToRemove }
   Response format: { intent: string, templateName: string|null, triggerWord: string|null,
   steps: string[]|null, fieldToAdd: string|null, fieldToRemove: string|null }"

Parse the JSON response. Strip markdown code fences if present before parsing.
Fall back to { intent: 'UNKNOWN' } on parse error.

**State machine — handle each intent:**

IDLE state:
- CREATE_CHECKLIST → set _state="collecting", _intent="create", _draft = blank template.
  If templateName extracted, set _draft.templateName. If triggerWord, set _draft.targetKeyword + _draft.triggerWords.
  If steps extracted, add them as checkbox fields to _draft.fields.
  Return a summary of what was captured + what is still needed (follow-up question).
  Example reply: "Got it — starting a \\"Supply Fan Motor\\" checklist. What steps should the tech complete?"
- UPDATE_CHECKLIST → _state="collecting", _intent="update". Look up template name in
  form_templates (firebase.firestore().collection('form_templates').where('templateName','==',name).limit(1).get()).
  If found, set _draft from the Firestore doc data + _updateTargetId = doc.id. Reply with current steps and ask what to change.
  If not found, reply "I couldn't find a template called \\"...\\" — check the name and try again."
- QUERY → call askAdminGemini with context about what was asked. Return the answer.
- All others → return idle greeting: "Admin mode active. You can say: \\"Create a supply fan motor checklist\\",
  \\"Update the belt replacement checklist\\", or \\"What templates are there?\\""

COLLECTING state:
- ADD_STEP → push { label: fieldToAdd, type: "checkbox", name: slugField(fieldToAdd), required: false } to _draft.fields.
  Reply: "Added that step. Current steps:\\n<numbered list>\\nAnything else to add?"
- REMOVE_STEP → remove field from _draft.fields where label matches fieldToRemove (case-insensitive, partial match ok).
  Reply: "Removed that step. Current steps:\\n<numbered list>"
- SET_TRIGGER → set _draft.targetKeyword = triggerWord.toLowerCase().trim(), rebuild _draft.triggerWords = [targetKeyword].
  Reply: "Got it — trigger word set to \\"<word>\\"."
- CREATE_CHECKLIST with steps → treat extracted steps as ADD_STEP for each one.
  Update templateName if a new name was extracted.
  Reply with updated step count.
- PREVIEW → return { type: 'preview', html: buildAdminPreviewBubble(_draft) }
  (buildAdminPreviewBubble is defined in slice 66d — stub it here: function buildAdminPreviewBubble(d) { return '<div>Preview coming in 66d</div>'; })
- CONFIRM_SAVE → _state="confirming". Build a confirmation summary:
  "Here's what I'll save:\\n  Name: <templateName>\\n  Trigger word: <targetKeyword>\\n  Steps:\\n  <numbered list>\\n\\nSay confirm to save, or tell me what to change."
  Return that string.
- CANCEL → reset all state, return "Cancelled. What would you like to do?"
- UNKNOWN / other → if text sounds like a step description (has >=3 words), treat as ADD_STEP where fieldToAdd = text.
  Otherwise call Gemini: "You are helping an HVAC manager build a checklist. The admin said: \\"<text>\\".
  The draft template so far: <JSON of _draft>. Reply with one short follow-up question to collect missing info."

CONFIRMING state:
- CONFIRM_SAVE → handled by 66c executeAdminSave(). Stub: return Promise.resolve("Save logic coming in 66c.");
- CANCEL → reset state, return "Cancelled. What would you like to do?"
- All others → re-show the confirmation summary + "Say confirm to save or tell me what to change."

### askAdminGemini(prompt) — private helper

Calls window.GeminiClient.callText(prompt, { temperature: 0.2, maxOutputTokens: 512 }).
Returns Promise<string>.

### getAdminDraftTemplate() — exported

window.VCAdminAgent.getAdminDraftTemplate = function() { return _draft; };

### resetAdminSession() — exported

window.VCAdminAgent.resetAdminSession = function() {
  _state = 'idle'; _intent = null; _draft = null; _updateTargetId = null;
};

### processAdminEntry — exported

window.VCAdminAgent.processAdminEntry = processAdminEntry;

### slugField(label) — private helper

  function slugField(label) {
    return String(label || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';
  }

### formatDraftStepList(fields) — private helper

Returns a numbered string list of field labels:
  "1. Check belt tension\\n2. Verify rotation\\n3. Measure amp draw"
Used in reply text throughout.

## technician/index.html wiring

### Script tag

Add <script src="../agents/admin_agent.js?v=1"></script> in the script block alongside
the other agents/ script tags (search for "agents/conversation_agent.js" to find the right location).

### Admin workspace entry point

In openWorkspace(ticketId) (around line ~9584), at the very top of the function body, add:

  if (localStorage.getItem('vc_admin_session') === '1' && window.VCAdminAgent) {
    if (!_adminGreetingShown) {
      _adminGreetingShown = true;
      appendAdminBubble(
        "Admin mode active. Tell me what you\\'d like to do — for example:\\n" +
        "\\u2022 \\"Create a supply fan motor checklist\\"\\n" +
        "\\u2022 \\"Update the belt replacement checklist\\"\\n" +
        "\\u2022 \\"What checklists do we have?\\""
      );
    }
    return;
  }

Add module-level: var _adminGreetingShown = false;
In switchUser(), add: _adminGreetingShown = false;

### appendAdminBubble(text) — new helper in technician/index.html inline script

  function appendAdminBubble(text) {
    var stream = document.getElementById('ct-message-stream');
    if (!stream) return;
    var div = document.createElement('div');
    div.className = 'ct-message ct-vertex';
    div.style.cssText = 'margin-bottom:10px;max-width:85%;align-self:flex-start;';
    var bubble = document.createElement('div');
    bubble.className = 'ct-bubble';
    bubble.style.cssText = 'background:#1e293b;color:#e2e8f0;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;';
    bubble.textContent = text;
    div.appendChild(bubble);
    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
  }

### appendAdminHtmlBubble(html) — new helper in technician/index.html inline script

  function appendAdminHtmlBubble(html) {
    var stream = document.getElementById('ct-message-stream');
    if (!stream) return;
    var div = document.createElement('div');
    div.className = 'ct-message ct-vertex';
    div.style.cssText = 'margin-bottom:10px;max-width:95%;align-self:flex-start;';
    var bubble = document.createElement('div');
    bubble.className = 'ct-bubble';
    bubble.style.cssText = 'background:#1e293b;border-radius:14px;overflow:hidden;padding:0;';
    bubble.innerHTML = html;
    div.appendChild(bubble);
    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
  }

### Wire send/record paths to admin agent

Find the place where user input text is submitted (search for where processEntry is called
from the send button / stopAndSend / similar — look for the section that reads the input field
value and calls processEntry). Wrap the existing submit logic:

  if (localStorage.getItem('vc_admin_session') === '1' && window.VCAdminAgent) {
    // Append user bubble to stream
    var userDiv = document.createElement('div');
    userDiv.className = 'ct-message ct-tech';
    userDiv.style.cssText = 'margin-bottom:10px;max-width:85%;align-self:flex-end;';
    var userBubble = document.createElement('div');
    userBubble.className = 'ct-bubble';
    userBubble.style.cssText = 'background:#0ea5e9;color:#fff;padding:10px 14px;border-radius:14px;font-size:14px;';
    userBubble.textContent = trimmedText;
    userDiv.appendChild(userBubble);
    var stream = document.getElementById('ct-message-stream');
    if (stream) { stream.appendChild(userDiv); stream.scrollTop = stream.scrollHeight; }
    // Route to admin agent
    window.VCAdminAgent.processAdminEntry(trimmedText).then(function(result) {
      if (result && typeof result === 'object' && result.type === 'preview') {
        appendAdminHtmlBubble(result.html);
      } else if (typeof result === 'string') {
        appendAdminBubble(result);
      }
    }).catch(function(e) {
      appendAdminBubble('Something went wrong. Try again.');
      console.error('VCAdminAgent error', e);
    });
    return;
  }

The variable trimmedText refers to whatever local variable holds the cleaned user input at
that submission point. Grep for the actual variable name (may be called text, userText, entry, etc.)
and use that name.

## Cache-bust

Bump VC_BUILD to Phase66-Slice66b-<date>.`,
    outOfScope: "The actual Firestore save (66c). The tech phone preview HTML builder (66d). Changing the Schedule screen or job cards. Any Firestore reads beyond the single form_templates query for UPDATE_CHECKLIST. Changing normal tech conversation flow. Settings UI for admin PIN management.",
    cacheBusts: ["agents/admin_agent.js"],
    uiChange: true,
  },

  {
    id: "66c",
    phase: 66,
    title: "Admin checklist save — confirmation gate + Firestore write to form_templates",
    dependsOn: ["66b"],
    patterns: ["Firestore write path (new collection/doc)"],
    riskLevel: "review",
    reviewChecklist: [
      "Admin builds a draft checklist (66b) → moves to confirming state → says 'confirm' → Vertex replies 'Saving…' then '✓ Checklist saved — techs will see it in the field app immediately.'",
      "Open Firebase Console → form_templates collection → confirm a new document exists with the correct templateName, targetKeyword, triggerWords array, and fields array (each step as a checkbox field).",
      "Dispatcher → Settings → Field Forms → confirm the new template appears in the template list with correct name and trigger word.",
      "Admin says 'update the supply fan motor checklist' → adds a step → says 'confirm' → Firestore doc is MERGED (not overwritten from blank) — only fields and triggerWords change.",
      "Admin says 'confirm' without a draft in progress → Vertex replies 'There's nothing to save right now.' (guard against stale confirm).",
      "After save, admin session state is reset to idle — a success bubble appears and the admin can start a new command.",
      "If the Firestore write fails (simulate by disabling network) → Vertex shows 'Save failed — check your connection and try again.' Error is logged to console.",
    ],
    htmlTarget: "technician/index.html",
    filesToCreate: [],
    filesToModify: ["agents/admin_agent.js"],
    expectedIds: [],
    expectedExports: {
      "agents/admin_agent.js": ["processAdminEntry", "getAdminDraftTemplate", "resetAdminSession"]
    },
    scope: `Implement the CONFIRM_SAVE path in agents/admin_agent.js — writes the admin's
draft template to Firestore form_templates with a confirmation gate.

## executeAdminSave() — new private async function in admin_agent.js

Add this async function inside the IIFE alongside processAdminEntry:

\`\`\`javascript
async function executeAdminSave() {
  if (!_draft || !_draft.templateName) {
    return "There's nothing to save right now.";
  }

  var docId = (_intent === 'update' && _updateTargetId)
    ? _updateTargetId
    : (_draft.templateName.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
       || ('template_' + Date.now()));

  var tw = Array.isArray(_draft.triggerWords) ? _draft.triggerWords.slice() : [];
  var kw = (_draft.targetKeyword || _draft.templateName).toLowerCase().trim();
  if (tw.indexOf(kw) === -1) tw.unshift(kw);

  var payload = {
    templateName: _draft.templateName,
    targetKeyword: kw,
    triggerWords: tw,
    active: true,
    fields: Array.isArray(_draft.fields) ? _draft.fields : [],
    formCategory: _draft.formCategory || "general",
    assignedJobTypes: Array.isArray(_draft.assignedJobTypes) ? _draft.assignedJobTypes : [],
    assignedRepairTypes: Array.isArray(_draft.assignedRepairTypes) ? _draft.assignedRepairTypes : [],
    isDefault: false,
    sortIndex: 0,
    quoteRelevant: false,
    associatedParts: [],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (_intent !== 'update') {
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  try {
    await firebase.firestore()
      .collection('form_templates')
      .doc(docId)
      .set(payload, { merge: true });
    _state = 'idle'; _intent = null; _draft = null; _updateTargetId = null;
    return '\\u2713 Checklist saved \\u2014 techs will see it in the field app immediately.';
  } catch (e) {
    console.error('VCAdminAgent save failed', e);
    return 'Save failed \\u2014 check your connection and try again.';
  }
}
\`\`\`

## Wire into processAdminEntry — CONFIRMING state

Replace the stub placeholder in the CONFIRMING → CONFIRM_SAVE branch:
  OLD: return Promise.resolve("Save logic coming in 66c.");
  NEW: return executeAdminSave();

Since executeAdminSave is async and returns a Promise<string>, wrapping it in Promise.resolve()
is not needed — just return it directly.

## Guard: no draft in CONFIRMING state

At the top of the CONFIRMING → CONFIRM_SAVE handler, before calling executeAdminSave():
  if (!_draft) {
    _state = 'idle';
    return Promise.resolve("There\\'s nothing to save right now.");
  }

## firestore.rules — form_templates access

Grep firestore.rules for "form_templates". If no rule exists for that collection, add
after the last existing template/form-related rule block:

  match /form_templates/{document=**} {
    allow read, write: if true;
  }

If a rule already exists, do not add a duplicate.

## Cache-bust

Bump VC_BUILD to Phase66-Slice66c-<date>.`,
    outOfScope: "Changing the payload structure beyond what saveFieldFormTemplate() already writes. Adding a vendor or roster save path (separate future slice). Admin PIN management in Settings. Any UI changes beyond agents/admin_agent.js and firestore.rules. The tech phone preview (66d).",
    cacheBusts: ["agents/admin_agent.js"],
  },

  {
    id: "66d",
    phase: 66,
    title: "Tech phone preview — 'show me what it looks like' bubble in admin chat",
    dependsOn: ["66b"],
    patterns: ["Multi-file UI feature (no Firestore writes)"],
    riskLevel: "safe",
    reviewChecklist: [
      "Admin builds a draft checklist with 3+ steps → says 'show me what it looks like on a tech phone' → a 📱 Tech Phone Preview card appears in the admin conversation bubble.",
      "The preview card shows: the template name in blue at the top, an 'Equipment' placeholder row, then each checklist step as a disabled checkbox field — identical style to the field app form.",
      "Admin says 'preview' (one word) → same preview card appears.",
      "Preview renders the current in-progress draft — reflects the latest draft including unsaved changes.",
      "If the draft has no fields yet, the preview shows only the equipment selector with a note 'No steps added yet.'",
      "The preview bubble has a small '📱 Tech Phone Preview' label above the card in grey.",
      "After previewing, the admin can continue adding steps or say 'confirm' to save — preview does not clear draft state.",
    ],
    htmlTarget: "technician/index.html",
    filesToCreate: [],
    filesToModify: ["agents/admin_agent.js"],
    expectedIds: [],
    expectedExports: {
      "agents/admin_agent.js": ["processAdminEntry", "getAdminDraftTemplate", "resetAdminSession"]
    },
    scope: `Replace the buildAdminPreviewBubble stub in agents/admin_agent.js with the full
implementation so admins can see exactly what the checklist will look like on a tech's phone.

## escapeAdminHtml(s) — private helper in admin_agent.js

  function escapeAdminHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

## buildAdminPreviewBubble(doc) — replace stub

Remove the stub:
  function buildAdminPreviewBubble(d) { return '<div>Preview coming in 66d</div>'; }

Replace with the full implementation:

\`\`\`javascript
function buildAdminPreviewBubble(doc) {
  var name = escapeAdminHtml((doc && doc.templateName) || 'Untitled Checklist');
  var fields = (doc && Array.isArray(doc.fields)) ? doc.fields : [];

  var html = '<div style="padding:12px;">';

  // Header label
  html += '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;'
    + 'letter-spacing:0.05em;margin-bottom:8px;">\uD83D\uDCF1 Tech Phone Preview</div>';

  // Phone-frame card
  html += '<div style="background:#f4f7fa;border-radius:16px;padding:12px;'
    + 'max-width:340px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">';
  html += '<div style="background:#fff;border-radius:12px;padding:14px;'
    + 'box-shadow:0 2px 12px rgba(0,0,0,0.08);">';

  html += '<h3 style="margin:0 0 12px 0;font-size:16px;color:#0ea5e9;">' + name + '</h3>';

  html += '<label style="display:block;font-size:11px;font-weight:700;color:#555;'
    + 'text-transform:uppercase;margin-bottom:4px;">Equipment</label>';
  html += '<div style="padding:10px 12px;border:1px solid #d1d9e0;border-radius:8px;'
    + 'background:#fafbfc;color:#94a3b8;font-size:14px;">Select equipment\u2026</div>';

  if (fields.length === 0) {
    html += '<div style="margin-top:14px;font-size:13px;color:#94a3b8;">No steps added yet.</div>';
  } else {
    fields.forEach(function(f) {
      var label = escapeAdminHtml(f.label || 'Step');
      var req = f.required ? ' <span style="color:#ef4444">*</span>' : '';
      var t = String(f.type || 'checkbox').toLowerCase();
      html += '<div style="margin-top:12px;">';

      if (t === 'checkbox') {
        html += '<label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#1e293b;">'
          + '<input type="checkbox" disabled /> ' + label + req + '</label>';
      } else if (t === 'toggle') {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;'
          + 'gap:10px;font-size:14px;color:#1e293b;">'
          + '<span>' + label + req + '</span>'
          + '<span style="display:inline-block;width:44px;height:24px;background:#cbd5e1;'
          + 'border-radius:24px;position:relative;flex-shrink:0;">'
          + '<span style="position:absolute;left:2px;top:2px;width:20px;height:20px;'
          + 'background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>'
          + '</span></div>';
      } else if (t === 'photo') {
        html += '<label style="display:block;font-size:11px;font-weight:700;color:#555;'
          + 'text-transform:uppercase;margin-bottom:4px;">' + label + req + '</label>'
          + '<div style="padding:10px;border:1px dashed #cbd5e1;border-radius:8px;'
          + 'color:#94a3b8;font-size:13px;">\uD83D\uDCF7 Photo capture</div>';
      } else if (t === 'dropdown') {
        var opts = Array.isArray(f.options) ? f.options : [];
        html += '<label style="display:block;font-size:11px;font-weight:700;color:#555;'
          + 'text-transform:uppercase;margin-bottom:4px;">' + label + req + '</label>'
          + '<select disabled style="width:100%;box-sizing:border-box;padding:10px;'
          + 'border:1px solid #d1d9e0;border-radius:8px;font-size:14px;background:#fff;">'
          + '<option>Select\u2026</option>';
        opts.forEach(function(o) { html += '<option>' + escapeAdminHtml(String(o)) + '</option>'; });
        html += '</select>';
      } else {
        html += '<label style="display:block;font-size:11px;font-weight:700;color:#555;'
          + 'text-transform:uppercase;margin-bottom:4px;">' + label + req + '</label>'
          + '<input disabled type="text" style="width:100%;box-sizing:border-box;padding:10px;'
          + 'border:1px solid #d1d9e0;border-radius:8px;font-size:14px;" placeholder="\u2026" />';
      }

      html += '</div>';
    });
  }

  // Disabled Save/Cancel row (visual reference only)
  html += '<div style="display:flex;gap:8px;margin-top:16px;">';
  html += '<button type="button" disabled style="flex:1;padding:10px;border:1px solid #ccc;'
    + 'border-radius:8px;background:#f4f4f4;color:#94a3b8;font-size:14px;">Cancel</button>';
  html += '<button type="button" disabled style="flex:1;padding:10px;border:none;'
    + 'border-radius:8px;background:#0ea5e9;color:#fff;font-size:14px;">Save</button>';
  html += '</div>';

  html += '</div></div></div>';
  return html;
}
\`\`\`

## Wire into PREVIEW intent

In processAdminEntry, in the COLLECTING state block, replace the PREVIEW handler:
  OLD: return Promise.resolve({ type: 'preview', html: buildAdminPreviewBubble(_draft) });
  NEW: (same — now buildAdminPreviewBubble is fully implemented so just verify it is called correctly)

Also handle PREVIEW intent from IDLE state:
  if (_state === 'idle') {
    return Promise.resolve("No checklist in progress. Start by saying \\'Create a \\' first.");
  }

## Cache-bust

Bump VC_BUILD to Phase66-Slice66d-<date>.`,
    outOfScope: "The Firestore save (66c). The sign-in gate (66a). The conversation engine core (66b). Adding preview for saved templates by name lookup. Interactive preview (all fields are always disabled — read-only visual only). PDF export of the preview.",
    cacheBusts: ["agents/admin_agent.js"],
    uiChange: true,
  },

];
