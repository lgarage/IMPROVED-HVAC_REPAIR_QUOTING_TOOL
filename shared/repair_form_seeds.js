/* ============================================================================
 * shared/repair_form_seeds.js?v=1  (Phase 34b — 2026-04-27)
 * ----------------------------------------------------------------------------
 * Default form_templates seeder. Idempotent against user edits.
 *
 * Public API on window.VCFormSeeds:
 *   - SEED_AT                    ISO 8601 timestamp baked at ship time. Bump
 *                                ONLY when seed contents change so prior-shipped
 *                                templates get refreshed on next admin-seed click.
 *   - SEED_TEMPLATES             Array<{ id, doc }> with the 9 stable docs.
 *   - seedDefaultFormTemplates() Async. Returns { created, updated, skipped, errors }.
 *
 * Idempotency rule:
 *   For each seed:
 *     1. Read form_templates/{id}.
 *     2. Doc missing            → CREATE with full payload + seedAt + serverTimestamp.
 *     3. Doc exists, updatedAt
 *        > SEED_AT              → SKIP (user has edited locally; do not clobber).
 *     4. Doc exists, updatedAt
 *        <= SEED_AT (or absent) → set merge:true to refresh seed-owned fields.
 *
 * Batching: per .cursorrules §5, use writeBatch when total writes > 5. That makes
 * the common "fresh install / 9 creates" case atomic (all-or-nothing). When ≤ 5
 * writes, fall back to per-doc set() so a single bad doc doesn't take the rest down.
 *
 * NOTE: This module does NOT touch the technician app. It writes to the existing
 * root `form_templates` collection (cross-tenant catalog) per ADR-014 deferral.
 * ============================================================================
 */
(function () {
    "use strict";

    var SEED_AT = "2026-04-27T00:00:00Z";
    var SEED_AT_MS = Date.parse(SEED_AT);
    var SEED_SOURCE = "phase34b";

    function isFirebaseReady() {
        return (
            typeof firebase !== "undefined" &&
            firebase.apps &&
            firebase.apps.length > 0 &&
            typeof firebase.firestore === "function"
        );
    }

    function readDocUpdatedAtMs(snap) {
        if (!snap || !snap.exists) return null;
        var data = snap.data() || {};
        var ts = data.updatedAt;
        if (!ts) return 0;
        if (typeof ts.toMillis === "function") return ts.toMillis();
        if (typeof ts.seconds === "number") return ts.seconds * 1000;
        if (typeof ts === "number") return ts;
        if (typeof ts === "string") {
            var parsed = Date.parse(ts);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
    }

    var SEED_TEMPLATES = [
        {
            id: "seed_service_call_form",
            doc: {
                templateName: "Service Call",
                targetKeyword: "service call",
                active: true,
                formCategory: "service_call",
                assignedJobTypes: ["service"],
                assignedRepairTypes: [],
                isDefault: true,
                sortIndex: 10,
                fields: [
                    { name: "customer_complaint",            label: "Customer Complaint / Symptom",                  type: "text",     required: true },
                    { name: "equipment_found",               label: "Equipment / Unit Inspected",                    type: "text",     required: true },
                    { name: "system_state_on_arrival",       label: "System State on Arrival",                       type: "dropdown", required: true,  options: ["Running", "Running w/ fault", "Locked out", "Off — no power", "Off — by customer"] },
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
                ],
            },
        },
        {
            id: "seed_additional_diagnostic_form",
            doc: {
                templateName: "Additional Diagnostic",
                targetKeyword: "additional diagnostic",
                active: true,
                formCategory: "service_call",
                assignedJobTypes: ["service"],
                assignedRepairTypes: [],
                isDefault: false,
                sortIndex: 20,
                fields: [
                    { name: "secondary_unit_id",             label: "Secondary Unit # / Tag",                        type: "text",     required: true },
                    { name: "reason_for_extra_diagnostic",   label: "Reason for Extra Diagnostic",                   type: "text",     required: true },
                    { name: "additional_findings",           label: "Additional Findings",                           type: "text",     required: true },
                    { name: "component_under_test",          label: "Component Tested",                              type: "dropdown", required: false, options: ["Compressor", "Condenser fan", "Blower motor", "Gas valve", "Igniter / flame sensor", "Control board", "Refrigerant circuit", "Electrical", "Other"] },
                    { name: "extra_diagnostic_time",         label: "Extra Diagnostic Time Required",                type: "dropdown", required: true,  options: ["30 min", "1 hr", "1 hr 30 min", "2 hr", "2 hr 30 min", "3 hr", "3 hr 30 min", "4 hr", "4 hr 30 min", "5 hr", "5 hr 30 min", "6 hr", "6 hr 30 min", "7 hr", "7 hr 30 min", "8 hr"] },
                    { name: "further_repair_required",       label: "Further Repair Required?",                      type: "toggle",   required: true },
                    { name: "quote_to_follow",               label: "Quote to Follow?",                              type: "toggle",   required: false },
                    { name: "related_component_photo",       label: "Photo of Related Component",                    type: "photo",    required: false },
                ],
            },
        },
        {
            id: "seed_quoted_repair_form",
            doc: {
                templateName: "Quoted Repair (Dispatcher)",
                targetKeyword: "quoted repair",
                active: true,
                formCategory: "quote",
                assignedJobTypes: ["quote"],
                assignedRepairTypes: [],
                isDefault: true,
                sortIndex: 30,
                // Dispatcher-filled. NO cost field — technicians must never see cost.
                fields: [
                    { name: "scope_of_work",                   label: "Scope of Work",                              type: "text",     required: true },
                    { name: "parts_list",                      label: "Parts List (one per line)",                  type: "text",     required: true },
                    { name: "labor_hours_estimated",           label: "Labor Hours (estimated)",                    type: "number",   required: true },
                    { name: "urgency",                         label: "Urgency",                                    type: "dropdown", required: true,  options: ["Emergency", "Urgent (within 48 hr)", "Standard (within 1 wk)", "Scheduled / Planned"] },
                    { name: "customer_authorization_received", label: "Customer Authorization Received?",           type: "toggle",   required: true },
                    { name: "customer_authorized_by_name",     label: "Authorized By (name)",                       type: "text",     required: false },
                    { name: "damage_photo",                    label: "Photo of Damage / Failed Component",         type: "photo",    required: true },
                    { name: "additional_photo",                label: "Additional Reference Photo",                 type: "photo",    required: false },
                ],
            },
        },
        {
            id: "seed_warranty_repair_form",
            doc: {
                templateName: "Warranty Repair",
                targetKeyword: "warranty",
                active: true,
                formCategory: "service_call",
                assignedJobTypes: ["service"],
                assignedRepairTypes: [],
                isDefault: false,
                sortIndex: 40,
                // Top 4 dispatcher-filled (required:false so tech isn't blocked).
                // Bottom 3 are the tech post-repair report.
                // Pre-captured at initial diagnosis (not duplicated here):
                //   manufacturer / model / serial / install date / warranty start date / nameplate photo.
                fields: [
                    { name: "warranty_claim_number",         label: "Warranty Claim #",                              type: "text",        required: false },
                    { name: "parts_under_warranty",          label: "Parts Under Warranty",                          type: "multi_check", required: false, options: ["Compressor", "Coil", "Heat exchanger", "Control board", "Motor", "Capacitor", "Gas valve", "Igniter / flame sensor", "Other"] },
                    { name: "failure_mode",                  label: "Failure Mode",                                  type: "dropdown",    required: false, options: ["Electrical short / open", "Mechanical seizure", "Refrigerant leak", "Cracked / corroded", "Software / control fault", "Premature wear", "Other"] },
                    { name: "warranty_action_taken",         label: "Warranty Action Taken",                         type: "dropdown",    required: false, options: ["Replace under warranty", "Repair under warranty", "Denied — out of warranty", "Pending mfr response"] },
                    { name: "system_operating_normally",     label: "System Operating Normally After Repair?",       type: "toggle",      required: true },
                    { name: "further_issues_found",          label: "Further Issues Found (tech notes)",             type: "text",        required: false },
                    { name: "post_repair_photo",             label: "Photo — System After Repair",                   type: "photo",       required: true },
                ],
            },
        },
        {
            id: "seed_supply_fan_replacement",
            doc: {
                templateName: "Supply Fan Replacement",
                targetKeyword: "supply fan",
                active: true,
                formCategory: "repair_checklist",
                assignedJobTypes: ["service"],
                assignedRepairTypes: ["supply_fan"],
                isDefault: false,
                sortIndex: 50,
                // install_date removed — captured automatically at job complete.
                // blower_shaft_size / blower_sheave_size / bearings_needed_count are
                // conditional on "Worn" bearings — kept required:false (no schema-level conditional).
                fields: [
                    { name: "old_motor_nameplate_photo",     label: "Diagnosis — Photo of Old Motor Nameplate (HP / RPM / frame)",          type: "photo",    required: true },
                    { name: "motor_sheave_size",             label: "Diagnosis — Motor Sheave Size",                                        type: "text",     required: true },
                    { name: "motor_sheave_adjustable",       label: "Diagnosis — Is Motor Sheave Adjustable?",                              type: "toggle",   required: true },
                    { name: "belt_size",                     label: "Diagnosis — Belt Size",                                                type: "text",     required: true },
                    { name: "blower_bearings_condition",     label: "Diagnosis — Blower Bearings Condition",                                type: "dropdown", required: true,  options: ["OK", "Worn"] },
                    { name: "blower_shaft_size",             label: "Diagnosis — Blower Shaft Size (if bearings worn)",                     type: "text",     required: false },
                    { name: "blower_sheave_size",            label: "Diagnosis — Blower Sheave Size (if bearings worn)",                    type: "text",     required: false },
                    { name: "bearings_needed_count",         label: "Diagnosis — Bearings Needed for Blower Assembly (count, if worn)",     type: "number",   required: false },
                    { name: "amp_draw_at_completion",        label: "Replacement — Amp Draw at Completion (A)",                             type: "number",   required: true },
                    { name: "rotation_verified",             label: "Replacement — Rotation Verified?",                                     type: "toggle",   required: true },
                    { name: "vibration_check_passed",        label: "Replacement — Vibration Check Passed?",                                type: "toggle",   required: true },
                    { name: "new_install_photo",             label: "Replacement — Photo of New Install",                                   type: "photo",    required: true },
                ],
            },
        },
        {
            id: "seed_condenser_fan_replacement",
            doc: {
                templateName: "Condenser Fan Replacement",
                targetKeyword: "condenser fan",
                active: true,
                formCategory: "repair_checklist",
                assignedJobTypes: ["service"],
                assignedRepairTypes: ["condenser_fan"],
                isDefault: false,
                sortIndex: 60,
                // Photo fallback chain: motor nameplate (preferred) → unit nameplate → model/serial tag inside unit.
                fields: [
                    { name: "motor_nameplate_photo",         label: "Diagnosis — Photo of Condenser Fan Motor Nameplate (HP / RPM, etc.)",                       type: "photo",    required: true },
                    { name: "unit_nameplate_photo",          label: "Diagnosis — Photo of Unit Nameplate (fallback if motor plate worn)",                        type: "photo",    required: false },
                    { name: "model_serial_tag_photo",        label: "Diagnosis — Photo of Model/Serial Tag Inside Unit (fallback if both above are worn)",      type: "photo",    required: false },
                    { name: "nameplate_legibility_note",     label: "Diagnosis — Nameplate Legibility Note",                                                     type: "text",     required: false },
                    { name: "amp_draw_at_completion",        label: "Replacement — Amp Draw at Completion (A)",                                                  type: "number",   required: true },
                    { name: "rotation_verified",             label: "Replacement — Rotation Verified?",                                                          type: "toggle",   required: true },
                    { name: "new_install_photo",             label: "Replacement — Photo of New Install",                                                        type: "photo",    required: true },
                ],
            },
        },
        {
            id: "seed_gas_valve_replacement",
            doc: {
                templateName: "Gas Valve Replacement",
                targetKeyword: "gas valve",
                active: true,
                formCategory: "repair_checklist",
                assignedJobTypes: ["service"],
                assignedRepairTypes: ["gas_valve"],
                isDefault: false,
                sortIndex: 70,
                fields: [
                    { name: "gas_type",                      label: "Diagnosis — Gas Type",                                                 type: "dropdown", required: true,  options: ["Natural Gas (NG)", "Propane / LP"] },
                    { name: "has_gas_regulator",             label: "Diagnosis — Does System Have a Gas Regulator?",                        type: "toggle",   required: true },
                    { name: "inlet_pressure_diagnosis_iwc",  label: "Diagnosis — Inlet Gas Pressure (″ WC)",                                type: "number",   required: true },
                    { name: "manifold_pressure_after_iwc",   label: "Replacement — Manifold Pressure (″ WC)",                               type: "number",   required: true },
                    { name: "inlet_pressure_after_iwc",      label: "Replacement — Inlet Gas Pressure After Repair (″ WC)",                 type: "number",   required: true },
                    { name: "leak_test_passed",              label: "Replacement — Leak Test Passed?",                                      type: "toggle",   required: true },
                    { name: "ignition_test_passed",          label: "Replacement — Ignition Test Passed?",                                  type: "toggle",   required: true },
                    { name: "flame_signal_microamps",        label: "Replacement — Flame Signal (µA)",                                      type: "number",   required: true },
                    { name: "new_valve_photo",               label: "Replacement — Photo of New Valve Installed",                           type: "photo",    required: true },
                ],
            },
        },
        {
            id: "seed_compressor_replacement",
            doc: {
                templateName: "Compressor Replacement",
                targetKeyword: "compressor",
                active: true,
                formCategory: "repair_checklist",
                assignedJobTypes: ["service"],
                assignedRepairTypes: ["compressor"],
                isDefault: false,
                sortIndex: 80,
                // Cooling vitals required on the Replacement phase per user spec.
                fields: [
                    { name: "nameplate_refrigerant_charge_lbs", label: "Diagnosis — Refrigerant Charge per Nameplate (lbs, this circuit)", type: "number",   required: true },
                    { name: "refrigerant_type",                 label: "Diagnosis — Refrigerant Type",                                     type: "dropdown", required: true,  options: ["R-410A", "R-22", "R-454B", "R-32", "R-407C", "Other"] },
                    { name: "old_compressor_photo",             label: "Diagnosis — Photo of Existing / Old Compressor",                   type: "photo",    required: true },
                    { name: "recovered_refrigerant_lbs",        label: "Replacement — Refrigerant Recovered (lbs)",                        type: "number",   required: true },
                    { name: "charge_added_lbs",                 label: "Replacement — Charge Added (lbs)",                                 type: "number",   required: true },
                    { name: "brazing_crimp_leak_test_passed",   label: "Replacement — Braze / Crimp Leak Test Passed?",                    type: "toggle",   required: true },
                    { name: "evacuation_microns",               label: "Replacement — Evacuation Pulled To (microns)",                     type: "number",   required: true },
                    { name: "running_amps",                     label: "Replacement — Running Amps (A)",                                   type: "number",   required: true },
                    { name: "suction_pressure_psi",             label: "Replacement — Suction Pressure (psi)",                             type: "number",   required: true },
                    { name: "discharge_pressure_psi",           label: "Replacement — Discharge Pressure (psi)",                           type: "number",   required: true },
                    { name: "superheat_f",                      label: "Replacement — Superheat (°F)",                                     type: "number",   required: true },
                    { name: "subcool_f",                        label: "Replacement — Subcool (°F)",                                       type: "number",   required: true },
                    { name: "supply_air_temp_f",                label: "Replacement — Supply Air Temp (°F)",                               type: "number",   required: true },
                    { name: "return_air_temp_f",                label: "Replacement — Return Air Temp (°F)",                               type: "number",   required: true },
                    { name: "outside_air_temp_f",               label: "Replacement — Outside Air Temp (°F)",                              type: "number",   required: true },
                    { name: "nameplate_photo",                  label: "Replacement — Photo of New Compressor Nameplate",                  type: "photo",    required: true },
                    { name: "install_photo",                    label: "Replacement — Photo of New Compressor Installed",                  type: "photo",    required: true },
                ],
            },
        },
        {
            id: "seed_refrigerant_leak_repair",
            doc: {
                templateName: "Refrigerant Leak Repair",
                targetKeyword: "refrigerant leak",
                active: true,
                formCategory: "repair_checklist",
                assignedJobTypes: ["service"],
                assignedRepairTypes: ["refrigerant_leak"],
                isDefault: false,
                sortIndex: 90,
                // Repair-phase fields are required:false so a diagnosis-only visit doesn't error out.
                fields: [
                    { name: "refrigerant_type",                  label: "Diagnosis — Refrigerant Type",                                          type: "dropdown", required: true,  options: ["R-410A", "R-22", "R-454B", "R-32", "R-407C", "Other"] },
                    { name: "initial_leak_detection_performed",  label: "Diagnosis — Was Initial Leak Detection Performed?",                     type: "toggle",   required: true },
                    { name: "leak_detection_method",             label: "Diagnosis — Leak Detection Method",                                     type: "dropdown", required: false, options: ["Electronic detector", "UV dye", "Soap bubble", "Nitrogen pressure", "Standing pressure / decay", "Other"] },
                    { name: "existing_suction_pressure_psi",     label: "Diagnosis — Existing Suction Pressure (psi)",                           type: "number",   required: true },
                    { name: "existing_discharge_pressure_psi",   label: "Diagnosis — Existing Discharge Pressure (psi)",                         type: "number",   required: true },
                    { name: "nameplate_refrigerant_charge_lbs",  label: "Diagnosis — Refrigerant Charge per Nameplate (lbs, this circuit)",      type: "number",   required: true },
                    { name: "leak_location_found",               label: "Diagnosis — Leak Location Found?",                                      type: "toggle",   required: true },
                    { name: "leak_location_photo_diagnosis",     label: "Diagnosis — Leak Location Photo (if found)",                            type: "photo",    required: false },
                    { name: "needs_quote_for_return_visit",      label: "Diagnosis — Needs Quote for Return-Visit Repair?",                      type: "toggle",   required: false },
                    { name: "pressure_test_psi",                 label: "Repair — Pressure-Tested To (psi)",                                     type: "number",   required: false },
                    { name: "pressure_held_minutes",             label: "Repair — Pressure Held For (min)",                                      type: "number",   required: false },
                    { name: "recovered_refrigerant_lbs",         label: "Repair — Refrigerant Recovered (lbs)",                                  type: "number",   required: false },
                    { name: "recharged_refrigerant_lbs",         label: "Repair — Refrigerant Recharged (lbs)",                                  type: "number",   required: false },
                    { name: "additional_refrigerant_added_lbs",  label: "Repair — Additional Refrigerant Added (lbs)",                           type: "number",   required: false },
                    { name: "leak_location",                     label: "Repair — Leak Location (final, in writing)",                            type: "text",     required: false },
                    { name: "repair_photo",                      label: "Repair — Photo of Completed Repair",                                    type: "photo",    required: false },
                ],
            },
        },
    ];

    function buildSeedPayload(doc) {
        // Shape mirrors saveFieldFormTemplate() in settings.js so the dispatcher
        // list and field renderer treat seeded docs identically to user-built docs.
        return {
            templateName: doc.templateName,
            targetKeyword: doc.targetKeyword,
            active: doc.active !== false,
            fields: doc.fields,
            formCategory: doc.formCategory || "general",
            assignedJobTypes: Array.isArray(doc.assignedJobTypes) ? doc.assignedJobTypes : [],
            assignedRepairTypes: Array.isArray(doc.assignedRepairTypes) ? doc.assignedRepairTypes : [],
            isDefault: !!doc.isDefault,
            sortIndex: Number.isFinite(doc.sortIndex) ? doc.sortIndex : 0,
            seedAt: SEED_AT,
            seedSource: SEED_SOURCE,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
    }

    /**
     * Reads each seed doc, classifies as create / update / skip, then writes.
     * Uses writeBatch when (creates + updates) > 5 for atomicity (per .cursorrules §5);
     * otherwise per-doc set() so a single bad doc doesn't poison the rest.
     *
     * Returns { created: number, updated: number, skipped: number, errors: string[] }.
     */
    async function seedDefaultFormTemplates() {
        var result = { created: 0, updated: 0, skipped: 0, errors: [] };

        if (!isFirebaseReady()) {
            result.errors.push("Firebase not initialized.");
            return result;
        }

        var db = firebase.firestore();
        var col = db.collection("form_templates");

        var snaps;
        try {
            snaps = await Promise.all(
                SEED_TEMPLATES.map(function (s) {
                    return col.doc(s.id).get();
                })
            );
        } catch (e) {
            result.errors.push("Read failed: " + (e && e.message ? e.message : String(e)));
            return result;
        }

        var plan = [];
        for (var i = 0; i < SEED_TEMPLATES.length; i++) {
            var seed = SEED_TEMPLATES[i];
            var snap = snaps[i];
            if (!snap || !snap.exists) {
                plan.push({ seed: seed, action: "create" });
                continue;
            }
            var docTs = readDocUpdatedAtMs(snap);
            if (docTs && docTs > SEED_AT_MS) {
                plan.push({ seed: seed, action: "skip" });
                result.skipped += 1;
                continue;
            }
            plan.push({ seed: seed, action: "update" });
        }

        var writes = plan.filter(function (p) {
            return p.action === "create" || p.action === "update";
        });

        if (writes.length === 0) {
            return result;
        }

        if (writes.length > 5) {
            // Single atomic batch — preferred path on fresh installs (9 creates).
            try {
                var batch = db.batch();
                writes.forEach(function (p) {
                    batch.set(col.doc(p.seed.id), buildSeedPayload(p.seed.doc), { merge: true });
                });
                await batch.commit();
                writes.forEach(function (p) {
                    if (p.action === "create") result.created += 1;
                    else result.updated += 1;
                });
            } catch (e) {
                var msg = "Batch write failed: " + (e && e.message ? e.message : String(e));
                result.errors.push(msg);
            }
            return result;
        }

        // Per-doc path (≤ 5 writes): isolate failures so partial success is preserved.
        for (var j = 0; j < writes.length; j++) {
            var p2 = writes[j];
            try {
                await col.doc(p2.seed.id).set(buildSeedPayload(p2.seed.doc), { merge: true });
                if (p2.action === "create") result.created += 1;
                else result.updated += 1;
            } catch (e2) {
                result.errors.push(
                    p2.seed.id + ": " + (e2 && e2.message ? e2.message : String(e2))
                );
            }
        }

        return result;
    }

    window.VCFormSeeds = {
        SEED_AT: SEED_AT,
        SEED_SOURCE: SEED_SOURCE,
        SEED_TEMPLATES: SEED_TEMPLATES,
        seedDefaultFormTemplates: seedDefaultFormTemplates,
    };

    try {
        console.info("[VC] repair_form_seeds v=1 loaded; SEED_AT=" + SEED_AT);
    } catch (e) {}
})();
