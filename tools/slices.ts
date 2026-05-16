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

  // ═══════════════════════════════════════════════════════════
  //  Phase 61: Security Polish & Tooling Hygiene
  //  Overnight-safe hardening: no app logic changes, no auth
  //  rollout required. Pure rules / sender tightening / tooling.
  // ═══════════════════════════════════════════════════════════

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
  // ═══════════════════════════════════════════════════════════
  //  Phase 62: Hygiene & Regression Fixes
  // ═══════════════════════════════════════════════════════════
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
      "B5: dispatcher/js/report_builder.js loads ?v=4 CSS.",
      "B6: sw.js has activate handler with cache cleanup.",
      "B7: sw.js has dispatcher-vs-tech SW asymmetry comment.",
      "C4: shadow_mode.js and technician/index.html have origin guards on message receivers.",
      "E1: activity_feed.js normalizeInternal coercing types to 'internal_comms'.",
      "E3: settings.js uses WriteBatch for dual roster/on-call writes."
    ],
    filesToCreate: [],
    filesToModify: [
      "dispatcher/js/report_builder.js",
      "sw.js",
      "dispatcher/js/shadow_mode.js",
      "technician/index.html",
      "dispatcher/js/activity_feed.js",
      "settings.js"
    ],
    expectedIds: [],
    expectedExports: {},
    scope: `Apply KI-002 hygiene fixes:
B5: Consolidate report_builder.css version string to ?v=4 in dispatcher/js/report_builder.js.
B6: Add/confirm 'activate' event handler in sw.js for stale cache cleanup.
B7: Document dispatcher-SW vs tech-no-SW asymmetry in sw.js header.
C4: Add origin guards to postMessage receivers in dispatcher/js/shadow_mode.js and technician/index.html.
E1: Normalize internal_comms type to 'internal_comms' in activity_feed.js normalizeInternal.
E3: Use WriteBatch for dual roster + on-call writes in settings.js.`,
    outOfScope: "Any other KI-002 items. Refactoring beyond the specific fixes. UI changes.",
    cacheBusts: ["dispatcher/js/report_builder.js", "dispatcher/js/shadow_mode.js", "settings.js"],
    htmlTarget: "index.html",
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
];
