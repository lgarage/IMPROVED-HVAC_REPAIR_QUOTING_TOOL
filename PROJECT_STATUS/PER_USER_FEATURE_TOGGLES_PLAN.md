# Per-User Feature Toggles — Slice Plan (Slices 2–5)

> **AI read protocol:** fetched by the `📋` pointer in `CURRENT_STATE.md → Immediate Next Step`.
> Read this file **before** composing §6B. Delete when all slices ship; add a one-liner to `PROJECT_MAP.md → Build History`.
>
> **Design authority:** `DECISIONS.md → ADR-015` (architectural decisions, rationale, alternatives).
> This file is the **implementation spec** — schema, pseudocode, file tasks per slice.

---

## Prerequisites

- **Slice 1 must be deployed before Slices 2–4 will work end-to-end.**
  1. Add your verified Firebase Auth admin email to **both**:
     - `shared/config.js` → `APP_CONFIG.bootstrapAdminEmails: ["your@email.com"]`
     - `firestore.rules` → `isBootstrapAdmin()` → `email in ["your@email.com"]`
  2. Create the user in Firebase Console → Authentication → Add user. Verify the email.
  3. `firebase deploy --only firestore:rules`
- Slices 2–4 touch **no** `shared/firebase_logic.js` so `FIREBASE_LOGIC_VERSION` stays at 2 (no KI-002 Plan B1 lockstep).
- Tenant id is `USA_HEATING_COOLING` (default); `VCFirestore.getTenantId()` resolves it everywhere.

---

## Data shape

`featureOverrides` map lives on the existing `tenants/{tid}/users/{docId}` doc:

```js
// tenants/{tid}/users/{docId}  (merged onto existing fields — no migration needed)
{
  // ...existing fields (payrollNameUpper, role, isAdmin, timeTrackingOnly, etc.)...
  featureOverrides: {
    // key = featureId from FEATURE_CATALOG in shared/entitlements.js
    // value: true  = force ON for this user (subject to tenant ceiling)
    //        false = force OFF for this user (even if tenant has it enabled)
    // absent key  = inherit from tenant entitlement + role defaults
    aiReportReviewer: false,   // example: disabled for this one user
    // quotingTool: true,      // example: forced on
  },
  featureOverridesUpdatedAt: <serverTimestamp>,
  featureOverridesUpdatedBy: "<adminUid>",
}
```

**Firestore path** the write helper uses:
`tenants/{tid}/users/{docId}` via `VCFirestore.tenantUsers(db).doc(docId).set({ featureOverrides, featureOverridesUpdatedAt, featureOverridesUpdatedBy }, { merge: true })`

---

## Algorithm / Resolver

`VCUserEntitlements.has(featureId, userProfile)` — precedence top to bottom, first match wins:

```
1. if tenant doesn't have the feature → return false  (tenant is ceiling; VCEntitlements.has(featureId))
2. if userProfile.role === "time_tracking_only" AND feature is tier:"premium" → return false  (role hard-jail)
3. if userProfile.featureOverrides has featureId key → return !!userProfile.featureOverrides[featureId]
4. return VCEntitlements.has(featureId)  (fall through to tenant default)
```

Event: emit `vc:user-entitlements-changed` on the window (same pattern as `vc:entitlements-changed`)
Cache key: `vc_user_entitlements_cache_v1` in localStorage, keyed by `{tenantId}:{uid or payrollNameUpper}`

---

## Slices remaining

### Slice 2 — Data shape + resolver

- **Scope:** New `shared/user_entitlements.js` (`VCUserEntitlements` module); no UI, no call-site changes yet.
- **Files to touch:**
  - `shared/user_entitlements.js` — NEW. Implements resolver + localStorage cold-boot cache + `vc:user-entitlements-changed` event.
  - `index.html` — add `<script src="shared/user_entitlements.js?v=1">` after `shared/entitlements.js?v=1`. Bump `VC_BUILD`.
  - `technician/index.html` — add same `<script>` include (field app also needs the resolver for Slice 4+).
- **Cache-busts:** `shared/user_entitlements.js?v=1` (new), `VC_BUILD = "Slice2-UserEntitlements-<date>"`
- **Recommended model:** **Sonnet 4.6** — T2 standard dev, no Firestore rule changes, no new auth path, pure JS module mirroring `shared/entitlements.js` pattern.
- **Confidence:** ~82%
- **Out of scope:** No UI, no write path, no call-site swaps. Module is wired but nothing calls it yet.

---

### Slice 3 — Per-user toggle UI in dispatcher Settings

- **Scope:** Add a "👤 Per-User Feature Access" subsection inside the existing dispatcher Settings admin disclosure (`#vcAdminForm` / `#vcAdminTools`), below the existing "Plan & Feature Entitlements" block. Admin must be signed in via `VCAuth` **and** have the PIN unlocked to save.
- **Files to touch:**
  - `index.html` — HTML for the new subsection + inline JS controller. Bump `VC_BUILD` + `shared/config.js?v=7` stays, no bump needed there.
  - `settings.js` — if the entitlements save logic lives there, add `saveUserFeatureOverrides(db, userDocId, patch)` helper (mirrors `VCEntitlements.savePatch`). Otherwise keep controller inline in `index.html`.
- **UI elements needed:**
  - Search input → queries `tenants/{tid}/users` by `payrollNameUpper` (contains, case-insensitive) or `emailLower` (exact). Limit 10 results. Show name + role pill.
  - Selected user panel: name, role, email.
  - Feature grid: one row per `VCEntitlements.getFeatureCatalog()` entry. Three-state radio: `Inherit` (key absent) | `Force ON` | `Force OFF`. Disable the row + show hint if tenant doesn't have the feature.
  - Save button: calls `VCFirestore.tenantUsers(db).doc(selectedDocId).set({ featureOverrides, featureOverridesUpdatedAt: serverTimestamp, featureOverridesUpdatedBy: auth.currentUser.uid }, { merge: true })`. Guards: `VCAuth.requireAdmin("saveUserFeatureOverrides")` + `VCAuth.isPinUnlocked()`.
  - Sign-in card: if `VCAuth.isAdmin()` is false, show email + password inputs + "Sign in" button inside the admin disclosure (visible alongside / above the PIN block). On success `VCAuth.signIn(email, pwd)`; card hides on `VCAuth.onReady` when `isAdmin === true`.
- **Cache-busts:** `settings.js?vX→vX+1` if touched; `VC_BUILD = "Slice3-UserToggleUI-<date>"`
- **Recommended model:** **Sonnet 4.6** — T2 UI + write helper. No new Firestore paths, no rule changes. Auth write already guarded by rules from Slice 1.
- **Confidence:** ~78%
- **Out of scope:** No call-site changes — the toggle UI saves to Firestore but nothing reads `featureOverrides` yet (that's Slice 4).

---

### Slice 4 — Gate one feature end-to-end (proof-of-concept)

- **Scope:** Replace `vcHasFeature("aiReportReviewer")` call sites in the dispatcher with `VCUserEntitlements.has("aiReportReviewer", currentUserProfile)`. Verify: tenant Pro + user override OFF → no AI Reviewer; toggle ON → appears live without reload.
- **Files to touch (grep first):**
  - Run `rg 'vcHasFeature\("aiReportReviewer"\)'` to find all call sites. Expected: `index.html` (sidebar nav show/hide + view render), `dispatcher/js/ai_report_reviewer.js` (init guard).
  - Each call site: replace with `VCUserEntitlements.has("aiReportReviewer", VCAuth.currentProfile())`.
  - Wire `vc:user-entitlements-changed` listener to re-run the same show/hide logic (mirror how `vc:entitlements-changed` is handled today for `interOfficeFeed`).
- **Cache-busts:** `ai_report_reviewer.js?vX→vX+1` if touched; `VC_BUILD = "Slice4-UserGate-aiReviewer-<date>"`
- **Recommended model:** **Sonnet 4.6** — T2, targeted call-site swap + event listener. No new files, no new Firestore writes.
- **Confidence:** ~80%
- **Out of scope:** Only `aiReportReviewer` is gated. All other `vcHasFeature(...)` calls stay as-is for now.

---

### Slice 5 — Standalone `/admin` page (post-MVP, not urgent)

- **Scope:** Lift the per-user toggle UI into a new `admin/index.html` page (separate URL, same Firebase project). Add audit log at `tenants/{tid}/audit/featureToggles/{autoId}`. Broaden coverage to all `FEATURE_CATALOG` features.
- **Files to touch:** `admin/index.html` (NEW), `admin/admin.js` (NEW), `firestore.rules` (add `tenants/{tid}/audit/featureToggles/{document=**}` — write = admin, read = admin).
- **Cache-busts:** new files get `?v=1`; `firestore.rules` deploy required; `VC_BUILD` on `index.html`.
- **Recommended model:** **Opus 4.7** — new page + new Firestore path = Vertex Core T3. Re-gate before starting.
- **Confidence:** ~65% (scoped loosely; re-assess at gate time)
- **Out of scope:** No Cloud Functions, no custom claims, no cross-tenant super-admin view.

---

## Invariants (every slice must not break these)

- `vcHasFeature(featureId)` global still works unchanged — it reads tenant entitlements only; Slices 2–4 add a new resolver on top, they do not replace the existing one.
- The dispatcher PIN gate (`sessionStorage.vc_admin_unlocked` + `APP_CONFIG.adminUnlockPin`) must remain functional for users who have not yet signed in via Firebase Auth.
- `shared/firebase_logic.js` is NOT touched in Slices 2–4 → `FIREBASE_LOGIC_VERSION` stays 2 → no KI-002 Plan B1 lockstep required.
- `proof_of_service.html` and the field app (`technician/index.html`) continue to load without requiring Auth sign-in.
- Every Slice must bump `VC_BUILD` and the `?v=N` of any touched external file per `.cursorrules §5`.
- Bootstrap email list must stay in sync across `shared/config.js → APP_CONFIG.bootstrapAdminEmails` AND `firestore.rules → isBootstrapAdmin()`.
