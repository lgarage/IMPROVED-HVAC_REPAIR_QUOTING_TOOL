# Vertex Core — Project Context for AI Assistants

This document gives **full architectural context** for the repository **IMPROVED-HVAC_REPAIR_QUOTING_TOOL** (product name: **Vertex Core**; legacy UI name "Twin Pillars" is retired — do not use it in new code or docs). Use it to onboard another AI or developer in a new conversation without re-reading the entire codebase.

> **Tier 2 (cold) — first-time onboarding only, or major architectural shift.** Treat as historical context; **current naming conventions and feature locations live in `PROJECT_MAP.md`**, not here. Read protocol in `.cursorrules` §1A.

---

## 1. What This Program Is

A **multi-surface static web application** for an **HVAC field service and office workflow**:

- **Office / dispatcher** (`index.html` at repo root): quoting, invoicing, inventory, technician roster, settings, integrations (Maps, Gemini API key stored in Firestore), and dynamic form templates.
- **Field technician PWA** (`technician/index.html`): mobile-first **schedule**, **workspace** per job ticket, **dictation-first** notes, **asset-centric equipment** tracking tied to Firestore, optional **Gemini** for dictation mapping, plate OCR, and location/parts parsing.

There is **no traditional backend server** in this repo: logic runs in the browser; **Firebase** (Firestore, Storage, Hosting) and **Google APIs** (Maps, Generative Language / Gemini) provide persistence and AI.

---

## 2. Tech Stack

| Layer | Technology |
|--------|------------|
| UI | HTML, CSS, vanilla JavaScript (no React/Vue in core flows) |
| Hosting | Firebase Hosting (`firebase.json` — static site from repo root) |
| Data | Cloud Firestore, Firebase Storage |
| Auth / config | Firebase JS SDK (compat), `firebase-config.js` |
| AI | Google Gemini via `generativelanguage.googleapis.com` REST (`generateContent`) |
| OCR | Tesseract.js (local nameplate OCR in some flows); Gemini Vision for equipment data plate in `equipment_manager.js` |

**Important:** The **Gemini API key** is **not** hardcoded for production use; it is loaded from Firestore `app_config/api_keys` (and/or office Settings UI) via `getGeminiApiKey()` in `firebase-config.js`.

---

## 3. Repository Layout (High Level)

```
├── index.html                 # Office / dispatcher main app
├── technician/index.html      # Field technician app (PWA)
├── firebase-config.js         # Firebase init, GEMINI_GENERATE_MODEL, getGeminiApiKey()
├── dictation_hub.js           # Dictation Hub: Rosetta mapping, asset tray, lifecycle UI
├── equipment_manager.js       # Equipment profile modal, Gemini vision plate OCR, dictation asset promotion/retire
├── equipment_hub.js           # Legacy path: Customers/Locations/Equipment hub modal (bridge read)
├── field_forms.js             # Dynamic Firestore form templates + Gemini keyword intent
├── quoting.js, invoice.js, service_call.js, customer_directory.js, settings.js, app.js, …
├── shared/
│   ├── auth.js                # VCAuth — Firebase Auth wrapper, isAdmin, isPinUnlocked (Phase 36 Slice 1)
│   ├── entitlements.js        # VCEntitlements — tenant feature-flag platform (Phase 35)
│   ├── user_entitlements.js   # VCUserEntitlements — per-user feature override resolver (Phase 36 Slices 2-4)
│   ├── firebase_logic.js      # Tenant bridge helpers, VCFirestore, VCRequireTicketId, VCSurfaceWriteFailure
│   ├── config.js              # APP_CONFIG, VC_EQUIPMENT_TYPE_PREFIXES, bootstrapAdminEmails
│   └── permissions.js         # (stub — hasCapability() to be built; see PERMISSIONS_PLAN.md)
├── firestore.rules            # Firestore security rules (deployed via firebase CLI)
├── firestore.indexes.json
├── sw.js                      # Service worker (if used for caching)
└── manifest.json              # PWA manifest (references root index; technician app is separate HTML)
```

Script **load order** on the technician page matters: e.g. `equipment_manager.js` **before** `dictation_hub.js` so globals like `dictationPromoteAssetPhoto` exist.

---

## 4. Firebase Data Model (Relevant Pieces)

### 4.1 Asset-centric path (Dictation Hub / legacy bridge)

> **ADR-011 (Phase 33) — canonical write path changed.** New equipment writes target `tenants/{tenantId}/imported_equipment`. The path below is now a **read-time bridge fallback only** — it is still read by `getEquipmentForSiteBridged()` in `shared/firebase_logic.js` but receives no new writes. See `DECISIONS.md → ADR-011`.

Used by `dictation_hub.js` and `equipment_manager.js` (`dictationPromoteAssetPhoto`, `dictationRetireCurrentAsset`):

```
customers/{customerId}/sites/{siteId}/assets/{assetDocId}
```

- **`customerId` / `siteId`**: Derived from **sanitized** strings (slashes → `_`, etc.): typically **customer name** and **full location line** from the job (`#location` or ticket-derived text).
- **Asset document fields** (non-exhaustive):
  - `id` — logical unit id (e.g. `RTU1`, `VH1`); often aligns with `assetDocId`.
  - `type`, `locationDescription`, `lastServiceDate`
  - `manufacturer`, `modelNumber`, `serialNumber`, `voltage`, `phase`, `refrigerant`
  - `images.nameplate.url`, `images.overall.url`
  - `additional_images` — array of `{ url, addedAt }`
  - `awaitingNewEquipment` — `true` after a **retire** clears the slot for a new install

**Retirement archive:**

```
customers/.../assets/{assetDocId}/retired_history/{timestampDocId}
```

Full snapshot of the asset before clear, plus `retiredAt`, `archiveId`. Parent asset is then cleared (specs/images) and marked vacant.

### 4.2 Legacy equipment path (Equipment Hub modal — read bridge only)

`equipment_hub.js` still uses:

```
Customers/{customerId}/Locations/{locationId}/Equipment/{unitDocId}
```

> **ADR-011 (Phase 33):** This path and `customers/.../assets` (§4.1) are now **read-only bridge fallbacks**. All new equipment writes go to `tenants/{tenantId}/imported_equipment` via `getEquipmentForSiteBridged()` in `shared/firebase_logic.js`. Do not write to legacy paths directly. See `DECISIONS.md → ADR-011`.

### 4.3 Other collections

- `service_calls`, `pm_records`, `field_quotes` — job history, linked equipment ids.
- `app_config/*` — technicians roster, API keys, inventory templates, etc.
- `form_templates` — dynamic field forms (`field_forms.js`).

---

## 5. Field App: User-Facing Flow (Technician)

### 5.1 Navigation

- **Schedule / History / Profile** (top nav).
- Opening a job runs **`openWorkspace(ticketId)`** in `technician/index.html`: loads ticket into **workspace**, sets `#location`, mode (PM / Service / Quote), drafts, etc.

### 5.2 Dictation Hub (`dictation_hub.js`)

A **persistent block** at the top of the workspace:

1. **Dictation Hub** — large `#dictationHubNotes` textarea; notes persist per ticket in `localStorage` (`dictationHubNotes_<ticketId>`).
2. **Process notes** — calls **`processVisitNotes`**: Gemini with a **system instruction** (“HVAC Rosetta Stone”): slang → standard codes (VH, EF, UH, RTU, MUA), quantity expansion, JSON output:
   - `identifiedAssetIds`, `locationTransposed`, `visitSummary`
3. **Action tray** — Firestore listener on `customers/.../sites/.../assets`: **unit cards** with states:
   - **VERIFIED (green)** — model, serial, nameplate image, overall image (see `computeVerification`).
   - **INCOMPLETE (white)** — missing any of the above; buttons to capture nameplate/overall.
   - **GHOST (dashed)** — AI listed an id **not** in Firestore; “NEW DISCOVERY”; upload starts **promotion** (camera → Storage → optional plate OCR → `set` merge).
   - **VACANT (dashed, after retire)** — `awaitingNewEquipment`; same dashed look; prompts new install captures.
4. **Site nav strip** — customer, address, ticket (existing `#ws-*` ids).

**Rosetta overlay:** After processing, matching tray cards get `.active-asset`; unmatched ids get **ghost** cards.

**`+ Add Equipment`:** Prompts for unit id, **`set` merge** minimal asset doc → incomplete flow.

### 5.3 Global APIs (window)

| Name | Defined in | Role |
|------|------------|------|
| `processVisitNotes(text)` | `dictation_hub.js` | Gemini Rosetta + UI updates |
| `dictationPromoteAssetPhoto(opts, file)` | `equipment_manager.js` | Upload image; kind `nameplate` \| `overall` \| `additional`; plate OCR for nameplate |
| `dictationRetireCurrentAsset(opts)` | `equipment_manager.js` | Archive to `retired_history`, clear parent |
| `startDictationHubFromWorkspace` | `dictation_hub.js` | Wire UI + subscribe Firestore |
| `teardownDictationHub` | `dictation_hub.js` | Unsubscribe + clear Rosetta when leaving workspace |

### 5.4 Verified unit modal

- **Swipeable gallery** (horizontal, scroll-snap) for **active** photos only — nameplate, overall, additional; **watermark** overlay (site line + `UNIT (Current)`).
- **⚠️ Retire this Equipment** → confirm → `dictationRetireCurrentAsset`.
- **+ Add Photo** → `kind: "additional"` promotion.
- **Retired Equipment** (gray) → second modal listing **`retired_history`**; galleries are **grayscale only** (separate silo from active).

### 5.5 Other technician features (same HTML)

- **`autoParseLocation`**, **`autoParseParts`** — Gemini helpers for location JSON and parts list.
- **Equipment Hub** button — opens `equipment_hub.js` modal (legacy `Customers/.../Equipment`).
- **`equipment_manager.js`** — richer equipment profile modal (dispatcher + field), plate OCR queue (IndexedDB offline), saves to legacy path; also hosts **dictation** Storage paths under `dictation_hub_assets/...`.

---

## 6. Office / Dispatcher App (`index.html`)

- Customer/quote/invoice workflows, **Settings** (Gemini key mask, technicians, inventory templates sync to Firestore).
- Shares **`firebase-config.js`**, similar Gemini patterns in `invoice.js`, `settings.js`, etc.

---

## 7. Gemini Usage (Cross-Cutting)

| Area | File | Purpose |
|------|------|---------|
| Dictation Rosetta | `dictation_hub.js` | Structured JSON from notes; `systemInstruction` + JSON response |
| Plate OCR (dictation path) | `equipment_manager.js` | `callGeminiVision` + `buildDictationPlateOcrPrompt` |
| Plate OCR (equipment modal) | `equipment_manager.js` | `buildPlatePrompt` |
| Form intent | `field_forms.js` | Keyword match vs `form_templates` |
| Invoice assist | `invoice.js` | Parse pasted notes to invoice fields |
| Service call polish | `service_call.js` | “Improve With AI” on issue text |
| Technician | `technician/index.html` | Location extraction, parts array |

Model id: **`GEMINI_GENERATE_MODEL`** (e.g. `gemini-2.5-flash`) in `firebase-config.js`.

---

## 8. Persistence & Offline

- Firestore **persistence** enabled in technician app where configured.
- Draft fields: **`saveDraft`**, `localStorage` keys for workspace.
- Equipment manager **OCR queue** in IndexedDB when offline (`equipment_manager.js`).

---

## 9. Security & Operations Notes

- **Firestore security rules** must allow field roles to read/write the paths your features use (`customers/.../assets`, `retired_history`, Storage prefixes, etc.).
- **API keys** in client bundles are always discoverable; restrict by **API restrictions** in Google Cloud and Firestore rules.
- CI: `.github/workflows` may deploy Hosting on push to `main`.

---

## 10. How to Extend Safely

- **New dictation behavior:** Prefer extending `dictation_hub.js` and the Rosetta `SYSTEM_INSTRUCTION` string; keep JSON schema stable or version it.
- **New asset fields:** Update `computeVerification`, `dictationPromoteAssetPhoto` merge logic, and any modal rendering.
- **Do not break** script order on `technician/index.html` or global names consumed by inline handlers.

---

## 11. Glossary

| Term | Meaning |
|------|---------|
| Rosetta | Slang → standard HVAC unit codes + quantity expansion via Gemini |
| Ghost card | UI card for an AI-identified unit not yet in Firestore |
| Vacant slot | Asset doc exists but was **retired**; cleared for new install |
| Promotion | Camera → Firebase Storage → Firestore merge (+ optional OCR) |
| Vertex Core | Current product name (replaces retired "Twin Pillars" branding). Use this in all new code, docs, and UI copy. |
| Site Intel | Persistent per-location notes, access photos, and Field Access Notes (formerly "Field Bible"). |
| Inter-Office Comms | Internal tech ↔ dispatcher messaging channel. Formerly "Dark Channel." Enforced by `.cursorrules §3`. |
| Shadow Mode | Read-only dispatcher mirror of a tech's active-ticket screen position. |
| Office Override | Dispatcher-controlled editable iframe of the field app for a specific ticket, with tech consent gate (ADR-010). |
| Field Bible / Field Access Notes | The persistent per-location notes textarea inside Site Intel (renamed in Phase 34e). |

---

*Generated for handoff to other AI sessions. Update this file when major architecture or Firestore layouts change.*
