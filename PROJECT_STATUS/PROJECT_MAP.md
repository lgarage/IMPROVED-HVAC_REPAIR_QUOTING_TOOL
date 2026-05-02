# Vertex-Core Project Map

Audited snapshot of what is **implemented and wired today**. Each feature lists **User Guide** (how to use it) and **Technical Specs** (paths, data, hooks).

> **Tier 2 (cold) — implemented-feature catalog. Grep by feature, file path, or `Phase N`. Do not read end-to-end unless first-time onboarding.** Read protocol in `.cursorrules` §1A.
>
> - For *where we are right now* and the active blocker, read `CURRENT_STATE.md` (Tier 1) first.
> - For open bugs and environmental gotchas, read `KNOWN_ISSUES.md`.
> - For why a given architectural choice was made, read `DECISIONS.md`.
> - For unbuilt ideas, read `ROADMAP.md`.

---

## 1. System Philosophy & Architecture

### System overview

- **Tenant Architecture:** `tenants/{tenantId}/` (Isolated)
- **Roles:** Admin, Tech, Sales, Time-Tracking Only.
- **Data Bridge:** Lazy migration from Root to Tenant paths.

### System Architecture & Tech Stack

- **Tech Stack:** Vanilla HTML/JS/CSS, Firebase (Firestore, Auth, Storage), Leaflet.js. **CRITICAL:** NO React, NO Node backend, NO build tools (Webpack/Vite).
- **Folder Structure:**
  - `/dispatcher` — The office/admin application.
  - `/technician` — The field application (Mobile First).
  - `/shared` — Global configurations, shared UI logic, and Firebase initialization.
- **Core Database Schema** (`tenants/{tenantId}/...`):
  - `users`: Roster, roles, entitlements (e.g., time-tracking-only, sandbox flags), weekly availability.
  - `service_calls`: Service tickets, statuses, assigned techs, internal/public notes, and invoice data.
  - `equipment`: Customer assets, photos, and AI-parsed OCR nameplates.
  - `customers`: Customer profiles and associated sites/locations.
  - `live_presence`: Field tech online status, screen position, and active ticket tracking for Shadow Mode.
  - `labor_logs`: Clock IN/OUT pairs, geolocation data for time tracking, payroll, and efficiency reports.
  - `portal_tokens`: Secure tokens and branding snapshots for Proof of Service client links.
- **AI & APIs:** Gemini AI (via `generativelanguage.googleapis.com`) for text dictation parsing, professional note cleanup, and Vision (nameplate OCR). Leaflet.js for all map integrations.

### Tenant isolation `tenants/{tenantId}/…`

**User Guide**

- Office and field apps read **tenant id** from branding config (`APP_CONFIG.tenantId`, overridable via `localStorage` `vc_active_tenant_id`). Default tenant id in `shared/config.js` is **USA_HEATING_COOLING** (legacy **TWIN_PILLARS** remains supported for the lazy data bridge when that id is active).

**Technical Specs**

- `shared/firebase_logic.js`: `tenantRoot(db) → db.collection("tenants").doc(getTenantId())`; collections include `service_calls`, `site_intelligence`, `completed_reports`, `field_quotes`, `users`, `imported_equipment`, etc.
- All `tenantCollection` writes keep SaaS data partitioned by `tenantId`.

### Lazy Migration bridge (TWIN_PILLARS) — Data Bridge

**User Guide**

- For the legacy **TWIN_PILLARS** tenant, the app **reads** both new tenant-scoped documents and **old root** collections so existing production data still appears while you migrate.

**Technical Specs**

- `isBridgeTenant()` when `getTenantId() === "TWIN_PILLARS"`.
- **Read:** `subscribeServiceCallsMerged`, `subscribeSiteIntelligenceMerged`, `getServiceCallOnceBridged`, `getSiteIntelDocOnceBridged`, etc. — merge tenant snapshot with `root` collection snapshot (tenant wins on conflicts where implemented).
- **Write:** `setServiceCallMerged`, `setSiteIntelMerged` write the **tenant** path and can **delete** the root copy after migrate for that doc (lazy lift).

### Sandbox / training accounts

**User Guide**

- **Training** users (or `+training` email pattern in import helpers) can be flagged so the Field app uses **sandbox** data instead of live tenant collections.
- **Lite / time-tracking-only** users get a dedicated **Time** tab (stopwatch UI) instead of History; read-only job view from the schedule (no dictation).

**Technical Specs**

- `technician/js/vc_entitlements.js`: loads `tenants/{tenantId}/users` by `payrollNameUpper`; sets `global.VC_SANDBOX_DATA = true` when `isTrainingAccount === true`; sets `localStorage` `vc_time_tracking_only` when `timeTrackingOnly === true` **or** `role === "time_tracking_only"`.
- `shared/firebase_logic.js`: when `VC_SANDBOX_DATA === true`, `isSandboxDataPath()` routes to `tenants/{tenantId}/sandbox/default/{collection}` instead of the live tenant subcollections.

### User Roles — definitions

Definitions live in `shared/config.js` as **`VC_ROLE_DEFINITIONS`**: `admin`, `tech`, `sales`, `time_tracking_only` (Lite / yellow seat).

#### Admin

**User Guide**

- **Dispatcher office app:** “Admin” access to **tenant branding / PIN-protected admin block** is via **PIN unlock** (`sessionStorage` `vc_admin_unlocked`), not automatically tied to the `isAdmin` field on a user row.
- Unlocked admins can edit tenant id, brand colors, logo, **Enterprise Data Onboarding** (import wizard), **Labor & payroll** CSV export, and related controls in the **Admin** disclosure.

**Technical Specs**

- PIN: `APP_CONFIG.adminUnlockPin` (default in `shared/config.js`); UI `#vcAdminUnlockBtn`, `#vcAdminForm`.
- User CSV import stores `isAdmin` on `tenants/{tenantId}/users/{docId}` (`dispatcher/js/user_import.js`) for enterprise directory / future enforcement.
- **Labor export:** `dispatcher/js/payroll_manager.js` — date range → queries `tenants/{tenantId}/labor_logs` by `dateYmd`, resolves job sites via `getServiceCallOnceBridged`, downloads CSV (employee, date, hours, sites, overtime over 8h).

#### Tech

**User Guide**

- Full **Field App**: schedule, workspace, Dictation Hub, Site Intel, Equipment Hub, forms, PM/repair flows, sync to Firestore — subject to **entitlements** (training sandbox or time-tracking-only overrides).

**Technical Specs**

- `isTech` (and related flags) stored on tenant user documents from import; Field App enforcement today centers on **`timeTrackingOnly`** and **`isTrainingAccount`** via `applyVcFieldEntitlements`.

#### Sales

**User Guide**

- **Quoting Tool & CRM** and customer-facing flows live in the office app sidebar; there is **no separate “sales-only” navigation shell** gated by the `isSales` flag in the current static UI.

**Technical Specs**

- CSV import persists `isSales` on tenant users for directory / downstream use (`user_import.js`); **role-based UI hiding for sales is not fully wired** in the dispatcher SPA beyond data model support.

---

## 2. Dispatcher Operations

### Dispatcher navigation (`index.html` sidebar)

**User Guide**

- The left sidebar follows a single mental model: **operations first**, then **people & sites**, then **collaboration**, then **intelligence**, then **tools at the bottom**.
- Order: **Service Call Intake** → **Quoting Tool** → **Invoicing** (expand for Invoicing Tool / Invoice Archive) → **Customer Directory** → **Inter-Office Feed** (Pulse) → **Reports** (expand for **Executive Insights** and **Custom Report Studio**) → **Preview Field App** → **Settings** (pinned to the bottom).
- **Reports** is the hub for all **business intelligence**: charts, KPIs, and printable management reports. Open **Reports**, then choose **Executive Insights** or **Custom Report Studio**; the active sub-item is highlighted in gold like other sidebar selections.
- **Inter-Office Feed** is the live Pulse stream (not “enter feed” — you open it from the sidebar like any other view).

**Technical Specs**

- Tab switching: global `switchTab()` in `index.html` (inline script); Reports submenu: `dispatcher/js/navigation.js` (`toggleReportsSubmenu`, `closeReportsSubmenu`, flyout positioning). Invoicing submenu logic remains in `index.html`; both cross-close when opening the other.
- Styles: `dispatcher/css/sidebar.css` (submenu flyouts, `sidebar-reports-active` / `sidebar-reports-open`, Invoicing parent states).

### Dispatcher Board (`index.html` + `service_call.js` + `dispatcher/js/ticket_manager.js`)

#### Twin Pillar UI & dispatch workflow

**User Guide**

- The **Service Call Intake** view uses the **Twin Pillar** control style: pill-shaped selects with chevron, light gray fill, hover border, and **blue focus ring** (`sc-twin-pillar-select`) for Job Type, Priority, duration, and related fields.
- **Technician assignment** uses a searchable multi-select dropdown (summary on the trigger, checkboxes inside the panel) with the same visual system.
- **Release to Field app** is gated: the issue/description must meet a minimum length before release is allowed; the UI nudges users to add detail or use the AI cleanup tool first (`dispatcher/js/ticket_manager.js` — `MIN_ISSUE_CHARS_FOR_RELEASE`).

**Technical Specs**

- Styles: `.sc-twin-pillar-select`, `.sc-tech-dropdown__*` in `index.html` (inline CSS).
- Release guard: `ticket_manager.js` wires validation to `#scIssueInput` / release flow; messages reference **✨ Clean up & structure with AI** when text is too short.
- Tickets are written through `VCFirestore.serviceCalls` / `setServiceCallMerged` where applicable (tenant path; bridge for legacy tenant — see Data Architecture).

#### Service windows & capacity (weekly tech availability) — Phase 23

**User Guide**

- **Purpose:** Match dispatch to **part-time or fixed-day** field coverage (for example, a technician who only runs service Thursday–Friday).
- **Where to configure:** **Settings** → **Manage Technicians & Truck Inventory**. Each technician row includes **Service days (dispatch):** checkboxes **M T W Th F S Su**. Checked = **service-ready** that weekday; unchecked = **off** for scheduling on that day (defaults are **all days on** for existing rosters so behavior stays unchanged until you edit it).
- **Enterprise import:** CSV user import (`dispatcher/js/user_import.js`) writes an `availability` object on each `tenants/{tenantId}/users/{emailId}` document with **all days `true`** by default. Align Field roster names with **payroll / uppercase** names used on the dispatch board.
- **At intake:** Set the job **date** first. The technician multi-select lists **available** techs first; anyone **not** service-ready that day appears under **Unavailable Today** with an **(Off)** label. The **Lead technician** dropdown uses the same **(Off)** hint.
- **Emergency override:** You can still check an unavailable technician. The app asks for confirmation and then shows a short **toast** (`showSaveCue`) that the assignment is outside usual weekly availability.

**Technical Specs**

- Profile shape (stored under `app_config/technicians` and tenant `roster` merge payload, `profiles.{techName}.availability`): `{ mon, tue, wed, thu, fri, sat, sun }` booleans (`settings.js`: `normalizeTechAvailability`, `getTechAvailabilityForJobDate`).
- Firestore user docs from import: `availability` with the same keys (`user_import.js`).
- UI: `dispatcher/js/ticket_manager.js` — `mountTechMultiSelect` partitions by `jobDateYmd` + `isTechAvailableForJobDate`; override confirmation on checkbox; `syncLeadSelectFromCrew` labels lead options with **(Off)** when applicable.
- Wiring: `service_call.js` — `buildServiceAssignedTechForm` passes `leadSelectId: "scPrimaryTechInput"` and date-aware options; `#scDateInput` `change` rebuilds the multi-select while preserving selection; ticket modal `#tdDate` mirrors the same behavior.

#### Schedule conflict detection & fleet capacity (Phase 24)

**User Guide**

- **Double-booking signal:** For the **selected job date**, each technician line in the assignment dropdown shows **(N Jobs)** when they already have **other active** tickets that day (not **Completed** / **Cancelled**, not **archived**). Counts come from the same ticket list as the board (`localStorage` `twinPillarsServiceDB`, merged with cloud). The **current ticket** is excluded when editing so self-assignment does not inflate the count.
- **Warning toast:** If you **check** a tech who **already has at least one** other job that day, a toast appears: **⚠️ [Name] is already assigned to another job on this day.** (Assignment is still allowed.)
- **Lead technician:** Changing **Lead** re-checks **weekly service-day** availability for the **scheduled date**; if the chosen lead is **off** that weekday, the selection is cleared and a warning toast explains why. Applies to the main intake form (`#scPrimaryTechInput`) and the ticket modal (`#tdPrimaryTechSelect`, delegated on `#ticketDetailsModal`).
- **Fleet capacity (Reports):** **Executive Insights** includes a **Fleet capacity** strip: **today’s** scheduled job count vs **today’s** count of roster techs available on that weekday (Settings → service days), with a **meter** and short **headroom** hint. A second line compares **this calendar week (Mon–Sun)** total scheduled jobs vs **tech-days of supply** (sum over each day of “how many techs are available that weekday”) to spot an overbooked week.

**Technical Specs**

- `dispatcher/js/ticket_manager.js`: `getServiceCallsFromCache`, `isTicketActiveForScheduling`, `ticketAssignsTech`, `countJobsForTechOnDate(techName, ymd, excludeTicketId)`; `mountTechMultiSelect` options include `excludeTicketId`; row labels append **(N Job[s])**; checkbox `change` fires availability override flow then double-book **toast**; `syncLeadSelectFromCrew` includes job-count suffixes when `jobDateYmd` is set.
- `service_call.js`: passes `excludeTicketId` from `#scCurrentId` (modal: `sc.id`); lead verification listener on main select + delegated handler on ticket modal for `tdPrimaryTechSelect`.
- `dispatcher/js/insights_manager.js`: `renderFleetCapacityCard`, `countScheduledJobsOnDate`, `countAvailableTechsForYmd`, `sumFleetWeek`; container `#insightsFleetCapacity`. Styles: `dispatcher/css/insights.css` (`.insights-fleet*`).

#### Dispatch Board QoL (Phase 28)

**Feature 1: Auto-status on crew / lead**

**User Guide**

- The system **automatically** toggles **Ticket Status** to **Dispatched** when at least one technician is assigned (crew checkboxes), and to **Unassigned** when the crew is cleared, so intake status stays aligned with assignment without extra clicks.

**Technical Specs**

- `applyAutoDispatchStatusFromCrew()` in `service_call.js`, invoked from `wireDispatcherAssignmentControlsOnce` on **crew checkbox** (`.sc-tech-cb`) `change` and **Lead technician** `#scPrimaryTechInput` `change`.
- Does **not** override terminal workflow statuses: **Completed**, **Client Verified / Ready for Billing**, or **Canceled** (`SC_STATUS_AUTO_SKIP`).

**Feature 2: 30-minute snap on timeline**

**User Guide**

- **Dragging** and **resizing** tickets on the dispatch **timeline** (and **dropping** cards onto the board) **snaps** start time and duration to **30-minute** intervals so scheduled blocks stay visually aligned and consistent.

**Technical Specs**

- `snapBoardDecimalHoursToHalfHour()` and `snapBoardDurationToHalfHour()` in `service_call.js` — applied in `handleTimelineDrop` and `timelineMouseUp` (drag/resize commit after `initTimelineAction` / `timelineMouseMove`).

#### Transparent AI Report Reviewer — side-by-side confidence UI (Phase 29)

**User Guide**

- On **Service Call Intake**, next to the other AI tools on the reported-issue toolbar, open **🔍 AI Report Reviewer**. You must have a **saved ticket** loaded (Firestore id) and **Inter-Office Comms** (`internal_comms`) worth extracting — field dictation / Pulse / internal thread content.
- The modal shows **two columns:** left = **raw Inter-Office Comms** (read-only “truth”); right = **AI-structured JSON** rendered as readable sections. **Job type** on the loaded ticket drives the schema: **Preventative Maintenance** uses a **PM** layout (work completed, per-unit equipment rows, consolidated future PM supply list); **all other job types** use a **diagnostic** layout (issue, diagnosis, work performed, recommended repairs).
- **Hover** (or keyboard focus) on any **cited** value on the right to **highlight the exact source substring** in the left column (yellow mark). Review citations before publishing.
- Click **Approve & Save to Portal** to write the formatted plain-text summary into **Client portal memo** (`clientPortalMemo`) via the tenant merge path, update the intake textarea, and sync local + cloud like other dispatcher saves.

**Technical Specs**

- `dispatcher/js/ai_report_reviewer.js` — `VcAiReportReviewer`: loads ticket with `VCFirestore.getServiceCallOnceBridged(firestore, ticketId)`; normalizes `internal_comms` (string or array → single string); reads `jobType` for **PM** vs **diagnostic** prompts.
- **Gemini:** `getGeminiApiKey()` + `generativelanguage.googleapis.com` `generateContent`; `generationConfig` prefers `responseMimeType: "application/json"` with fallback if the API rejects MIME mode; dynamic prompts embed strict JSON shapes with mandatory `sourceQuote` siblings for extractable facts; PM schema includes `workCompleted`, `equipmentDetails[]`, `consolidatedFuturePMSupplyList[]`; diagnostic schema includes `issueReported`, `diagnosis`, `workPerformed`, `recommendedRepairs[]`.
- **UI:** `index.html` — `#vcAiReportReviewerModal`, `#vcAiReviewRaw`, `#vcAiReviewParsed`; `dispatcher/css/ai_report_reviewer.css` — split grid, `.vc-ai-cite` hover styling, `mark.vc-highlight-quote` for source match.
- **Hover:** Vanilla JS `mouseenter` / `mouseleave` / `focus` / `blur` on `[data-vc-qidx]` → `quoteRegistry` index → substring highlight in `#vcAiReviewRaw` via temporary `<mark class="vc-highlight-quote">`.
- **Persist:** `VCFirestore.setServiceCallMerged` with `{ clientPortalMemo }`; `localStorage` `twinPillarsServiceDB` row update; optional `syncSingleServiceCallToCloud` (`service_call.js`).

#### Interactive Field App View (Office Override) — Phase 30

**User Guide**

- On **Service Call Intake**, next to the other AI tools on the reported-issue toolbar, use **📱 Edit in Field App UI** after a ticket is loaded (saved Firestore id). A large modal opens with the **Field App** in an **iframe** so dispatch can work in the **same interactive workspace** a technician uses: technician notes (synced to **`internal_comms`**), equipment, forms, etc. This is **not** Shadow Mode — you are editing live tenant data; sign in with a normal field account if the iframe shows the login shell.
- Use this to inject or fix notes, add equipment, or adjust formatting **on behalf of** the crew when needed; the tech’s device will see updates through existing Firestore sync.
- **Locks:** In Office Override, dispatchers can bypass the usual **historical-job** / **lite-seat** interaction rules that would block typing in the workspace (including **`#dictationHubNotes`**). Use **✍️ Insert Office Note** next to **✨ Improve with AI** to append a clean **`[Office Note]: `** stamp so office additions are easy to spot.
- **Dispatch Board phone preview vs. Office Override:** The in-portal **phone simulator** (Shadow Mode, `vc_shadow_viewer=1`) used to make **all** field inputs non-interactive. When a ticket is loaded on **Service Call Intake** (`scCurrentId`), the preview now adds **`office_override=1`** + **`forceTicketId`** so technician notes stay editable and match the **📱 Edit in Field App UI** modal behavior. For full interactive editing without Shadow mirroring, prefer **📱 Edit in Field App UI** (dedicated modal).
- **Manual Office Override toggle:** In the **phone preview**, use the orange **Office Override** button above the Field App iframe. Click to turn **ACTIVE** — the Field App frame gets an **orange outline** and dispatcher-driven editing is enabled via **`postMessage`**. Click the **Office Override** button again, or click **anywhere outside** the phone-preview modal shell, to return to **Inactive** (override is also cleared when the preview or Office modal closes).
- **Technician Field App (phone):** While **Office Override** applies (URL from dispatch, dispatcher toggle, **or** the Firestore flag the dispatcher sets on the open ticket), the app shows a **fixed orange bar** at the top (“Office Override active — *<dispatcher name>* may be editing”) with a **pulsing dot**, and an **orange frame** around the full screen so the tech always sees that the session is in override — on their **real device**, not just the dispatcher’s phone preview.
- **Live two-way notes:** While the workspace is open on the technician's phone, **Dictation Hub notes** mirror **`internal_comms`** in real time so the tech can watch office staff type and edit during Office Override (and the office sees the tech's edits the same way). The local user's typing is never overwritten — the live mirror only updates the textarea when the tech isn't focused on it and there's no pending local save.

**Technical Specs**

- `index.html` — `#btnOfficeOverride` (`.vc-btn-orange`) in `#fieldAppSimulatorModal`; `#vcFieldAppOfficeModal`, `#vcFieldAppOfficeIframe`; `service_call.js` — `toggleOfficeOverride(active)` updates button text/ARIA and **`postMessage({ type: 'VC_OFFICE_OVERRIDE', active }, '*')`** to **`#fieldAppSimulatorFrame`** and **`#vcFieldAppOfficeIframe`**; `pointerdown` on `document` (capture) turns override off when the hit is **outside** `#fieldAppSimulatorModal`; `openTechnicianAppPreview` / `closeFieldAppSimulator` / `closeFieldAppOfficeModal` call **`toggleOfficeOverride(false)`**. Iframe `src` for the Office modal remains `technician/index.html?forceTicketId={id}&office_override=1` (same origin as dispatcher).
- `technician/index.html` — `window.VC_OFFICE_OVERRIDE` from URL; `maybeOpenDeepLinkedTicket` accepts `forceTicketId` and, with `office_override=1`, loads the ticket via `getServiceCallOnceBridged` even when **`releasedToTech === false`**; `openWorkspace` skips Lite read-only when `VC_OFFICE_OVERRIDE` is true; **does not** set `vc_shadow_viewer` (Shadow read-only remains `?vc_shadow_viewer=1` only).
- UI: `#vcOfficeOverrideBanner` in the workspace shell when in Office Override mode.
- **Historical lock bypass:** `#screen-workspace` gets `vc-office-override-unlock` when `VC_OFFICE_OVERRIDE` is true; CSS overrides `#screen-workspace.is-historical-job .workspace-lock-scope` `pointer-events` so the workspace stays interactive. `applyWorkspaceHistoricalMode` calls `lockWorkspaceControls` (`technician/js/workspace_ui.js`); that function **returns immediately** when `VC_OFFICE_OVERRIDE` is true so imperative locks are not applied. `ensureOfficeOverrideWorkspaceUnlocked` / `workspaceUiOnOpen` clear **`readonly` / `disabled`** on `#dictationHubNotes` if needed.
- **`dictation_hub.js`:** `isVcTimeTrackingOnlySeat()` treats Office Override as **not** a lite seat so **`internal_comms`** debounce (`schedulePersistNotes` → `scheduleInternalCloudSave`) still runs. **`#btnInsertOfficeNote`** is shown when `VC_OFFICE_OVERRIDE` is true; click appends **`[Office Note]: `** and calls **`schedulePersistNotes()`**. `syncVcOfficeOverrideFromUrl()` re-reads the query string so the iframe always matches the URL.
- **Shadow + Office Override:** `body.vc-shadow-viewer` disables inputs globally; when `office_override=1`, **`body.vc-office-override`** is set and **`technician/index.html`** adds a CSS exception for **`#dictationHubNotes`**. `index.html` **`openTechnicianAppPreview()`** appends **`forceTicketId`** + **`office_override=1`** when **`scCurrentId`** is set so the Dispatch Board phone preview matches editable Office Override behavior.
- **Dispatcher ↔ Field `postMessage`:** `technician/js/workspace_ui.js` listens for **`VC_OFFICE_OVERRIDE`**; **`handleOfficeOverride(active)`** toggles **`body.vc-override-active`** and saves/restores **`readonly` / `disabled`** on **`#dictationHubNotes`** and **`#vcSiteIntelBody`**; additional CSS re-enables pointer events for those fields under **`body.vc-shadow-viewer`** when the toggle is active. The orange screen frame is rendered by a separate fixed-position overlay element (see "Field App chrome" below), not by an `outline` on `<body>`.
- **Field App chrome (tech device / iframe):** Two direct children of `<body>` in `technician/index.html` provide the visual override indicators, and both must remain direct children of `<body>` so iOS doesn't clip them and no transformed/filtered ancestor breaks `position: fixed`:
  - **`#vcOfficeOverrideFrame`** — fixed-position 8px `#f39c12` border overlay with `inset: 0`, `pointer-events: none`, `z-index: 100000`. Visibility is CSS-driven from `body.vc-office-override` (URL) or `body.vc-override-active` (dispatcher toggle / Firestore flag), so both the URL-init code path and the postMessage / Firestore-flag JS path light it up automatically. **This replaces the earlier `outline: 8px solid #f39c12` on `<body>`, which mobile Safari and Android Chrome clipped on scroll** (see `KNOWN_ISSUES.md → Resolved → KI-001` and `DECISIONS.md → ADR-008`).
  - **`#vcOfficeOverrideGlobalStrip`** — fixed top bar (orange gradient + pulsing dot, `z-index: 100001` to clear all modal layers) with `min-height: 56px` fallback before the `calc(40px + env(safe-area-inset-top, 0px))` rule for older iOS Safari.
  - **`<body>`** gets `padding-top: 56px` (with `calc()` fallback) so content clears the strip; workspace **`#vcOfficeOverrideBanner`** is hidden when the global strip is used.
- **Cross-device override flag (`officeOverrideActive`):** `service_call.js#toggleOfficeOverride` writes **`{ officeOverrideActive, officeOverrideBy, officeOverrideAt }`** to the open ticket via **`VCFirestore.setServiceCallMerged`**, and clears those fields (with **`FieldValue.delete()`**) when the dispatcher toggles off / closes the preview / unloads the tab. The technician's existing schedule listener (`runScheduleMergeAndRender` in `technician/index.html`, fed by **`subscribeBridgedServiceCallQuery`** on `assignedTechs`/`assignedTech`) calls **`window.applyOfficeOverrideFromTickets(myTickets)`** on every snapshot — including the first one right after page load — so the tech's real phone reflects the override on **any screen** (not just the workspace) and clears it the moment the flag is removed. `applyOfficeOverrideFromTickets` invokes **`handleOfficeOverride(active)`** and updates the top-strip label with the dispatcher name from **`officeOverrideBy`**.
- **Live `internal_comms` mirror (`dictation_hub.js`):** **`subscribeInternalCommsForTicket(ticketId)`** runs from `loadNotesFromStorageForNewTicket` and `onSnapshot`s the active ticket; updates `#dictationHubNotes` only when **`document.activeElement !== el`** and neither **`internalCloudDebounce`** nor **`notesDebounce`** is pending, so the local typist is never clobbered. `teardownDictationHub()` calls **`unsubscribeInternalCommsOnly()`**.

#### Watch + Take Over (Shadow → Office Override) — Phase 31

**User Guide**

- In the dispatcher Shadow modal toolbar, the orange **🟠 Take over (edit this job)** button stays disabled until you've picked a tech AND that tech is currently on a job workspace. When both conditions hold, the tooltip flips to "Take over the tech's current job (Office Override). Tech sees the orange chrome on their phone."
- Click it — the Shadow modal closes, the Office Override modal (`#vcFieldAppOfficeModal`) opens on the tech's currently-active ticket, and the tech's real phone immediately shows the orange Office Override chrome (frame + top strip from KI-001 / Phase 30) so they know dispatch is editing.
- This is the "watch + take over" combo: shadow read-only by default, then one button to flip into editing without first looking up the ticket id.

**Technical Specs**

- `index.html` — `#vcShadowTakeOverBtn` lives in `.vc-shadow-force-row` next to `#vcShadowForceSyncBtn`; uses `.vc-shadow-takeover-btn` (orange gradient, disabled-state grey). `dispatcher/js/shadow_mode.js?v=4` cache-bust.
- `dispatcher/js/shadow_mode.js`:
  - `takeOverActiveTicket()` — reads `presenceStateByKey[currentShadowPresenceKey].activeTicketId`, alerts if no presence key or no active ticket, otherwise sets `#scCurrentId.value = tid` (so `openFieldAppOfficeModal` can read it without requiring the dispatcher to also have the ticket open in Service Call Intake), calls `closeShadowModal()`, then `window.openFieldAppOfficeModal()` (which internally calls `toggleOfficeOverride(false)` to reset state and loads the iframe with `?forceTicketId={id}&office_override=1`), then `window.toggleOfficeOverride(true)` to write the cross-device Firestore flag.
  - `updateTakeOverButtonState()` — runs from `subscribeLivePresenceIdle` (every `live_presence` snapshot), `updateOfflineBadgeForCurrentSelection`, `closeShadowModal`, and `initShadowMode`. Sets `disabled` + tooltip based on (a) modal visible, (b) presence key set, (c) `activeTicketId` present.
  - Wiring is idempotent (`dataset.vcShadowWired = "1"`).
- `live_presence` contract: technician writes `activeTicketId: ticketId | null` from `writeLivePresence` in `technician/index.html` whenever the workspace ticket changes.
- See `DECISIONS.md → ADR-009` for why we reuse the existing Office Override modal instead of editing through the Shadow iframe.

#### Historical-job Addendum CTA — Phase 31

**User Guide**

- When a tech opens a closed/historical job in the field app, the warning banner now reads "⚠️ Historical Record: Viewing Read-Only. Tap **'Add update to this job'** to add a supplemental note or photo." The blue **✏️ Add update to this job** button sits inline in the banner.
- Tap it — the page smooth-scrolls to the **Supplemental update (addendum)** section, the section glows with a 2-cycle blue pulse (`vc-addendum-flash` keyframe), and the supplemental-notes textarea takes focus so the tech can start typing immediately.
- The CTA is hidden in Office Override mode (dispatcher already has full inline editing) and on lite seats (read-only by entitlement).

**Technical Specs**

- `technician/index.html`:
  - Banner refactored from raw `textContent` updates to a structured `<span id="workspaceHistoricalBannerText">` + `<button id="workspaceHistoricalAddUpdateBtn" hidden>` so we can flip text and button visibility independently.
  - CSS: `.workspace-historical-banner` is now `display: flex; flex-wrap: wrap;` with `.workspace-historical-banner__text` (`flex: 1 1 220px`) and `.workspace-historical-banner__cta` (blue button, `flex: 0 0 auto`). New `@keyframes vc-addendum-flash` and `.workspace-addendum-section.is-flashing` rule for the pulse.
  - `applyWorkspaceHistoricalMode(isHistorical)` — sets text on the inner span (not on the banner itself), toggles `addUpdateBtn.hidden` based on `isHistorical && window.VC_OFFICE_OVERRIDE !== true`, and lazily wires the click handler (`dataset.vcWired = '1'`) to `scrollIntoView({ behavior: 'smooth', block: 'center' })` + restart the `is-flashing` class via `void target.offsetWidth` reflow + focus the textarea.

#### `?vc_debug=1` In-App Debug Overlay — Phase 31 (standing aid)

**User Guide**

- Append `?vc_debug=1` to any technician URL (e.g. `technician/index.html?vc_debug=1`) to render a small dark monospace box in the bottom-right corner showing live state values that update once per second. Tap **Copy** to copy the snapshot to the clipboard for sharing diagnostics over chat / SMS.
- Standing diagnostic aid for **iOS-only testing without remote DevTools** (no Mac available). Lets us inspect `body.className`, override-frame visibility, override-strip visibility, ticket counts, active ticket id, current screen, and URL params on a real iPhone in seconds.

**Technical Specs**

- `technician/index.html`:
  - `#vcDebugOverlay` is injected as a **direct child of `<body>`** (same fixed-position discipline as `#vcOfficeOverrideFrame` from KI-001 — any transformed/filtered/perspective ancestor would break `position: fixed` containment on iOS).
  - CSS: `.vc-debug-overlay` is `position: fixed; right: 6px; bottom: 6px; z-index: 100002;` (just above the override strip at `100001`), `max-width: 240px`, dark semi-transparent background, monospace 11px text, `pointer-events: auto`, `user-select: text` so the user can long-press to select.
  - JS IIFE `vcDebugOverlayBoot` lives in the same large `<script>` block as `myTickets` / `activeTicket` so it can read them via lexical scope. Bails immediately if `?vc_debug` !== `"1"`. Calls `setInterval(snapshot, 1000)` and a Copy handler that uses `navigator.clipboard.writeText` with a `document.execCommand("copy")` fallback for older Safari.
  - Lines logged: `body.className`, `getComputedStyle(#vcOfficeOverrideFrame).display`, `getComputedStyle(#vcOfficeOverrideGlobalStrip).display`, `myTickets.length` with `(override: N, ack: M)` counts (Phase 32), `activeTicket.id`, current screen id, `location.search`, `Date.now`.

#### Office Override Consent Gate — Phase 32

**User Guide**

- Dispatcher activating Office Override no longer immediately frames the tech's phone in orange. The tech first sees a **large pulsing orange button at the top of every screen** of the field app: *"🟠 Tap to acknowledge — Dispatch is editing this job"* with a subtitle naming the dispatcher (when known).
- Tech taps the button → field app writes the acknowledgment to Firestore → the orange frame + top strip from KI-001 light up (existing chrome, now gated by consent).
- Dispatcher toggling Office Override OFF clears both the consent button **and** the chrome on the tech's phone within ~1s. Re-activating later starts in `pending` again — fresh consent required every time.
- The dispatcher's own iframes (`?office_override=1` URL or in-portal phone preview) **skip** the consent gate — they are the dispatcher by definition. The gate applies only to the tech's actual physical device via the Firestore-flag path.

**Technical Specs**

- **Firestore ticket fields (new):** `officeOverrideAcknowledged: boolean`, `officeOverrideAcknowledgedAt: serverTimestamp`, `officeOverrideAcknowledgedBy: string`. Set by the tech's tap; cleared with `FieldValue.delete()` whenever the dispatcher toggles Office Override OFF.
- **Three-state cross-device path (`technician/js/workspace_ui.js?v=8`):**
  - `applyOfficeOverrideFromTickets(tickets)` — picks the first ticket with `officeOverrideActive === true`, computes `state = !hit ? 'off' : (hit.officeOverrideAcknowledged === true ? 'active' : 'pending')`, dispatches to `setRemoteOverrideState(state, ticketId, byName)`.
  - `setRemoteOverrideState(state, ticketId, byName)` — toggles `body.vc-override-pending` / `body.vc-override-active` and calls `handleOfficeOverride(true|false)` only on transitions in/out of `'active'` so input snapshots and strip aria are managed correctly. Tracks state in `_vcOfficeOverrideRemoteState` (`'off' | 'pending' | 'active'`).
  - `setConsentButtonForState(state, ticketId, byName)` — writes `data-ticketId` + subtitle text on the consent button when entering `pending`; clears `data-ticketId` and resets the title in any other state so a stale tap can't write to the wrong doc.
  - The local **postMessage** path (`handleOfficeOverride(active)`) is unchanged — dispatcher iframes (live preview + Office Override modal) still flip directly to `vc-override-active` because they are the dispatcher.
- **Consent button (`technician/index.html`):**
  - `#vcOfficeOverrideConsentBtn` is a `<button>` injected as a **direct child of `<body>`** (same KI-001 fixed-position discipline). Hidden by default; visible only when `body.vc-override-pending` is set (`.vc-override-consent-btn { display: none }` → `body.vc-override-pending .vc-override-consent-btn { display: block }`).
  - CSS: `position: fixed; top: 0; left: 0; right: 0; z-index: 100003;` (just above the strip at 100001 and the debug overlay at 100002), orange gradient, 14–18px padding with `padding-top: calc(14px + env(safe-area-inset-top, 0px))` for the iOS notch, `vc-consent-pulse` keyframe on `box-shadow`, `-webkit-tap-highlight-color: transparent`. `body.vc-override-pending` adds `padding-top: 78px` (with safe-area fallback) so content shifts down under the taller button. While pending, `#vcOfficeOverrideFrame` and `.vc-office-override-global-strip` are forced `display: none !important` so the chrome doesn't double-render.
  - JS IIFE `vcOfficeOverrideConsentBoot` (inline, same `<script>` block as `currentTechProfile`): on click, reads `dataset.ticketId`, builds a `{ officeOverrideAcknowledged: true, officeOverrideAcknowledgedAt: serverTimestamp(), officeOverrideAcknowledgedBy: currentTechProfile }` patch, writes via `VCFirestore.setServiceCallMerged` (falls back to raw `service_calls/{id}.set({...}, { merge: true })`), disables itself with title *"✓ Acknowledging…"* and re-enables on error. The next snapshot from `runScheduleMergeAndRender` calls `applyOfficeOverrideFromTickets` again and the state machine flips `pending` → `active`.
- **Dispatcher reset (`service_call.js?v=66`):** `toggleOfficeOverride(active)` writes a single merged patch:
  ```js
  {
    officeOverrideActive: !!active,
    officeOverrideBy: !!active ? byName : FV.delete(),
    officeOverrideAt: !!active ? FV.serverTimestamp() : FV.delete(),
    officeOverrideAcknowledged: !!active ? false : FV.delete(),
    officeOverrideAcknowledgedAt: FV.delete(),
    officeOverrideAcknowledgedBy: FV.delete(),
  }
  ```
  On activate: `officeOverrideAcknowledged: false` (reset) + clear stale ack timestamps. On deactivate: delete every override field including the ack ones. Plus the existing `beforeunload` safety still calls `toggleOfficeOverride(false)` to prevent a stuck flag.
- **Decision:** see `DECISIONS.md → ADR-010` for why the consent gate runs only on the cross-device Firestore path and not on the local postMessage path.

#### Live Inter-Office Feed (Pulse)

**User Guide**

- Sidebar: **Inter-Office Feed** (Pulse) — open from the main nav list; opens `#view-pulse`.
- The dashboard shows a **live, append-only-style feed** of: Inter-Office Comms changes on tickets, meaningful **status** transitions, and **Site Intel** note updates.
- Click a row to **deep-link** to **Service Call Intake** and load that ticket (`loadServiceCall`).
- **Quick reply**: after selecting a feed row, type in the Pulse quick-reply box and send — the office label comes from `localStorage` `pulse_manager_name` (default **Office**). Messages are prefixed as `[Manager @ Pulse]: …` and appended to the ticket’s inter-office thread.

**Technical Specs**

- Module: `dispatcher/js/activity_feed.js` (comment header: “Live Pulse”).
- Listeners: `VCFirestore.subscribeServiceCallsMerged` and `subscribeSiteIntelligenceMerged` so **TWIN_PILLARS** reads **tenant + root** and merges (see Bridge).
- Ticket deltas: compares `internal_comms` (supports array or string) and `status` vs. previous snapshot; Site Intel: compares `notes` per doc.
- Writes (quick reply): `getServiceCallOnceBridged` → merge into `internal_comms` + `internal_comms_updatedAt` → `setServiceCallMerged`.
- CSS: `dispatcher/css/activity_feed.css`.

#### AI “Clean up & structure with AI”

**User Guide**

- On the service ticket form, the issue field has **✨ Clean up & structure with AI**.
- Paste or dictate **rough notes** first; the button calls Gemini to rewrite them into a structured **work order** (imperative voice, `[INSPECTION]` / `[ACTION]` / `[VERIFICATION]` blocks). It does not invent facts.
- Requires a **Gemini API key** from Settings → Integrations (loaded via `getGeminiApiKey()` / Firestore app config). If Generative Language API is disabled in GCP, a help alert links to enable it.

**Technical Specs**

- Function: `improveIssueTextWithAI()` in `service_call.js`; button `#scIssueImproveAiBtn`, target `#scIssueInput`.
- API: `generativelanguage.googleapis.com` `generateContent`, model from `GEMINI_GENERATE_MODEL` or default `gemini-2.5-flash`.

### Executive Insights & Revenue dashboard (includes visual analytics — Phase 15 & Phase 17)

**User Guide**

- Sidebar: **Reports** → **Executive Insights** opens `#view-insights`. Set **From** / **To** (defaults to last 30 days), optional **Default billable rate ($/hr)** (saved in `localStorage` as `vc_insights_default_rate`), then **Refresh dashboard**.
- **Fleet capacity:** a **meter** under the toolbar compares **scheduled jobs today** to **available techs today** (roster + weekday availability), with a **weekly** jobs vs **tech-days** summary — use it to see if the week has headroom.
- **Profitability by pillar:** table and bar comparison of **scheduled billable hours** (from ticket `Total_Billable_Hours` or `DispatcherTicketManager.computeTotalBillableHours`) vs **clocked hours** attributed to jobs (`labor_logs` entries: IN carries `ticketId`, OUT closes the pair). Job types map to pillars **PM, QR, SC, IN, WC** via the same rules as ticket prefixes (`getPrefixForJobType` in `service_call.js`). A **manager insight** callout flags pillars where clocked time exceeds billable by ~8%+.
- **Tech efficiency:** ranks technicians using **completed_reports** in range (timestamp on report), **median hours from ticket `date` to report** as a simple “close speed” signal, **verification %** among tickets in range with status **Completed** or **Client Verified / Ready for Billing** (counts per assigned tech), and **total shift hours** from `labor_logs`. **Rockstar** / **Coaching** badges are heuristic vs peer median verification and close-time thresholds.
- **Unbilled revenue:** lists tickets with status **Client Verified / Ready for Billing** and shows **potential revenue = billable hours × default rate**. Ticket links switch to Service Call Intake and call `loadServiceCall`.
- **System health:** counts **portal verification sends this calendar week** (non-empty `clientPortalMemo` with `portalVerificationSentAt` in the Mon–Sun window), **all-time memo count** in the loaded dataset, and **site intelligence** docs with `updatedAt` in that week (tenant + root merged for bridge tenant).
- **Charts (Phase 17):** From **Reports** → **Executive Insights**, charts include a **Revenue mix** pie (billable dollars by pillar / job type) and a **Labor efficiency** bar chart for the **last 30 days**: quoted billable hours vs. clocked labor hours per pillar, so managers can spot bleed.
- Default billable rate for dollar estimates matches the **Default billable rate ($/hr)** field on the same view (stored in `localStorage`).

**Technical Specs**

- `dispatcher/js/insights_manager.js` (`VcInsightsManager`), `dispatcher/css/insights.css`; **Fleet capacity** strip: `#insightsFleetCapacity`, `renderFleetCapacityCard` (today + week tech-days vs jobs), uses `getTechAvailabilityForJobDate` and merged service-call tickets.
- Reads: `VCFirestore.loadServiceCallsMergedOnce`, `VCFirestore.laborLogs` (`dateYmd` range query), merged `completed_reports` (tenant + root for `TWIN_PILLARS`), merged `site_intelligence` for health stats.
- Pillar job-type mapping: `Quoted Repair`→QR, `Install`→IN, `Preventative Maintenance`→PM, `Warranty Call`→WC, default→SC.
- Chart.js (CDN) in root `index.html`; canvases `#insightsChartPie`, `#insightsChartBar` in `#view-insights`.
- `dispatcher/js/insights_manager.js` — `laborSnap30` query for last-30-day labor; `destroyInsightsCharts` on refresh.

### Remote coaching & Shadow Mode (dispatcher mirror) — Phases 19–20

**User Guide**

- **Remote coaching:** dispatchers use **Shadow View** on the **Service Call Intake** dashboard (top bar) to open a **read-only** live preview of a field user’s app in a phone-style frame. Use it when a tech is **stuck** (talk them through the next step while watching their screen) or to **verify a Lite Seat** apprentice’s progress (time-tracking–only users still appear in the roster when they are not admins).
- The dropdown lists **non-admin** users from **`tenants/{tenantId}/users`** (labels: **`payrollFullName`**; values: **`presenceKey`**). Changing the selection **swaps** the shadow target: the iframe reloads, the coaching prompt field clears, and the modal title reads **Shadowing: [Tech Name]**.
- If the tech’s **`live_presence.updatedAt`** is older than **5 minutes**, their name is **dimmed** in the dropdown and **Device Offline** shows in the Shadow modal — the device may be asleep, offline, or the app not open.
- **Send prompt** delivers a short message (e.g. “Don’t forget the nameplate photo!”) as a **toast** on the technician’s device.
- **Force app refresh** asks the Field App to **reload** (writes `forceSyncAt` on `live_presence`); the tech’s app reloads when that timestamp is **newer than the app’s load time** (useful after a bad cache state or stale UI).
- Shadow is **not** a substitute for dispatch: the preview is for **training and supervision**, not for billing or time-clock actions (dispatcher cannot clock the tech out).

**Technical Specs**

- `dispatcher/js/shadow_mode.js` (`VcShadowMode`), `#vcDispatchDashboardBar` + `#vcShadowModal` + iframe in `index.html`.
- Presence: `VCFirestore.livePresence(db)` → `tenants/{tenantId}/live_presence/{presenceKey}` with `presenceKey` on user docs (import) + same `payrollKeyFromName` as `VcTimeTracker` / labor logs (`techDisplayName`, `screen`, `activeTicketId`, `updatedAt`; coach: `coachPrompt`, `coachPromptAt`; remote refresh: `forceSyncAt`).
- Field `technician/index.html`: `VC_FIELD_APP_LOADED_AT` at load; `writeLivePresence()` on screen/ticket changes + 15s interval; `wireCoachingInbox()` listener handles **coach prompts** and **`forceSyncAt` → `location.reload()`** when newer than load time; `?vc_shadow_viewer=1&vc_presence_key=…` → `VC_SHADOW_VIEWER` + read-only UI + `applyShadowPresenceFromDoc` mirroring.
- `shared/firebase_logic.js`: `livePresence` collection helper.

### Custom Report Studio & printable reports (Phase 16 & Phase 17)

#### Custom Report Studio (dispatcher)

**User Guide**

- Sidebar: **Reports** → **Custom Report Studio** — set **From** / **To**, optional **Ticket IDs** (comma-separated; leave blank for all tickets in range), choose **blocks**, then **Generate & print**. A new window opens with printable HTML; use the browser **Print** dialog → **Save as PDF**.

**Technical Specs**

- `dispatcher/js/report_builder.js` (`VcReportStudio`), `#view-report-studio` in `index.html`.
- Loads `VCFirestore.loadServiceCallsMergedOnce`, filters by `date` and optional IDs; optional blocks: job details, public-facing notes (issue / `techNotes` / `clientPortalMemo`), equipment + `getSiteIntelDocOnceBridged` for the hashed site key, `filterPublicEvidencePhotoUrls` for photos, labor hours via `labor_logs` IN/OUT pairs with `ticketId` on IN.

#### Custom Report Studio & print (Phase 17 extensions)

**User Guide**

- **Generate & print** opens a window with **branded header**, optional **summary charts** (same mix + labor bars for the report’s ticket slice), and per-ticket **site health** (rolling trend line + meter) when the **Site intel** block is included.

**Technical Specs**

- `dispatcher/js/report_builder.js` — embeds Chart.js + `dispatcher/css/report_builder.css`, JSON `chartPayload` for inline chart script after load.
- `dispatcher/css/report_builder.css` — Inter/Roboto, meter styles, `@media print` (margins, `print-color-adjust`, avoid breaks inside chart cards).

### Labor & payroll (dispatcher)

**User Guide**

- **Admin tools** (PIN) → **Labor & payroll** — pick **From** / **To** dates → **Download labor CSV**.

**Technical Specs**

- `dispatcher/js/payroll_manager.js`; CSV columns: Employee Name, Date, Total Shift Hours, Job Site(s), Overtime (if over 8hrs). Shift hours computed from paired IN/OUT entries; overtime = hours − 8 when hours exceed 8.

---

## 3. Field Operations

### Field App (`technician/index.html` + `dictation_hub.js` + `technician/js/workspace_ui.js` + `equipment_hub.js`)

#### Intelligent workspace — USA Heating and Cooling branding & Obsidian UI (Phase 27)

**User Guide**

- Default **Vertex Core** tenant branding is **USA Heating and Cooling** with the **Obsidian** palette: background **#0f172a**, primary accent **#0ea5e9**, muted text **#94a3b8** (also exposed as CSS variables `--vc-bg-obsidian`, `--vc-text-muted` from `applyVcBranding`).
- The **site banner** (customer name, **Site Intel**, tappable address, ticket line) sits in a **sticky** strip at the **top of the job workspace** (`workspace-site-banner-sticky`) so it stays visible while scrolling the rest of the form.
- **✨ Improve with AI** (formerly “Process notes”) rewrites **technician notes** using Gemini: professional/direct tone, typo fixes, **no first-person** — refer to the worker only as **“The technician”** — plus the existing Rosetta JSON mapping (asset ids, `locationTransposed`, `visitSummary`). Notes sync to the office as **`internal_comms`** (single unified notes box).

**Technical Specs**

- `shared/config.js`: `brandName` / `shortBrand`, `tenantId` default `USA_HEATING_COOLING`, `primaryColor` `#0ea5e9`; logo tint class `vc-brand-logo-primary-tint` (cyan filter for default Vertex PNGs).
- `technician/index.html`: Obsidian-oriented `body` / schedule / nav colors; site `<nav class="dictation-site-nav">` moved **above** the Dictation Hub shell inside `#workspaceLockScope`; Vision Hub markup `#visionHubAddEquipment` + styles.
- `dictation_hub.js`: `SYSTEM_INSTRUCTION` merges **improvedNotes** rules with Rosetta; `processVisitNotes` writes `improvedNotes` back into `#dictationHubNotes` when present; **+ Add Equipment** opens Vision Hub (no manual prompt-only flow).

#### Vision Hub — full-screen Add Equipment (Phase 27)

**User Guide**

- Tap **+ Add Equipment** in the action tray to open **Vision Hub** (full-screen overlay). **Capture nameplate photo** runs **Gemini Vision** preview (`dictationPreviewNameplateFromFile`) to fill manufacturer, model, serial, and **capacity (BTU / tons)**; edit **Unit ID**, then **Save equipment** to merge the Firestore asset and upload the nameplate via `dictationPromoteAssetPhoto` (same pipeline as tray captures).

**Technical Specs**

- `equipment_manager.js`: `buildDictationPlateOcrPrompt` / `pickDictationPlateOcrFields` include **`heatingCapacityBtu`**; `window.dictationPreviewNameplateFromFile` for pre-save OCR; existing upload path still merges OCR after Storage.
- `dictation_hub.js`: `openVisionHubAddEquipment`, `visionHubSaveEquipment`, `wireVisionHubOnce` (Escape + backdrop close).

#### Legacy unit-tag accordion removed (Phase 27)

**User Guide**

- The **“Unit nameplate (optional)”** accordion is removed to reduce clutter. **Tag OCR** modal flows remain for power users who open it from code paths that still call `openTagOcrModal`; draft fields `unitTagMake` … `unitTagInstallDate` persist as **hidden** inputs so reports and local draft JSON stay compatible.

**Technical Specs**

- `technician/index.html`: hidden inputs preserve `getFields` / `setFields` / `collectUnitTagFields`; `openTagOcrBtn` removed — `runTagOcrOnFile` / `initUnitTagOcr` guard null controls.

#### Dictation Hub (Simplified Notes)

**User Guide**

- **Technician notes** (header on the workspace) is the primary notes area: **✨ Improve with AI**, a single textarea, and the **dynamic action tray** (units on site from Firestore). There is **no** public vs. internal toggle — techs use one unified notes box; content is synced to the office for Inter-Office / dispatcher workflows (including **AI Report Reviewer** on raw `internal_comms`). The office formats customer-facing copy on the dispatcher side.

**Technical Specs**

- `dictation_hub.js`: `localStorage` key `dictationHubNotes_{ticketId}` (draft: `dictationHubNotes_draft`); legacy `dictationHubInternal_*` is read as fallback when migrating. Notes debounce to **`internal_comms`** + `internal_comms_updatedAt` via `setServiceCallMerged` (`scheduleInternalCloudSave`).
- **`getDictationExportMode`** returns `"internal"` for compatibility; **`getPublicDictationNotesForReport`** reads the unified technician notes buffer (name retained for callers).
- **Time-tracking-only** seat: `vc_entitlements.js` dims and disables the Dictation Hub shell (`pointer-events`, `aria-disabled`).

#### Site Intelligence (“Field Bible”)

**User Guide**

- **Site Intel** button (`#wsSiteIntelBtn`) opens a modal for **persistent site notes** (ladder access, roof hatch, lock codes) shared across all jobs at that **location line**.
- The modal label describes the textarea as the **Field bible**. When notes exist, the button gets a visual **has data** state so techs see intel at a glance.

**Technical Specs**

- `technician/js/workspace_ui.js`: builds `#vcSiteIntelModal`, uses `DataProvider.siteIntelDocIdFromLocationLine` + `VCFirestore.siteIntelligence`.
- Listener: `VCFirestore.subscribeSiteIntelDocMerged` for **TWIN_PILLARS** (tenant vs root merged notes).
- Document fields include `notes`, `locationDisplay`, `normalizedKey`, `updatedAt`, `updatedByTech`.

#### Equipment Hub

**User Guide**

- **View Site Equipment** opens the **Equipment Hub** modal for the current site: list of equipment, history, verification/retired state, and paths into **EquipmentManager** (e.g. AI plate scan flows where configured).
- Data is scoped to the active ticket’s **customer / location** and legacy Firestore paths used by the hub (`equipment_hub.js`).

**Technical Specs**

- `equipment_hub.js`: resolves `customers/{customerId}/sites/{locationId}/…` style paths; `makeEquipmentId`, modal `#equipmentHubModal`.
- Works with `equipment_manager.js` for promotions and shared equipment UI.
- Disabled when **time-tracking-only** (`vc_entitlements.js` — `#btnOpenEquipmentHub`).

#### Offline sync, cache reads & geo snapshots (Phase 18)

**User Guide**

- **Vertex-Core works in basements and mechanical rooms:** Firestore keeps an **offline cache** on the device. When there is no signal, you can still open the schedule, draft work, clock in/out, and queue writes. **Data syncs automatically** when connectivity returns—nothing extra to tap.
- The Field App header may show **Working offline** (no network) or **Using cached data** (reading from the local Firestore cache; see `SnapshotMetadata.fromCache` via the lightweight `app_config/api_keys` listener).
- **Clock in/out** and **Complete & Sync** capture a **GPS snapshot** when possible. If a fix does not arrive within **about 5 seconds**, the action still completes and the record is flagged with **`location_estimated: true`** (coordinates may be null).
- When new jobs appear on your schedule, the app **prefetches** **Site Intel** and **completed visit history** for that customer/address so it is available before you arrive on site.

**Technical Specs**

- Persistence: `firebase-config.js` — `db.enablePersistence({ synchronizeTabs: true })` immediately after the first `firebase.firestore()`; optional duplicate guard in `shared/firebase_config.js` (loaded after `firebase-config.js` on Field, dispatcher, and Proof of Service).
- Cache-first directory reads: `technician/js/data_provider.js` — `queryGetCacheFirst` (try `get({ source: "cache" })`, then full `get()` if the cached query snapshot is empty or on error).
- Geo: `technician/js/time_tracker.js` — `captureGeoSnapshot()` (5s cap), `location_estimated` + lat/lng on `labor_logs` entries; `technician/index.html` — `uploadReportToCloud` adds `geoLat`, `geoLng`, `location_estimated` to `completed_reports`.
- Prefetch: `prefetchSiteResourcesForTicket` in `technician/index.html` — `VCFirestore.getSiteIntelDocOnceBridged` + `queryCompletedReportsWhereMerged` per ticket; deduped with `vcPrefetchedTicketIds` on schedule merge and on workspace open.
- Offline badge: `updateVcFieldOfflineBadge`, `app_config/api_keys` `onSnapshot({ includeMetadataChanges: true })`, `online`/`offline` window events.

### Site Intel — Field Access Notes & Access Photos (Phase 34e)

**User Guide**

- Open a job → tap **Site Intel** in the workspace header. The modal now reads **Field Access Notes** (renamed from “Field Bible”) — same site-wide field bible content (ladder access, roof hatch, lock codes, etc.) shared across every ticket at that address.
- Below the notes textarea, an **Access Photos** section lets the technician capture and store photos of access issues or processes for future technicians (ladder placement, key locations, hatch routes, etc.). Tap **📷 Add photo** → the device opens the rear camera (or a multi-file picker on desktop). Each uploaded photo shows as a thumbnail with an inline caption box and a red **×** delete button.
- Captions save automatically when you blur the input or hit **Save**. Tapping a thumbnail opens the full-size image in a new tab. Tapping **×** asks for confirmation, then removes the photo from the doc and best-effort deletes the underlying Storage file.
- Photos are scoped to the **site** (location-line hash), not the ticket — every ticket at that address sees the same gallery. The Site Intel button shows a “has-data” indicator after Save when notes exist or after the first photo upload.

**Technical Specs**

- Modal markup + photo wiring: `technician/js/workspace_ui.js?v=11` — `ensureSiteIntelModal()` injects the renamed label, hint copy, hidden file input, **Add photo** button, status line, and (lazy-injected once via `injectSiteIntelStyles()`) the photo grid CSS. Same fixed-position discipline pattern as the Phase 32a consent button.
- Storage path: `site_access_photos/{tenantId}/{siteDocId}/{ts}_{safeFilename}`. `tenantId` resolves via `VCFirestore.getTenantId()` (fallback `APP_CONFIG.tenantId`, ultimate fallback `USA_HEATING_COOLING`); `siteDocId` is the existing `DataProvider.siteIntelDocIdFromLocationLine` hash so photos and notes share the same key.
- New `site_intelligence/{siteDocId}` fields (additive — zero migration needed):
  - `accessPhotoUrls: Array<{ url, storagePath, caption, addedBy, addedAt }>` — `addedAt` is an ISO 8601 string (NOT `serverTimestamp`) so `arrayUnion` / `arrayRemove` structural-equality matching works inside the array.
  - `accessPhotoUpdatedAt: serverTimestamp` — set on every photo add / delete / caption update.
- Add flow: serial `uploadSiteIntelPhotoFile` → `firebase.storage().ref().child(...).put(file)` → `getDownloadURL` → `arrayUnion(entry)` patch via tenant-scoped `siteIntelligence(db).doc(docId).set(..., { merge: true })`. In-memory `_siteIntelCurrentPhotos` array re-renders the grid after each success. Per-file failures funnel through `VCSurfaceWriteFailure("siteIntel:photoUpload", err)` (KI-002 Plan A).
- Delete flow: `arrayRemove(exact entry)` patch + `firebase.storage().ref().child(storagePath).delete()` (best-effort; orphaned Storage objects are harmless because the doc no longer references them). Failures surface via `VCSurfaceWriteFailure("siteIntel:photoDelete", err)`.
- Caption update: full read-modify-write of `accessPhotoUrls` (cannot combine `arrayRemove(old)` + `arrayUnion(new)` on the same field in one `set`). Wired via delegated `change` listener on `#vcSiteIntelPhotosGrid`. Failures surface via `VCSurfaceWriteFailure("siteIntel:captionUpdate", err)`.
- `saveSiteIntelFromModal` blurs the focused caption first (50ms tick) so a tech who hits **Save** mid-typing doesn't drop their last keystrokes. Notes-save failures funnel through `VCSurfaceWriteFailure("siteIntel:notesSave", err)`. Site Intel button "has-data" state now reflects either notes presence OR photos presence after a successful save.
- Open flow: `openSiteIntelModal` zeroes `_siteIntelCurrentPhotos` / `_siteIntelCurrentDocId` first to prevent stale state leaking across two different sites, then loads the doc via `VCFirestore.getSiteIntelDocOnceBridged` (bridge-aware for legacy TWIN_PILLARS — also reads root `site_intelligence/{docId}` and merges).
- Cache-bust: `workspace_ui.js?v=10` → `?v=11` in `technician/index.html`. `window.VC_BUILD = "Phase34d-2026-04-27"` → `"Phase34e-2026-05-02"`. Dispatcher (`index.html`) NOT touched — Phase 34e is field-only.
- Terminology: `.cursorrules §3` updated `"Field Bible"` → `"Field Access Notes"` (formerly "Field Bible") to keep canonical UI copy and the rules file in sync.
- **Post-ship fix (2026-05-02):** Removed `capture="environment"` from `#vcSiteIntelPhotoInput` so iOS/Android shows the native picker sheet (**Take Photo / Photo Library / Choose File**) instead of jumping straight to the rear camera. `accept="image/*" multiple` retained. Rides `workspace_ui.js?v=11` — no additional cache-bust required.

### Time-tracking only (Lite seat)

**User Guide**

- Banner: **Lite seat** — use the **Time** tab for **CLOCK IN / CLOCK OUT**; status card shows duty state, **hours today**, and **lead tech** (first assigned tech on the crew who is not you, when viewing a job).
- **Schedule** tab is unchanged; tapping a job opens a **read-only** job screen: reported issue + equipment scope only; **technician notes / Dictation Hub** and full workspace are not available.
- After sign-in, the app opens the **Time** screen first (not History).

**Technical Specs**

- `applyTimeTrackingOnlyUi` in `vc_entitlements.js`; triggers `VcTimeTracker.initLiteSeatShell()` (`technician/js/time_tracker.js`).
- `localStorage` `vc_time_tracking_only`; lite user doc: `timeTrackingOnly: true` OR `role: "time_tracking_only"`.
- Labor writes: `tenants/{tenantId}/labor_logs/{payrollKey}_{YYYY_MM_DD}` via `VCFirestore.laborLogs`; document fields `dateYmd`, `payrollKey`, `employeeName`, `entries[]` (each: `at` ISO, `action` IN/OUT, `lat`, `lng`, `ticketId` optional). Geolocation via `navigator.geolocation.getCurrentPosition`.
- Read-only workspace: `#vcLiteReadonlyWorkspace` + `workspace--lite-readonly` on `#screen-workspace` hides `#workspaceLockScope` and FAB; `openWorkspace` delegates to `openWorkspaceLiteReadonly` when lite.

---

## 4. Client Experience & Invoicing

### Office billing & quoting (sidebar access)

**User Guide**

- **Quoting Tool** and **Invoicing** (expand for **Invoicing Tool** / **Invoice Archive**) are available from the main dispatcher sidebar order (see **Dispatcher navigation**). Detailed invoicing and quoting implementations live in the corresponding app modules linked from those views.

**Technical Specs**

- Navigation and tab wiring: **Dispatcher navigation** (`index.html`, `switchTab()`); Invoicing submenu states in `dispatcher/css/sidebar.css`.

### Proof of Service & client verification (Phase 14)

#### Verification link (dispatcher)

**User Guide**

- **Send verification to client** (on the service ticket form) creates a **one-time style** link. Copy it from the box or use the automatic clipboard copy when the browser allows it.
- **URL shape:** `{origin}/proof_of_service.html?tid={tenantId}&t={opaqueToken}` — map a short hostname (e.g. `vc.app`) in Firebase Hosting to the same site if desired.

**Technical Specs**

- `dispatcher/js/client_notifications.js` — writes `tenants/{tenantId}/portal_tokens/{token}` (metadata, branding snapshot, expiry ~90 days) and merges `portalVerificationToken` + `portalVerificationSentAt` on the service call.
- `shared/client_portal_logic.js` — `VCClientPortal.generatePortalTokenId`, `buildProofOfServiceUrl`, `parseWorkOrderBlocks`, `generateClientSummaryLetter` (Gemini).

#### Proof of Service page (customer)

**User Guide**

- Customer opens the link on a phone or desktop: sees branded header, **job site**, **equipment** line, **work performed** as **[INSPECTION] / [ACTION] / [VERIFICATION]** blocks when present in the technician/dispatch text (public notes only — **no** `internal_comms`), **or** a **Work summary** when the memo field is used instead.
- **Photos:** `customerEvidenceUrls` (strings) and `evidencePhotoUrls` (objects `{ url, isPublic, caption }`); Proof of Service shows **public** field photos only (`isPublic !== false`).
- **Approve work** records approval and sets the ticket status to **Client Verified / Ready for Billing** (when the write succeeds).

**Technical Specs**

- `proof_of_service.html` — Firebase compat + `shared/config.js`, `shared/firebase_logic.js`, `shared/client_portal_logic.js`; reads token doc, loads ticket via `getServiceCallOnceBridged`; approval: `portal_tokens` merge + `setServiceCallMerged` on the ticket.

#### AI: Generate Client Summary

**User Guide**

- On the service form, **✉ Generate Client Summary** uses the technician report (or reported issue if empty) to draft a **professional letter** into **Client portal memo**; save the ticket to persist it.

**Technical Specs**

- `generateClientSummaryForPortal()` in `service_call.js`; `clientPortalMemo` on the service call document via normal save/merge.

### Evidence filtering & client-visible field photos (Phase 16)

#### Field evidence — public vs internal

**User Guide**

- In the **Field app** workspace, pasted/uploaded field photos are stored under **Field Evidence**. Each row has **Show client? Yes/No**, an optional **caption**, and a badge (Client vs Internal).
- **Default visibility:** New field evidence photos default to **internal** (`isPublic: false`); the dispatcher can mark photos public before Proof of Service.
- **Dispatcher override:** On the service ticket form, **Field evidence — client visibility** lists each field photo with **Show on Proof of Service?** so the office can flip a photo internal before **Send verification to client**.

**Technical Specs**

- `evidencePhotoUrls`: array of `{ url: string, isPublic: boolean, caption: string }`; legacy string URLs normalize to **public** in `VCClientPortal.normalizeEvidencePhotoArray`.
- `technician/index.html` — paste pipeline, `persistFieldEvidencePhotoUrlToFirestore` (`arrayUnion` object), `updateFieldEvidenceFirestoreAtIndex` (transaction), `renderWorkspaceFieldEvidence`.
- `technician/js/workspace_ui.js` — `getFieldEvidenceDefaultIsPublic()` returns **false** (internal by default) after the Dictation Hub channel toggle removal.
- `shared/client_portal_logic.js` — `normalizeEvidenceEntry`, `normalizeEvidencePhotoArray`, `filterPublicEvidencePhotoUrls`.
- `service_call.js` — `renderDispatcherFieldEvidenceOverrides`, `persistDispatcherEvidenceOverride` (Firestore + local cache sync).

### Proof of Service — site trend (Phase 17)

**User Guide**

- **Proof of Service** shows a **Site service trend** card: rolling months of service-call counts for this customer + address and a small **activity** meter.

**Technical Specs**

- `proof_of_service.html` — Chart.js, `paintSiteTrendChart()` after ticket render; uses `loadServiceCallsMergedOnce` + same site key as intel.

---

## 5. Technical Build History

### Build History

- [v] Phase 10: Tenant Isolation & Branding
- [v] Phase 11: Terminology Pivot (Inter-Office Comms) & Data Bridge
- [v] Phase 12: Enterprise Data Importer (Legacy Platform / Green Column mapping)
- [v] Phase 13: Lite Seat Dashboard & Payroll Manager (`labor_logs`, `time_tracker.js`, `payroll_manager.js`)
- [v] Phase 14: Client Verification & Proof of Service Portal (`portal_tokens`, `proof_of_service.html`, `client_notifications.js`, `client_portal_logic.js`)
- [v] Phase 15: Executive Insights & Revenue Dashboard (`dispatcher/js/insights_manager.js`, `dispatcher/css/insights.css`, `#view-insights` in `index.html`)
- [v] Phase 16: Evidence filtering & Custom Report Studio (`shared/client_portal_logic.js` evidence helpers, `technician/index.html` + `workspace_ui.js`, `service_call.js` dispatcher overrides, `dispatcher/js/report_builder.js`, `proof_of_service.html` filter)
- [v] Phase 17: Visual analytics & professional reporting (Chart.js in `index.html`, `insights_manager.js`, `report_builder.js` + `report_builder.css`, Proof of Service site trend, competitor-name scrub in UI/copy)
- [v] Navigation: Reports hub (`dispatcher/css/sidebar.css`, `dispatcher/js/navigation.js`, sidebar order + Invoicing/Reports submenus in `index.html`)
- [v] Phase 18: Offline sync & geo-snapshotting (`firebase-config.js`, `shared/firebase_config.js`, `technician/js/time_tracker.js`, `technician/js/data_provider.js`, Field header badge + prefetch in `technician/index.html`)
- [v] Phase 19: Shadow Mode (`shared/firebase_logic.js` `livePresence`, `dispatcher/js/shadow_mode.js`, Office top bar + modal in `index.html`, `technician/index.html` presence + coaching + read-only viewer)
- [v] Phase 20: Shadow switcher & force sync (`dispatcher/js/shadow_mode.js`, Service Call Intake dashboard bar + Shadow modal in `index.html`, `forceSyncAt` + `VC_FIELD_APP_LOADED_AT` reload in `technician/index.html` — non-admin roster, idle styling, **Force app refresh**)
- [v] Phase 23: Service windows & weekly tech availability (`settings.js`, `user_import.js` `availability`, `ticket_manager.js` / `service_call.js` smart tech selector)
- [v] Phase 24: Schedule conflict detection & fleet capacity (`ticket_manager.js` job counts + toasts, `insights_manager.js` fleet meter, lead-day verification in `service_call.js`)
- [v] Phase 27: Intelligent workspace — USA Heating and Cooling + Obsidian palette (`shared/config.js`, `technician/index.html`, dispatcher CSS/JS color pass), sticky site banner, **✨ Improve with AI** prompt rules (`dictation_hub.js`), Vision Hub full-screen Add Equipment + BTU on nameplate OCR (`equipment_manager.js`, `dictation_hub.js`), removal of unit-tag accordion (hidden draft fields), `manifest.json`, `settings.js` restock copy
- [v] Phase 28: Dispatch Board QoL (Auto-status & 30-min timeline snap).
- [v] Phase 29: Transparent AI Report Reviewer (`dispatcher/js/ai_report_reviewer.js`, `dispatcher/css/ai_report_reviewer.css`, `#vcAiReportReviewerModal` in `index.html`).
- [v] Phase 30: Interactive Field App View — Office Override iframe (`index.html` `#vcFieldAppOfficeModal`, `service_call.js` open/close; `technician/index.html` `forceTicketId` + `office_override=1` routing; `#vcOfficeOverrideFrame` overlay div + `#vcOfficeOverrideGlobalStrip` `z-index: 100001` from KI-001 close-out).
- [v] Phase 31: Watch + Take Over (Shadow → Office Override) + Historical-job Addendum CTA + always-on in-app debug overlay (`dispatcher/js/shadow_mode.js?v=5` `takeOverActiveTicket` / `updateTakeOverButtonState` + `#vcShadowTakeOverBtn` in `index.html`; `technician/index.html` `#workspaceHistoricalAddUpdateBtn` + `vc-addendum-flash` keyframe + `#vcDebugOverlay` direct-child-of-`<body>` overlay).
- [v] Phase 32: Office Override **consent gate** on the tech's real phone (`#vcOfficeOverrideConsentBtn` direct child of `<body>` + `body.vc-override-pending` CSS state in `technician/index.html`; 3-state refactor of `applyOfficeOverrideFromTickets` + new `setRemoteOverrideState` in `technician/js/workspace_ui.js?v=10`; `service_call.js?v=67` `toggleOfficeOverride` resets/clears `officeOverrideAcknowledged*` fields; new ticket fields `officeOverrideAcknowledged` / `officeOverrideAcknowledgedAt` / `officeOverrideAcknowledgedBy`). Verified end-to-end on real iPhone 2026-04-25. See `DECISIONS.md → ADR-010`.
- [v] Phase 32a: On-device diagnosability hardening — debug overlay always-on by default (opt out with `?vc_debug=0`), self-healing (lazy-injects its own div + CSS if HTML is cached stale), `BUILD: <stamp>` line + `setRemoteOverrideState`/`consent btn DOM`/`consent btn vis` diagnostic lines, and lazy-inject of `#vcOfficeOverrideConsentBtn` (with full CSS + click→ack-write wiring) from `workspace_ui.js?v=10` so cached `technician/index.html` can never break the consent UI again.
- [v] Phase 32b: Root-cause diagnosis hardening — `service_call.js#toggleOfficeOverride` now fires a loud `alert()` + red 3px outline + `console.warn` when `#scCurrentId.value` is empty (the silent "no-ticket-loaded → write skipped" trap that ate Phase 32 v1 verification). Debug overlay also dumps the first ticket's full override fields (`t#0`, `ovActive`, `ovBy`, `ack`) and a `last decision: <state>` line so the consent state machine is observable in real time from the iPhone.
- [v] Phase 32c: **Auto-sync `#scCurrentId.value` to the active shadowed tech's `live_presence.activeTicketId`** — `dispatcher/js/shadow_mode.js?v=5` new `syncDispatcherTicketIdToActiveTech()` (called from `applyShadowTarget` / live_presence snapshot / `wireShadowIframeTechSync`) with a `lastSyncedTicketId` watermark so manual ticket loads in Service Call Intake always win. New visible `#vcSimulatorTicketBadge` in the simulator toolbar shows three states: cyan info `<TechName> — Synced ticket: <id>`, amber warn `Tech not on a job`, amber warn `No tech selected`. Eliminates the manual "open ticket in Intake first" step that Phase 32b's alert was warning about.
- [v] KI-002 Plan B subset (B1+B2+B3+B4) — **Cache & version hygiene.** `shared/firebase_logic.js?v=1` on all three callers (`index.html`, `technician/index.html`, `proof_of_service.html`); new `FIREBASE_LOGIC_VERSION` constant inside the IIFE that emits `[VC] firebase_logic v=1 loaded` console.info on load and is exposed as `window.__VC_FIREBASE_LOGIC_VERSION` so the dispatcher chip can render the loaded version. `?v=1` added to the five previously-unversioned tech bundle scripts (`equipment_smart_select.js`, `ufx_adapter.js`, `location_manager.js`, `equipment_hub.js`, `field_forms.js`). `equipment_manager.js?v=8` unified across dispatcher (`index.html`) and tech. `window.VC_BUILD = "KI002-B-2026-04-25"` set in dispatcher inline `<script>` (mirrors the technician pattern); new `#vcBuildChip` rendered inside `.sidebar-footer` (auto-hidden when sidebar collapsed) populated by `vcDispatcherBuildChipBoot` IIFE with `BUILD <stamp> · fb v<N>` and click-to-copy behavior. Closes the "stale `firebase_logic.js` could win silently because it had no `?v=`" hole and gives the dispatcher the same one-glance build/cache diagnostic the iPhone has had since Phase 32a.
- [v] KI-002 Plan A — **Stop the silent failures (sync hardening pass).** New helpers `VCRequireTicketId(tid, label)` + `VCSurfaceWriteFailure(ctx, err)` in `shared/firebase_logic.js` (also exposed as bare globals), with a 10-deep `window.__vcWriteFailures` ring buffer that the iPhone debug overlay now surfaces (last 3 records, age in seconds, ctx + error message) plus a `presence: OFFLINE` line. Call-site conversions: A1 `uploadReportToCloud` (await both writes; red `⚠ Sync Failed` card on rejection instead of falsely-green sync), A2 `writeLivePresence` (one retry, lazy-injected `#vcPresenceOfflineChip` in top-right), A3 `dictation_hub.scheduleInternalCloudSave` (lazy-injected `#dictationHubNotesError` "tap to retry" banner under `#dictationHubNotes`), A4 `service_call.toggleOfficeOverride` (extends Phase 32b empty-tid alarm to actual Firestore-write rejections — red outline + alert), A5 consent-button ack (both inline IIFE in `technician/index.html` and lazy-inject path in `workspace_ui.js` now show `⚠ Sync failed — tap to retry acknowledgement` instead of resetting silently to the original prompt), A6 coach-field delete (one retry on failure so a dead delete doesn't loop the toast forever), A7 `customer_directory.syncSingleCustomerToCloud` (`showSaveCue` warning instead of console-only), A8 `setServiceCallMerged` (returns `Promise.reject` on empty tid instead of writing to doc id `""`), A9 `shadow_mode.sendCoachPrompt` + `forceRemoteSync` (`showSaveCue` warning toast on failure). Bumped `service_call.js?v=68` and `window.VC_BUILD = "KI002-A-2026-04-25"` once for the whole batch.
- [v] KI-002 Plan C3 — **Shadow mirror polling fallback.** `applyShadowPresenceFromDoc` in `technician/index.html` previously polled `myTickets` 40×350ms (~14s) waiting for the schedule listener to surface the active ticket id, then silently stalled if the ticket id sat outside the schedule's date filter (e.g. tech opened a historical or future-dated job). New `shadowMirrorOpenViaBridgedFetch(tid)` runs after polling exhausts: one-shot `VCFirestore.getServiceCallOnceBridged(db, tid)`, push the doc into `myTickets`, call `openWorkspace(tid)`. Every failure path (no firebase, no bridge helper, doc not found, fetch rejection, exception) routes through `VCSurfaceWriteFailure` so the iPhone debug overlay's `__vcWriteFailures` ring buffer surfaces the stall (`shadowMirrorFetch:noFirebase` / `shadowMirrorFetch:noBridge` / `shadowMirrorFetch:notFound` / `shadowMirrorFetch:fetchFailed[<tid>]` / `shadowMirrorFetch:exception[<tid>]`) instead of swallowing it. Bumped `window.VC_BUILD = "KI002-CE-2026-04-25"` in `technician/index.html`. No `?v=` bumps elsewhere — `shared/firebase_logic.js` was not touched (pure caller-side fix on top of existing bridge helpers).
- [v] KI-002 Plan E2 — **TWIN_PILLARS branding purge (caller-side).** `dispatcher/js/client_notifications.js#getTenantIdSafe` was the only remaining caller-side `"TWIN_PILLARS"` literal default in the codebase (verified by full grep across all source dirs, excluding the lazy-migration bridge in `shared/firebase_logic.js` which the 2026-04-25 audit decision said to leave quiet — it has no live consumers and bridge-aware listeners are not required for live tenants). Replaced with: `VCFirestore.getTenantId()` first (canonical helper used by every tenant-scoped collection wrapper) → `APP_CONFIG.tenantId` secondary → empty-string final fallback. Only consumer (`sendVerificationToClient` → portal_token branding snapshot) tolerates empty results, so this is non-breaking. Bumped `dispatcher/js/client_notifications.js?v=2` in `index.html` and `window.VC_BUILD = "KI002-CE-2026-04-25"` in dispatcher `index.html` so the sidebar BUILD chip surfaces the new build. `shared/firebase_logic.js` intentionally NOT bumped because E2 didn't change it.
- [v] KI-002 — **Sync Risk Audit closeout (2026-04-25).** All field-impact items in the four-plan repair backlog landed: Plan A (silent-failure repair, commit `e8f5cab`) + Plan B subset B1+B2+B3+B4 (cache & version hygiene, commit `b49eb23`) + Plan C3 (commit `f4fe37a`) + Plan E2 (commit `79eb281`). Remaining hygiene items (B5/B6/B7 + C1/C2/C4 + E1/E3/E4) migrated to `ROADMAP.md → Minor Tweaks & Polish` to be picked off opportunistically when their surrounding code is touched — none are field-impact. Standing dev tools that came out of this issue and remain in use: `VCRequireTicketId` / `VCSurfaceWriteFailure` standardized failure surfacing (use these instead of `if (tid)` skips and `.catch(console.warn)` everywhere going forward), 10-deep `__vcWriteFailures` ring buffer rendered live by the iPhone debug overlay, dispatcher `#vcBuildChip` mirror of the technician `BUILD:` line, `?v=1` on `shared/firebase_logic.js` so a stale shared bridge can no longer silently win on any device, lazy-injected sync-failure UI (`#vcPresenceOfflineChip`, `#dictationHubNotesError`, red `⚠ Sync Failed` card on `#successCard`).
- [v] Phase 34c — **Service Call additional-repair branching accordion (technician-side).** New collapsed accordion `#acc-svc-repair` injected between sections 2 and 3 of `#serviceSection` in `technician/index.html` lets a tech declare extra repair work beyond the primary service call and open the matching Phase-34b seeded checklist for each selected repair type. Layout: yes/no pillbar (`#svcRepairNeededYesBtn` / `#svcRepairNeededNoBtn`) → on Yes reveals a 2-column `pillbar-grid` of multi-select repair types (Supply Fan / Condenser Fan / Gas Valve / Compressor / Refrigerant Leak / Other) → for each selected type a chip resolves the canonical template via `getTemplatesByRepairType(<key>)` (prefers `isDefault: true`, else lowest `sortIndex`) and renders an "Open form" button + status badge ("Not started" gray → "✓ Saved" green). The "Other" pill reveals a free-text `#svcRepairOtherLabel` input (no template, just label persistence). All wiring lives in `field_forms.js?v=3` (`initRepairBranchAccordion` IIFE + helpers), keeping the hot path cache-bustable per KI-002 §B mitigations — the inline `technician/index.html` HTML is purely structural so a stale cached HTML simply renders no chips (zero-break). New ticket fields on `service_calls/{ticketId}` (additive, no schema migration): `additionalRepairNeeded: boolean`, `repairFormTypes: string[]` (e.g. `["supply_fan","compressor","other"]`), `repairFormCustomLabel: string` (only meaningful when `repairFormTypes` includes `"other"`), `repairFormStatus: { <repairKey>: { templateId, status, savedAt: <ISO date> } }` (deep-merged on update — preserves history when user toggles No → Yes), and `repairBranchUpdatedAt: serverTimestamp` on every patch. All writes go through the canonical `VCFirestore.setServiceCallMerged(db, tid, patch, true)` helper so they ride the lazy-bridge tenant-write path; failures funnel through `VCSurfaceWriteFailure("repairBranch:write[<tid>]", err)` per KI-002 Plan A so the iPhone debug overlay surfaces dropped writes. **Form-save provenance plumbing:** `renderDynamicForm(templateId, opts)` now accepts an optional second arg (signature stays backward-compatible — every existing single-arg call still works); `opts.triggeredBy = "repair_branch"` is held in a module-level `pendingTriggeredBy` var, threaded into the `field_form_submissions` payload, and surfaced on a new `vc:fieldFormSaved` CustomEvent (detail: `{ templateId, triggeredBy, ticketId }`) dispatched after every successful dynamic-form add. The accordion listens for that event and writes `repairFormStatus[<key>] = { ..., status: "saved" }` so the chip flips to its "✓ Saved" badge without a Firestore round-trip. **Hydration:** `openWorkspace()` in `technician/index.html` now dispatches `vc:workspaceOpened` (detail: `{ ticketId, mode, ticket }`) at the end of every workspace open, replacing the need for `field_forms.js` to access the inline `activeTicket` lexical scope; the accordion subscribes and re-hydrates yes/no state, selected types, "Other" label, and chip badges from the active ticket doc. Also exposes `window.__vcLastActiveTicket` and `window.vcRepairBranchHydrate(ticket)` for on-device console debugging. New CSS classes: `.pillbar-grid` (2-col tile layout), `.pillbar button[aria-pressed="true"]` (cyan selected state), `.vc-svc-repair-yesno button[data-svc-repair-needed][aria-pressed="true"]` (green/red yes/no states), `.vc-repair-chip` + `.vc-repair-chip__name` / `__badge` (`.saved` variant) / `__open` / `__missing`. Cache-bust: `field_forms.js?v=3` (was `v=2` — bumped because of the new optional second arg + payload field + accordion module + event dispatcher), `window.VC_BUILD = "Phase34c-2026-04-27"` in `technician/index.html`. **`index.html` NOT touched** — Phase 34c is technician-only by design (dispatcher's view of the data lives in the existing service_call doc surface). **Non-goals (per `PHASE_34_HANDOFF.md → §3`):** no drag-and-drop reorder of selected repair types; no deep-links between dispatcher and field repair branch; no checkout redesign; no changes to office-override / shadow-mode flow; no automatic auto-selection of repair types from dictation (the existing `scanNotesForFormRequirements` Gemini path remains untouched).
- [v] Phase 34b — **9 default form templates seeder (PIN-gated, idempotent).** New module `shared/repair_form_seeds.js?v=1` (`window.VCFormSeeds`) baking 9 stable seed docs into the root `form_templates` collection (cross-tenant catalog; tenant scoping deferred to ADR-014 in 34e): Service Call (`seed_service_call_form`, default), Additional Diagnostic (`seed_additional_diagnostic_form`), Quoted Repair Dispatcher (`seed_quoted_repair_form`, default — explicitly **NO cost field**; technicians must never see cost), Warranty Repair (`seed_warranty_repair_form` — strips manufacturer/model/serial/install-date/warranty-start-date fields already captured at initial diagnosis; tech-only post-repair report tail), Supply Fan Replacement (`seed_supply_fan_replacement` — old-motor-nameplate photo carries HP/RPM/frame, conditional bearings sub-fields kept `required:false`; install_date auto-captured at job complete), Condenser Fan Replacement (`seed_condenser_fan_replacement` — 3-photo nameplate fallback chain: motor-plate → unit-plate → inside model/serial tag), Gas Valve Replacement (`seed_gas_valve_replacement` — diagnosis captures gas type / regulator / inlet; replacement captures manifold + inlet-after + leak/ignition/flame-signal tests), Compressor Replacement (`seed_compressor_replacement` — required cooling vitals on Replacement phase: superheat, subcool, suction, discharge, supply/return/outside air temps), and Refrigerant Leak Repair (`seed_refrigerant_leak_repair` — diagnosis fields required, repair-phase fields kept `required:false` so a diagnosis-only visit doesn't error out). All seeded payloads carry the Phase 34a schema (`formCategory` / `assignedJobTypes` / `assignedRepairTypes` / `isDefault` / `sortIndex`) plus `seedAt: "2026-04-27T00:00:00Z"` + `seedSource: "phase34b"` provenance tags. **Idempotency rule:** read each `form_templates/{id}` first → CREATE if missing → SKIP if `doc.updatedAt > SEED_AT` (user has edited locally; never clobber) → `set(..., {merge:true})` UPDATE if `updatedAt <= SEED_AT` or absent. Uses `writeBatch` when total writes > 5 (atomic on the fresh-install case where all 9 are creates); per-doc `set()` when ≤5 writes (preserves partial success on flaky network). New admin button **🌱 Seed default form templates (admin)** (`#btnFieldFormSeedDefaults`, `background: #64748b`) added to `#fieldFormBuilderSection` in `index.html` next to "+ Create New Template". Click handler `handleSeedDefaultFormTemplatesClick()` in `settings.js` reuses the existing dispatcher PIN gate (`sessionStorage` `vc_admin_unlocked`, value `APP_CONFIG.adminUnlockPin || "beta"`) so unlocking once via the sidebar Admin Tools disclosure carries through; if not unlocked, an inline `prompt()` validates against the same PIN value before proceeding. Confirms before writing, runs the seeder, calls `hydrateFieldFormTemplatesList()` to refresh the dispatcher list in place, surfaces a `created C, updated U, skipped S` toast via the existing `showSaveCue()` (falls back to `alert()` with per-doc error list on partial failure). Cache-bust: new `shared/repair_form_seeds.js?v=1` script tag in `index.html`, `settings.js?v=17` (was `v=16`), `window.VC_BUILD = "Phase34b-2026-04-27"` in `index.html`. **`technician/index.html` NOT touched** — Phase 34b is dispatcher-only.
- [v] Phase 34e — **Site Intel: Field Access Notes rename + access photos.** Renames the `#vcSiteIntelBody` label from "Field bible" to **Field Access Notes** and adds a structured **Access Photos** section to the Site Intel modal so techs can capture roof access / ladder placement / key location / hatch routes pictures for future technicians. New `accessPhotoUrls: Array<{ url, storagePath, caption, addedBy, addedAt }>` + `accessPhotoUpdatedAt: serverTimestamp` fields on `site_intelligence/{siteDocId}` (additive — zero migration). All photo writes funnel through `VCSurfaceWriteFailure("siteIntel:photoUpload" / ":photoDelete" / ":captionUpdate" / ":notesSave", err)` per KI-002 Plan A. Storage path: `site_access_photos/{tenantId}/{siteDocId}/{ts}_{safeFilename}`. Captions save on blur via delegated `change` listener; **Save** blurs any focused caption input first (50ms tick) so mid-typing keystrokes never drop. Site Intel button "has-data" state now reflects either notes presence OR photos presence. CSS lazy-injected once via `injectSiteIntelStyles()` (same Phase 32a pattern as the consent button) so a stale cached `technician/index.html` cannot break the new UI. `.cursorrules §3` terminology updated `"Field Bible"` → `"Field Access Notes"` (formerly "Field Bible") to keep canonical UI copy and rules file in sync. Cache-bust: `workspace_ui.js?v=10` → `?v=11`, `window.VC_BUILD = "Phase34d-2026-04-27"` → `"Phase34e-2026-05-02"` in `technician/index.html`. **`index.html` NOT touched** — Phase 34e is field-only by design. Closes Phase 34 (see ADR-014 for the deferred form_templates tenant-scoping decision that was the original 34e docs gate). `PHASE_34_HANDOFF.md` deleted as part of this commit.
- [v] Phase 34d — **Thermostat labeling accordion at checkout.** New `#acc-tstat-label` accordion injected once before the shared Complete & Sync FAB in `technician/index.html` (covers PM / Service / Quote panels). Pillbar with three single-select options (`Already labeled` green / `Labeled now` blue / `Not labeled` orange); on `Not labeled`, reveals a reason dropdown (`Not needed` / `No printer available` / `No access` / `Will label later` / `Other`) with conditional free-text on `Other`. Auto-derives the unit label from `#linkedEquipmentSelect` selected option's `unitTag` attribute / first Action Tray chip / fallback `"the unit serviced today"`; renders the derived label inline so the tech sees "Did you label `RTU-3` today?" rather than a generic prompt. New ticket fields on `service_calls/{ticketId}` (additive): `tstatLabelStatus` (`already_labeled` | `labeled_now` | `not_labeled` | `null`), `tstatLabelReason` (`not_needed` | `no_printer` | `no_access` | `will_label_later` | `other` | `null`), `tstatLabelOtherText: string`, `tstatLabelVerifiedAt: serverTimestamp`, `tstatLabelUnitTag: string`. Persists immediately on change via `VCFirestore.setServiceCallMerged` (no separate save button). Soft-validation on Complete & Sync FAB click: if `tstatLabelStatus` is unset, fires a soft toast (`"Don't forget to confirm thermostat labeling."`) + scroll-nudge to `#acc-tstat-label` — does NOT block sync per spec. Also bumps `equipment_smart_select.js?v=2` to add `data-unit-tag` on equipment options so the auto-derived label can read it. Cache-bust: `window.VC_BUILD = "Phase34d-2026-04-27"` in `technician/index.html`.
- [v] Phase 34a — **Field Form Builder schema + UI extension.** Extended the dispatcher's Field Form & Checklist Builder (`#fieldFormBuilderModal` in `index.html`, `settings.js`) with category-aware metadata so seeded + user templates can be filtered downstream. New schema fields on `form_templates/{id}` (additive, zero breakage): `formCategory` (`"general"` / `"service_call"` / `"pm_checklist"` / `"quote"` / `"repair_checklist"` / `"warranty"`), `assignedJobTypes[]` (any of `"service"` / `"pm"` / `"quote"`), `assignedRepairTypes[]` (any of `"supply_fan"` / `"condenser_fan"` / `"gas_valve"` / `"compressor"` / `"refrigerant_leak"` / `"other"`), `isDefault: boolean`, `sortIndex: number` (lower = earlier; ties broken by `templateName`). New field type `toggle` (Yes/No slider; persists `"yes"` / `"no"` identical to checkbox so existing readers keep working). Up/Down reorder arrows on each field row in the builder editor (intentionally NOT drag-and-drop — see ROADMAP). Builder save/load/list-display now persist + render the full schema (chip multi-select helpers `getFfbChipValues` for job/repair types; category dropdown; isDefault checkbox; numeric sortIndex input). New filter helpers `getTemplatesByJobType(jobType)` and `getTemplatesByRepairType(repairType)` exposed on `window` from `field_forms.js?v=2`; both filter `active !== false` and sort by `sortIndex` then `templateName` so dispatcher-side and tech-side consumers can resolve the right template deterministically. Cache-bust: `settings.js?v=16` in `index.html`, `field_forms.js?v=2` in `technician/index.html`, `window.VC_BUILD = "Phase34a-2026-04-26"` on both. **Awaiting on-device verification** of builder UI + tech-side template list rendering; verified end-to-end by Phase 34b's seed-then-render path (the 9 seeded templates use the full new schema and render correctly in the dispatcher list immediately after seed, per `hydrateFieldFormTemplatesList`).
- [v] Phase 33 — **Field-Add Equipment (No-Info Capture).** Implements `DECISIONS.md → ADR-011` end-to-end across 5 commits (`dc6e8df`, `43a1831`, `bc642bd`, `9b42a5f`, plus the build-stamp + docs sync commit). New `VC_EQUIPMENT_TYPE_PREFIXES` canonical seed (`RTU`, `B`, `CU`, `AHU`, `FCU`, `WH`, `MAU`, `EF`, `CHL`, `CT`, `SPLIT` + `Other → freeform` escape hatch) in `shared/config.js?v=4`. New bridge helpers `getEquipmentForSiteBridged(db, customerId, siteId, locationLine?)` + `subscribeEquipmentForSiteBridged(...)` in `shared/firebase_logic.js` (bumped to `FIREBASE_LOGIC_VERSION = 2` + `?v=2` on all 3 callers per KI-002 B1 lockstep) merge three sources by unit identity (`unitType+unitNumber` → `unitTag` → legacy doc id) with `imported_equipment` rows winning on conflict per ADR-011 §2: legacy `customers/{customerId}/sites/{siteId}/assets`, tenant `imported_equipment` filtered by `customerId+siteId`, tenant `imported_equipment` filtered by `normalizedLocationKey` (legacy CSV index). `dictation_hub.js?v=10` Action Tray now subscribes through the bridge so it sees field-added units AND legacy CSV units. Vision Hub overlay rewrite: identity row = `unitType <select>` (seeded from `VC_EQUIPMENT_TYPE_PREFIXES`, with `Other` revealing a freeform input) + `unitNumber` text input + live tag preview (`Slot: RTU4 [New slot|Edit existing]`). `visionHubSaveEquipment` writes only to `tenants/{tenantId}/imported_equipment/{docId}` (canonical store; doc id = existing `imported_equipment.docId` if the bridge found one, else deterministic `vc_field_eq_<hash(customer|site|unitTag)>`); pre-loads existing slot values via the bridge → diffs at save → stamps `fieldEdits[<fieldName>] = { by, at }` only for fields the tech actually CHANGED (not for fields they merely viewed); new slots additionally stamp `source: "field"`, `addedBy: currentTechProfile`, `addedAt: serverTimestamp()`; nameplate photos upload directly to `tenants/{tenantId}/imported_equipment_photos/{customerId}/{siteId}/{unitTag}/nameplate-{ts}.{ext}` (no legacy `customers/.../assets` write — keeps Phase 33 hitting one canonical store only); failures funnel through `VCSurfaceWriteFailure` + render an inline red `#visionHubSaveError` banner with retry guidance per KI-002 Plan A. `dispatcher/js/import_hub.js?v=2` `processEquipmentImport` per-field merge guard (ADR-011 §3 writer side): pre-fetches existing `imported_equipment` docs by `normalizedLocationKey` (concurrent in chunks of 8), matches each CSV row to an existing doc by `unitTag` → `serialNumber` → legacy doc id, and **strips any field present in the existing doc's `fieldEdits` map** before writing — the technician's correction wins. Brand-new rows get `source: "csv"` + seeded empty `fieldEdits: {}`; existing field-added rows preserve `source: "field"`; legacy CSV rows missing a `source` flag get backfilled to `"csv"`. `window.VC_BUILD = "Phase33-2026-04-25"` in both `index.html` and `technician/index.html`. **Awaiting on-device verification** (smoke-tests a/b/c in `CURRENT_STATE.md → Immediate Next Step`); flip the `[v]` to confirmed once they pass.

### Current Focus

- **Active phase:** None. Phase 34 fully shipped (34a/b/c/d/e); Phase 33 still awaiting on-device verification. See `CURRENT_STATE.md` for next-up.
- **Active blocker:** None. Pointers + open KIs in `CURRENT_STATE.md`.
- **Ongoing maintenance threads** are tracked in `CURRENT_STATE.md`, not here, so this catalog stays focused on shipped functionality.
