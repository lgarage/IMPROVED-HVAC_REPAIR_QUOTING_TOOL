# Phase 34 — Cross-Session Handoff Notes

> **Temporary file.** Lives only until Phase 34 fully ships. Once Phase 34e ships, this file is deleted and any surviving content folds into `PROJECT_MAP.md → Build History → Phase 34` and `DECISIONS.md → ADR-014`.

## How to use this file

- **If you are working on Phase 34b** in a fresh conversation → read **§1** below FIRST, then proceed with 34b. Do not skip the approval gate.
- **If you are starting Phase 34c (or later)** in a fresh conversation → confirm Phase 34b is shipped (`PROJECT_MAP.md → Build History` should list Phase 34b under `[v]`), then read **§3 / §4 / §5** for whichever phase is next.
- All sessions: read Tier 1 (`.cursorrules` + `CURRENT_STATE.md`) before touching any code, per `.cursorrules §1A`.

---

## Phase 34 — overall status as of 2026-04-27

| Phase | What | Status |
|---|---|---|
| 34a | Form builder schema + UI extension | **SHIPPED** 2026-04-26 (entry in `PROJECT_MAP.md → Build History`) |
| 34b | 9 default seed templates (PIN-gated, idempotent) | **SHIPPED** 2026-04-27 (entry in `PROJECT_MAP.md → Build History`) — see §1.6 below for ship summary |
| 34c | Repair branching in Service Call workflow | **SHIPPED** 2026-04-27 (entry in `PROJECT_MAP.md → Build History`) — see §3.5 below for ship summary |
| 34d | Thermostat labeling prompt at checkout | **NEXT** |
| 34e | Roof access field + docs (PROJECT_MAP, ADR-014, flip CURRENT_STATE) | After 34d |

**Cache-bust state at end of Phase 34a:**
- `index.html` → `settings.js?v=16`, `VC_BUILD = "Phase34a-2026-04-26"`
- `technician/index.html` → `field_forms.js?v=2`, `VC_BUILD = "Phase34a-2026-04-26"`

**Phase 34a schema additions on `form_templates/{id}` (additive, zero breakage):**
```
formCategory:        "general" | "service_call" | "pm_checklist" | "quote" | "repair_checklist" | "warranty"
assignedJobTypes:    string[]  any of: "service" | "pm" | "quote"
assignedRepairTypes: string[]  any of: "supply_fan" | "condenser_fan" | "gas_valve" | "compressor" | "refrigerant_leak" | "other"
isDefault:           boolean
sortIndex:           number
```
**Phase 34a new field type:** `toggle` (Yes/No slider, persists same as checkbox → `"yes"` / `"no"`).
**Phase 34a new helpers exposed on `window`:** `getTemplatesByJobType(jobType)`, `getTemplatesByRepairType(repairType)`. Both filter `active !== false` and sort by `sortIndex` then `templateName`.

---

# §1 — Phase 34b: APPROVAL GATE (read first if doing 34b)

> **Hard rule:** Do NOT write `shared/repair_form_seeds.js` until the user has approved the question sets.

The 9 templates that need drafting before any code is written:

1. **Service Call form** — `formCategory: service_call`, `assignedJobTypes: ["service"]`, `isDefault: true`, `sortIndex: 10`
2. **Additional Diagnostic form** — `formCategory: service_call`, `assignedJobTypes: ["service"]`, `isDefault: false`, `sortIndex: 20`
3. **Quoted Repair form** — `formCategory: quote`, `assignedJobTypes: ["quote"]`, `isDefault: true`, `sortIndex: 30`
4. **Warranty Repair form** — `formCategory: service_call`, `assignedJobTypes: ["service"]`, `isDefault: false`, `sortIndex: 40`
5. **Supply Fan Replacement** — `formCategory: repair_checklist`, `assignedJobTypes: ["service"]`, `assignedRepairTypes: ["supply_fan"]`, `sortIndex: 50`
6. **Condenser Fan Replacement** — `formCategory: repair_checklist`, `assignedJobTypes: ["service"]`, `assignedRepairTypes: ["condenser_fan"]`, `sortIndex: 60`
7. **Gas Valve Replacement** — `formCategory: repair_checklist`, `assignedJobTypes: ["service"]`, `assignedRepairTypes: ["gas_valve"]`, `sortIndex: 70`
8. **Compressor Replacement** — `formCategory: repair_checklist`, `assignedJobTypes: ["service"]`, `assignedRepairTypes: ["compressor"]`, `sortIndex: 80`
9. **Refrigerant Leak Repair** — `formCategory: repair_checklist`, `assignedJobTypes: ["service"]`, `assignedRepairTypes: ["refrigerant_leak"]`, `sortIndex: 90`

### Step 1 — DRAFT and surface for approval (no code yet)

For each template, surface to the user:
- `templateName`
- `targetKeyword` (single distinctive word/phrase Gemini can match in tech notes)
- `formCategory` + `assignedJobTypes` + `assignedRepairTypes` + `isDefault` + `sortIndex`
- The full `fields[]` array — each with `name`, `label`, `type`, `required`, `options[]` (when type is `dropdown` or `multi_check`)

**Field types available:** `text` | `number` | `photo` | `checkbox` | `toggle` | `dropdown` (needs `options[]`) | `multi_check` (needs `options[]`). Also `text` with `group: "belt"` or `group: "filter"` for PM-style hidden-on-direct-drive behavior — not expected to be used in these 9 templates.

**HVAC-domain guidance for the question sets:**
- **Service Call form** — symptom captured, equipment found, electrical / refrigerant / mechanical readings, root cause, action taken, customer signed-off (toggle).
- **Additional Diagnostic** — secondary unit number, additional findings, time spent on extra diagnostic, photo of related component.
- **Quoted Repair** — scope of work, parts list (textarea), labor hours, urgency dropdown, customer authorization toggle, photos of damage.
- **Warranty Repair** — manufacturer, model, serial, original-install date, warranty start date, claim # (text), parts under warranty (multi_check), failure mode dropdown, evidence photos.
- **Supply Fan Replacement** — old motor HP/RPM, new motor HP/RPM, sheave size, belt size, amp draw before/after, rotation verified (toggle), vibration check, install date, photo of new install.
- **Condenser Fan Replacement** — old fan blade pitch, new fan blade pitch, motor HP, capacitor µF, amp draw before/after, rotation verified (toggle), photos.
- **Gas Valve Replacement** — manifold pressure before/after, gas type (NG/LP), leak test (toggle), BTU/hr verified (toggle), model/serial of new valve, ignition test (toggle), photo of new valve installed.
- **Compressor Replacement** — refrigerant type (R-410A/R-22/R-454B/R-32), recovered amount lbs, charge added lbs, oil added oz, brazing leak test (toggle), evacuation pulled to (microns), startup amps, superheat / subcool readings, photos of nameplate + install.
- **Refrigerant Leak Repair** — leak location, leak detection method (electronic/UV/bubble/N2 pressure), repair method (braze/replace component/tighten flare), pressure-tested to (psi), recovered lbs, recharged lbs, EPA tech cert # (text), photos.

### Step 2 — Implement (only after user approval)

**New file: `shared/repair_form_seeds.js`**
- IIFE on `window`, namespaced as `window.VCFormSeeds`.
- Constant `SEED_AT = "<today ISO 8601>"` baked into the file. Bump it manually only when the seed contents change.
- `window.VCFormSeeds.SEED_TEMPLATES = [{ id, doc }, ...]` with stable ids:
  ```
  seed_service_call_form
  seed_additional_diagnostic_form
  seed_quoted_repair_form
  seed_warranty_repair_form
  seed_supply_fan_replacement
  seed_condenser_fan_replacement
  seed_gas_valve_replacement
  seed_compressor_replacement
  seed_refrigerant_leak_repair
  ```
- `window.VCFormSeeds.seedDefaultFormTemplates()` — async, returns `{ created, updated, skipped, errors }`.

**Idempotency rule (CRITICAL):**
For each seed:
1. Read `form_templates/{id}`.
2. If doc does NOT exist → create with full payload + `seedAt: SEED_AT` + `updatedAt: serverTimestamp()` → counts as `created`.
3. If doc exists AND `doc.updatedAt > SEED_AT` → skip (user has modified locally; never clobber) → counts as `skipped`.
4. If doc exists AND `doc.updatedAt <= SEED_AT` (or no `updatedAt`) → `set(..., {merge: true})`, refreshing seed-owned fields only → counts as `updated`.

Use `writeBatch` only if total writes >5 (per `.cursorrules §5`).

Each seeded payload must include:
```
templateName, targetKeyword, active: true, fields[],
formCategory, assignedJobTypes, assignedRepairTypes, isDefault, sortIndex,
seedAt: SEED_AT,
seedSource: "phase34b",
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
```

**Admin button placement:**
- In `index.html`, inside `#fieldFormBuilderSection` (around line 5305), add a new button **"🌱 Seed default form templates (admin)"** next to the existing **"+ Create New Template"** button. Style: secondary (e.g., `background: #64748b`).

**PIN gate:**
- Find the existing dispatcher admin PIN pattern (`grep` for `PIN` / `promptForPin` / `adminPin` / similar in `settings.js` + `index.html`). REUSE it; do not invent a new gate. If no existing pattern surfaces, ask the user which gate to use.
- Wire button → PIN prompt → on success → call `seedDefaultFormTemplates()` → show result toast like `"Seeded N templates (created C, updated U, skipped S)"` via the existing `showSaveCue()` helper.
- After seed completes, call `hydrateFieldFormTemplatesList()` to refresh the dispatcher list in place.

**Cache-bust + VC_BUILD discipline (per `.cursorrules §5`):**
- `shared/repair_form_seeds.js?v=1` (new file → first version)
- `settings.js?v=17` (was `v=16`; bump because the admin button handler will live there or be wired from there)
- `index.html`: `VC_BUILD = "Phase34b-<today>"` (bump from `"Phase34a-2026-04-26"`)
- `technician/index.html`: NO touch in 34b (Phase 34b is dispatcher-only)

**Non-goals for 34b:**
- No drag-and-drop reorder (34a shipped up/down arrows only — do not extend).
- No tenant scoping of `form_templates` (deferred to ADR-014 in 34e).
- No new field types beyond what 34a already added.
- No changes to `renderDynamicForm` or `saveCurrentFieldForm` in `field_forms.js`.
- No 34c/d/e work in this phase.
- No technician-app changes.

---

## §1.5 — In-flight v2 draft (PAUSED 2026-04-26 by user)

> **Status:** v2 question-set draft was generated and surfaced in chat. User reviewed v1, gave HVAC-domain revision feedback, agent regenerated as v2, user paused before approving. **Awaiting user reply** with one of: `"Approved — implement"` / inline edits / per-template approvals. Do NOT write `shared/repair_form_seeds.js` until that reply lands.

### User's revision rules (apply across all 9 templates)

- **Cooling vitals on cooling work:** when the issue is cooling-related, capture `superheat_f`, `subcool_f`, `outside_air_temp_f`, `return_air_temp_f`, `supply_air_temp_f` alongside `suction_pressure_psi` / `discharge_pressure_psi`. Required on Compressor Replacement; optional on Service Call.
- **Diagnosis vs Replacement phasing:** for forms that span both visits (Supply Fan, Condenser Fan, Gas Valve, Compressor, Refrigerant Leak) order `fields[]` **Diagnosis first, Replacement/Repair second**, and prefix labels `"Diagnosis — "` / `"Replacement — "` / `"Repair — "`. The schema has no section headers; ordering carries the meaning.
- **Install date is auto-captured at job complete** — never a form field.
- **Quoted Repair has NO cost fields:** technicians must never see cost. Quote `$` amount lives in the dispatcher quote workflow, NOT in the form_template. (Agent removed `quote_amount_estimated` unilaterally; flag for re-confirm.)
- **Warranty Repair pre-captured fields stripped:** `manufacturer / model_number / serial_number / original_install_date / warranty_start_date / nameplate_photo` are already captured at initial diagnosis. Warranty form keeps only the dispatcher claim fields + the tech's post-repair report.
- **Additional Diagnostic time → 30-min increments dropdown** (30 min … 8 hr).
- **Role notes (informational only — schema has no role gate yet):** Quoted Repair = dispatcher-filled. Warranty Repair = top fields dispatcher-filled (`required: false` so tech isn't blocked) + bottom fields tech-filled (post-repair report). Tech-vs-dispatcher visibility will be wired later (NOT in 34b).
- **Conditional sub-fields stay `required: false`** because the schema has no conditional logic. Tech fills when applicable, leaves blank otherwise.

### Open questions still pending user reply

1. **Conditional sub-fields strictness.** Supply Fan (`blower_shaft_size`, `blower_sheave_size`, `bearings_needed_count` — only when bearings are worn) and Refrigerant Leak (`leak_detection_method`, `leak_location_photo_diagnosis` — only when leak detection was performed / leak was located) are currently `required: false`. If user wants them strictly required, flip them.
2. **Quoted Repair cost field re-confirm.** Agent removed `quote_amount_estimated` based on the "tech must never see cost" rule. If the dispatcher wants `$` back inside the seed template, add it back later when the schema gets a role gate (NOT in 34b).

### Stable seed ids + metadata (frozen — no edits expected here)

| id | templateName | targetKeyword | formCategory | assignedJobTypes | assignedRepairTypes | isDefault | sortIndex |
|---|---|---|---|---|---|---|---|
| `seed_service_call_form` | Service Call | `service call` | `service_call` | `["service"]` | `[]` | `true` | 10 |
| `seed_additional_diagnostic_form` | Additional Diagnostic | `additional diagnostic` | `service_call` | `["service"]` | `[]` | `false` | 20 |
| `seed_quoted_repair_form` | Quoted Repair (Dispatcher) | `quoted repair` | `quote` | `["quote"]` | `[]` | `true` | 30 |
| `seed_warranty_repair_form` | Warranty Repair | `warranty` | `service_call` | `["service"]` | `[]` | `false` | 40 |
| `seed_supply_fan_replacement` | Supply Fan Replacement | `supply fan` | `repair_checklist` | `["service"]` | `["supply_fan"]` | `false` | 50 |
| `seed_condenser_fan_replacement` | Condenser Fan Replacement | `condenser fan` | `repair_checklist` | `["service"]` | `["condenser_fan"]` | `false` | 60 |
| `seed_gas_valve_replacement` | Gas Valve Replacement | `gas valve` | `repair_checklist` | `["service"]` | `["gas_valve"]` | `false` | 70 |
| `seed_compressor_replacement` | Compressor Replacement | `compressor` | `repair_checklist` | `["service"]` | `["compressor"]` | `false` | 80 |
| `seed_refrigerant_leak_repair` | Refrigerant Leak Repair | `refrigerant leak` | `repair_checklist` | `["service"]` | `["refrigerant_leak"]` | `false` | 90 |

### Full v2 `fields[]` arrays (paste-ready into `shared/repair_form_seeds.js`)

#### 1. `seed_service_call_form` — Service Call
```js
fields: [
  { name: "customer_complaint",            label: "Customer Complaint / Symptom",                  type: "text",     required: true },
  { name: "equipment_found",               label: "Equipment / Unit Inspected",                    type: "text",     required: true },
  { name: "system_state_on_arrival",       label: "System State on Arrival",                       type: "dropdown", required: true,  options: ["Running","Running w/ fault","Locked out","Off — no power","Off — by customer"] },
  { name: "voltage_supply",                label: "Supply Voltage (V)",                            type: "number",   required: false },
  { name: "amp_draw",                      label: "Total Amp Draw (A)",                            type: "number",   required: false },
  { name: "suction_pressure_psi",          label: "Suction Pressure (psi) — cooling",              type: "number",   required: false },
  { name: "discharge_pressure_psi",        label: "Discharge Pressure (psi) — cooling",            type: "number",   required: false },
  { name: "superheat_f",                   label: "Superheat (°F) — cooling",                      type: "number",   required: false },
  { name: "subcool_f",                     label: "Subcool (°F) — cooling",                        type: "number",   required: false },
  { name: "outside_air_temp_f",            label: "Outside Air Temp (°F) — cooling",               type: "number",   required: false },
  { name: "return_air_temp_f",             label: "Return Air Temp (°F) — cooling",                type: "number",   required: false },
  { name: "supply_air_temp_f",             label: "Supply Air Temp (°F) — cooling",                type: "number",   required: false },
  { name: "root_cause",                    label: "Root Cause / Diagnosis",                        type: "text",     required: true },
  { name: "action_taken",                  label: "Action Taken",                                  type: "text",     required: true },
  { name: "additional_repair_recommended", label: "Additional Repair Recommended?",                type: "toggle",   required: false },
  { name: "customer_signed_off",           label: "Customer Signed Off On-Site?",                  type: "toggle",   required: true },
  { name: "equipment_photo",               label: "Photo of Equipment / Nameplate",                type: "photo",    required: false },
]
```

#### 2. `seed_additional_diagnostic_form` — Additional Diagnostic
```js
fields: [
  { name: "secondary_unit_id",             label: "Secondary Unit # / Tag",                        type: "text",     required: true },
  { name: "reason_for_extra_diagnostic",   label: "Reason for Extra Diagnostic",                   type: "text",     required: true },
  { name: "additional_findings",           label: "Additional Findings",                           type: "text",     required: true },
  { name: "component_under_test",          label: "Component Tested",                              type: "dropdown", required: false, options: ["Compressor","Condenser fan","Blower motor","Gas valve","Igniter / flame sensor","Control board","Refrigerant circuit","Electrical","Other"] },
  { name: "extra_diagnostic_time",         label: "Extra Diagnostic Time Required",                type: "dropdown", required: true,  options: ["30 min","1 hr","1 hr 30 min","2 hr","2 hr 30 min","3 hr","3 hr 30 min","4 hr","4 hr 30 min","5 hr","5 hr 30 min","6 hr","6 hr 30 min","7 hr","7 hr 30 min","8 hr"] },
  { name: "further_repair_required",       label: "Further Repair Required?",                      type: "toggle",   required: true },
  { name: "quote_to_follow",               label: "Quote to Follow?",                              type: "toggle",   required: false },
  { name: "related_component_photo",       label: "Photo of Related Component",                    type: "photo",    required: false },
]
```

#### 3. `seed_quoted_repair_form` — Quoted Repair (Dispatcher)
```js
// Dispatcher-filled. NO cost field — technicians must never see cost.
fields: [
  { name: "scope_of_work",                 label: "Scope of Work",                                 type: "text",     required: true },
  { name: "parts_list",                    label: "Parts List (one per line)",                     type: "text",     required: true },
  { name: "labor_hours_estimated",         label: "Labor Hours (estimated)",                       type: "number",   required: true },
  { name: "urgency",                       label: "Urgency",                                       type: "dropdown", required: true,  options: ["Emergency","Urgent (within 48 hr)","Standard (within 1 wk)","Scheduled / Planned"] },
  { name: "customer_authorization_received", label: "Customer Authorization Received?",            type: "toggle",   required: true },
  { name: "customer_authorized_by_name",   label: "Authorized By (name)",                          type: "text",     required: false },
  { name: "damage_photo",                  label: "Photo of Damage / Failed Component",            type: "photo",    required: true },
  { name: "additional_photo",              label: "Additional Reference Photo",                    type: "photo",    required: false },
]
```

#### 4. `seed_warranty_repair_form` — Warranty Repair
```js
// Top 4 fields dispatcher-filled (required:false so tech isn't blocked).
// Bottom 3 fields tech post-repair report.
// Removed: manufacturer/model/serial/install date/warranty start date/nameplate photo (already captured at initial diagnosis).
fields: [
  { name: "warranty_claim_number",         label: "Warranty Claim #",                              type: "text",       required: false },
  { name: "parts_under_warranty",          label: "Parts Under Warranty",                          type: "multi_check",required: false, options: ["Compressor","Coil","Heat exchanger","Control board","Motor","Capacitor","Gas valve","Igniter / flame sensor","Other"] },
  { name: "failure_mode",                  label: "Failure Mode",                                  type: "dropdown",   required: false, options: ["Electrical short / open","Mechanical seizure","Refrigerant leak","Cracked / corroded","Software / control fault","Premature wear","Other"] },
  { name: "warranty_action_taken",         label: "Warranty Action Taken",                         type: "dropdown",   required: false, options: ["Replace under warranty","Repair under warranty","Denied — out of warranty","Pending mfr response"] },
  { name: "system_operating_normally",     label: "System Operating Normally After Repair?",       type: "toggle",     required: true },
  { name: "further_issues_found",          label: "Further Issues Found (tech notes)",             type: "text",       required: false },
  { name: "post_repair_photo",             label: "Photo — System After Repair",                   type: "photo",      required: true },
]
```

#### 5. `seed_supply_fan_replacement` — Supply Fan Replacement
```js
// install_date removed — auto-captured at job complete.
// blower_shaft_size / blower_sheave_size / bearings_needed_count are conditional on "Worn" bearings — kept as required:false (no schema-level conditional).
fields: [
  { name: "old_motor_nameplate_photo",     label: "Diagnosis — Photo of Old Motor Nameplate (HP / RPM / frame)",          type: "photo",    required: true },
  { name: "motor_sheave_size",             label: "Diagnosis — Motor Sheave Size",                                        type: "text",     required: true },
  { name: "motor_sheave_adjustable",       label: "Diagnosis — Is Motor Sheave Adjustable?",                              type: "toggle",   required: true },
  { name: "belt_size",                     label: "Diagnosis — Belt Size",                                                type: "text",     required: true },
  { name: "blower_bearings_condition",     label: "Diagnosis — Blower Bearings Condition",                                type: "dropdown", required: true,  options: ["OK","Worn"] },
  { name: "blower_shaft_size",             label: "Diagnosis — Blower Shaft Size (if bearings worn)",                     type: "text",     required: false },
  { name: "blower_sheave_size",            label: "Diagnosis — Blower Sheave Size (if bearings worn)",                    type: "text",     required: false },
  { name: "bearings_needed_count",         label: "Diagnosis — Bearings Needed for Blower Assembly (count, if worn)",     type: "number",   required: false },
  { name: "amp_draw_at_completion",        label: "Replacement — Amp Draw at Completion (A)",                             type: "number",   required: true },
  { name: "rotation_verified",             label: "Replacement — Rotation Verified?",                                     type: "toggle",   required: true },
  { name: "vibration_check_passed",        label: "Replacement — Vibration Check Passed?",                                type: "toggle",   required: true },
  { name: "new_install_photo",             label: "Replacement — Photo of New Install",                                   type: "photo",    required: true },
]
```

#### 6. `seed_condenser_fan_replacement` — Condenser Fan Replacement
```js
// Photo fallback chain: motor nameplate (preferred) → unit nameplate → model/serial tag inside unit.
fields: [
  { name: "motor_nameplate_photo",         label: "Diagnosis — Photo of Condenser Fan Motor Nameplate (HP / RPM, etc.)",                       type: "photo",    required: true },
  { name: "unit_nameplate_photo",          label: "Diagnosis — Photo of Unit Nameplate (fallback if motor plate worn)",                        type: "photo",    required: false },
  { name: "model_serial_tag_photo",        label: "Diagnosis — Photo of Model/Serial Tag Inside Unit (fallback if both above are worn)",        type: "photo",    required: false },
  { name: "nameplate_legibility_note",     label: "Diagnosis — Nameplate Legibility Note",                                                     type: "text",     required: false },
  { name: "amp_draw_at_completion",        label: "Replacement — Amp Draw at Completion (A)",                                                  type: "number",   required: true },
  { name: "rotation_verified",             label: "Replacement — Rotation Verified?",                                                          type: "toggle",   required: true },
  { name: "new_install_photo",             label: "Replacement — Photo of New Install",                                                        type: "photo",    required: true },
]
```

#### 7. `seed_gas_valve_replacement` — Gas Valve Replacement
```js
fields: [
  { name: "gas_type",                      label: "Diagnosis — Gas Type",                                                 type: "dropdown", required: true,  options: ["Natural Gas (NG)","Propane / LP"] },
  { name: "has_gas_regulator",             label: "Diagnosis — Does System Have a Gas Regulator?",                        type: "toggle",   required: true },
  { name: "inlet_pressure_diagnosis_iwc",  label: "Diagnosis — Inlet Gas Pressure (″ WC)",                                type: "number",   required: true },
  { name: "manifold_pressure_after_iwc",   label: "Replacement — Manifold Pressure (″ WC)",                               type: "number",   required: true },
  { name: "inlet_pressure_after_iwc",      label: "Replacement — Inlet Gas Pressure After Repair (″ WC)",                 type: "number",   required: true },
  { name: "leak_test_passed",              label: "Replacement — Leak Test Passed?",                                      type: "toggle",   required: true },
  { name: "ignition_test_passed",          label: "Replacement — Ignition Test Passed?",                                  type: "toggle",   required: true },
  { name: "flame_signal_microamps",        label: "Replacement — Flame Signal (µA)",                                      type: "number",   required: true },
  { name: "new_valve_photo",               label: "Replacement — Photo of New Valve Installed",                           type: "photo",    required: true },
]
```

#### 8. `seed_compressor_replacement` — Compressor Replacement
```js
// Cooling vitals required on Replacement phase per user spec.
fields: [
  { name: "nameplate_refrigerant_charge_lbs", label: "Diagnosis — Refrigerant Charge per Nameplate (lbs, this circuit)", type: "number",   required: true },
  { name: "refrigerant_type",              label: "Diagnosis — Refrigerant Type",                                         type: "dropdown", required: true,  options: ["R-410A","R-22","R-454B","R-32","R-407C","Other"] },
  { name: "old_compressor_photo",          label: "Diagnosis — Photo of Existing / Old Compressor",                       type: "photo",    required: true },
  { name: "recovered_refrigerant_lbs",     label: "Replacement — Refrigerant Recovered (lbs)",                            type: "number",   required: true },
  { name: "charge_added_lbs",              label: "Replacement — Charge Added (lbs)",                                     type: "number",   required: true },
  { name: "brazing_crimp_leak_test_passed",label: "Replacement — Braze / Crimp Leak Test Passed?",                        type: "toggle",   required: true },
  { name: "evacuation_microns",            label: "Replacement — Evacuation Pulled To (microns)",                         type: "number",   required: true },
  { name: "running_amps",                  label: "Replacement — Running Amps (A)",                                       type: "number",   required: true },
  { name: "suction_pressure_psi",          label: "Replacement — Suction Pressure (psi)",                                 type: "number",   required: true },
  { name: "discharge_pressure_psi",        label: "Replacement — Discharge Pressure (psi)",                               type: "number",   required: true },
  { name: "superheat_f",                   label: "Replacement — Superheat (°F)",                                         type: "number",   required: true },
  { name: "subcool_f",                     label: "Replacement — Subcool (°F)",                                           type: "number",   required: true },
  { name: "supply_air_temp_f",             label: "Replacement — Supply Air Temp (°F)",                                   type: "number",   required: true },
  { name: "return_air_temp_f",             label: "Replacement — Return Air Temp (°F)",                                   type: "number",   required: true },
  { name: "outside_air_temp_f",            label: "Replacement — Outside Air Temp (°F)",                                  type: "number",   required: true },
  { name: "nameplate_photo",               label: "Replacement — Photo of New Compressor Nameplate",                      type: "photo",    required: true },
  { name: "install_photo",                 label: "Replacement — Photo of New Compressor Installed",                      type: "photo",    required: true },
]
```

#### 9. `seed_refrigerant_leak_repair` — Refrigerant Leak Repair
```js
// Repair-phase fields are required:false so a diagnosis-only visit doesn't error out.
fields: [
  { name: "refrigerant_type",                  label: "Diagnosis — Refrigerant Type",                                          type: "dropdown", required: true,  options: ["R-410A","R-22","R-454B","R-32","R-407C","Other"] },
  { name: "initial_leak_detection_performed", label: "Diagnosis — Was Initial Leak Detection Performed?",                     type: "toggle",   required: true },
  { name: "leak_detection_method",            label: "Diagnosis — Leak Detection Method",                                     type: "dropdown", required: false, options: ["Electronic detector","UV dye","Soap bubble","Nitrogen pressure","Standing pressure / decay","Other"] },
  { name: "existing_suction_pressure_psi",    label: "Diagnosis — Existing Suction Pressure (psi)",                           type: "number",   required: true },
  { name: "existing_discharge_pressure_psi",  label: "Diagnosis — Existing Discharge Pressure (psi)",                         type: "number",   required: true },
  { name: "nameplate_refrigerant_charge_lbs", label: "Diagnosis — Refrigerant Charge per Nameplate (lbs, this circuit)",      type: "number",   required: true },
  { name: "leak_location_found",              label: "Diagnosis — Leak Location Found?",                                      type: "toggle",   required: true },
  { name: "leak_location_photo_diagnosis",    label: "Diagnosis — Leak Location Photo (if found)",                            type: "photo",    required: false },
  { name: "needs_quote_for_return_visit",     label: "Diagnosis — Needs Quote for Return-Visit Repair?",                      type: "toggle",   required: false },
  { name: "pressure_test_psi",                label: "Repair — Pressure-Tested To (psi)",                                     type: "number",   required: false },
  { name: "pressure_held_minutes",            label: "Repair — Pressure Held For (min)",                                      type: "number",   required: false },
  { name: "recovered_refrigerant_lbs",        label: "Repair — Refrigerant Recovered (lbs)",                                  type: "number",   required: false },
  { name: "recharged_refrigerant_lbs",        label: "Repair — Refrigerant Recharged (lbs)",                                  type: "number",   required: false },
  { name: "additional_refrigerant_added_lbs", label: "Repair — Additional Refrigerant Added (lbs)",                           type: "number",   required: false },
  { name: "leak_location",                    label: "Repair — Leak Location (final, in writing)",                            type: "text",     required: false },
  { name: "repair_photo",                     label: "Repair — Photo of Completed Repair",                                    type: "photo",    required: false },
]
```

### When the user replies "Approved — implement"

1. **Resolve any inline edits** they sent on the v2 draft above (apply directly to these `fields[]` arrays before coding).
2. **Find the existing dispatcher PIN pattern.** `Grep` for `PIN` / `promptForPin` / `adminPin` / `dispatcher_admin_pin` / similar in `settings.js` + `index.html`. REUSE it; do not invent a new gate. If nothing surfaces, STOP and ask the user which gate to wire.
3. **Write `shared/repair_form_seeds.js`** per Step 2 above (the 9 stable ids, idempotent seeder, `SEED_AT = "2026-04-26T00:00:00Z"` if shipped same-day, otherwise bump to ship date).
4. **Wire the admin button** in `#fieldFormBuilderSection` (around line ~5305 of `index.html`) next to "+ Create New Template". Style: secondary (`background: #64748b`).
5. **Cache-bust:** `shared/repair_form_seeds.js?v=1`, `settings.js?v=17`, `VC_BUILD = "Phase34b-<ship-date>"` in `index.html`. Do NOT touch `technician/index.html`.
6. **Single commit** per the suggested message in the original task brief.

---

## §1.6 — Phase 34b SHIPPED summary (2026-04-27)

> User said "continue" → agent treated as approval of v2 as drafted (both open questions resolved to v2 defaults: conditional sub-fields stay `required: false`; Quoted Repair has no cost field). Both open questions remain noted in §1.5 if you ever want to revisit.

**Files touched (single commit):**
- **`shared/repair_form_seeds.js`** — NEW. IIFE on `window.VCFormSeeds`. Bakes `SEED_AT = "2026-04-27T00:00:00Z"` and `SEED_SOURCE = "phase34b"`. Exports `SEED_TEMPLATES` (9 stable ids — exactly matching §1.5 metadata table) and `seedDefaultFormTemplates()` (async, returns `{ created, updated, skipped, errors }`). Idempotency rule per §1.5 implemented exactly: read all 9 in parallel → classify each into create/update/skip via `doc.updatedAt > SEED_AT` comparison → batch-write when total writes > 5 (atomic, common case on fresh installs) or per-doc set when ≤ 5 (preserves partial success). Each payload mirrors `saveFieldFormTemplate()` shape in `settings.js` exactly + adds `seedAt` + `seedSource` provenance.
- **`index.html`** — Added second button `#btnFieldFormSeedDefaults` ("🌱 Seed default form templates (admin)", `background: #64748b`) inside `#fieldFormBuilderSection` next to `#btnFieldFormCreateTemplate`. Bumped `<script src="settings.js?v=16">` → `?v=17`. Inserted `<script src="shared/repair_form_seeds.js?v=1">` immediately before settings.js so seeds module is available before the click handler runs. Bumped `window.VC_BUILD = "Phase34a-2026-04-26"` → `"Phase34b-2026-04-27"`.
- **`settings.js`** — Extended `initFieldFormBuilderUi()` to wire `#btnFieldFormSeedDefaults` alongside the existing create button (same `dataset.wired = "1"` guard). New `handleSeedDefaultFormTemplatesClick()` reuses the existing PIN gate (`sessionStorage` `vc_admin_unlocked`, value `APP_CONFIG.adminUnlockPin || "beta"`); if not unlocked, shows `prompt()` validating against the same value, sets the flag on success. Confirms before writing, disables button + shows "Seeding…" while running, calls `window.VCFormSeeds.seedDefaultFormTemplates()`, then `hydrateFieldFormTemplatesList()`, then `showSaveCue()` with `Seeded N templates — created C, updated U, skipped S` (or `alert()` with per-doc error list on partial failure).

**PIN gate decision (no new gate invented):** the existing dispatcher Admin Tools sidebar pattern is canonical (`<details id="vcAdminTools">` → `#vcAdminPinInput` → `#vcAdminUnlockBtn` → on success `sessionStorage.setItem("vc_admin_unlocked", "1")`). Documented in `PROJECT_MAP.md → Dispatcher Operations → "Admin tools / PIN unlock"`. The seed handler reads the same flag and falls back to an inline `prompt()` validating against the same `APP_CONFIG.adminUnlockPin || "beta"` so unlocking once carries through.

**`technician/index.html` NOT touched** — Phase 34b is dispatcher-only by design.

**On-device smoke checklist (when next at the dispatcher):**
1. Load dispatcher → check sidebar BUILD chip reads `BUILD Phase34b-2026-04-27 · fb v<N>`.
2. Settings → Field Form & Checklist Builder → 🌱 button visible next to "+ Create New Template".
3. With **no** sessionStorage admin unlock → click button → `prompt()` for PIN → enter PIN → confirm dialog → `Seeded 9 templates — created 9, updated 0, skipped 0` toast → list immediately refreshes showing all 9 templates with `DEFAULT` chips on Service Call + Quoted Repair.
4. Click button again → `Seeded 9 templates — created 0, updated 9, skipped 0` (idempotency: no clobber).
5. Manually edit one template via the existing builder UI (e.g., change a label on Service Call) → save → click 🌱 again → that one template should appear under `skipped` count. Open it — your edit must still be there.
6. (Optional) On the iPhone field app, open a job, dictate notes mentioning "supply fan" → Gemini suggestion path should now resolve to the seeded `seed_supply_fan_replacement` template via `getTemplatesByRepairType("supply_fan")`.

---

# §2 — Phase 1 inspection findings (still valid, do not re-inspect)

These findings were established at the start of Phase 34 and were NOT invalidated by Phase 34a. Carry them forward into 34c/d/e:

- **Job workflow** (`#serviceSection`, `#pmSection`, `#quoteSection`) lives in `technician/index.html` and is modular.
- **Equipment pill-bar buttons** (RTU / Furnace / UH / Radiant / EF / MUA) exist inside each section.
- **Form engine** (`field_forms.js`) is hybrid: 2 hardcoded forms (`standard_pm`, `repair_quote`) + a working dynamic renderer (`renderDynamicForm`) reading from the Firestore `form_templates` root collection.
- **Form builder** in `settings.js` (~line 2173) was thin pre-34a; 34a extended it with category, job-type chips, repair-type chips, isDefault, sortIndex, Toggle field type, up/down reorder arrows.
- **Checkout** = single FAB **"Complete & Sync Ticket"** → text preview → confirm. No thermostat prompt yet (34d will add it). No repair gate yet (34c will add it).
- **Repair branching does not exist** pre-34c.
- **Thermostat labeling does not exist** pre-34d.
- **Roof access** is currently free-text only in Site Intel; 34e will add a structured field.

---

# §3 — Phase 34c: Repair branching in Service Call workflow

> Run AFTER 34b is shipped (verify in `PROJECT_MAP.md → Build History`).

### Goal
Inside the Service Call panel only, add an "Additional repair (optional)" accordion that lets the tech declare extra repair work beyond the primary call, pick repair types from a multi-select pillbar, and open the matching `form_templates` checklist for each selected repair type.

### Where the changes go (verify these exist via `Grep` first)
- **`technician/index.html`** → find `#serviceSection`. Insert `<div id="acc-svc-repair" class="vc-accordion">…</div>` between section 2 and section 3 of that panel. Title: **"Additional repair (optional)"**.
- **`technician/index.html`** or `service_call.js` → find the existing `setServiceCallMerged` helper (used to merge ticket-field updates onto the active service call doc). Use it for all writes from this accordion.
- **`field_forms.js`** → already exposes `getTemplatesByRepairType(repairType)` (Phase 34a). Use it directly; do not re-implement.
- **`field_forms.js`** → already exposes `renderDynamicForm(templateId)` to launch the form modal. Use it directly.

### UI structure inside `#acc-svc-repair`
1. **Yes/No pillbar** — "Is additional repair needed?"
   - On "No" → collapse the rest, persist `additionalRepairNeeded: false`.
   - On "Yes" → reveal the repair-type pillbar.
2. **Repair-type pillbar** (multi-select, 2-column layout on phone):
   - Supply Fan / Condenser Fan / Gas Valve / Compressor / Refrigerant Leak / **Other** (free-text label input revealed under the "Other" pill).
3. **Per-selected-type form chip:**
   - For each selected repair type, render a chip showing:
     - The matching template name (resolved via `getTemplatesByRepairType(<type>)`; if multiple matches, prefer `isDefault: true`, else lowest `sortIndex`).
     - A status badge: **Not started** (gray) / **Saved** (green check).
     - An **"Open form"** button → calls `renderDynamicForm(templateId)`.

### Data shape on the ticket
Use `setServiceCallMerged` to persist:
```
additionalRepairNeeded: boolean
repairFormTypes: string[]              // e.g. ["supply_fan", "compressor", "other"]
repairFormCustomLabel: string          // free-text label for "Other"; empty otherwise
repairFormStatus: {                    // map of repairTypeKey → { templateId, status, savedAt? }
  supply_fan: { templateId: "seed_supply_fan_replacement", status: "saved", savedAt: <serverTimestamp> },
  ...
}
```

### `field_form_submissions` write
When the user saves a repair-branch form, in addition to the existing `field_form_submissions` write, add `triggeredBy: "repair_branch"` to the payload so we can filter for these submissions later. Hook into the existing `saveCurrentFieldForm` save flow in `field_forms.js`; the simplest path is to set a module-level `var pendingTriggeredBy = null;` set by the caller before opening, then included in the payload and cleared on close. **Do not change `renderDynamicForm`'s signature.** Add an optional second arg `renderDynamicForm(templateId, opts)` where `opts.triggeredBy` is the only key.

### Cache-bust + VC_BUILD
- `field_forms.js?v=3` (was `v=2`; bump because of the optional second arg + payload change)
- `technician/index.html` → bump `VC_BUILD = "Phase34c-<date>"`
- If `service_call.js` is touched → bump its `?v=` too (search for current value in `index.html` AND `technician/index.html` first; both files load it under separate `?v=`).
- `settings.js` → no bump in 34c (dispatcher untouched).

### Non-goals for 34c
- No drag-and-drop reorder of selected repair types.
- No deep-links between dispatcher and field repair branch.
- No checkout redesign.
- No changes to the office override / shadow-mode flow.
- No automatic auto-selection of repair types from dictation (Gemini intent already handles that path via `scanNotesForFormRequirements` — leave it alone).

---

## §3.5 — Phase 34c SHIPPED summary (2026-04-27)

> User said "phase 34b tested and found it working. continue to next phase" then escalated to Opus 4.7 → agent treated as approval. Both `getTemplatesByRepairType` (Phase 34a) and the 9 seeded `assignedRepairTypes` templates (Phase 34b) were already in place — 34c just consumes them.

**Files touched (single commit):**
- **`field_forms.js`** — Bumped to `?v=3`. Added module-level `pendingTriggeredBy` var. Modified `renderDynamicForm(templateId, opts)` signature (backward-compatible — callers passing only one arg still work; `opts.triggeredBy` is the only honored key). Threaded `triggeredBy` into the dynamic-form `field_form_submissions` payload + dispatched a new `vc:fieldFormSaved` CustomEvent (detail: `{ templateId, triggeredBy, ticketId }`) after every successful add. Cleared `pendingTriggeredBy` in `closeFieldFormModal`. Added an entire new accordion-wiring module (`initRepairBranchAccordion` + helpers `getActiveTicketIdForRepairBranch` / `getServiceCallsRefForRepairBranch` / `persistRepairBranchPatch` / `getRepairBranchAccordion` / `resolveRepairTemplateForKey` / `renderRepairBranchChipsHtml` / `rerenderRepairBranchChips` / `applyRepairBranchYesNoStyles` / `applyRepairBranchTypePillStyles` / `hydrateRepairBranchFromTicket` / `setRepairBranchYesNo` / `toggleRepairBranchType` / `setRepairBranchOtherLabel` / `markRepairBranchFormSaved`). All persistence via `VCFirestore.setServiceCallMerged(db, tid, patch, true)`; failures funnel through `VCSurfaceWriteFailure("repairBranch:write[<tid>]", err)`. Subscribes to `vc:workspaceOpened` for hydration + `vc:fieldFormSaved` for chip status updates. Exposes `window.vcRepairBranchHydrate(ticket)` for on-device console debugging. `initRepairBranchAccordion` called from `initFieldFormLaunchers` so it boots automatically.
- **`technician/index.html`** — Inserted new `<div class="accordion" id="acc-svc-repair">` between section 2 (`#acc-notes-svc`) and section 3 (`#acc-parts-svc`) of `#serviceSection`. Body contains: yes/no pillbar (`.vc-svc-repair-yesno`), reveal-on-Yes wrap (`#svcRepairTypesWrap`) with 6-button repair-type pillbar (`.vc-svc-repair-types.pillbar-grid`, 2-column), free-text "Other" wrap (`#svcRepairOtherWrap` + `#svcRepairOtherLabel`), chips wrap (`#svcRepairFormChips`). Added matching CSS in the existing `<style>` block: `.pillbar-grid` (2-up grid), `.pillbar button[aria-pressed="true"]` (cyan selected), `.vc-svc-repair-yesno button[data-svc-repair-needed][aria-pressed="true"]` (green/red yes/no states), `.vc-repair-chip` + `.vc-repair-chip__name` / `__badge` (`.saved` variant) / `__open` / `__missing`. In `openWorkspace`, added a 1-block dispatch of `vc:workspaceOpened` (detail: `{ ticketId, mode, ticket }`) plus stashing `window.__vcLastActiveTicket` so externally-loaded modules can hydrate without needing access to the inline `activeTicket` lexical scope. Bumped `<script src="../field_forms.js?v=2">` → `?v=3`. Bumped `window.VC_BUILD = "Phase34a-2026-04-26"` → `"Phase34c-2026-04-27"`.

**Why wiring lives in `field_forms.js` (cache-bustable) and not inline in `technician/index.html`:** per `KNOWN_ISSUES.md → KI-002 §B` mitigations, inline JS in `technician/index.html` cannot be cache-busted (entry-point HTML has no `?v=`). Putting all the accordion logic in `field_forms.js?v=3` means future tweaks ride a `?v=` bump and reach the iPhone immediately. The inline HTML is purely structural — stale cached HTML will simply render no chips (graceful degradation).

**New ticket fields on `service_calls/{id}` (additive, no schema migration):**
```
additionalRepairNeeded:    boolean
repairFormTypes:           string[]   e.g. ["supply_fan","compressor","other"]
repairFormCustomLabel:     string     (only meaningful when types includes "other")
repairFormStatus:          { <repairKey>: { templateId, status: "saved", savedAt: <ISO date> } }
repairBranchUpdatedAt:     serverTimestamp   (set on every patch)
```
Deep-merge semantics: `repairFormStatus` is preserved when toggling No → Yes (so saved-state badges restore on re-toggle). Toggling No also clears `repairFormTypes` + `repairFormCustomLabel` so a follow-up Yes starts clean.

**`index.html` NOT touched** — Phase 34c is technician-only by design. Dispatcher consumes the new fields by reading the same `service_calls/{id}` doc surface (no new dispatcher UI in 34c; that's a follow-up phase if/when needed).

**On-device smoke checklist (when next at the iPhone):**
1. Open dispatcher → confirm sidebar BUILD chip still reads `Phase34b-2026-04-27` (dispatcher unchanged).
2. On iPhone, hard-refresh `technician/index.html` → confirm debug overlay top line reads `BUILD: Phase34c-2026-04-27` (if not, force-reload until it updates per KI-002 §B mitigations).
3. Open a Service Call ticket → expand new "Additional repair (optional)" accordion (between "2. Diagnostics & Repairs" and "3. Parts & Quote Info").
4. Tap **No** → no chips render; reload → state persists; in dispatcher's view of the same ticket doc, confirm `additionalRepairNeeded: false`.
5. Tap **Yes** → 6-pill repair-type grid appears; tap "Supply Fan" + "Compressor" → two chips render with template names from Phase 34b seeds + "Open form" buttons + gray "Not started" badges.
6. Tap "Open form" on Supply Fan → dynamic form modal opens → fill required fields → Save → "Form saved" alert → modal closes → chip flips to green "✓ Saved" badge with button text "Re-open form".
7. Reload page → state persists (Yes still selected, both pills still active, Supply Fan chip still green Saved).
8. Tap "Other" pill → `#svcRepairOtherLabel` text input appears → type "belt and bearings replacement" → wait ~1s (debounce) → reload → label persists.
9. In Firestore console, inspect `service_calls/{id}` → `repairFormStatus.supply_fan = { templateId: "seed_supply_fan_replacement", status: "saved", savedAt: "<iso>" }`, `repairFormTypes = ["supply_fan", "compressor", "other"]`, `repairFormCustomLabel = "belt and bearings replacement"`.
10. In `field_form_submissions`, find the latest doc → confirm `triggeredBy: "repair_branch"` is set.

---

# §4 — Phase 34d: Thermostat labeling prompt at checkout

> Run AFTER 34c is shipped.

### Goal
Before the FAB ("Complete & Sync Ticket"), prompt the tech to confirm the unit they serviced today has been physically labeled (so the next tech can identify it). Visible on **all 3 job panels** (`#serviceSection`, `#pmSection`, `#quoteSection`). Soft validation only — never a hard block.

### Where the changes go (verify via `Grep`)
- **`technician/index.html`** → find the FAB `Complete & Sync Ticket`. Just before it, inject `<div id="acc-tstat-label" class="vc-accordion">…</div>` so the accordion appears at the bottom of every job panel (or once at panel level if the FAB is shared — confirm by reading the panel structure first).
- **`technician/index.html`** → find `#linkedEquipmentSelect` and the Action Tray (the unit-pillbar of equipment selected for the active job). Use these to derive the unit label.
- Existing toast helper — find via `Grep` for `showToast` / `vcToast` / similar.

### Auto-derived unit label (precedence order)
1. `#linkedEquipmentSelect` selected option's `unitTag` attribute (or visible text minus emoji decorations).
2. First unit chip in the Action Tray.
3. Fallback string: **"the unit serviced today"**.

Render the derived label inside the accordion header so the tech sees "Did you label `RTU-3` today?" rather than a generic prompt.

### UI structure inside `#acc-tstat-label`
1. **Three-option pillbar** (single-select):
   - **Already labeled** (green tint when picked)
   - **Labeled now** (blue tint when picked)
   - **Not labeled** (orange tint when picked)
2. On **"Not labeled"** → reveal a **reason dropdown**:
   - `Not needed` / `No printer available` / `No access` / `Will label later` / `Other`
   - On `Other` → reveal a free-text input.
3. Persist immediately on change; do NOT require a separate save button.

### Soft validation hook
- On Complete & Sync FAB click, before the existing checkout flow runs:
  - If `tstatLabelStatus` is unset → show a toast like `"Don't forget to confirm thermostat labeling."` AND scroll-nudge the user to `#acc-tstat-label`.
  - **Do NOT block the sync.** Return control to the existing checkout flow regardless. The toast is informational only.

### Data shape on the ticket (write via `setServiceCallMerged` or the equivalent merge helper for PM / Quote panels — verify the helpers per panel)
```
tstatLabelStatus:     "already_labeled" | "labeled_now" | "not_labeled" | null
tstatLabelReason:     "not_needed" | "no_printer" | "no_access" | "will_label_later" | "other" | null
tstatLabelOtherText:  string                // only when tstatLabelReason === "other"
tstatLabelVerifiedAt: serverTimestamp       // set when tstatLabelStatus is first persisted
tstatLabelUnitTag:    string                // the auto-derived label captured at the time of confirm
```

### Cache-bust + VC_BUILD
- `technician/index.html` → bump `VC_BUILD = "Phase34d-<date>"`
- Whichever JS module ends up owning the accordion's wiring → bump its `?v=` (likely `service_call.js` and / or `workspace_ui.js`; verify).
- `field_forms.js` → no bump expected in 34d.
- `settings.js` → no bump in 34d.

### Non-goals for 34d
- No Bluetooth printer integration.
- No auto-print on "Labeled now".
- No deep-links to a label-printing app.
- No hard block on Complete & Sync.
- No new collection writes — these fields live on the existing ticket doc.

---

# §5 — Phase 34e: Roof access field + docs sync

> Run AFTER 34d is shipped. Smallest of the four follow-up phases.

### Goal
Add a structured **Roof access** input to the existing Site Intel modal so the office can see how a tech got onto the roof at this site (ladder vs interior hatch vs scissor lift, key required, etc.). Plus the doc/admin sync that closes out Phase 34.

### Where the changes go (verify via `Grep`)
- **`technician/index.html`** (or whichever module owns the Site Intel modal) → find `#vcSiteIntelBody`. Add a `<textarea>` (or a few structured inputs — at minimum a textarea) labeled **"Roof access"**.
- **Site Intel write helper** → find via `Grep` for `site_intelligence` / `siteIntel` / similar. Merge `roofAccess` (string) onto `site_intelligence/{siteKey}` via the existing helper.

### Data shape on `site_intelligence/{siteKey}`
```
roofAccess: string
roofAccessUpdatedAt: serverTimestamp
roofAccessUpdatedBy: <techName | userId>
```
Existing fields on the doc are untouched.

### Documentation sync (REQUIRED for 34e to ship)
- **`PROJECT_STATUS/PROJECT_MAP.md`** → categorized update under **Field Operations** (per `.cursorrules §1C`). Add a Phase 34 entry with **User Guide** + **Technical Specs** subsections covering all of 34a/34b/34c/34d/34e. Flip the Phase 34 line in **Build History** from `[ ]` to `[v]`.
- **`PROJECT_STATUS/CURRENT_STATE.md`** → flip Active Phase from "Phase 34" to "None" (or to whatever the next phase is); move the per-phase detail out of CURRENT_STATE and into PROJECT_MAP. Hard size cap is ~30 content lines.
- **`PROJECT_STATUS/DECISIONS.md`** → append **ADR-014: form_templates collection scoping**. Decision: `form_templates` stays at root (cross-tenant catalog). Tenant-scoping deferred until a second tenant goes live and needs divergent templates. Reference Phase 34 as the context.
- **Delete this file (`PROJECT_STATUS/PHASE_34_HANDOFF.md`)** as part of the 34e commit.

### Cache-bust + VC_BUILD
- `technician/index.html` → bump `VC_BUILD = "Phase34-2026-04-26"` (or the actual ship date — drop the per-phase suffix once 34 is fully shipped).
- `index.html` → match: `VC_BUILD = "Phase34-<date>"`.
- Touched JS file → bump `?v=`.

### Non-goals for 34e
- No new collection moves for `form_templates` (explicitly deferred per ADR-014).
- No new Site Intel fields beyond `roofAccess` in this phase.
- No drag-and-drop in the Site Intel modal.

---

## Recurring discipline (applies to every Phase 34 commit)

- **Task classification (per `.cursorrules §6B`):** Every response must begin with the 4-line block. 34b/c/d are HIGH risk (multi-file changes, Firestore writes, field workflow) → recommend Opus 4.7. 34e is borderline LOW (text input + docs) but call HIGH because of the Build History flip + ADR write.
- **Cache-bust (per `.cursorrules §5`):** Bump `?v=N` on every touched JS file. Bump `VC_BUILD` on every touched HTML file. The dispatcher and tech apps both have their own `?v=` — search BOTH `index.html` AND `technician/index.html` before bumping.
- **One commit per phase.** Suggested commit-message anatomy:
  ```
  Phase 34<X> — <one-line summary>

  <2–3 sentence why>

  <key file list with cache-bust deltas>
  ```
- **Tier 1 reads first.** `.cursorrules` + `CURRENT_STATE.md`. Do not re-read PROJECT_MAP / DECISIONS / KNOWN_ISSUES end-to-end; grep by phase or KI / ADR id only.

---

## Explicit non-goals (apply to ALL of Phase 34c / 34d / 34e)

- No Bluetooth printer integration.
- No deep-links between dispatcher and field.
- No checkout redesign.
- No collection moves (`form_templates` stays at root — see ADR-014 in 34e).
- No drag-and-drop (up/down arrows only, shipped in 34a).
- No new navigation patterns.
- No tenant-scoping of `form_templates` (deferred per ADR-014).
