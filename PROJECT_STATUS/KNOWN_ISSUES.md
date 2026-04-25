# Vertex Core | Known Issues

Open bugs, environmental gotchas, and debug notes. Resolved items move to the **Resolved (Reference)** section at the bottom so we keep institutional memory without cluttering the open list.

> **Tier 2 (cold) — pull on demand by `KI-NNN` or affected file. Do not read end-to-end.** `CURRENT_STATE.md` always names the **single highest-priority blocker** by ID; this file holds full reproduction and investigation notes. Read protocol in `.cursorrules` §1A.

---

## Open

### KI-004 — Field-app photo uploads are silently dropped offline (Phase 33 follow-up)

- **Filed:** 2026-04-25 (post-Phase 33 audit triggered by user spec "if a technician does not have a signal when they are servicing a piece of equipment, that the information will be stored in the user's phone, [and] synced when signal returns"). Scope-checked with user 2026-04-25; user chose **audit-only** treatment (file this entry + ADR-012 + ROADMAP pointer; defer implementation) and asked that the eventual fix ship as a **KI-002-style follow-up patch on Phase 33**, not a new phase.
- **Severity:** Medium-High — affects the freshly-shipped Phase 33 "tech services equipment without signal" promise plus six other field-side photo paths. **Text fields survive offline already** (Firestore SDK queues via `db.enablePersistence`); **photos do not** — they are uploaded directly to Firebase Storage which has no offline persistence.
- **Affected files (8 silent-failure surfaces — all `ref.put(...)` calls in field code):**
  - `dictation_hub.js#visionHubUploadNameplatePhoto` (line ~2410) — Phase 33 nameplate photo. The `.catch` already routes through `VCSurfaceWriteFailure` (KI-002 Plan A standard) but proceeds with the Firestore patch; the photo file is dropped from memory.
  - `equipment_manager.js#saveEquipment` (line ~691–710) — Equipment Manager modal overall + dataplate photos on the *online* path. (The plate-OCR offline path is already covered by the existing `ocrQueue` IndexedDB outbox at lines 63–146 + line 288 + the `online` event hook at line 1352; the **overall** photo and the watermarked-file path at line ~1089 are not.)
  - `equipment_manager.js` watermarked-file upload (line ~1089–1093).
  - `field_forms.js` (lines 408, 1126, 1152) — Custom Field Forms photo attachments (3 sites).
  - `technician/index.html` (line ~5184) — workspace addendum photos.
  - `technician/index.html` (line ~5325) — pasted-image evidence.
- **What works today:**
  - **Firestore writes are fully offline-resilient** via `db.enablePersistence({ synchronizeTabs: true })` in `firebase-config.js` line 34 (and the duplicate-init guard in `shared/firebase_config.js` line 13). Text-field equipment edits (Phase 33 `imported_equipment` patches), ticket resolution / parts / hours, internal_comms notes, addendum metadata, time-clock punches all queue locally and replay automatically when signal returns.
  - **Service worker** (`sw.js`) caches the app shell so the field app launches with zero signal.
  - **Two visible offline indicators** are already wired:
    - `#vcFieldOfflineBadge` in `technician/index.html` flips between "Working offline" (`navigator.onLine === false`) and "Using cached data" (Firestore `snap.metadata.fromCache === true`) — see lines ~4284, ~4994, ~5001.
    - The Submit Report success card explicitly handles offline (`technician/index.html` line ~7095): green "✓ Saved Offline — Will sync in background when signal returns."
  - **One IndexedDB outbox already exists as a reference pattern**: `equipment_manager.js#ocrQueue` (`TwinPillarsOfflineDB → ocrQueue` store, lines 63–146). When `!navigator.onLine` it stashes the data-plate photo as base64 + context, then on `window.addEventListener("online", processOcrQueue)` (line 1352) replays the full pipeline (Gemini → Storage upload → Firestore write → delete queue row).
  - `.cursorrules §2` already codifies "Offline First: Assume the user has no signal. Use Firestore Persistence and `queryGetCacheFirst` logic for all field app reads." — the gap is on the *write* side for non-Firestore destinations.
- **What's broken / missing:**
  - All 8 sites above call `ref.put(file)` or `ref.put(blob)` on Firebase Storage with **no offline outbox**. Storage uploads are NOT covered by Firestore persistence. When offline, the put rejects and the file is gone from the next reload.
  - Vision Hub specifically silently partial-saves: the `imported_equipment` doc still saves the text fields (because `visionHubSaveEquipment` runs the photo upload in a `.catch(...) → return null` and proceeds to the Firestore patch — see `dictation_hub.js` line 2280–2290), so the dispatcher's bridged Equipment Hub read sees "this RTU was field-corrected" but with no nameplate photo.
  - There is no aggregate "N items pending sync" affordance on the field app. The user can see "Working offline" but not how many photo uploads are queued waiting for signal.
- **Investigation checklist (for whoever picks this up — see `DECISIONS.md → ADR-012` for the proposed design):**
  - Confirm Storage SDK behavior under offline on iOS Safari + Android Chrome (specifically: does `ref.put(file)` reject immediately on `!navigator.onLine`, or does it block until network timeout? Affects whether we gate on `!navigator.onLine` upfront or always wrap in try/catch).
  - Decide whether the new outbox shares `TwinPillarsOfflineDB` with `equipment_manager.js#ocrQueue` (one IDB connection) or lives in its own DB (cleaner separation, double the open connections). ADR-012 recommendation: **same DB**, new `storageOutbox` object store, bump `IDB_VERSION` from `1` to `2` with an `onupgradeneeded` migration that adds the new store and leaves `ocrQueue` untouched.
  - Confirm IndexedDB blob storage limits on iOS Safari (50 MB per blob historically, with quota pressure under `navigator.storage.estimate()` < 1 GB on PWAs). Photos are typically 1–4 MB so this is fine, but the existing `processOcrQueue` pattern stores base64 (1.33× the binary size) — for the new outbox we should store the original `Blob` directly to save IDB pressure.
  - Inventory each of the 8 call sites and decide whether the upload result is *required* before the Firestore write (e.g. if the Firestore doc needs the download URL inline, the write must wait or be a two-phase patch). For Vision Hub, the current code already two-phases this — the photo is uploaded, then `nameplatePhotoUrl` is patched in via `merge: true` — so the outbox replay can do the URL patch on its own.
  - Decide whether the addendum-photo path (`technician/index.html` line ~5184) and customer-evidence paths (`service_call.js` lines 3181 / 3197) participate in the outbox or stay synchronous (those tend to be dispatcher-initiated; dispatcher is rarely offline).
  - Per `.cursorrules §5`: any new shared module needs `?v=N` cache-busts on every caller; bumping `FIREBASE_LOGIC_VERSION` is **not** required because the outbox is a new file, not an edit to `shared/firebase_logic.js`.
- **Related code (for grep):**
  - Existing photo uploads: `dictation_hub.js#visionHubUploadNameplatePhoto`, `equipment_manager.js#saveEquipment` (line 691), `equipment_manager.js` line 1089, `field_forms.js` lines 408 / 1126 / 1152, `technician/index.html` lines 5184 / 5325, `service_call.js` lines 3181 / 3197 (dispatcher-side, mostly out of scope).
  - Reference outbox pattern: `equipment_manager.js#ocrQueue` (lines 63–146 + `processOcrQueue` line 288 + `online` event hook line 1352).
  - Existing offline UI: `#vcFieldOfflineBadge` in `technician/index.html` (line ~4284 + ~4994 + ~5001), Submit Report offline branch (line ~7095), `VCSurfaceWriteFailure` in `shared/firebase_logic.js` (KI-002 Plan A standard).
  - Persistence init: `firebase-config.js` line 34 + `shared/firebase_config.js` line 13.
- **Directive fix (proposed — see `DECISIONS.md → ADR-012`):** Build a single shared `shared/offline_storage_outbox.js` module modeled on `equipment_manager.js#ocrQueue`. Same `TwinPillarsOfflineDB` (version bump to 2, new `storageOutbox` object store). Public API: `OfflineStorageOutbox.enqueueUpload({ storagePath, blob, contentType, contextHook, label })` returning a queue id; `OfflineStorageOutbox.drain()` runs on `online` event + boot; `OfflineStorageOutbox.getPendingCount()` for the UI chip. Convert the 8 sites listed above to call `enqueueUpload` upfront when `!navigator.onLine` OR in the `.put` rejection catch. Surface a separate persistent chip `#vcPendingSyncChip` in the technician UI for queue depth (independent from the existing connectivity badge `#vcFieldOfflineBadge` per user 2026-04-25 — connectivity state and queue depth are independent signals; the queue can have items after signal returns while it drains). Per the KI-002 Plan A discipline, every upload-write that rejects must call `VCSurfaceWriteFailure` so the iPhone debug overlay surfaces it. Lazy-inject both UI elements per the `workspace_ui.js#ensureConsentButtonInDom` Phase 32a pattern; both must be direct children of `<body>` per the KI-001 / ADR-008 fixed-position discipline.
- **Treatment chosen by user 2026-04-25:** **Audit-only** for now. Implementation will be a **KI-002-style follow-up patch on Phase 33** (not a new phase). Verification will piggyback on Phase 33 on-device verification — once smoke-tests a/b/c pass (`CURRENT_STATE.md → Immediate Next Step`), this patch is the next thing to ship under a `Phase33-followup-<date>` `VC_BUILD` stamp; ADR-012 enumerates the additional smoke-tests (d) and (e).
- **Workaround until shipped:** Tech should re-tap "Save" on Vision Hub once signal returns to re-upload the nameplate photo (the text fields will already be on the doc — re-saving with no field changes still triggers the photo upload because of the existing `Object.keys(changedFields).length === 0 && !visionHubPendingFile` short-circuit; if the tech kept the photo selection in the form, this works). For the other six sites, the photo is gone — the tech must take it again.

---

### KI-003 — Office Override iframe is not a live mirror of the tech's phone state

- **Filed:** 2026-04-25 (user observation while testing Phase 33).
- **Severity:** Medium — Office Override (Phase 30) was sold as "office sees what the tech sees." Today it actually shows what the tech *would see if they were just opening the field app fresh from Firestore* — not what's on their physical screen.
- **What works today:**
  - Office Override iframe loads `technician/index.html?forceTicketId=<tid>&office_override=1` and reads/writes the same Firestore docs the tech does (`service_calls/{tid}`, `internal_comms`, `live_presence`, etc.).
  - Anything backed by a Firestore listener that the tech has already saved is in sync (last-writer-wins, per the 2026-04-25 audit decision on `internal_comms`).
  - `dictation_hub.js#scheduleInternalCloudSave` debounces writes from the tech's notes textarea, so the dispatcher iframe sees notes update within the debounce window once the tech pauses typing.
- **What's broken / missing (per user 2026-04-25):**
  1. **Local UI state is not mirrored.** Which workspace accordions/menus are expanded vs. collapsed on the tech's phone is purely local DOM state — never written to Firestore — so the dispatcher's iframe shows its own initial accordion state, not the tech's. Examples: dictation hub sections, equipment hub disclosure rows, Vision Hub overlay open/closed, address book / customer directory accordions, action tray expanded items, parts tab tabs, and any `<details>` / `aria-expanded` toggle in `technician/index.html`. None of these have a live channel to the iframe.
  2. **Inline form values are not mirrored on keystroke.** Field inputs (notes, equipment hub fields, Vision Hub identity row, retire-equipment forms, signature capture, custom field forms, etc.) only sync on save/blur/debounce, not on `input`. So when the tech is mid-typing into the model number on Vision Hub, the dispatcher iframe shows the *previously saved* value until the tech finishes the field. The dispatcher cannot "watch the tech type."
- **Why this matters:**
  - Defeats the primary use case of Office Override: dispatcher coaching a struggling tech in real time. Today the dispatcher can ANSWER (via internal_comms) but can't SEE what the tech is doing turn-by-turn.
  - Surfaces during onboarding ride-alongs and any "office helps with a hard ticket" workflow that motivated Phases 30–32c in the first place.
- **Investigation checklist (for whoever picks this up):**
  - Inventory every accordion / disclosure / overlay open-state in `technician/index.html` and the workspace JS bundle (`workspace_ui.js`, `dictation_hub.js`, `equipment_hub.js`, `equipment_manager.js`, `field_forms.js`, `location_manager.js`, etc.). Each one needs a tiny key in a single per-ticket "ui state" doc.
  - Inventory every `<input>` / `<textarea>` / `<select>` inside the tech workspace that the office should see live. Each needs an `input` listener that pushes its value through a debounced channel (NOT Firestore — too expensive for keystrokes).
  - Pick a transport: candidates are (a) Firestore on the existing `live_presence/{payrollKey}` doc with a `uiState` map and a `liveDraft` map, debounced ~200ms, (b) Realtime Database `live_workspaces/{tid}` for cheaper high-frequency writes, (c) WebRTC data channel between the dispatcher iframe and the tech's tab via a signalling doc — most "live" but most complex. ADR-required before code.
  - Decide direction. Read-only mirror (office WATCHES) is one design; bi-directional (office can also expand a section the tech has collapsed, or correct a typo mid-stream) is a different design and overlaps with Office Override's existing "remote takeover" semantic in Phase 30/31.
  - Consent: per ADR-010 the tech must consent before chrome flips orange. Live keystroke mirroring is *more* invasive than orange chrome and probably needs its own consent gate (or piggybacks on the existing override-acknowledged flag — design call).
- **Related code (for grep):**
  - Existing live channels: `dictation_hub.js#scheduleInternalCloudSave`, `dispatcher/js/shadow_mode.js#applyShadowPresenceFromDoc`, `service_call.js#syncDispatcherTicketIdToActiveTech`, `live_presence` writes in `technician/index.html#writeLivePresence`.
  - Office Override iframe loader: `service_call.js#openFieldAppOfficeModal` and the URL-routing in `technician/index.html` that interprets `?office_override=1`.
- **Phase candidate:** "Phase 34 — Live Workspace Mirror" or "Office Override v2" — needs a dedicated ADR before code (transport choice + consent model + scope: which accordions, which fields, throttle budget, how to handle disconnects).
- **Workaround until shipped:** dispatcher pings the tech via `internal_comms` ("show me your screen") and uses the cyan synced-ticket badge + the existing read-only data already in the iframe; for live coaching, voice/phone is still required.

---

---

## (Archived in place for traceability — see Resolved (Reference) for the closeout summary)

### KI-002 — Sync Risk Audit (2026-04-25): silent-failure & cache-versioning repair backlog [RESOLVED 2026-04-25]

A comprehensive audit of dispatcher ↔ field sync surfaces (Firestore reads/writes, real-time listeners, postMessage contracts, silent error handling, cache versioning) was completed 2026-04-25 immediately after Phase 32c shipped. It surfaced ~25 actionable repair items grouped into four plans. **None of these are blocking the Office Override workstream that just shipped** — they are pre-existing risks that were accepted for speed and now deserve dedicated attention before piling on more features. The user explicitly requested this audit before continuing with new feature work.

**User decisions made during audit (locks scope):**
- TWIN_PILLARS branding is gone — all paths are Vertex Core / `USA_HEATING_COOLING`. Bridge cleanup (originally Plan D) drops to nice-to-have; bridge-aware listeners are not required for live consumers.
- `internal_comms` conflict resolution: **last writer wins** (no merge logic). Document this in code comments anywhere two paths can write the same field.
- Equipment data path going forward: **CSV import + legacy + new field-add capture** (see Phase 33 in `ROADMAP.md`).

**Plan A — Stop the silent failures (highest user impact, ~1 day): SHIPPED 2026-04-25.** Single commit batch; bumped `service_call.js?v=68` and `VC_BUILD = "KI002-A-2026-04-25"` once at the end.
- [v] A1: `technician/index.html` (`uploadReportToCloud`) — both writes routed through `Promise.all`; offline still happy-path; online rejection renders red `⚠ Sync Failed` card on `#successCard` instead of false-green; `VCSurfaceWriteFailure` called for both writes.
- [v] A2: `technician/index.html` (`writeLivePresence`) — one retry after 2.5s; on second failure sets `window.__vcPresenceOffline = true` and shows lazy-injected `#vcPresenceOfflineChip` (top-right red chip). Both attempts call `VCSurfaceWriteFailure`.
- [v] A3: `dictation_hub.js` (`scheduleInternalCloudSave`) — extracted to new `runInternalCloudSave(tid, payload, isRetry)`; on failure shows lazy-injected `#dictationHubNotesError` "⚠ note not synced — tap to retry" sibling under `#dictationHubNotes`; tap re-runs the save with the stored payload.
- [v] A4: `service_call.js` (`toggleOfficeOverride`) — Phase 32b empty-tid alarm pattern (red 3px outline + alert + warn) now also fires on actual Firestore write rejection. `VCSurfaceWriteFailure` first.
- [v] A5: `technician/index.html` consent IIFE + `workspace_ui.js` lazy-inject path — both now show `⚠ Sync failed — tap to retry acknowledgement` instead of silently resetting to the original prompt; `VCSurfaceWriteFailure("OfficeOverride:ackWrite[(lazy)]", e)` first.
- [v] A6: `technician/index.html` (coach-field delete) — one retry after 2s; both attempts call `VCSurfaceWriteFailure("coachField.delete:tryN", err)`.
- [v] A7: `customer_directory.js` (`syncSingleCustomerToCloud`) — `showSaveCue("⚠ Customer saved locally only — cloud sync FAILED for <name>. Check connection.")` on cloud rejection; `VCSurfaceWriteFailure` first.
- [v] A8: `shared/firebase_logic.js` (`setServiceCallMerged`) — now calls `VCRequireTicketId(ticketId, "setServiceCallMerged")`; returns `Promise.reject(new Error("setServiceCallMerged: empty ticket id"))` instead of writing to doc id `""`.
- [v] A9: `dispatcher/js/shadow_mode.js` (`sendCoachPrompt` + `forceRemoteSync`) — `showSaveCue("⚠ Coach prompt FAILED to send …")` / `showSaveCue("⚠ Force-sync FAILED to send …")` on rejection; `VCSurfaceWriteFailure` first.
- [v] **Standardize:** `VCRequireTicketId(tid, label)` and `VCSurfaceWriteFailure(ctx, err)` shipped in `shared/firebase_logic.js` (also published as bare globals `window.VCRequireTicketId` / `window.VCSurfaceWriteFailure`). Failures push onto a 10-deep `window.__vcWriteFailures` ring buffer that the iPhone debug overlay now renders (last 3 records, age in seconds, ctx, msg). Future call sites should use these helpers instead of `if (tid)` skips and `.catch(console.warn)`.

**Plan B — Cache & version hygiene (~2 hours): subset B1+B2+B3+B4 SHIPPED 2026-04-25.** Single commit batch on top of Plan A.
- [v] B1: `shared/firebase_logic.js?v=1` on all three callers (`index.html`, `technician/index.html`, `proof_of_service.html`). Added `FIREBASE_LOGIC_VERSION = 1` constant inside the IIFE that emits `[VC] firebase_logic v=1 loaded` on load and is exposed as `window.__VC_FIREBASE_LOGIC_VERSION` so the dispatcher BUILD chip can render the loaded version. Bump-in-lockstep procedure documented in the file header comment.
- [v] B2: Added `?v=1` to all five unversioned tech bundle scripts in `technician/index.html`: `equipment_smart_select.js`, `ufx_adapter.js`, `location_manager.js`, `equipment_hub.js`, `field_forms.js`. (None are loaded by the dispatcher.)
- [v] B3: Unified `equipment_manager.js?v=8` on the dispatcher (`index.html`); tech was already `?v=8`.
- [v] B4: `window.VC_BUILD = "KI002-B-2026-04-25"` set near the top of dispatcher inline `<script>` (mirrors the `technician/index.html` pattern). New `#vcBuildChip` rendered inside `.sidebar-footer` (hidden when sidebar is collapsed via the existing rule); populated by `vcDispatcherBuildChipBoot` IIFE with `BUILD <stamp> · fb v<N>` (the `fb v<N>` half reads `window.__VC_FIREBASE_LOGIC_VERSION` from B1 so a stale `shared/firebase_logic.js` is visible at a glance). Click the chip to copy.
- [ ] B5: `dispatcher/js/report_builder.js:138-140` loads `report_builder.css?v=1` while `index.html:20` loads `?v=4` — consolidate to one source.
- [ ] B6: `sw.js` cache hygiene — bump `CACHE_NAME` on each deploy; add activate handler to delete old caches; consider network-first for `index.html`.
- [ ] B7: Document the dispatcher-SW vs tech-no-SW asymmetry in `sw.js` and here under Environmental Gotchas.

**Plan C — Listener hygiene & polling fixes (~half day):**
- [ ] C1: `dispatcher/js/shadow_mode.js:147-167` — refcount + unsubscribe `subscribeLivePresenceIdle` (consumers: shadow modal, take-over button, syncDispatcherTicketIdToActiveTech). *(Deferred to ROADMAP — listener leak; not field-impact.)*
- [ ] C2: `field_forms.js:496-510` — store unsub for `form_templates` listener; call on tab leave. *(Deferred to ROADMAP — listener leak; not field-impact.)*
- [v] C3: `technician/index.html:7768-7789` — Shadow mirror polled 40×350ms then silently stalled if ticket id was outside the schedule date window. **SHIPPED 2026-04-25 (commit f4fe37a):** added `shadowMirrorOpenViaBridgedFetch(tid)` fallback that runs after polling exhausts — calls `VCFirestore.getServiceCallOnceBridged(db, tid)`, pushes the doc into `myTickets`, and calls `openWorkspace(tid)`. Every failure path (no firebase, no bridge helper, doc not found, fetch rejection, exception) routes through `VCSurfaceWriteFailure` so the iPhone debug overlay's `__vcWriteFailures` ring buffer surfaces the stall instead of swallowing it.
- [ ] C4: postMessage receivers (`workspace_ui.js:301`, `technician/index.html:4163`, `shadow_mode.js:355`) — validate `event.origin === window.location.origin`. *(Deferred to ROADMAP — security hardening, no live exploit.)*

**Plan E — Schema/typing cleanups (trivial):**
- [ ] E1: `dispatcher/js/activity_feed.js:44-55` (`normalizeInternal`) — normalize `internal_comms` to a single canonical type on every write (string, per "last writer wins"). *(Deferred to ROADMAP — schema hygiene; reads already tolerate both shapes.)*
- [v] E2: `dispatcher/js/client_notifications.js:16-20` (`getTenantIdSafe`) — remove `"TWIN_PILLARS"` fallback default; use `VCFirestore.getTenantId()` only. **SHIPPED 2026-04-25 (commit 79eb281):** `getTenantIdSafe` now defers to `VCFirestore.getTenantId()` (canonical helper) with `APP_CONFIG.tenantId` secondary and empty-string final fallback. Codebase grep verified that `dispatcher/js/client_notifications.js` was the **only** caller-side `"TWIN_PILLARS"` default outside the lazy-migration bridge in `shared/firebase_logic.js` (which the 2026-04-25 audit decision says to leave quiet because no live consumers need it). `dispatcher/js/client_notifications.js?v=2` bumped in `index.html`. `shared/firebase_logic.js` intentionally NOT touched (no `?v=2` bump needed).
- [ ] E3: `settings.js:614-617` & `:632-635` — wrap dual roster + on-call writes in a `WriteBatch` so both succeed atomically (or neither). *(Deferred to ROADMAP — both writes already work; atomicity is a polish item.)*
- [ ] E4: `dispatcher/js/ai_report_reviewer.js:563-583` — drop the redundant `syncSingleServiceCallToCloud(localRow)` after `setServiceCallMerged(memo)` (or refresh `localRow` from server first). *(Deferred to ROADMAP — perf/clarity; not user-visible.)*

**Recommended ship order:** ~~A (full plan)~~ ✓ shipped 2026-04-25 → ~~B1+B2+B3+B4~~ ✓ shipped 2026-04-25 → ~~C3~~ ✓ shipped 2026-04-25 (commit f4fe37a) → ~~E2~~ ✓ shipped 2026-04-25 (commit 79eb281). **KI-002 closed 2026-04-25.** Remaining hygiene items (B5/B6/B7, C1, C2, C4, E1, E3, E4) migrated to `ROADMAP.md → Minor Tweaks & Polish` so they don't get lost; none are field-impact and they can be picked off opportunistically when their surrounding code is touched.

**Decision deferred:** equipment data path long-term (legacy `customers/.../assets` vs tenant `imported_equipment`). Phase 33 (Field-Add Equipment) will need to settle this. Until then the existing parallel paths stay.

---

## Environmental Gotchas (Standing)

These are not bugs but recurring traps — keep them in mind whenever editing the relevant area.

- **Mobile `<body>` `outline` clipping.** Never rely on `outline` set on `<body>` for full-viewport visual indicators on mobile. Use a fixed-position `<div>` overlay as a direct child of `<body>` (see KI-001 directive fix).
- **`position: fixed` and CSS transforms.** A `position: fixed` element loses its viewport anchoring if any ancestor has `transform`, `filter`, `perspective`, or `will-change` set. Always mount global overlays as direct children of `<body>`.
- **PWA / service-worker cache on mobile.** A soft refresh is often not enough. After deploying JS/CSS changes, force a full reload (close tab/PWA and reopen) on iOS Safari and Android Chrome before declaring a fix verified.
- **Entry-point HTML has no `?v=` cache-bust.** `technician/index.html` (and `index.html` for the dispatcher) are loaded by URL, so they cannot be cache-busted from inside the app. Any inline `<style>`, inline `<script>`, or inline markup edits in those files can sit in mobile Safari's cache for hours after deploy. **Mitigations: (a)** keep a `window.VC_BUILD = "<phase>-<date>"` constant near the top of the inline script and surface it in the debug overlay (top line) — if the iPhone shows the wrong build string, force-reload until it updates; **(b)** prefer pushing new behavior into externally-loaded JS files (e.g. `workspace_ui.js?v=N`) which CAN be cache-busted; **(c)** use `workspace_ui.js`'s `ensureConsentButtonInDom()` lazy-inject pattern (Phase 32a) for any UI element that needs to ship in inline HTML — JS lazy-creates the element + its CSS if the cached HTML doesn't have it, guaranteeing the next workspace_ui.js bump fixes the device.
- **Firestore persistence + multi-tab.** `db.enablePersistence({ synchronizeTabs: true })` is enabled; some browsers (older Safari) can still throw on second-tab init. Catch and continue.
- **Gemini `responseMimeType: "application/json"` is not universal.** Some prompt/model combos reject it. Always include a fallback path that re-issues the request without `responseMimeType` (see `ai_report_reviewer.js`).
- **Tenant id pinning.** Existing deployments may need `vc_active_tenant_id` in `localStorage` to stay on `TWIN_PILLARS` after the Phase 27 default-tenant change to `USA_HEATING_COOLING`.
- **iOS-only testing without a Mac (no remote DevTools).** The dev box is Windows; we cannot attach Safari Web Inspector to a real iPhone. Use the in-app debug overlay on the field app instead. **Phase 32a:** the overlay is now **always-on by default** — no URL flag required; opt out by appending `?vc_debug=0`. The overlay is also self-healing — if cached HTML doesn't include `<div id="vcDebugOverlay">`, the IIFE injects the div + its CSS into `<body>`. The first three lines are the deploy diagnostic — `BUILD: <stamp>`, `setRemoteOverrideState: yes/NO (stale workspace_ui.js)`, `consent btn DOM: present/MISSING (stale HTML)` — followed by live values for `body.className`, override-frame/strip/consent-button computed display, ticket counts `(override: N, ack: M)`, the first hit ticket's `id` and `officeOverrideBy`, active ticket id, current screen, and URL params (updated every 1s). **KI-002 Plan A addition:** if `window.__vcWriteFailures` is non-empty the overlay also dumps `write fails: N` plus the last 3 records in `<seconds>s <ctx>: <msg>` form, and a `presence: OFFLINE` line when `window.__vcPresenceOffline` is set. Tap **Copy** to paste the snapshot into a chat. Lives in `technician/index.html` (`#vcDebugOverlay`, `vcDebugOverlayBoot` IIFE, `window.VC_BUILD` constant). Failures get pushed by `VCSurfaceWriteFailure` (in `shared/firebase_logic.js`).
- **Office Override is consent-gated on the tech device (Phase 32).** Setting `officeOverrideActive: true` on a ticket no longer immediately flips the orange chrome on the tech's real phone — the tech first sees a pulsing orange consent button. The chrome only lights up after the tech taps and the field app writes `officeOverrideAcknowledged: true`. Dispatcher iframes are NOT consent-gated (they are the dispatcher). When writing programmatic flags from any new feature, set both `officeOverrideActive: true` AND `officeOverrideAcknowledged: true` together if you want to skip the consent gate. See `DECISIONS.md → ADR-010`.

---

## Resolved (Reference)

### KI-002 — Sync Risk Audit (2026-04-25): silent-failure & cache-versioning repair backlog

- **Resolved:** 2026-04-25 — closed after C3 + E2 shipped on top of the morning's Plan A + Plan B subset (B1+B2+B3+B4). All field-impact items in the four-plan repair backlog from the 2026-04-25 sync audit are landed; remaining hygiene items (B5/B6/B7, C1, C2, C4, E1, E3, E4) were migrated to `ROADMAP.md → Minor Tweaks & Polish` to be picked off opportunistically when their surrounding code is touched. The full per-checkbox shipping inventory is preserved above (in the archived KI-002 block) for traceability.
- **Closeout commits:**
  - `e8f5cab` — Plan A (silent-failure repair: new `VCRequireTicketId` + `VCSurfaceWriteFailure` helpers in `shared/firebase_logic.js`, ring-buffered into `__vcWriteFailures` and surfaced in the iPhone debug overlay; A1–A9 call-site conversions; `service_call.js?v=68`; `VC_BUILD = "KI002-A-2026-04-25"`).
  - `b49eb23` — Plan B subset B1+B2+B3+B4 (cache & version hygiene: `shared/firebase_logic.js?v=1` on all 3 callers + `[VC] firebase_logic v=1 loaded` console.info + `__VC_FIREBASE_LOGIC_VERSION` global; `?v=1` on the 5 unversioned tech bundle scripts; `equipment_manager.js?v=8` unified across dispatcher + tech; new dispatcher `VC_BUILD = "KI002-B-2026-04-25"` + `#vcBuildChip` in sidebar-footer rendering `BUILD <stamp> · fb v<N>`, click-to-copy).
  - `f4fe37a` — Plan C3 (Shadow mirror polling fallback: `applyShadowPresenceFromDoc` calls new `shadowMirrorOpenViaBridgedFetch(tid)` after 40×350ms polling exhausts, which one-shot-fetches via `VCFirestore.getServiceCallOnceBridged`, pushes into `myTickets`, and opens the workspace; every failure path routes through `VCSurfaceWriteFailure` so the iPhone debug overlay surfaces it).
  - `79eb281` — Plan E2 (TWIN_PILLARS branding purge: `dispatcher/js/client_notifications.js#getTenantIdSafe` now defers to `VCFirestore.getTenantId()` instead of pinning `"TWIN_PILLARS"`; codebase grep verified this was the only caller-side default outside the lazy-migration bridge in `shared/firebase_logic.js` — bridge intentionally left quiet because it has no live consumers per the 2026-04-25 audit decision; `client_notifications.js?v=2` bumped, dispatcher `VC_BUILD = "KI002-CE-2026-04-25"`).
- **Standing dev tools shipped during this issue (keep in mind for future work):** `VCRequireTicketId` / `VCSurfaceWriteFailure` standardized failure surfacing (use these instead of `if (tid)` skips and `.catch(console.warn)`), 10-deep `__vcWriteFailures` ring buffer rendered live by the iPhone debug overlay, dispatcher `#vcBuildChip` mirror of the technician `BUILD:` line, `?v=1` on `shared/firebase_logic.js` so a stale shared bridge can no longer silently win on any device, lazy-injected sync-failure UI (`#vcPresenceOfflineChip`, `#dictationHubNotesError`, red `⚠ Sync Failed` card on `#successCard`), and the cyan synced-ticket badge `#vcSimulatorTicketBadge` driven by `syncDispatcherTicketIdToActiveTech`. See `PROJECT_MAP.md → Build History` for the full inventory.
- **Verification:** Plan A + Plan B subset both verified live on iPhone + dispatcher 2026-04-25 (debug overlay `BUILD:` line + write-failures ring + dispatcher BUILD chip). C3 + E2 verification protocol: tech debug overlay top line should read `BUILD: KI002-CE-2026-04-25`; dispatcher sidebar chip should read `BUILD KI002-CE-2026-04-25 · fb v1`. C3 smoke-test: open a historical or future-dated job from a shadowed tech's phone — the dispatcher's shadow viewer should open that workspace within ~14s instead of staying on the schedule. E2 smoke-test: send a portal verification link — the resulting `portal_token` doc should carry the live tenant id (e.g. `USA_HEATING_COOLING`) instead of `TWIN_PILLARS`.

### KI-001 — Office Override visual chrome missing on physical mobile devices (Phase 30)

- **Resolved:** 2026-04-25 — Phase 30 close-out. Replaced the `<body>` `outline` (clipped by mobile Safari / Android Chrome on scroll) with a dedicated fixed-position overlay div `#vcOfficeOverrideFrame` injected as a direct child of `<body>`. Bumped `#vcOfficeOverrideGlobalStrip` to `z-index: 100001` (was `280`, well below modal layers at 50000/30000/20050) and added a fixed `min-height: 56px` fallback before the `calc(... env(safe-area-inset-top))` rule for older iOS Safari. The frame's visibility is CSS-driven from `body.vc-office-override` / `body.vc-override-active`, so both the URL-init code path and the postMessage / Firestore-flag JS path light it up automatically.
- **Files touched:** `technician/index.html` (inline `<style>` block + new `<div id="vcOfficeOverrideFrame">` directly under `<body>`).
- **Files NOT touched (intentional):** `technician/js/workspace_ui.js` — `handleOfficeOverride` and `applyOfficeOverrideFromTickets` already toggle the body class correctly; the bug was purely in the CSS rendering layer, not the JS wiring. No `?v=N` cache-bust needed because no external JS/CSS files were modified; the service worker does not precache `technician/index.html` (`sw.js` only precaches the root dispatcher shell).
- **Verification protocol when deploying:** force-reload on iOS Safari and Android Chrome (close the tab/PWA and reopen) so the device picks up the new HTML. Confirm via remote DevTools that (a) `document.body.className` includes `vc-override-active` or `vc-office-override` while the dispatcher toggle is ACTIVE, (b) `#vcOfficeOverrideFrame` is a direct child of `<body>` with `display: block`, and (c) `#vcOfficeOverrideGlobalStrip` renders above every modal.
- **Related decision:** see `DECISIONS.md → ADR-008`.

---

## Filing Protocol

- New issue → add a `KI-NNN` entry under **Open** with: severity, affected files, what works, what's broken, investigation checklist, and (when known) directive fix.
- Resolved issue → move the entire entry into **Resolved (Reference)** with a `**Resolved:** YYYY-MM-DD — <one-line summary of the fix and the commit/phase it shipped in>` line at the top.
- Standing environmental traps that are not bugs but recurring footguns belong under **Environmental Gotchas (Standing)**, not under Open.
