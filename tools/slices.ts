/**
 * Slice definitions for the New Field Tech UX phased build.
 * Each slice has scope, files, patterns (for model lookup), validation checks,
 * and push safety level.
 */

import { ARCHIVED_SLICES } from "./slices_archive";

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
  playwrightSteps?: string[]; // optional JS lines injected into the generated Playwright script after login and before the final screenshot; used with uiChange:true to test a specific click flow
}

// Slices 41a–57a have been moved to slices_archive.ts (all passed).
// Add new slices here; they will be auto-archived once they pass and
// SLICES.length exceeds MAX_ACTIVE_SLICES in build_runner.ts.

const PHASE_64_ACTIVE = ["64a", "64b", "64c", "64e"].map((id) => {
  const slice = ARCHIVED_SLICES.find((entry) => entry.id === id);
  if (!slice) {
    throw new Error(`Missing archived slice ${id}`);
  }
  return slice;
});

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

  

  

  

  

  

  

  

  // ═══════════════════════════════════════════════════════════
  //  Phase 64: AI Quote Pipeline — Foundation (Phase A)
  //  Migrate office quotes to Firestore, port standalone
  //  quoting tool features, add vendor directory.
  //  Full spec: PROJECT_STATUS/ai_quote_pipeline_spec.md
  //  Phase B slices (64f–64i) below.
  //  Phase C (email automation) sliced after Phase B confirmed.
  // ═══════════════════════════════════════════════════════════

  

  

  

  ...PHASE_64_ACTIVE,

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

  

  // ═══════════════════════════════════════════════════════════
  //  Phase 64 — Phase B: AI Field Pipeline
  //  Connects field conversation → structured quote_data →
  //  auto-drafted office quote. No email yet (Phase C).
  // ═══════════════════════════════════════════════════════════

  

  

  

  

  

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
