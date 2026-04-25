# Vertex-Core Project Map

Audited snapshot of what is **implemented and wired today**. Each feature lists **User Guide** (how to use it) and **Technical Specs** (paths, data, hooks).

> **This file is the implemented-feature catalog.**
>
> - For *where we are right now* and the active blocker, read `CURRENT_STATE.md` first.
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
- **Dispatcher ↔ Field `postMessage`:** `technician/js/workspace_ui.js` listens for **`VC_OFFICE_OVERRIDE`**; **`handleOfficeOverride(active)`** toggles **`body.vc-override-active`** (orange **`outline`**, **`technician/index.html`**) and saves/restores **`readonly` / `disabled`** on **`#dictationHubNotes`** and **`#vcSiteIntelBody`**; additional CSS re-enables pointer events for those fields under **`body.vc-shadow-viewer`** when the toggle is active.
- **Field App chrome (tech device / iframe):** **`#vcOfficeOverrideGlobalStrip`** fixed top bar (orange gradient + pulsing dot) when **`body.vc-office-override`** (URL) or **`body.vc-override-active`** (dispatcher toggle / Firestore flag); **`body`** gets an **8px `#f39c12` outline** and **`padding-top`** so content clears the strip; workspace **`#vcOfficeOverrideBanner`** is hidden when the global strip is used.
- **Cross-device override flag (`officeOverrideActive`):** `service_call.js#toggleOfficeOverride` writes **`{ officeOverrideActive, officeOverrideBy, officeOverrideAt }`** to the open ticket via **`VCFirestore.setServiceCallMerged`**, and clears those fields (with **`FieldValue.delete()`**) when the dispatcher toggles off / closes the preview / unloads the tab. The technician's existing schedule listener (`runScheduleMergeAndRender` in `technician/index.html`, fed by **`subscribeBridgedServiceCallQuery`** on `assignedTechs`/`assignedTech`) calls **`window.applyOfficeOverrideFromTickets(myTickets)`** on every snapshot — including the first one right after page load — so the tech's real phone reflects the override on **any screen** (not just the workspace) and clears it the moment the flag is removed. `applyOfficeOverrideFromTickets` invokes **`handleOfficeOverride(active)`** and updates the top-strip label with the dispatcher name from **`officeOverrideBy`**.
- **Live `internal_comms` mirror (`dictation_hub.js`):** **`subscribeInternalCommsForTicket(ticketId)`** runs from `loadNotesFromStorageForNewTicket` and `onSnapshot`s the active ticket; updates `#dictationHubNotes` only when **`document.activeElement !== el`** and neither **`internalCloudDebounce`** nor **`notesDebounce`** is pending, so the local typist is never clobbered. `teardownDictationHub()` calls **`unsubscribeInternalCommsOnly()`**.

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
- [v] Phase 30: Interactive Field App View — Office Override iframe (`index.html` `#vcFieldAppOfficeModal`, `service_call.js` open/close; `technician/index.html` `forceTicketId` + `office_override=1` routing).

### Current Focus

- **Active phase:** **30 — Interactive Field App View (Office Override iframe).** Functionally complete on the data path; visual chrome on physical mobile devices is the open blocker.
- **Active blocker:** **KI-001 — Office Override visual chrome missing on physical mobile devices.** Full reproduction, investigation checklist, and the agreed-on directive fix live in `KNOWN_ISSUES.md → KI-001`. Session-level snapshot is in `CURRENT_STATE.md`.
- **Next phase candidates** (after blocker clears): see `ROADMAP.md → Next Up` (Command Map / TV Mode; Field Inventory / Truck Stock).
- **Ongoing maintenance threads** are tracked in `CURRENT_STATE.md`, not here, so this catalog stays focused on shipped functionality.
