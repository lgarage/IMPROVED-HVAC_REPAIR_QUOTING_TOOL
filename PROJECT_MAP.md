# Vertex-Core Project Map

## System Overview

- **Tenant Architecture:** `tenants/{tenantId}/` (Isolated)
- **Roles:** Admin, Tech, Sales, Time-Tracking Only.
- **Data Bridge:** Lazy migration from Root to Tenant paths.

## Manual — Functional Inventory

Audited snapshot of what is **implemented and wired today**. Each feature lists **User Guide** (how to use it) and **Technical Specs** (paths, data, hooks).

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

- Sidebar: **Inter-Office Feed** opens the Pulse view (`#view-pulse`).
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
- **Time-tracking-only** users get a banner and restricted UI (no premium dictation hub, equipment hub, PM section, etc.).

**Technical Specs**

- `technician/js/vc_entitlements.js`: loads `tenants/{tenantId}/users` by `payrollNameUpper`; sets `global.VC_SANDBOX_DATA = true` when `isTrainingAccount === true`; sets `localStorage` `vc_time_tracking_only` when `timeTrackingOnly === true`.
- `shared/firebase_logic.js`: when `VC_SANDBOX_DATA === true`, `isSandboxDataPath()` routes to `tenants/{tenantId}/sandbox/default/{collection}` instead of the live tenant subcollections.

---

### User Roles

Definitions live in `shared/config.js` as **`VC_ROLE_DEFINITIONS`**: `admin`, `tech`, `sales`, `time_tracking_only` (Lite / yellow seat).

#### Admin

**User Guide**

- **Dispatcher office app:** “Admin” access to **tenant branding / PIN-protected admin block** is via **PIN unlock** (`sessionStorage` `vc_admin_unlocked`), not automatically tied to the `isAdmin` field on a user row.
- Unlocked admins can edit tenant id, brand colors, logo, **Enterprise Data Onboarding** (import wizard), and related controls in the **Admin** disclosure.

**Technical Specs**

- PIN: `APP_CONFIG.adminUnlockPin` (default in `shared/config.js`); UI `#vcAdminUnlockBtn`, `#vcAdminForm`.
- User CSV import stores `isAdmin` on `tenants/{tenantId}/users/{docId}` (`dispatcher/js/user_import.js`) for enterprise directory / future enforcement.

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

- Banner: **Time tracking seat** — AI dictation, advanced reporting, and premium Field tools disabled.
- Dictation Hub and Equipment Hub are unusable; **Work Order Forms** accordion is hidden; PM accordion hidden.

**Technical Specs**

- `applyTimeTrackingOnlyUi` in `vc_entitlements.js`; flag `timeTrackingOnly` on user doc; `localStorage` `vc_time_tracking_only`.

---

## Build History

- [v] Phase 10: Tenant Isolation & Branding
- [v] Phase 11: Terminology Pivot (Inter-Office Comms) & Data Bridge
- [v] Phase 12: Enterprise Data Importer (BuildOps Mapping)

## Current Focus

- Phase 13: Lite Seat Time-Tracking & Payroll Export
