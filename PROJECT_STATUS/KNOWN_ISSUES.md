# Vertex Core | Known Issues

Open bugs, environmental gotchas, and debug notes. Resolved items move to the **Resolved (Reference)** section at the bottom so we keep institutional memory without cluttering the open list.

> **Tier 2 (cold) — pull on demand by `KI-NNN` or affected file. Do not read end-to-end.** `CURRENT_STATE.md` always names the **single highest-priority blocker** by ID; this file holds full reproduction and investigation notes. Read protocol in `.cursorrules` §1A.

---

## Open

### KI-008 — Log out / switch user: cannot log back in

- **Filed:** 2026-05-18 (user report in session — not yet in Slack `#issues-found`).
- **Severity:** **High** — blocks switching users on a shared device; logout appears to work but re-login fails.
- **Symptoms:** Tap **Log Out / Switch User** (profile panel or settings) → login shell may appear → pick name → **Continue** (or admin path) does not complete login; schedule empty/stuck, or shell dismisses without loading tickets.
- **Affected code:** `technician/index.html` — `switchUser()` (~8826), `showLoginShell` / `hideLoginShell`, `completeTechnicianLogin()` (~8757), `loadUserProfile()` (~8800), init `loginContinueBtn` wiring (~12774 / 12810).
- **Investigation checklist:**
  - Repro on device: logout from schedule vs from workspace; note BUILD stamp + debug overlay state.
  - After logout, confirm `#loginShell` visible (not `hidden`); tap Continue — does `completeTechnicianLogin` run? Any alert?
  - Check whether `switchUser()` clears in-memory `currentTechProfile` (only removes `localStorage tp_saved_tech` today).
  - Check whether `loginContinueBtn.onclick` is still bound after logout (init wires once; `switchUser` does not re-wire).
  - After failed re-login: `subscribeToMyTickets` — was listener restarted? `jobListContainer` stuck on "Fetching schedule…"?
  - Admin logout: `vc_admin_session` cleared but ADMIN pill styling on `#techDisplayLabel` may persist until re-login.
- **Hypothesis:** `switchUser()` shows login shell then calls `switchScreen('schedule')` without resetting profile/subscription state; stale `currentTechProfile` or missing `loginContinueBtn` re-bind / missing `loadUserProfile()` resubscribe leaves user unable to complete second login.
- **Directive fix:** Reset session state fully on logout (`currentTechProfile`, workspace close, ticket listener teardown); re-wire `loginContinueBtn` + `wireAdminLoginBtn` guards in `switchUser`; ensure `completeTechnicianLogin` → `loadUserProfile` → `subscribeToMyTickets` runs cleanly on every re-login.
- **Status:** Open — investigation not started.

---

### KI-006 — Past-day job UX: card tap, report-first, timestamped addendum notes

- **Filed:** 2026-05-18 (`#issues-found` — user message + screenshots same day).
- **Severity:** Medium — UX/product; not a crash.
- **Requested behavior:**
  1. Tap a **past/completed job card** → open workspace same as **Update / Review this job** (not a dead card).
  2. **First screen in workspace** → **compiled report** (not chat timeline).
  3. **Add additional notes** affordance → chat composer; messages **timestamped** so cross-day addenda are auditable.
- **Related shipped work:** Phase 66 historical mode (selective locks + addendum section) — does **not** fully satisfy this spec.
- **Directive fix:** Design pass then implement in field app (`technician/index.html`, `conversational_timeline.js`, historical-mode helpers).
- **Status:** Open — spec locked from Slack; implementation not started.

---

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
- **Directive fix:** Design locked. See `DECISIONS.md → ADR-012` for the full spec (module shape, API, IDB version bump, dual UI signal, failure surfacing). Treat as a KI-002-style follow-up patch on Phase 33 (`VC_BUILD = "Phase33-followup-<date>"`); verification piggybacks on Phase 33 on-device smoke-tests.
- **Status (2026-05-18):** Outbox module `shared/offline_storage_outbox.js` created by Slice 56a (SDK runner). All field-side `ref.put()` call sites now wired with `VCStorageOutbox.enqueue` fallback — 8 sites wired by Slice 56a, 6 additional sites wired 2026-05-18 (`dictation_hub.js`, `field_forms.js` ×3, `conversational_timeline.js`, `teaching_layer.js`). `VC_BUILD: KI004-OfflineOutboxWiring-2026-05-18`. **Remaining gap:** outbox `drain()` uploads the file to Storage but does not patch the Firestore doc with the download URL (no `contextHook` callbacks yet). Files are preserved but the doc-level URL field stays empty until the tech re-saves. Dispatcher-side uploads (`service_call.js` ×2) intentionally not wired per ADR-012 (dispatcher rarely offline).
- **Workaround for URL gap:** Tech re-opens the equipment/form and re-saves — the text fields are already persisted via Firestore persistence, and the photo will be in Storage from the outbox drain. The re-save triggers a fresh upload attempt which succeeds (file already exists at path) and patches the URL.

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
- **Design lock 2026-04-25:** see `DECISIONS.md → ADR-013` (Live Workspace Mirror). Locked: transport = extend existing `live_presence/{payrollKey}` doc with `uiState` + `liveDraft` maps (rejected RTDB / WebRTC / per-ticket collection); direction = read-only v1 (office WATCHES); consent = piggyback ADR-010 with new `liveMirrorAcknowledged` flag written in the same merge as the existing override ack; scope = 11 named accordions + module-registered disclosures + delegated `input` listener on `#workspaceScreen` for `<input>` (text/number/tel/email/search/url) + `<textarea>` + `<select>`; throttle = 250ms debounce + 100ms per-field rate cap (≈$0.20/day/tech); disconnect = Firestore persistence buffers + dispatcher "last seen Ns ago" badge; failures route through `VCSurfaceWriteFailure` (KI-002 Plan A standard); ships as **Phase 34**, build stamp `Phase34-<date>`. Implementation file = new `technician/js/live_mirror.js`. Smoke-tests (a)/(b)/(c)/(d)/(e) defined in ADR-013 → Consequences.
- **Related code (for grep):**
  - Existing live channels: `dictation_hub.js#scheduleInternalCloudSave` (800ms Firestore debounce on `service_calls/{tid}` — keep unchanged), `dispatcher/js/shadow_mode.js#applyShadowPresenceFromDoc`, `service_call.js#syncDispatcherTicketIdToActiveTech`, `live_presence` writes in `technician/index.html#writeLivePresence` (15s heartbeat — keep unchanged).
  - Office Override iframe loader: `service_call.js#openFieldAppOfficeModal` and the URL-routing in `technician/index.html` that interprets `?office_override=1` (reads `window.VC_OFFICE_OVERRIDE`).
  - Consent precedent: `DECISIONS.md → ADR-010` (3-state pending/active gate via `officeOverrideAcknowledged` written by tech tap on `#vcOfficeOverrideConsentBtn`).
- **Phase candidate (locked by ADR-013):** **Phase 34 — Live Workspace Mirror** (Office Override v2). Sequenced behind Phase 33 on-device verification + KI-004 follow-up patch.
- **Workaround until shipped:** dispatcher pings the tech via `internal_comms` ("show me your screen") and uses the cyan synced-ticket badge + the existing read-only data already in the iframe; for live coaching, voice/phone is still required.

---

---

## (Resolved — see archive for full per-checkbox inventory)

### KI-002 — Sync Risk Audit [RESOLVED 2026-04-25]

Full per-checkbox inventory: see `KNOWN_ISSUES_ARCHIVE.md → KI-002`.

Plans A+B (B1–B4)+C3+E2 shipped 2026-04-25. Commits: `e8f5cab` (Plan A), `b49eb23` (Plan B), `f4fe37a` (C3), `79eb281` (E2). Hygiene leftovers (B5/B6/B7, C1/C2/C4, E1/E3/E4) in `ROADMAP.md → Minor Tweaks & Polish`. Standing dev tools: `VCRequireTicketId` / `VCSurfaceWriteFailure` / `__vcWriteFailures` ring buffer / `#vcBuildChip` / lazy-injected sync-failure UI.

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

### KI-005 — Field schedule/board stuck on "Loading…"

- **Resolved:** 2026-05-18 — user confirmed schedule loads normally same day; no repro after morning report. **Most likely fix:** Phase 66 restoration of missing `}` in `technician/index.html` init (~12384) so `loadUserProfile` / `subscribeToMyTickets` run for returning users (see `phase66-fix-tracker.canvas.tsx` #1). **If it returns:** force-reload PWA, check debug overlay `BUILD:` + `__vcWriteFailures`, trace schedule init and add spinner timeout + error surface.
- **Verification:** User report 2026-05-18 PM — "not stuck on loading anymore today."

### KI-007 — Repair checklist trigger may not inject full item list

- **Resolved:** 2026-05-18 — `isFirstShow` race in `scheduleChecklistReminders()`: snapshot at call time before `updateFromEntry` marks same-message items. Commit `658c08b` · `conversational_timeline.js?v=69` · `VC_BUILD: ChecklistFirstShowFix-2026-05-18`.
- **Verification:** Playwright 5/5 items on trigger phrase; user device-confirmed same day — full checklist on first show.

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
