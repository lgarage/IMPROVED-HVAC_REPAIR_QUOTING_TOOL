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
    patterns: ["Multi-file UI feature (no Firestore writes)", "Firestore write path (new collection/doc)"],
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
    patterns: ["Multi-file UI feature (no Firestore writes)", "Firestore write path (new collection/doc)"],
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
    patterns: ["Multi-file UI feature (no Firestore writes)", "Firestore write path (new collection/doc)"],
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
