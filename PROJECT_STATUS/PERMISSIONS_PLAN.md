# Vertex Core — Permissions & Role Plan

> **Purpose:** Single source of truth for roles, capability IDs, preset bundles, and Firestore enforcement scope.
> Read this file **before** implementing any role-gating, Manage Admins UI, or per-user permission surface.
>
> **Authority:** Supersedes informal role notes in chat. When code ships against this spec, update the relevant rows.
> **Companion docs:** `DECISIONS.md → ADR-015` (auth architecture), `MODEL_DOSSIER.md` (model picks per task type).

---

## Two-layer permission model

```
Layer 1: TENANT ENTITLEMENTS  (what the org is allowed to use — plan + feature catalog)
         → shared/entitlements.js · FEATURE_CATALOG · tenants/{tid}/config/entitlements
         → Firestore-enforced writes via isAdmin(tid)

Layer 2: USER ACCESS          (what a specific person can do within the tenant's allowed set)
         → role field + permissionTags[] on tenants/{tid}/users/{docId}
         → VCAuth.isAdmin() for privileged writes
         → UI gating via hasCapability(tag) helper (to be built)
```

A user can never access more than the **tenant ceiling**. A premium feature disabled at the tenant level is invisible regardless of any user's role or tags.

---

## Roles

Six named roles stored in `role` field on the user's roster doc. Roles drive the **default tag bundle** on creation. Tags can be individually added or removed afterward (UniFiX-style composable access).

| Role ID | Display name | Description |
|---------|--------------|-------------|
| `administrator` | Administrator | Tenant config, admin grants, per-user overrides, full app access. Small set — typically owner / office manager. |
| `dispatcher` | Dispatcher | Schedule, assign, reassign, service calls, quoting, invoicing, customer directory. Primary ops role. |
| `csr` | CSR | Customer intake, booking, service call creation, quoting. Customer-first ops. No bulk dispatch reassignment by default. |
| `lead_tech` | Lead Tech | Field workspace, full job documentation, site intel, parts/quote on-job. Can view assigned jobs in dispatcher view. |
| `helper` | Helper | Simplified field flows for assigned jobs. No arbitrary customer access, no final sign-off unless toggled on. |
| `payroll` | Payroll | Time & attendance records, exports. No dispatch or service call edits. |

> **One person, multiple hats:** Store the **primary** role in `role`; add individual capability tags for exceptions (e.g., a dispatcher who also runs payroll exports gets `role: dispatcher` + `payroll_export` tag).

---

## Capability tag catalog

### A. Operations — core app surfaces

| Tag ID | Display name | Default for roles | Enforcement |
|--------|--------------|-------------------|-------------|
| `service_view` | Service / Dispatch — view | administrator, dispatcher, csr, lead_tech | UI only |
| `service_assign` | Service — assign / reassign jobs | administrator, dispatcher | UI only |
| `service_edit` | Service — create / edit service calls | administrator, dispatcher, csr | UI only |
| `quoting_use` | Quoting Tool | administrator, dispatcher, csr | UI + tenant entitlement check |
| `invoicing_use` | Invoicing | administrator, dispatcher | UI + tenant entitlement check |
| `invoicing_archive` | Invoice Archive | administrator, dispatcher | UI + tenant entitlement check |
| `customer_directory` | Customer Directory | administrator, dispatcher, csr | UI + tenant entitlement check |

### B. Field app surfaces

| Tag ID | Display name | Default for roles | Enforcement |
|--------|--------------|-------------------|-------------|
| `field_workspace` | Field Workspace (own jobs) | administrator, lead_tech, helper | UI only |
| `field_workspace_any` | Field Workspace (any job — shadow / coaching) | administrator | UI only |
| `field_office_override` | Field App — Office Override | administrator | UI + tenant entitlement check |

### C. Premium / feature-gated surfaces

> These tags are **also** gated by tenant entitlement (`vcHasFeature(id)`). Both must be true for the surface to show.

| Tag ID | Maps to feature ID | Display name | Default for roles | Enforcement |
|--------|--------------------|--------------|-------------------|-------------|
| `pulse_use` | `interOfficeFeed` | Inter-Office Feed (Pulse) | administrator, dispatcher | UI + tenant entitlement |
| `ai_reviewer_use` | `aiReportReviewer` | AI Report Reviewer | administrator, dispatcher, lead_tech | UI + tenant entitlement |
| `insights_view` | `executiveInsights` | Executive Insights & Revenue | administrator | UI + tenant entitlement |
| `report_studio_use` | `customReportStudio` | Custom Report Studio | administrator, dispatcher | UI + tenant entitlement |
| `shadow_mode_use` | `shadowMode` | Shadow Mode (read-only mirror) | administrator | UI + tenant entitlement |
| `site_history_view` | `siteHistory` | Site History (Customer Directory) | administrator, dispatcher, csr | UI + tenant entitlement |

### D. Payroll / time

| Tag ID | Display name | Default for roles | Enforcement |
|--------|--------------|-------------------|-------------|
| `payroll_time_view` | Time & Attendance — view | administrator, payroll | UI only |
| `payroll_export` | Payroll Export | administrator, payroll | UI only (Firestore-enforce when export writes land) |

### E. Admin / settings surfaces

| Tag ID | Display name | Default for roles | Enforcement |
|--------|--------------|-------------------|-------------|
| `settings_view` | System Settings — view | administrator, dispatcher | UI only |
| `settings_entitlements_admin` | Plan & Feature Entitlements | administrator | **Firestore-enforced** — `isAdmin(tid)` in rules |
| `settings_user_overrides_admin` | Per-User Feature Overrides | administrator | **Firestore-enforced** — `VCAuth.requireAdmin` + `isPinUnlocked` |
| `settings_admins_admin` | Manage Administrators | administrator | **Firestore-enforced** — `isAdmin(tid)` (Manage Admins UI, not yet built) |

---

## Preset bundles (role → default tags)

When a user is created or their role is set, apply this bundle. Tags can be individually adjusted afterward.

### Administrator
All tags in catalog, including all **E** (admin/settings) tags.
No tenant entitlement override needed — Administrator sees everything the tenant plan unlocks.

### Dispatcher
```
service_view, service_assign, service_edit,
quoting_use, invoicing_use, invoicing_archive,
customer_directory, site_history_view,
pulse_use, ai_reviewer_use, report_studio_use,
shadow_mode_use,
field_workspace_any,
settings_view,
payroll_time_view
```
*(Premium tags visible only if tenant entitlement is also on)*

### CSR
```
service_view, service_edit,
quoting_use,
customer_directory, site_history_view,
ai_reviewer_use,
settings_view
```

### Lead Tech
```
service_view,
field_workspace,
ai_reviewer_use,
site_history_view
```

### Helper
```
service_view,
field_workspace
```

### Payroll
```
payroll_time_view, payroll_export
```

---

## Firestore enforcement matrix

| What is protected | Current rule | Tag that drives it | Status |
|-------------------|--------------|-------------------|--------|
| `tenants/{tid}/config/entitlements` write | `isAdmin(tid)` | `settings_entitlements_admin` | ✅ Deployed (Slice 1) |
| `tenants/{tid}/admins/{doc}` write | `isAdmin(tid)` | `settings_admins_admin` | ✅ Deployed (Slice 1) |
| `tenants/{tid}/users/{uid}.featureOverrides` write | `isAdmin(tid)` | `settings_user_overrides_admin` | ✅ Deployed (Slice 1) |
| `tenants/{tid}/users/{uid}.role` write | *(not yet locked)* | `settings_admins_admin` | 🔲 Add when Manage Admins UI ships |
| `tenants/{tid}/users/{uid}.permissionTags` write | *(not yet locked)* | `settings_admins_admin` | 🔲 Add when Manage Admins UI ships |
| Payroll export (if/when Firestore write) | *(not yet)* | `payroll_export` | 🔲 Add when export feature lands |

---

## `hasCapability()` runtime helper (to build)

```js
// shared/permissions.js  — thin wrapper, to be added
// Checks: (1) user has the tag in permissionTags[] OR role preset includes it
//         (2) for premium tags, also checks vcHasFeature(featureId)
// Returns: boolean
window.hasCapability = function(tagId, userProfile) { ... }
```

Call sites replace scattered `if (role === 'dispatcher')` checks with `if (hasCapability('service_assign'))`.

---

## Implementation order (suggested slices)

| # | Slice | Scope | Recommended model |
|---|-------|-------|------------------|
| 1 | **Manage Admins UI** | Settings panel to grant/revoke `isAdmin` on roster docs; no new Firestore rules needed | **Sonnet 4.6** |
| 2 | **`permissionTags[]` on user docs + `role` field** | Schema: write tags on save in Manage Admins UI; no UI gating yet | **Sonnet 4.6** |
| 3 | **`shared/permissions.js` + `hasCapability()`** | Resolver + localStorage cache; no call-site swaps yet | **Sonnet 4.6** |
| 4 | **Firestore rules: lock `role` + `permissionTags` writes** | Rules parity for new fields | **Opus 4.6** |
| 5 | **Call-site gating** | Hide/show nav items and action buttons by capability; per-user override integration | **Sonnet 4.6** |
| 6 | **Audit log** (Slice 5 / standalone admin) | Record who changed what, when | **Opus 4.6** |

---

## Decisions (locked 2026-05-07)

| # | Question | Decision |
|---|----------|----------|
| 1 | CSR vs Dispatcher app mode | **Same `index.html` shell with hidden elements.** No separate CSR shell until usage data shows a clear need. |
| 2 | Helper ticket scope | **Assigned-only.** Helper can only open tickets they are explicitly assigned to; broader access requires an explicit tag override. |
| 3 | Payroll tab location | **Deferred / TBD.** Do not add a payroll tab to the dispatcher shell yet. Revisit when the export feature is scoped — likely lands in a future `admin/index.html` (Slice 6). |
| 4 | `permissionTags` storage format | **Array** — `permissionTags: ["service_assign", "quoting_use", …]`. Firestore `array-contains` rules work cleanly; JS uses `Array.includes()`. |
