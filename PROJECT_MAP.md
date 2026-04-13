# Vertex-Core Project Map

## System Overview

- **Tenant Architecture:** `tenants/{tenantId}/` (Isolated)
- **Roles:** Admin, Tech, Sales, Time-Tracking Only.
- **Data Bridge:** Lazy migration from Root to Tenant paths.

## Manual — Functional Inventory

Audited snapshot of what is **implemented and wired today**. Each feature lists **User Guide** (how to use it) and **Technical Specs** (paths, data, hooks).

---

### Dispatcher navigation (`index.html` sidebar)

**User Guide**

- The left sidebar follows a single mental model: **operations first**, then **people & sites**, then **collaboration**, then **intelligence**, then **tools at the bottom**.
- Order: **Service Call Intake** → **Quoting Tool** → **Invoicing** (expand for Invoicing Tool / Invoice Archive) → **Customer Directory** → **Inter-Office Feed** (Pulse) → **Reports** (expand for **Executive Insights** and **Custom Report Studio**) → **Preview Field App** → **Settings** (pinned to the bottom).
- **Reports** is the hub for all **business intelligence**: charts, KPIs, and printable management reports. Open **Reports**, then choose **Executive Insights** or **Custom Report Studio**; the active sub-item is highlighted in gold like other sidebar selections.
- **Inter-Office Feed** is the live Pulse stream (not “enter feed” — you open it from the sidebar like any other view).

**Technical Specs**

- Tab switching: global `switchTab()` in `index.html` (inline script); Reports submenu: `dispatcher/js/navigation.js` (`toggleReportsSubmenu`, `closeReportsSubmenu`, flyout positioning). Invoicing submenu logic remains in `index.html`; both cross-close when opening the other.
- Styles: `dispatcher/css/sidebar.css` (submenu flyouts, `sidebar-reports-active` / `sidebar-reports-open`, Invoicing parent states).

---

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

#### Executive Insights & Revenue dashboard

**User Guide**

- Sidebar: **Reports** → **Executive Insights** opens `#view-insights`. Set **From** / **To** (defaults to last 30 days), optional **Default billable rate ($/hr)** (saved in `localStorage` as `vc_insights_default_rate`), then **Refresh dashboard**.
- **Profitability by pillar:** table and bar comparison of **scheduled billable hours** (from ticket `Total_Billable_Hours` or `DispatcherTicketManager.computeTotalBillableHours`) vs **clocked hours** attributed to jobs (`labor_logs` entries: IN carries `ticketId`, OUT closes the pair). Job types map to pillars **PM, QR, SC, IN, WC** via the same rules as ticket prefixes (`getPrefixForJobType` in `service_call.js`). A **manager insight** callout flags pillars where clocked time exceeds billable by ~8%+.
- **Tech efficiency:** ranks technicians using **completed_reports** in range (timestamp on report), **median hours from ticket `date` to report** as a simple “close speed” signal, **verification %** among tickets in range with status **Completed** or **Client Verified / Ready for Billing** (counts per assigned tech), and **total shift hours** from `labor_logs`. **Rockstar** / **Coaching** badges are heuristic vs peer median verification and close-time thresholds.
- **Unbilled revenue:** lists tickets with status **Client Verified / Ready for Billing** and shows **potential revenue = billable hours × default rate**. Ticket links switch to Service Call Intake and call `loadServiceCall`.
- **System health:** counts **portal verification sends this calendar week** (non-empty `clientPortalMemo` with `portalVerificationSentAt` in the Mon–Sun window), **all-time memo count** in the loaded dataset, and **site intelligence** docs with `updatedAt` in that week (tenant + root merged for bridge tenant).

**Technical Specs**

- `dispatcher/js/insights_manager.js` (`VcInsightsManager`), `dispatcher/css/insights.css`.
- Reads: `VCFirestore.loadServiceCallsMergedOnce`, `VCFirestore.laborLogs` (`dateYmd` range query), merged `completed_reports` (tenant + root for `TWIN_PILLARS`), merged `site_intelligence` for health stats.
- Pillar job-type mapping: `Quoted Repair`→QR, `Install`→IN, `Preventative Maintenance`→PM, `Warranty Call`→WC, default→SC.

#### AI “Clean up & structure with AI”

**User Guide**

- On the service ticket form, the issue field has **✨ Clean up & structure with AI**.
- Paste or dictate **rough notes** first; the button calls Gemini to rewrite them into a structured **work order** (imperative voice, `[INSPECTION]` / `[ACTION]` / `[VERIFICATION]` blocks). It does not invent facts.
- Requires a **Gemini API key** from Settings → Integrations (loaded via `getGeminiApiKey()` / Firestore app config). If Generative Language API is disabled in GCP, a help alert links to enable it.

**Technical Specs**

- Function: `improveIssueTextWithAI()` in `service_call.js`; button `#scIssueImproveAiBtn`, target `#scIssueInput`.
- API: `generativelanguage.googleapis.com` `generateContent`, model from `GEMINI_GENERATE_MODEL` or default `gemini-2.5-flash`.

---

### Field App (`technician/index.html` + `dictation_hub.js` + `technician/js/workspace_ui.js` + `equipment_hub.js`)

#### Dictation Hub — Public vs Inter-Office

**User Guide**

- **Dictation Hub** is the primary notes area on the workspace: **Process notes**, raw textarea, and the **dynamic action tray** (units on site from Firestore).
- Two channels: **Public export** vs **Inter-Office Comms**. Only one is active at a time; the choice controls whether processed / synced text is treated as **customer-facing export** vs **office-only** content on the ticket (`internal_comms`).

**Technical Specs**

- `dictation_hub.js`: `dictationChannel` is `"public"` or `"internal"`; wired to `#dictationChannelPublic` / `#dictationChannelInternal`.
- Inter-Office content flows to service call **`internal_comms`** (and related timestamps) per existing sync paths; public path aligns with export / report-facing compilation (Rosetta JSON mapping, tray assets, etc.).
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

#### Remote coaching & Shadow Mode (dispatcher mirror) — Phases 19–20

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

---

### Data Architecture

#### Tenant isolation `tenants/{tenantId}/…`

**User Guide**

- Office and field apps read **tenant id** from branding config (`APP_CONFIG.tenantId`, overridable via `localStorage` `vc_active_tenant_id`). Default demo tenant id is **TWIN_PILLARS**.

**Technical Specs**

- `shared/firebase_logic.js`: `tenantRoot(db) → db.collection("tenants").doc(getTenantId())`; collections include `service_calls`, `site_intelligence`, `completed_reports`, `field_quotes`, `users`, `imported_equipment`, etc.
- All `tenantCollection` writes keep SaaS data partitioned by `tenantId`.

#### Lazy Migration bridge (TWIN_PILLARS)

**User Guide**

- For the legacy **TWIN_PILLARS** tenant, the app **reads** both new tenant-scoped documents and **old root** collections so existing production data still appears while you migrate.

**Technical Specs**

- `isBridgeTenant()` when `getTenantId() === "TWIN_PILLARS"`.
- **Read:** `subscribeServiceCallsMerged`, `subscribeSiteIntelligenceMerged`, `getServiceCallOnceBridged`, `getSiteIntelDocOnceBridged`, etc. — merge tenant snapshot with `root` collection snapshot (tenant wins on conflicts where implemented).
- **Write:** `setServiceCallMerged`, `setSiteIntelMerged` write the **tenant** path and can **delete** the root copy after migrate for that doc (lazy lift).

#### Sandbox / training accounts

**User Guide**

- **Training** users (or `+training` email pattern in import helpers) can be flagged so the Field app uses **sandbox** data instead of live tenant collections.
- **Lite / time-tracking-only** users get a dedicated **Time** tab (stopwatch UI) instead of History; read-only job view from the schedule (no dictation).

**Technical Specs**

- `technician/js/vc_entitlements.js`: loads `tenants/{tenantId}/users` by `payrollNameUpper`; sets `global.VC_SANDBOX_DATA = true` when `isTrainingAccount === true`; sets `localStorage` `vc_time_tracking_only` when `timeTrackingOnly === true` **or** `role === "time_tracking_only"`.
- `shared/firebase_logic.js`: when `VC_SANDBOX_DATA === true`, `isSandboxDataPath()` routes to `tenants/{tenantId}/sandbox/default/{collection}` instead of the live tenant subcollections.

---

### User Roles

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

#### Time-tracking only (Lite seat)

**User Guide**

- Banner: **Lite seat** — use the **Time** tab for **CLOCK IN / CLOCK OUT**; status card shows duty state, **hours today**, and **lead tech** (first assigned tech on the crew who is not you, when viewing a job).
- **Schedule** tab is unchanged; tapping a job opens a **read-only** job screen: reported issue + equipment scope only; **Dictation Hub**, Inter-Office channel, and full workspace are not available.
- After sign-in, the app opens the **Time** screen first (not History).

**Technical Specs**

- `applyTimeTrackingOnlyUi` in `vc_entitlements.js`; triggers `VcTimeTracker.initLiteSeatShell()` (`technician/js/time_tracker.js`).
- `localStorage` `vc_time_tracking_only`; lite user doc: `timeTrackingOnly: true` OR `role: "time_tracking_only"`.
- Labor writes: `tenants/{tenantId}/labor_logs/{payrollKey}_{YYYY_MM_DD}` via `VCFirestore.laborLogs`; document fields `dateYmd`, `payrollKey`, `employeeName`, `entries[]` (each: `at` ISO, `action` IN/OUT, `lat`, `lng`, `ticketId` optional). Geolocation via `navigator.geolocation.getCurrentPosition`.
- Read-only workspace: `#vcLiteReadonlyWorkspace` + `workspace--lite-readonly` on `#screen-workspace` hides `#workspaceLockScope` and FAB; `openWorkspace` delegates to `openWorkspaceLiteReadonly` when lite.

#### Labor & payroll (dispatcher)

**User Guide**

- **Admin tools** (PIN) → **Labor & payroll** — pick **From** / **To** dates → **Download labor CSV**.

**Technical Specs**

- `dispatcher/js/payroll_manager.js`; CSV columns: Employee Name, Date, Total Shift Hours, Job Site(s), Overtime (if over 8hrs). Shift hours computed from paired IN/OUT entries; overtime = hours − 8 when hours exceed 8.

---

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

---

### Evidence filtering & Custom Report Studio (Phase 16)

#### Field evidence — public vs internal

**User Guide**

- In the **Field app** workspace, pasted/uploaded field photos are stored under **Field Evidence**. Each row has **Show client? Yes/No**, an optional **caption**, and a badge (Client vs Internal).
- **Default visibility:** With **Public export** selected in the Dictation Hub channel bar, new pastes default to **client-visible**. With **Inter-Office Comms** selected, new pastes default to **internal** (not shown on Proof of Service).
- **Dispatcher override:** On the service ticket form, **Field evidence — client visibility** lists each field photo with **Show on Proof of Service?** so the office can flip a photo internal before **Send verification to client**.

**Technical Specs**

- `evidencePhotoUrls`: array of `{ url: string, isPublic: boolean, caption: string }`; legacy string URLs normalize to **public** in `VCClientPortal.normalizeEvidencePhotoArray`.
- `technician/index.html` — paste pipeline, `persistFieldEvidencePhotoUrlToFirestore` (`arrayUnion` object), `updateFieldEvidenceFirestoreAtIndex` (transaction), `renderWorkspaceFieldEvidence`.
- `technician/js/workspace_ui.js` — `getFieldEvidenceDefaultIsPublic()` reads `#dictationChannelInternal` active state.
- `shared/client_portal_logic.js` — `normalizeEvidenceEntry`, `normalizeEvidencePhotoArray`, `filterPublicEvidencePhotoUrls`.
- `service_call.js` — `renderDispatcherFieldEvidenceOverrides`, `persistDispatcherEvidenceOverride` (Firestore + local cache sync).

#### Custom Report Studio (dispatcher)

**User Guide**

- Sidebar: **Reports** → **Custom Report Studio** — set **From** / **To**, optional **Ticket IDs** (comma-separated; leave blank for all tickets in range), choose **blocks**, then **Generate & print**. A new window opens with printable HTML; use the browser **Print** dialog → **Save as PDF**.

**Technical Specs**

- `dispatcher/js/report_builder.js` (`VcReportStudio`), `#view-report-studio` in `index.html`.
- Loads `VCFirestore.loadServiceCallsMergedOnce`, filters by `date` and optional IDs; optional blocks: job details, public-facing notes (issue / `techNotes` / `clientPortalMemo`), equipment + `getSiteIntelDocOnceBridged` for the hashed site key, `filterPublicEvidencePhotoUrls` for photos, labor hours via `labor_logs` IN/OUT pairs with `ticketId` on IN.

### Visual analytics & “gold standard” reporting (Phase 17)

#### Executive Insights — charts

**User Guide**

- From **Reports** → **Executive Insights**, charts include a **Revenue mix** pie (billable dollars by pillar / job type) and a **Labor efficiency** bar chart for the **last 30 days**: quoted billable hours vs. clocked labor hours per pillar, so managers can spot bleed.
- Default billable rate for dollar estimates matches the **Default billable rate ($/hr)** field on the same view (stored in `localStorage`).

**Technical Specs**

- Chart.js (CDN) in root `index.html`; canvases `#insightsChartPie`, `#insightsChartBar` in `#view-insights`.
- `dispatcher/js/insights_manager.js` — `laborSnap30` query for last-30-day labor; `destroyInsightsCharts` on refresh.

#### Custom Report Studio & print

**User Guide**

- **Generate & print** opens a window with **branded header**, optional **summary charts** (same mix + labor bars for the report’s ticket slice), and per-ticket **site health** (rolling trend line + meter) when the **Site intel** block is included.

**Technical Specs**

- `dispatcher/js/report_builder.js` — embeds Chart.js + `dispatcher/css/report_builder.css`, JSON `chartPayload` for inline chart script after load.
- `dispatcher/css/report_builder.css` — Inter/Roboto, meter styles, `@media print` (margins, `print-color-adjust`, avoid breaks inside chart cards).

#### Proof of Service — site trend

**User Guide**

- **Proof of Service** shows a **Site service trend** card: rolling months of service-call counts for this customer + address and a small **activity** meter.

**Technical Specs**

- `proof_of_service.html` — Chart.js, `paintSiteTrendChart()` after ticket render; uses `loadServiceCallsMergedOnce` + same site key as intel.

---

## Build History

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

## Current Focus

- Next: production Firestore rules for `portal_tokens` (public read + controlled approval write) and `labor_logs`; optional short URL / custom domain for `proof_of_service.html`; optional composite Firestore index if `labor_logs` range queries require it at scale; validate print/PDF chart timing across browsers; field-test Firestore persistence across Safari/Chrome on iOS/Android.
