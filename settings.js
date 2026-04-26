// ====================================================================
// --- MASTER TEMPLATE SEED DATA (FROM SPREADSHEETS) ---
// ====================================================================
const seedDataApprentice = [
    { name: "LHKNL Headlamp Flashlight", category: "Accessories", vendor: "Amazon", bundle: false },
    { name: "3-Piece Magnetic Tray Holder", category: "Accessories", vendor: "Amazon", bundle: false },
    { name: "2-Piece Knipex Cobra Pliers Set", category: "Hand Tools", vendor: "Amazon", bundle: false },
    { name: "Milwaukee FASTBACK Flip Utility Knife", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Aluminum Pipe Wrench 14\"", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Aluminum Pipe Wrench 18\"", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Aluminum Pipe Wrench 24\"", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "PVC Cutter", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Drill Bit Set", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "5/8\" x 50 FT Heavy Rope", category: "Accessories", vendor: "Home Depot", bundle: false },
    { name: "Klein Tools Digital Dual-Range Non-Contact Voltage Tester", category: "Diagnostic", vendor: "Home Depot", bundle: false },
    { name: "Husky 10 in. Adjustable Wrench", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Klein Tools Heavy-Duty Flathead Demolition Screwdriver", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Milwaukee Folding Drywall Jab Saw", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Klein Tools Kurve Wire Stripper", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "9 in. Crimping and Cutting Tool", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "8\" High-Leverage Diagonal-Cutting Pliers", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Malco TBP33 Heavy-Duty Tool Backpack Bundle", category: "Tool Bag", vendor: "USA Tool Depot", bundle: false },
    { name: "C5R REDLINE 5-Blade Pipe Crimper", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "SL1R REDLINE Snap Lock Punch", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "N1R REDLINE Hand Notcher", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "S2R REDLINE Hand Seamer", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "12F Folding Tool (12\")", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "18 Divider", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "M2001 Aviation Snip (Left Cut)", category: "Hand Tool (Cutting)", vendor: "USA Tool Depot", bundle: true },
    { name: "M2002 Aviation Snip (Right Cut)", category: "Hand Tool (Cutting)", vendor: "USA Tool Depot", bundle: true },
    { name: "M2005 Bulldog Aviation Snip", category: "Hand Tool (Cutting)", vendor: "USA Tool Depot", bundle: true },
    { name: "M14N 14\" Aluminum Handled Pattern Snip", category: "Hand Tool (Cutting)", vendor: "USA Tool Depot", bundle: true },
    { name: "A0 1/8\" Scratch Awl", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "A1 7/32\" Scratch Awl", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "SH3 Setting Hammer", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "DB1 Dead Blow Hammer", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "DS2 Offset Duct Stretcher", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "L9M Magnetic Torpedo Level", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "T416M 1\" x 16' Magnetic Tape Measure", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "W29 Hex Key Set", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "RD6 6-in-1 Reversible Driver", category: "Hand Tool (Driving)", vendor: "USA Tool Depot", bundle: true },
    { name: "HHD1S 1/4\" Magnetic Hex Driver", category: "Hand Tool (Driving)", vendor: "USA Tool Depot", bundle: true },
    { name: "HHD2S 5/16\" Magnetic Hex Driver", category: "Hand Tool (Driving)", vendor: "USA Tool Depot", bundle: true },
    { name: "TY4G Tie Tensioning Tool", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "TS1 TurboShear Attachment", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true },
    { name: "HC1 Hole Cutter", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true },
    { name: "MSH1/4 Magnetic Hex Chuck Driver", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true },
    { name: "MSH5/16 Magnetic Hex Chuck Driver", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true },
    { name: "4MC24 Reciprocating Saw Blade (6\" 24TPI)", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true }
];

const seedDataJman = [
    { name: "Test Lead Set & Alligator Clips", category: "Diagnostic", vendor: "Amazon", bundle: false },
    { name: "LCD Writing Tablet", category: "General", vendor: "Amazon", bundle: false },
    { name: "HVAC Service Wrench", category: "Hand Tool", vendor: "Amazon", bundle: false },
    { name: "Grease Gun", category: "Heavy Service", vendor: "Amazon", bundle: false },
    { name: "SAE 7-in-1 Impact Rated Socket Set", category: "Heavy Service", vendor: "Amazon", bundle: false },
    { name: "Shiv / Hub Puller (Posi-Lock)", category: "Heavy Service", vendor: "Amazon", bundle: false },
    { name: "1/4 in. x 3/8 in. Square Socket Adapter", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "1.5 in. Stiff Putty Knife", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "Alloy Steel Screw Driver Bit Set", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "4 in. Pocket Caliper", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "4-in-1 Precision Electronics Screwdriver", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "Telescoping Magnetic Pickup Tool", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "6 in. Magnetic Locking Bit Holder", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "12 in. Magnetic Locking Bit Holder", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "11-in-1 Magnetic Multi Bit Screwdriver", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "Electrician Scissors", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "Right Angle Drill Adapter", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "SAE Quad Drive Ratcheting Wrench Set", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "5/16 x 1/4 Short Drill Gun Bit", category: "Hand Tool", vendor: "Johnstone", bundle: false },
    { name: "Inspection Mirror", category: "Hand Tool", vendor: "Johnstone", bundle: false },
    { name: "Valve Core Removal Tool", category: "Hand Tool", vendor: "Johnstone", bundle: false },
    { name: "Folding Pocket Thermometer", category: "Diagnostic", vendor: "Johnstone", bundle: false },
    { name: "Rechargeable LED Flashlight", category: "Hand Tool", vendor: "Johnstone", bundle: false },
    { name: "SAE & Metric Ratcheting Wrenches", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Nitrogen Regulator", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Pulley Puller", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Vacuum Cleaner", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Refrigerant Scale", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Combustion Analyzer", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Vacuum Pump (Minimum 7 CFM)", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Refrigerant Recovery Machine", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Appion MGAVCR Valve Core Removal Tools", category: "Refrigeration", vendor: "TruTech", bundle: false },
    { name: "Dual-Port Digital Manometer", category: "Diagnostic", vendor: "TruTech", bundle: false },
    { name: "Wireless Vacuum Micron Gauge", category: "Refrigeration", vendor: "TruTech", bundle: false },
    { name: "Refrigerant Leak Detector", category: "Diagnostic", vendor: "TruTech", bundle: false },
    { name: "Hilmor Tool Tote Bag", category: "Tool Bag", vendor: "TruTech", bundle: false },
    { name: "1/4 inch Charging Hoses", category: "Refrigeration", vendor: "TruTech", bundle: true },
    { name: "Compact Clamp Meter", category: "Diagnostic", vendor: "TruTech", bundle: true },
    { name: "3-Port Digital Manifold", category: "Diagnostic", vendor: "TruTech", bundle: true },
    { name: "7 inch Wire Stripper", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "8 inch Tongue and Groove Pliers", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "9-in-1 Multi-Tool Driver", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "Compact Tubing Cutter", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "Folding Hex Key Set", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "Pen Style Deburring Tool", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "Reversible Magnetic Nut Driver", category: "Hand Tool", vendor: "TruTech", bundle: true },
    ...seedDataApprentice
];

const seedDataConsumables = [
    { name: "Wire Nuts (Assorted)", category: "Electrical", cost: 0.15, qty: 0, minLevel: 100, vendor: "Home Depot" },
    { name: "3M Super 33+ Electrical Tape", category: "Electrical", cost: 4.50, qty: 0, minLevel: 10, vendor: "Home Depot" },
    { name: "Clear PVC Glue", category: "Plumbing", cost: 8.00, qty: 0, minLevel: 3, vendor: "Home Depot" },
    { name: "PVC Primer", category: "Plumbing", cost: 7.00, qty: 0, minLevel: 3, vendor: "Home Depot" },
    { name: "Zip-in Screws HW8x1/2ZG", category: "Hardware", cost: 0.05, qty: 0, minLevel: 250, vendor: "USA Tool Depot" }
];

function processSeedData(arr) {
    let uniqueList = [];
    arr.forEach(item => {
        if (!uniqueList.find(u => u.name === item.name)) {
            item.url = `https://www.google.com/search?q=${encodeURIComponent(item.vendor + " " + item.name)}`;
            uniqueList.push(item);
        }
    });
    return uniqueList;
}

const masterJmanTemplate = processSeedData(seedDataJman);
const masterApprenticeTemplate = processSeedData(seedDataApprentice);

// HELPER FUNCTION: Prevents quotes from breaking the input boxes
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ====================================================================
// --- SETTINGS & TECHNICIAN LOGIC ---
// ====================================================================
let appTechList = [];
/** Per-tech: { onCallEligible, ptoDates, availability } keyed by roster name (uppercase). */
let techProfiles = {};

/** Firestore + Settings: weekly flags for service-day eligibility (dispatcher). */
const DEFAULT_TECH_AVAILABILITY = {
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: true,
    sun: true,
};

const AVAILABILITY_DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function normalizeTechAvailability(raw) {
    const out = {};
    AVAILABILITY_DAY_KEYS.forEach(function (k) {
        out[k] = !(raw && raw[k] === false);
    });
    return out;
}

/** Local date YYYY-MM-DD → weekday key (mon…sun). Noon avoids DST edge cases. */
function ymdToAvailabilityDayKey(ymd) {
    const p = String(ymd || "").trim().split("-");
    if (p.length !== 3) return null;
    const y = parseInt(p[0], 10);
    const m = parseInt(p[1], 10) - 1;
    const d = parseInt(p[2], 10);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
    const dt = new Date(y, m, d, 12, 0, 0);
    const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return keys[dt.getDay()] || null;
}

function formatWeekdayNameFromYmd(ymd) {
    const p = String(ymd || "").trim().split("-");
    if (p.length !== 3) return "that day";
    const y = parseInt(p[0], 10);
    const m = parseInt(p[1], 10) - 1;
    const d = parseInt(p[2], 10);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return "that day";
    const dt = new Date(y, m, d, 12, 0, 0);
    try {
        return dt.toLocaleDateString(undefined, { weekday: "long" });
    } catch (e) {
        return "that day";
    }
}

function getTechAvailabilityForJobDate(techName, ymd) {
    const key = ymdToAvailabilityDayKey(ymd);
    if (!key) return true;
    const prof = getTechProfile(techName);
    const a = prof.availability || DEFAULT_TECH_AVAILABILITY;
    return a[key] !== false;
}
/** Firestore app_config/onCallState — pause rotation + manual on-call tech. */
let onCallState = { pauseRotation: false, manualOnCallTech: "" };
let currentEditingTechInv = "";
let editingTemplateType = null; 
let currentInvTab = "tools";
let ptoModalTechIndex = -1;

/** Shown in Settings when a Gemini key exists in Firestore (not the real secret). */
const GEMINI_SETTINGS_MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

function onGeminiKeySettingsFocus(el) {
    if (el && el.dataset.maskedPlaceholder) {
        el.value = "";
        delete el.dataset.maskedPlaceholder;
    }
}

async function hydrateGeminiKeySettingsUi() {
    const el = document.getElementById("settingsGeminiKeyInput");
    if (!el || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    try {
        const snap = await firebase.firestore().collection("app_config").doc("api_keys").get();
        const g = snap.exists && snap.data().gemini ? String(snap.data().gemini).trim() : "";
        if (g) {
            el.value = GEMINI_SETTINGS_MASK;
            el.dataset.maskedPlaceholder = "1";
        } else {
            el.value = "";
            delete el.dataset.maskedPlaceholder;
        }
    } catch (e) {
        console.error("hydrateGeminiKeySettingsUi", e);
    }
}

async function saveGeminiApiKeyFromSettings() {
    const el = document.getElementById("settingsGeminiKeyInput");
    if (!el) return;
    const v = el.value.trim();
    if (el.dataset.maskedPlaceholder && (!v || v === GEMINI_SETTINGS_MASK)) {
        alert("A key is already saved. Focus the field and type a new key to replace it.");
        return;
    }
    if (!v) {
        alert("Enter a Gemini API key.");
        return;
    }
    try {
        await firebase.firestore().collection("app_config").doc("api_keys").set(
            { gemini: v },
            { merge: true }
        );
        if (typeof invalidateGeminiApiKeyCache === "function") {
            invalidateGeminiApiKeyCache();
        }
        el.value = GEMINI_SETTINGS_MASK;
        el.dataset.maskedPlaceholder = "1";
        if (typeof showSaveCue === "function") showSaveCue("✓ Gemini API key saved");
        else alert("Saved.");
    } catch (e) {
        console.error(e);
        alert("Could not save: " + (e.message || e));
    }
}

const ROTATION_ANCHOR_MONDAY = new Date(2024, 0, 1, 12, 0, 0);

function persistTechProfilesLocal() {
    try {
        localStorage.setItem("tp_tech_profiles", JSON.stringify(techProfiles));
    } catch (e) { /* ignore */ }
}

function getTechProfile(name) {
    const key = String(name || "").trim();
    if (!key) {
        return {
            onCallEligible: false,
            ptoDates: [],
            availability: normalizeTechAvailability(null),
        };
    }
    const p = techProfiles[key];
    if (!p) {
        return {
            onCallEligible: false,
            ptoDates: [],
            availability: normalizeTechAvailability(null),
        };
    }
    return {
        onCallEligible: !!p.onCallEligible,
        ptoDates: Array.isArray(p.ptoDates) ? p.ptoDates.slice() : [],
        availability: normalizeTechAvailability(p.availability),
    };
}

function setTechProfile(name, partial) {
    const key = String(name || "").trim();
    if (!key) return;
    const cur = getTechProfile(key);
    techProfiles[key] = {
        onCallEligible: partial.onCallEligible !== undefined ? !!partial.onCallEligible : cur.onCallEligible,
        ptoDates: partial.ptoDates !== undefined ? (Array.isArray(partial.ptoDates) ? partial.ptoDates.slice() : []) : cur.ptoDates,
        availability:
            partial.availability !== undefined
                ? normalizeTechAvailability(partial.availability)
                : cur.availability,
    };
    persistTechProfilesLocal();
    syncTechnicianRosterToFirestore();
}

/** Monday 00:00 local for the ISO week containing d (week starts Monday). */
function getMondayOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    return x;
}

function ymdFromDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
}

function parseYmdLocal(ymd) {
    const p = String(ymd || "").split("-");
    if (p.length !== 3) return null;
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12, 0, 0);
}

function weekRotationIndex(mondayDate) {
    const ms = mondayDate.getTime() - ROTATION_ANCHOR_MONDAY.getTime();
    return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

function getEligibleOnCallTechsOrdered() {
    return appTechList.filter(function (n) {
        return getTechProfile(n).onCallEligible;
    });
}

/**
 * Nominated on-call for the calendar week containing targetDate (rotation only; ignores PTO skips).
 * Used for PTO overlap warnings.
 */
function calculateProjectedOnCall(targetDate) {
    const d = targetDate instanceof Date ? targetDate : new Date(targetDate);
    const monday = getMondayOfWeek(d);
    const elig = getEligibleOnCallTechsOrdered();
    if (!elig.length) return null;
    const idx = ((weekRotationIndex(monday) % elig.length) + elig.length) % elig.length;
    return elig[idx];
}

function techHasPtoAnyDayInWeek(techName, weekMonday) {
    const pto = getTechProfile(techName).ptoDates;
    if (!pto.length) return false;
    const set = {};
    pto.forEach(function (y) { set[y] = true; });
    for (let i = 0; i < 7; i++) {
        const x = new Date(weekMonday);
        x.setDate(x.getDate() + i);
        if (set[ymdFromDate(x)]) return true;
    }
    return false;
}

/**
 * Effective on-call tech for a given instant: manual override, or rotation with PTO skips.
 */
function getEffectiveOnCallTech(now) {
    const t = now instanceof Date ? now : new Date(now);
    if (onCallState.pauseRotation && onCallState.manualOnCallTech) {
        return onCallState.manualOnCallTech;
    }
    const monday = getMondayOfWeek(t);
    const elig = getEligibleOnCallTechsOrdered();
    if (!elig.length) return null;
    const wk = weekRotationIndex(monday);
    const startIdx = ((wk % elig.length) + elig.length) % elig.length;
    for (let i = 0; i < elig.length; i++) {
        const idx = (startIdx + i) % elig.length;
        const name = elig[idx];
        if (!techHasPtoAnyDayInWeek(name, monday)) return name;
    }
    return null;
}

/** Monday–Friday 7:00 AM–4:00 PM local (4:00 PM inclusive). */
function isWithinStandardBusinessHours(date) {
    const day = date.getDay();
    if (day === 0 || day === 6) return false;
    const mins = date.getHours() * 60 + date.getMinutes();
    return mins >= 7 * 60 && mins <= 16 * 60;
}

/**
 * Dispatch board status label + CSS class for tech row.
 */
function evaluateTechStatus(techFullName) {
    const name = String(techFullName || "").trim();
    const prof = getTechProfile(name);
    const today = ymdFromDate(new Date());
    const pto = prof.ptoDates || [];
    if (pto.indexOf(today) >= 0) {
        return { label: "Inactive (PTO)", className: "tech-status-pto" };
    }
    if (isWithinStandardBusinessHours(new Date())) {
        return { label: "Active", className: "tech-status-active" };
    }
    const oncall = getEffectiveOnCallTech(new Date());
    if (oncall && oncall === name) {
        return { label: "Active", className: "tech-status-active" };
    }
    return { label: "Inactive", className: "tech-status-inactive" };
}

function expandDateRangeToYmdList(startYmd, endYmd) {
    const a = parseYmdLocal(startYmd);
    const b = parseYmdLocal(endYmd);
    if (!a || !b || a > b) return [];
    const out = [];
    const cur = new Date(a);
    while (cur <= b) {
        out.push(ymdFromDate(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}

function weeksOverlappingYmdRange(startYmd, endYmd) {
    const list = expandDateRangeToYmdList(startYmd, endYmd);
    const mondays = {};
    list.forEach(function (y) {
        const mon = getMondayOfWeek(parseYmdLocal(y));
        mondays[ymdFromDate(mon)] = true;
    });
    return Object.keys(mondays);
}

function checkPtoOverlapsProjectedOnCall(techName, startYmd, endYmd) {
    const weeks = weeksOverlappingYmdRange(startYmd, endYmd);
    const hits = [];
    weeks.forEach(function (monYmd) {
        const mon = parseYmdLocal(monYmd);
        const projected = calculateProjectedOnCall(mon);
        if (projected && projected === techName) hits.push(monYmd);
    });
    return hits;
}

/** Load technician roster: tenants/{tenantId}/roster/default, else legacy app_config/technicians, else localStorage. */
async function hydrateTechnicianRosterFromCloud() {
    appTechList = [];
    let loadedFromCloud = false;
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
        try {
            const db = firebase.firestore();
            let snap = null;
            if (typeof VCFirestore !== 'undefined') {
                snap = await VCFirestore.rosterDoc(db).get();
            }
            if (snap && snap.exists) {
                const data = snap.data() || {};
                if (Array.isArray(data.names) && data.names.length) {
                    appTechList = data.names.map(function (n) { return String(n).trim(); }).filter(Boolean);
                    loadedFromCloud = true;
                    localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));
                }
                if (data.profiles && typeof data.profiles === "object") {
                    techProfiles = {};
                    Object.keys(data.profiles).forEach(function (k) {
                        const raw = data.profiles[k] || {};
                        techProfiles[String(k).trim()] = {
                            onCallEligible: !!raw.onCallEligible,
                            ptoDates: Array.isArray(raw.ptoDates) ? raw.ptoDates.map(function (d) { return String(d).trim(); }).filter(Boolean) : [],
                            availability: normalizeTechAvailability(raw.availability),
                        };
                    });
                    persistTechProfilesLocal();
                }
            }
            if (!loadedFromCloud) {
                const leg = await db.collection('app_config').doc('technicians').get();
                if (leg.exists) {
                    const data = leg.data() || {};
                    if (Array.isArray(data.names) && data.names.length) {
                        appTechList = data.names.map(function (n) { return String(n).trim(); }).filter(Boolean);
                        loadedFromCloud = true;
                        localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));
                    }
                    if (Object.keys(techProfiles).length === 0 && data.profiles && typeof data.profiles === "object") {
                        techProfiles = {};
                        Object.keys(data.profiles).forEach(function (k) {
                            const raw = data.profiles[k] || {};
                            techProfiles[String(k).trim()] = {
                                onCallEligible: !!raw.onCallEligible,
                                ptoDates: Array.isArray(raw.ptoDates) ? raw.ptoDates.map(function (d) { return String(d).trim(); }).filter(Boolean) : [],
                                availability: normalizeTechAvailability(raw.availability),
                            };
                        });
                        persistTechProfilesLocal();
                    }
                }
            }
        } catch (e) {
            console.error('hydrateTechnicianRosterFromCloud', e);
        }
    }
    if (!loadedFromCloud) {
        const saved = localStorage.getItem('tp_tech_list');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) appTechList = parsed;
            } catch (e) { /* ignore */ }
        }
    }
    if (Object.keys(techProfiles).length === 0) {
        const lp = localStorage.getItem("tp_tech_profiles");
        if (lp) {
            try {
                const parsed = JSON.parse(lp);
                if (parsed && typeof parsed === "object") techProfiles = parsed;
            } catch (e) { /* ignore */ }
        }
    }
}

async function hydrateOnCallStateFromCloud() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
        try {
            const ls = localStorage.getItem("tp_on_call_state");
            if (ls) onCallState = JSON.parse(ls);
        } catch (e) { /* ignore */ }
        return;
    }
    try {
        const db = firebase.firestore();
        let snap = null;
        if (typeof VCFirestore !== 'undefined') {
            snap = await VCFirestore.onCallStateDoc(db).get();
        }
        if (!snap || !snap.exists) {
            snap = await db.collection('app_config').doc('onCallState').get();
        }
        if (snap.exists) {
            const d = snap.data() || {};
            onCallState = {
                pauseRotation: !!d.pauseRotation,
                manualOnCallTech: d.manualOnCallTech ? String(d.manualOnCallTech).trim() : ""
            };
        } else {
            try {
                const ls = localStorage.getItem("tp_on_call_state");
                if (ls) onCallState = JSON.parse(ls);
            } catch (e) { /* ignore */ }
        }
    } catch (e) {
        console.error('hydrateOnCallStateFromCloud', e);
        try {
            const ls = localStorage.getItem("tp_on_call_state");
            if (ls) onCallState = JSON.parse(ls);
        } catch (e2) { /* ignore */ }
    }
    try {
        localStorage.setItem("tp_on_call_state", JSON.stringify(onCallState));
    } catch (e) { /* ignore */ }
}

/** Re-fetch roster from cloud when opening Settings (optional refresh). */
async function refreshTechnicianRosterFromCloud() {
    await hydrateTechnicianRosterFromCloud();
    await hydrateOnCallStateFromCloud();
    await hydrateGeminiKeySettingsUi();
    renderTechSettings();
    renderOnCallPanel();
    populateTechDropdowns();
}

async function loadAppTechs() {
    await hydrateTechnicianRosterFromCloud();
    await hydrateOnCallStateFromCloud();
    await hydrateInventoryTemplatesFromFirestore();
    await hydrateGeminiKeySettingsUi();

    let masterDB = getMasterTemplatesDB();
    if (!masterDB["jman_consumables"]) {
        masterDB["jman_consumables"] = { tools: [], consumables: seedDataConsumables };
        persistInventoryStorage("tp_master_templates", masterDB);
    }

    renderTechSettings();
    renderOnCallPanel();
    renderMasterTemplates();
    populateTechDropdowns();
    syncTechnicianRosterToFirestore();

    setTimeout(checkGlobalVMI, 500);
}

/** Pushes the office technician roster + profiles to tenant roster (and legacy doc for migration). */
function syncTechnicianRosterToFirestore() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return;
    try {
        const db = firebase.firestore();
        const payload = {
            names: appTechList.slice(),
            profiles: techProfiles,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (typeof VCFirestore !== 'undefined') {
            VCFirestore.rosterDoc(db).set(payload, { merge: true });
        }
        db.collection('app_config').doc('technicians').set(payload, { merge: true });
    } catch (e) {
        console.error('syncTechnicianRosterToFirestore', e);
    }
}

function syncOnCallStateToFirestore() {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return;
    try {
        const db = firebase.firestore();
        const payload = {
            pauseRotation: !!onCallState.pauseRotation,
            manualOnCallTech: onCallState.manualOnCallTech || "",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (typeof VCFirestore !== 'undefined') {
            VCFirestore.onCallStateDoc(db).set(payload, { merge: true });
        }
        db.collection('app_config').doc('onCallState').set(payload, { merge: true });
    } catch (e) {
        console.error('syncOnCallStateToFirestore', e);
    }
    try {
        localStorage.setItem("tp_on_call_state", JSON.stringify(onCallState));
    } catch (e) { /* ignore */ }
}

function renderOnCallPanel() {
    const el = document.getElementById("onCallManagementPanel");
    if (!el) return;
    const effective = getEffectiveOnCallTech(new Date());
    const projectedWeek = calculateProjectedOnCall(new Date());
    const pause = onCallState.pauseRotation;
    const elig = getEligibleOnCallTechsOrdered();
    let html = "";
    html += '<div style="font-weight:bold;color:#0ea5e9;margin-bottom:8px;">On-Call Management</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;margin-bottom:12px;">';
    html += '<div style="min-width:220px;"><span style="color:#555;font-size:12px;">Current on-call</span><br/>';
    html += '<strong style="font-size:16px;">' + escapeHTML(effective || "—") + '</strong>';
    if (!pause && projectedWeek && projectedWeek !== effective) {
        html += '<div style="font-size:11px;color:#7f8c8d;margin-top:4px;">Rotation slot (this week): ' + escapeHTML(projectedWeek) + "</div>";
    }
    html += "</div>";
    html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;">';
    html += '<input type="checkbox" id="onCallPauseRotation" ' + (pause ? "checked" : "") + ' onchange="onOnCallPauseToggle(this.checked)" />';
    html += '<span>Pause automatic rotation (manual override)</span></label>';
    html += "</div>";
    html += '<div id="onCallManualWrap" style="margin-top:10px;' + (pause ? "" : "display:none;") + '">';
    html += '<label style="font-size:12px;color:#555;">On-call technician</label><br/>';
    html += '<select id="onCallManualSelect" style="margin-top:4px;padding:8px;min-width:260px;border-radius:4px;border:1px solid #ccc;" onchange="onOnCallManualChange(this.value)">';
    html += '<option value="">— Select —</option>';
    elig.forEach(function (n) {
        html += '<option value="' + escapeHTML(n) + '" ' + (onCallState.manualOnCallTech === n ? "selected" : "") + ">" + escapeHTML(n) + "</option>";
    });
    html += "</select>";
    html += '<p style="font-size:11px;color:#7f8c8d;margin:8px 0 0 0;">While paused, this technician stays on-call until you turn the toggle off.</p>';
    html += "</div>";
    el.innerHTML = html;
}

function onOnCallPauseToggle(checked) {
    onCallState.pauseRotation = !!checked;
    const wrap = document.getElementById("onCallManualWrap");
    if (wrap) wrap.style.display = checked ? "block" : "none";
    if (!checked) onCallState.manualOnCallTech = "";
    syncOnCallStateToFirestore();
    renderOnCallPanel();
    if (typeof renderServiceBoard === "function") {
        try { renderServiceBoard(); } catch (e) {}
    }
    if (typeof showSaveCue === "function") showSaveCue("On-call settings saved");
}

function onOnCallManualChange(val) {
    onCallState.manualOnCallTech = String(val || "").trim();
    syncOnCallStateToFirestore();
    renderOnCallPanel();
    if (typeof renderServiceBoard === "function") {
        try { renderServiceBoard(); } catch (e) {}
    }
    if (typeof showSaveCue === "function") showSaveCue("On-call override saved");
}

function setTechOnCallEligible(index, eligible) {
    const name = appTechList[index];
    if (!name) return;
    const p = getTechProfile(name);
    p.onCallEligible = !!eligible;
    setTechProfile(name, p);
    renderOnCallPanel();
    if (typeof showSaveCue === "function") showSaveCue("Technician updated");
}

function openPtoModal(index) {
    ptoModalTechIndex = index;
    const name = appTechList[index];
    if (!name) return;
    const modal = document.getElementById("ptoModal");
    const title = document.getElementById("ptoModalTitle");
    const start = document.getElementById("ptoStartInput");
    const end = document.getElementById("ptoEndInput");
    if (title) title.textContent = "PTO — " + name;
    const today = ymdFromDate(new Date());
    if (start) start.value = today;
    if (end) end.value = today;
    if (modal) modal.style.display = "flex";
}

function closePtoModal() {
    const modal = document.getElementById("ptoModal");
    if (modal) modal.style.display = "none";
    ptoModalTechIndex = -1;
}

function savePtoRange() {
    if (ptoModalTechIndex < 0) return;
    const name = appTechList[ptoModalTechIndex];
    const start = document.getElementById("ptoStartInput");
    const end = document.getElementById("ptoEndInput");
    if (!start || !end || !name) return;
    const s = start.value;
    const e = end.value;
    if (!s || !e) {
        alert("Choose start and end dates.");
        return;
    }
    const newDays = expandDateRangeToYmdList(s, e);
    if (!newDays.length) {
        alert("Invalid date range.");
        return;
    }
    const hits = checkPtoOverlapsProjectedOnCall(name, s, e);
    if (hits.length) {
        alert(
            "⚠️ WARNING: " + name + " is scheduled to be On-Call during these dates. The system will skip them. Please ensure coverage is manually assigned if needed."
        );
    }
    const p = getTechProfile(name);
    const merged = {};
    p.ptoDates.forEach(function (d) { merged[d] = true; });
    newDays.forEach(function (d) { merged[d] = true; });
    p.ptoDates = Object.keys(merged).sort();
    setTechProfile(name, p);
    closePtoModal();
    renderTechSettings();
    renderOnCallPanel();
    if (typeof renderServiceBoard === "function") {
        try { renderServiceBoard(); } catch (e) {}
    }
    if (typeof showSaveCue === "function") showSaveCue("PTO saved");
}

const AVAILABILITY_DAY_UI = [
    { key: "mon", label: "M" },
    { key: "tue", label: "T" },
    { key: "wed", label: "W" },
    { key: "thu", label: "Th" },
    { key: "fri", label: "F" },
    { key: "sat", label: "S" },
    { key: "sun", label: "Su" },
];

function setTechAvailabilityDay(techIndex, dayKey, checked) {
    const name = appTechList[techIndex];
    if (!name || AVAILABILITY_DAY_KEYS.indexOf(dayKey) === -1) return;
    const p = getTechProfile(name);
    const next = Object.assign({}, p.availability);
    next[dayKey] = !!checked;
    setTechProfile(name, { availability: next });
    renderTechSettings();
    if (typeof populateTechDropdowns === "function") populateTechDropdowns();
    if (typeof showSaveCue === "function") showSaveCue("Availability updated");
}

function renderTechSettings() {
    const container = document.getElementById('techListContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (appTechList.length === 0) {
        container.innerHTML = '<div style="padding: 15px; background: #fdfefe; border: 1px solid #eaeaea; border-radius: 4px; color: #7f8c8d; font-style: italic;">No technicians currently added.</div>';
        return;
    }

    appTechList.forEach((tech, index) => {
        const elig = getTechProfile(tech).onCallEligible;
        const av = getTechProfile(tech).availability;
        const safe = escapeHTML(tech);
        let dayRow =
            '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #eef2f6;font-size:12px;color:#475569;">';
        dayRow +=
            '<span style="font-weight:600;margin-right:4px;flex-shrink:0;">Service days (dispatch):</span>';
        dayRow += '<span style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">';
        AVAILABILITY_DAY_UI.forEach(function (d) {
            const on = av[d.key] !== false;
            dayRow +=
                '<label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;user-select:none;white-space:nowrap;">' +
                '<input type="checkbox" ' +
                (on ? "checked " : "") +
                'onchange="setTechAvailabilityDay(' +
                index +
                ", '" +
                d.key +
                "', this.checked)" +
                '" />' +
                escapeHTML(d.label) +
                "</label>";
        });
        dayRow += "</span></div>";
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; background:#fff; padding:12px 15px; border-radius:6px; border:1px solid #e1e8ed; box-shadow: 0 1px 3px rgba(0,0,0,0.02); flex-wrap:wrap;">
                <div style="flex:1; min-width:200px;">
                    <div style="font-weight:bold; color:#2c3e50; font-size:15px; text-transform:uppercase; margin-bottom:8px;">👤 ${safe}</div>
                    <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:#444; cursor:pointer; user-select:none;">
                        <input type="checkbox" ${elig ? "checked" : ""} onchange="setTechOnCallEligible(${index}, this.checked)" />
                        Eligible for On-Call Rotation
                    </label>
                    ${dayRow}
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
                    <button type="button" class="gen-btn" style="background:#16a085; padding:6px 12px; font-size:12px; border-radius:4px;" onclick="openPtoModal(${index})">Manage PTO</button>
                    <button type="button" class="gen-btn" style="background:#0ea5e9; padding:6px 12px; font-size:12px; border-radius:4px;" onclick="openTruckInventoryByIndex(${index})">🎒 Inventory</button>
                    <button type="button" class="gen-btn" style="background:#3498db; padding:6px 12px; font-size:12px; border-radius:4px;" onclick="editTechnician(${index})">Edit</button>
                    <button type="button" class="gen-btn" style="background:#e74c3c; padding:6px 12px; font-size:12px; border-radius:4px;" onclick="removeTechnician(${index})">Remove</button>
                </div>
            </div>
        `;
    });
}

function addNewTechnician() {
    const input = document.getElementById('newTechNameInput');
    const chk = document.getElementById('newTechOnCallEligible');
    const name = input.value.trim().toUpperCase();
    if (name === '') return;
    if (appTechList.includes(name)) {
        alert("This technician is already on the roster!");
        return;
    }
    appTechList.push(name);
    localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));
    const wantElig = chk && chk.checked;
    setTechProfile(name, { onCallEligible: wantElig, ptoDates: [] });
    input.value = '';
    if (chk) chk.checked = false;
    renderTechSettings();
    renderOnCallPanel();
    populateTechDropdowns();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Technician Added");
}

function editTechnician(index) {
    const currentName = appTechList[index];
    const newName = prompt("Edit Technician Name:", currentName);
    if (newName === null || newName.trim() === '') return;
    
    const cleanName = newName.trim().toUpperCase();
    if (cleanName === currentName) return;

    if (appTechList.includes(cleanName)) {
        alert("This technician name is already in use!");
        return;
    }

    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    if (invDB[currentName]) {
        invDB[cleanName] = invDB[currentName];
        delete invDB[currentName];
        localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
    }

    if (techProfiles[currentName]) {
        techProfiles[cleanName] = techProfiles[currentName];
        delete techProfiles[currentName];
        persistTechProfilesLocal();
    }

    appTechList[index] = cleanName;
    localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));

    renderTechSettings();
    renderOnCallPanel();
    populateTechDropdowns();
    syncTechnicianRosterToFirestore();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Technician Updated");
}

function removeTechnician(index) {
    const techName = appTechList[index];
    if (confirm(`Are you sure you want to remove ${techName} from the roster?`)) {
        appTechList.splice(index, 1);
        localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));
        
        let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
        if (invDB[techName]) {
            delete invDB[techName];
            localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
        }

        if (techProfiles[techName]) {
            delete techProfiles[techName];
            persistTechProfilesLocal();
        }
        if (onCallState.manualOnCallTech === techName) {
            onCallState.manualOnCallTech = "";
            syncOnCallStateToFirestore();
        }

        renderTechSettings();
        renderOnCallPanel();
        populateTechDropdowns();
        syncTechnicianRosterToFirestore();
        if(typeof showSaveCue === 'function') showSaveCue("✓ Technician Removed");
        checkGlobalVMI();
    }
}

function populateTechDropdowns() {
    if (typeof buildServiceAssignedTechForm === "function") {
        buildServiceAssignedTechForm(appTechList);
    }
    if (typeof renderGanttHeaders === 'function') {
        try { renderGanttHeaders(); renderServiceBoard(); } catch(e) {}
    }
}

// ====================================================================
// --- DYNAMIC TEMPLATE MANAGEMENT (Firestore: app_config/inventory_templates) ---
// ====================================================================

function buildDefaultMasterTemplatesDB() {
    return {
        jman: { tools: masterJmanTemplate, consumables: [] },
        apprentice: { tools: masterApprenticeTemplate, consumables: [] },
        jman_consumables: { tools: [], consumables: seedDataConsumables }
    };
}

function getMasterTemplatesDB() {
    try {
        return JSON.parse(localStorage.getItem("tp_master_templates") || "{}");
    } catch (e) {
        return {};
    }
}

/**
 * Global persistence for master inventory templates (JMAN, APPRENTICE, etc.).
 * Path: collection app_config, document inventory_templates, field templates (object map).
 */
async function writeInventoryTemplatesToFirestore(masterDB) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    await firebase.firestore().collection("app_config").doc("inventory_templates").set(
        {
            templates: masterDB,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
    );
}

function syncInventoryTemplatesToFirestore() {
    const masterDB = getMasterTemplatesDB();
    writeInventoryTemplatesToFirestore(masterDB).catch(function (e) {
        console.error("syncInventoryTemplatesToFirestore", e);
    });
}

/** Writes local cache; syncs master templates to Firestore when key is tp_master_templates. */
function persistInventoryStorage(storageKey, db) {
    localStorage.setItem(storageKey, JSON.stringify(db));
    if (storageKey === "tp_master_templates") {
        syncInventoryTemplatesToFirestore();
    }
}

function syncTruckInventoriesToFirestore() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    try {
        const invDB = JSON.parse(localStorage.getItem("tp_truck_inventories") || "{}");
        firebase.firestore().collection("app_config").doc("truck_inventories").set(
            {
                dataJson: JSON.stringify(invDB),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
        );
    } catch (e) {
        console.error("syncTruckInventoriesToFirestore", e);
    }
}

/**
 * Silent migration: load app_config/inventory_templates; if absent, seed from built-in
 * masterJmanTemplate / masterApprenticeTemplate / seedDataConsumables and local cache, then upload once.
 */
async function hydrateInventoryTemplatesFromFirestore() {
    const defaults = buildDefaultMasterTemplatesDB();
    const applyLocal = function (masterDB) {
        localStorage.setItem("tp_master_templates", JSON.stringify(masterDB));
    };

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
        let masterDB = getMasterTemplatesDB();
        if (Object.keys(masterDB).length === 0) {
            applyLocal(defaults);
        } else if (!masterDB.jman_consumables) {
            masterDB.jman_consumables = { tools: [], consumables: seedDataConsumables };
            applyLocal(masterDB);
        }
        return;
    }

    try {
        const snap = await firebase.firestore().collection("app_config").doc("inventory_templates").get();
        if (!snap.exists) {
            let masterDB = getMasterTemplatesDB();
            if (Object.keys(masterDB).length === 0) {
                masterDB = defaults;
            }
            if (!masterDB.jman_consumables) {
                masterDB.jman_consumables = { tools: [], consumables: seedDataConsumables };
            }
            applyLocal(masterDB);
            await writeInventoryTemplatesToFirestore(getMasterTemplatesDB());
            return;
        }
        const data = snap.data() || {};
        const masterDB =
            data.templates && typeof data.templates === "object" ? data.templates : {};
        if (Object.keys(masterDB).length === 0) {
            let localFallback = getMasterTemplatesDB();
            const merged = Object.keys(localFallback).length ? localFallback : defaults;
            if (!merged.jman_consumables) {
                merged.jman_consumables = { tools: [], consumables: seedDataConsumables };
            }
            applyLocal(merged);
            await writeInventoryTemplatesToFirestore(getMasterTemplatesDB());
            return;
        }
        if (!masterDB.jman_consumables) {
            masterDB.jman_consumables = { tools: [], consumables: seedDataConsumables };
        }
        applyLocal(masterDB);
    } catch (e) {
        console.error("hydrateInventoryTemplatesFromFirestore", e);
        let masterDB = getMasterTemplatesDB();
        if (Object.keys(masterDB).length === 0) {
            applyLocal(defaults);
        }
    }
}

function renderMasterTemplates() {
    let masterDB = getMasterTemplatesDB();
    let container = document.getElementById('masterTemplatesContainer');
    if(!container) return;
    
    container.innerHTML = '';
    for(let key in masterDB) {
        let displayName = key.replace(/_/g, ' ').toUpperCase();
        container.innerHTML += `
            <div style="background:#fff; border:1px solid #e1e8ed; padding:12px 15px; border-radius:6px; display:flex; align-items:center; gap:15px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <strong style="color:#0ea5e9; min-width: 170px;">${displayName}</strong>
                <button class="gen-btn btn-sm" style="background:#f39c12; padding:6px 15px;" onclick="openMasterTemplateEditor('${key}')">Edit List</button>
            </div>
        `;
    }
    renderTemplateLoaders(); 
}

async function createNewTemplate() {
    let name = prompt("Enter a name for the new template (e.g., 'Install Crew', 'Maintenance'):");
    if(!name || name.trim() === '') return;
    
    let key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'); 
    
    let masterDB = getMasterTemplatesDB();
    if(masterDB[key]) { 
        alert("A template with a similar name already exists!"); 
        return; 
    }
    
    const backupJson = localStorage.getItem("tp_master_templates") || "{}";
    masterDB[key] = { tools: [], consumables: [] };
    localStorage.setItem("tp_master_templates", JSON.stringify(masterDB));
    try {
        await writeInventoryTemplatesToFirestore(masterDB);
    } catch (e) {
        console.error("createNewTemplate", e);
        localStorage.setItem("tp_master_templates", backupJson);
        alert("Could not save template to the cloud. Check your connection and Firestore rules.");
        return;
    }
    renderMasterTemplates();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Template saved to cloud");
}

function deleteCurrentTemplate() {
    if (!editingTemplateType) return;
    let displayName = editingTemplateType.replace(/_/g, ' ').toUpperCase();
    
    let confirmation = prompt(`WARNING: You are about to permanently delete the '${displayName}' template.\n\nTo confirm, type DELETE in the box below:`);
    
    if (confirmation === "DELETE") {
        let masterDB = getMasterTemplatesDB();
        delete masterDB[editingTemplateType];
        persistInventoryStorage("tp_master_templates", masterDB);
        renderMasterTemplates();
        closeTruckInventory();
        if(typeof showSaveCue === 'function') showSaveCue("✓ Template Deleted");
    } else if (confirmation !== null) {
        alert("Deletion canceled. You did not type DELETE exactly.");
    }
}

function renderTemplateLoaders() {
    let masterDB = getMasterTemplatesDB();
    let container = document.getElementById('dynamicTemplateLoaders');
    if(!container) return;
    
    container.innerHTML = '';
    const colors = ['#f39c12', '#8e44ad', '#3498db', '#16a085'];
    let colorIndex = 0;
    
    for(let key in masterDB) {
        let displayName = key.replace(/_/g, ' ').toUpperCase();
        let color = colors[colorIndex % colors.length];
        container.innerHTML += `<button class="gen-btn btn-sm" style="background:${color}; margin-right:8px; padding:8px 15px;" onclick="loadMasterTemplate('${key}')">Load ${displayName}</button>`;
        colorIndex++;
    }
}

// ====================================================================
// --- VMI / INVENTORY MODAL LOGIC & REPLENISHMENT REPORTING ---
// ====================================================================

function openTruckInventoryByIndex(index) {
    const n = appTechList[index];
    if (n) openTruckInventory(n);
}

function openTruckInventory(techName, initialTab) {
    editingTemplateType = null; 
    currentEditingTechInv = techName;
    document.getElementById('invModalTitle').innerText = `${techName}'s Truck`;
    
    document.getElementById('btnDeleteTemplate').style.display = 'none';
    document.getElementById('btnClearInvBtn').style.display = 'inline-block';
    
    switchInvTab(initialTab === 'consumables' ? 'consumables' : 'tools'); 
    document.getElementById('truckInventoryModal').style.display = 'block';
    renderTruckInventory();
}

function openMasterTemplateEditor(type) {
    editingTemplateType = type; 
    currentEditingTechInv = "";
    
    let titleText = "Master " + type.replace(/_/g, ' ').toUpperCase() + " Template";
    document.getElementById('invModalTitle').innerText = titleText;
    
    document.getElementById('btnDeleteTemplate').style.display = 'inline-block';
    // RESTORED CLEAR ALL BUTTON FOR TEMPLATES
    document.getElementById('btnClearInvBtn').style.display = 'inline-block';
    
    if (type.includes('consumables')) {
        switchInvTab('consumables');
    } else {
        switchInvTab('tools'); 
    }
    
    document.getElementById('truckInventoryModal').style.display = 'block';
    renderTruckInventory();
}

function closeTruckInventory() {
    document.getElementById('truckInventoryModal').style.display = 'none';
    currentEditingTechInv = "";
    editingTemplateType = null;
    checkGlobalVMI(); 
}

function switchInvTab(tabName) {
    currentInvTab = tabName;
    document.getElementById('btnTabTools').classList.remove('active');
    document.getElementById('btnTabConsumables').classList.remove('active');
    
    if(tabName === 'tools') {
        document.getElementById('btnTabTools').classList.add('active');
        if (!editingTemplateType) document.getElementById('invActionButtons').style.display = 'block';
    } else {
        document.getElementById('btnTabConsumables').classList.add('active');
        // Do NOT hide action buttons on consumables, let them use Clear All
        document.getElementById('invActionButtons').style.display = 'block';
    }
    renderTruckInventory();
}

function getActiveInvData() {
    let storageKey = editingTemplateType ? 'tp_master_templates' : 'tp_truck_inventories';
    let targetKey = editingTemplateType ? editingTemplateType : currentEditingTechInv;
    let db = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    if (!db[targetKey] || Array.isArray(db[targetKey])) {
        let oldTools = Array.isArray(db[targetKey]) ? db[targetKey] : [];
        db[targetKey] = { tools: oldTools, consumables: [] };
    }

    let originalToolCount = db[targetKey].tools ? db[targetKey].tools.length : 0;
    let originalConsCount = db[targetKey].consumables ? db[targetKey].consumables.length : 0;

    if (db[targetKey].tools) {
        db[targetKey].tools = db[targetKey].tools.filter(function (i) {
            if (i.name === "Unknown Item") return false;
            return (
                (i.name && String(i.name).trim()) ||
                (i.category && String(i.category).trim()) ||
                (i.vendor && String(i.vendor).trim()) ||
                (i.url && String(i.url).trim()) ||
                !!i.bundle
            );
        });
    }
    if (db[targetKey].consumables) {
        db[targetKey].consumables = db[targetKey].consumables.filter(function (i) {
            if (i.name === "Unknown Item") return false;
            return (
                (i.name && String(i.name).trim()) ||
                (i.category && String(i.category).trim()) ||
                (i.vendor && String(i.vendor).trim()) ||
                (i.url && String(i.url).trim()) ||
                (parseInt(i.qty, 10) || 0) !== 0 ||
                (parseInt(i.minLevel, 10) || 0) !== 0 ||
                (parseFloat(i.cost) || 0) !== 0
            );
        });
    }

    if (db[targetKey].tools.length !== originalToolCount || db[targetKey].consumables.length !== originalConsCount) {
        persistInventoryStorage(storageKey, db);
    }
    
    return { db, storageKey, targetKey, invData: db[targetKey] };
}

function inventoryNavSelectors() {
    return currentInvTab === "tools"
        ? [".p-name", ".p-cat", ".p-ven", ".p-bun", ".p-url"]
        : [".p-name", ".p-cat", ".p-cost", ".p-qty", ".p-min", ".p-ven", ".p-url"];
}

function ghostInventoryRowHasMeaningfulInput(tr) {
    if (currentInvTab === "tools") {
        const name = (tr.querySelector(".p-name") && tr.querySelector(".p-name").value) || "";
        const cat = (tr.querySelector(".p-cat") && tr.querySelector(".p-cat").value) || "";
        const ven = (tr.querySelector(".p-ven") && tr.querySelector(".p-ven").value) || "";
        const url = (tr.querySelector(".p-url") && tr.querySelector(".p-url").value) || "";
        const bun = tr.querySelector(".p-bun") && tr.querySelector(".p-bun").checked;
        return (
            name.trim() !== "" ||
            cat.trim() !== "" ||
            ven.trim() !== "" ||
            url.trim() !== "" ||
            bun
        );
    }
    const name = (tr.querySelector(".p-name") && tr.querySelector(".p-name").value) || "";
    const cat = (tr.querySelector(".p-cat") && tr.querySelector(".p-cat").value) || "";
    const ven = (tr.querySelector(".p-ven") && tr.querySelector(".p-ven").value) || "";
    const url = (tr.querySelector(".p-url") && tr.querySelector(".p-url").value) || "";
    const qty = parseInt(tr.querySelector(".p-qty") && tr.querySelector(".p-qty").value, 10) || 0;
    const min = parseInt(tr.querySelector(".p-min") && tr.querySelector(".p-min").value, 10) || 0;
    const cost = parseFloat(tr.querySelector(".p-cost") && tr.querySelector(".p-cost").value) || 0;
    return (
        name.trim() !== "" ||
        cat.trim() !== "" ||
        ven.trim() !== "" ||
        url.trim() !== "" ||
        qty !== 0 ||
        min !== 0 ||
        cost !== 0
    );
}

function promoteGhostInventoryRow(tr) {
    if (!tr || !tr.classList.contains("ghost-row")) return;
    if (!ghostInventoryRowHasMeaningfulInput(tr)) return;
    const activeData = getActiveInvData();
    if (currentInvTab === "tools") {
        activeData.invData.tools.push({
            name: (tr.querySelector(".p-name") && tr.querySelector(".p-name").value) || "",
            category: (tr.querySelector(".p-cat") && tr.querySelector(".p-cat").value) || "",
            vendor: (tr.querySelector(".p-ven") && tr.querySelector(".p-ven").value) || "",
            bundle: !!(tr.querySelector(".p-bun") && tr.querySelector(".p-bun").checked),
            url: (tr.querySelector(".p-url") && tr.querySelector(".p-url").value) || ""
        });
    } else {
        activeData.invData.consumables.push({
            name: (tr.querySelector(".p-name") && tr.querySelector(".p-name").value) || "",
            category: (tr.querySelector(".p-cat") && tr.querySelector(".p-cat").value) || "",
            cost: parseFloat(tr.querySelector(".p-cost") && tr.querySelector(".p-cost").value) || 0,
            qty: parseInt(tr.querySelector(".p-qty") && tr.querySelector(".p-qty").value, 10) || 0,
            minLevel: parseInt(tr.querySelector(".p-min") && tr.querySelector(".p-min").value, 10) || 0,
            vendor: (tr.querySelector(".p-ven") && tr.querySelector(".p-ven").value) || "",
            url: (tr.querySelector(".p-url") && tr.querySelector(".p-url").value) || ""
        });
    }
    persistInventoryStorage(activeData.storageKey, activeData.db);
    renderTruckInventory();
}

function ghostRowMaybePromote(e) {
    const tr = e.target && e.target.closest && e.target.closest("tr.ghost-row");
    if (!tr) return;
    if (ghostInventoryRowHasMeaningfulInput(tr)) {
        promoteGhostInventoryRow(tr);
    }
}

function onInventoryTableKeydown(e) {
    const tag = (e.target && e.target.tagName) || "";
    if (tag !== "INPUT" && tag !== "TEXTAREA") return;
    const tbody = document.getElementById("inventoryTableBody");
    if (!tbody || !tbody.contains(e.target)) return;
    const tr = e.target.closest("tr");
    if (!tr) return;
    const cols = inventoryNavSelectors();
    const inputs = cols.map(function (sel) {
        return tr.querySelector(sel);
    }).filter(Boolean);

    function colIndexOf(el) {
        for (let i = 0; i < cols.length; i++) {
            if (tr.querySelector(cols[i]) === el) return i;
        }
        return -1;
    }

    const allRows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
    const rowIdx = allRows.indexOf(tr);
    if (rowIdx < 0) return;

    if (e.key === "Tab" && !e.shiftKey) {
        const ci = colIndexOf(e.target);
        if (ci === -1) return;
        if (ci === cols.length - 1) {
            e.preventDefault();
            const nextRow = allRows[rowIdx + 1];
            if (nextRow) {
                const first = nextRow.querySelector(cols[0]);
                if (first) first.focus();
            } else {
                const first = tr.querySelector(cols[0]);
                if (first) first.focus();
            }
        }
    }
    if (e.key === "Enter") {
        e.preventDefault();
        const ci = colIndexOf(e.target);
        if (ci === -1) return;
        const nextRow = allRows[rowIdx + 1];
        if (nextRow) {
            const next = nextRow.querySelector(cols[ci]);
            if (next) next.focus();
        }
    }
}

function attachInventoryTableBehaviors(tbody) {
    if (!tbody) return;
    tbody.removeEventListener("input", ghostRowMaybePromote);
    tbody.addEventListener("input", ghostRowMaybePromote);
    tbody.removeEventListener("change", ghostRowMaybePromote);
    tbody.addEventListener("change", ghostRowMaybePromote);
    tbody.removeEventListener("keydown", onInventoryTableKeydown);
    tbody.addEventListener("keydown", onInventoryTableKeydown);
}

function renderTruckInventory() {
    const thead = document.querySelector('.inventory-table thead');
    const tbody = document.getElementById('inventoryTableBody');
    
    if (currentInvTab === 'tools') {
        thead.innerHTML = `
            <tr>
                <th width="25%">Tool Name</th>
                <th width="15%">Category</th>
                <th width="15%">Vendor</th>
                <th width="10%">Bundle?</th>
                <th width="30%">Link</th>
                <th width="5%"></th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th width="20%">Part Name</th>
                <th width="10%">Category</th>
                <th width="8%">Unit Cost $</th>
                <th width="8%">Current QTY</th>
                <th width="8%">Min Level</th>
                <th width="12%">Vendor</th>
                <th width="9%">Status</th>
                <th width="20%">Link</th>
                <th width="5%"></th>
            </tr>
        `;
    }

    let activeData = getActiveInvData();
    const currentList = currentInvTab === 'tools' ? activeData.invData.tools : activeData.invData.consumables;

    let rowsHtml = '';

    currentList.forEach((item, idx) => {
        let safeName = escapeHTML(item.name);
        let safeCat = escapeHTML(item.category);
        let safeVen = escapeHTML(item.vendor);
        let safeUrl = escapeHTML(item.url);

        if (currentInvTab === 'tools') {
            let bundleCheck = item.bundle ? "checked" : "";
            rowsHtml += `
                <tr>
                    <td><input type="text" class="inventory-input p-name" value="${safeName}"></td>
                    <td><input type="text" class="inventory-input p-cat" value="${safeCat}"></td>
                    <td><input type="text" class="inventory-input p-ven" value="${safeVen}"></td>
                    <td style="text-align: center;"><input type="checkbox" class="p-bun" ${bundleCheck}></td>
                    <td>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <input type="text" class="inventory-input p-url" value="${safeUrl}" placeholder="Paste URL here..." style="width: 100%;">
                            <a href="${safeUrl || '#'}" target="_blank" title="Test Link" style="text-decoration:none; font-size:16px;">↗️</a>
                        </div>
                    </td>
                    <td><button type="button" tabindex="-1" class="gen-btn btn-sm" style="background:#e74c3c;" onclick="removeToolFromTruck(${idx})">X</button></td>
                </tr>
            `;
        } else {
            let qty = parseInt(item.qty) || 0;
            let min = parseInt(item.minLevel) || 0;
            let cost = parseFloat(item.cost) || 0.00;
            let isLow = qty <= min;
            
            let statusHtml = isLow ? `<span style="color:#e74c3c; font-weight:bold; font-size:11px;">⚠️ LOW STOCK</span>` : `<span style="color:#27ae60; font-weight:bold; font-size:11px;">✓ OK</span>`;
            let rowBg = isLow ? "background-color: #fdedec;" : "";

            rowsHtml += `
                <tr style="${rowBg}">
                    <td><input type="text" class="inventory-input p-name" value="${safeName}"></td>
                    <td><input type="text" class="inventory-input p-cat" value="${safeCat}"></td>
                    <td><input type="number" class="inventory-input p-cost" value="${cost.toFixed(2)}" step="0.01" onchange="liveRecalculateStock()"></td>
                    <td><input type="number" class="inventory-input p-qty" value="${qty}" style="width:100%;" min="0" onchange="liveRecalculateStock()"></td>
                    <td><input type="number" class="inventory-input p-min" value="${min}" style="width:100%;" min="0" onchange="liveRecalculateStock()"></td>
                    <td><input type="text" class="inventory-input p-ven" value="${safeVen}"></td>
                    <td style="text-align: center; vertical-align: middle;">${statusHtml}</td>
                    <td>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <input type="text" class="inventory-input p-url" value="${safeUrl}" placeholder="URL..." style="width: 100%;">
                            <a href="${safeUrl || '#'}" target="_blank" title="Test Link" style="text-decoration:none; font-size:16px;">↗️</a>
                        </div>
                    </td>
                    <td><button type="button" tabindex="-1" class="gen-btn btn-sm" style="background:#e74c3c;" onclick="removeToolFromTruck(${idx})">X</button></td>
                </tr>
            `;
        }
    });

    if (currentInvTab === 'tools') {
        rowsHtml += `
            <tr class="ghost-row" style="opacity:0.92;">
                <td><input type="text" class="inventory-input p-name" value="" placeholder=""></td>
                <td><input type="text" class="inventory-input p-cat" value=""></td>
                <td><input type="text" class="inventory-input p-ven" value=""></td>
                <td style="text-align: center;"><input type="checkbox" class="p-bun"></td>
                <td>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="text" class="inventory-input p-url" value="" placeholder="Paste URL here..." style="width: 100%;">
                        <span style="opacity:0.35;">↗️</span>
                    </div>
                </td>
                <td></td>
            </tr>
        `;
    } else {
        rowsHtml += `
            <tr class="ghost-row" style="opacity:0.92;">
                <td><input type="text" class="inventory-input p-name" value="" placeholder=""></td>
                <td><input type="text" class="inventory-input p-cat" value=""></td>
                <td><input type="number" class="inventory-input p-cost" value="0.00" step="0.01" onchange="liveRecalculateStock()"></td>
                <td><input type="number" class="inventory-input p-qty" value="0" style="width:100%;" min="0" onchange="liveRecalculateStock()"></td>
                <td><input type="number" class="inventory-input p-min" value="0" style="width:100%;" min="0" onchange="liveRecalculateStock()"></td>
                <td><input type="text" class="inventory-input p-ven" value=""></td>
                <td style="text-align: center; vertical-align: middle; color:#bdc3c7; font-size:11px;">—</td>
                <td>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="text" class="inventory-input p-url" value="" placeholder="URL..." style="width: 100%;">
                        <span style="opacity:0.35;">↗️</span>
                    </div>
                </td>
                <td></td>
            </tr>
        `;
    }

    tbody.innerHTML = rowsHtml;
    attachInventoryTableBehaviors(tbody);
}

function liveRecalculateStock() {
    saveAndCloseTruckInventory(true); 
    renderTruckInventory(); 
}

// ====================================================================
// --- SPREADSHEET PARSER (HYPERLINK INCLUDED & BLANK PROOF) ---
// ====================================================================
function bulkImportTools() {
    let inst = document.getElementById('bulkImportInstructions');
    if (inst) {
        inst.innerHTML = "Copy columns from Excel/Google Sheets <strong>INCLUDING the Header Row</strong> and paste below.<br><span style='color:#27ae60; font-weight:bold;'>The smart parser will extract your Data and Hyperlinks automatically!</span>";
    }
    
    const textarea = document.getElementById('bulkImportTextarea');
    if(textarea) {
        textarea.value = "";
        textarea.dataset.html = ""; 
        
        if (!textarea.dataset.listening) {
            textarea.addEventListener('paste', function(e) {
                let html = e.clipboardData.getData('text/html');
                if (html) {
                    this.dataset.html = html;
                }
            });
            textarea.dataset.listening = "true";
        }
    }
    
    document.getElementById('bulkImportModal').style.display = 'block';
}

function processBulkImport() {
    const textarea = document.getElementById('bulkImportTextarea');
    let text = textarea.value.trim();
    let htmlData = textarea.dataset.html;

    if (!text && !htmlData) {
        document.getElementById('bulkImportModal').style.display = 'none';
        return;
    }

    let activeData = getActiveInvData();
    let addedCount = 0;
    
    // Add "bundle" to the map
    let map = { name: 0, cat: 1, cost: 2, qty: 3, min: 4, ven: 5, bundle: -1 };
    let parsedRows = [];

    if (htmlData && htmlData.trim() !== '') {
        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlData, 'text/html');
        let rows = doc.querySelectorAll('tr');

        rows.forEach(row => {
            let tds = row.querySelectorAll('td, th');
            if(tds.length === 0) return;

            let rowData = { texts: [], link: "" };
            tds.forEach(td => {
                rowData.texts.push(td.innerText.trim());
                let a = td.querySelector('a');
                if (a && !rowData.link) {
                    rowData.link = a.href;
                }
            });
            
            let hasData = rowData.texts.some(c => c && c !== "");
            if(hasData) parsedRows.push(rowData);
        });
    } else {
        let rows = text.split('\n');
        rows.forEach(row => {
            let delimiter = row.includes('\t') ? '\t' : ',';
            let texts = row.split(delimiter).map(c => c.trim());
            
            let hasData = texts.some(c => c && c !== "");
            if(hasData) parsedRows.push({ texts: texts, link: "" });
        });
    }

    if (parsedRows.length === 0) {
        alert("No readable data found!");
        return;
    }

    let firstRowTexts = parsedRows[0].texts.map(c => c.toLowerCase());
    let hasHeaders = false;

    if (firstRowTexts.some(c => c.includes('name') || c.includes('tool') || c.includes('part') || c.includes('desc') || c.includes('category'))) {
        hasHeaders = true;
        
        let nIdx = firstRowTexts.findIndex(c => c.includes('name') || c.includes('tool') || c.includes('part') || c.includes('desc'));
        let catIdx = firstRowTexts.findIndex(c => c.includes('category') || c.includes('cat'));
        let costIdx = firstRowTexts.findIndex(c => c.includes('cost') || c.includes('price') || c.includes('each'));
        let qtyIdx = firstRowTexts.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('stock'));
        let minIdx = firstRowTexts.findIndex(c => c.includes('min') || c.includes('level'));
        let venIdx = firstRowTexts.findIndex(c => c.includes('vendor') || c.includes('brand') || c.includes('supplier'));
        
        // NEW: Detect bundle column
        let bunIdx = firstRowTexts.findIndex(c => c === 'bundle' || c === 'bundle?' || c.includes('included'));

        if (nIdx !== -1) map.name = nIdx;
        if (catIdx !== -1) map.cat = catIdx;
        if (costIdx !== -1) map.cost = costIdx;
        if (qtyIdx !== -1) map.qty = qtyIdx;
        if (minIdx !== -1) map.min = minIdx;
        if (venIdx !== -1) map.ven = venIdx;
        if (bunIdx !== -1) map.bundle = bunIdx;
    }

    let startIndex = hasHeaders ? 1 : 0;

    for (let i = startIndex; i < parsedRows.length; i++) {
        let rowData = parsedRows[i];
        let cols = rowData.texts;
        if (cols.length < 2 && !cols[0]) continue; 

        let partName = cols[map.name] || "Unknown Item";
        let partCat = cols[map.cat] || "Imported";
        let partVen = cols[map.ven] || "";
        
        if (partName === "Unknown Item" && partVen === "") continue;
        
        let partUrl = rowData.link || `https://www.google.com/search?q=${encodeURIComponent(partVen + " " + partName)}`;

        if (currentInvTab === 'tools') {
            // Check for bundle true/false
            let isBundle = false;
            if (map.bundle !== -1) {
                let bunVal = (cols[map.bundle] || "").toLowerCase();
                if (bunVal === 'yes' || bunVal === 'y' || bunVal === 'true' || bunVal === 'x') {
                    isBundle = true;
                }
            }

            activeData.invData.tools.push({
                name: partName,
                category: partCat,
                vendor: partVen,
                bundle: isBundle,
                url: partUrl
            });
            addedCount++;
        } else {
            let costStr = (cols[map.cost] || "0").replace(/[^0-9.]/g, '');
            activeData.invData.consumables.push({
                name: partName,
                category: partCat,
                cost: parseFloat(costStr) || 0,
                qty: parseInt(cols[map.qty]) || 0,
                minLevel: parseInt(cols[map.min]) || 0,
                vendor: partVen,
                url: partUrl
            });
            addedCount++;
        }
    }

    persistInventoryStorage(activeData.storageKey, activeData.db);
    renderTruckInventory();
    
    document.getElementById('bulkImportModal').style.display = 'none';
    if(typeof showSaveCue === 'function') showSaveCue(`✓ Imported ${addedCount} valid items`);

    setTimeout(() => {
        const tableContainer = document.querySelector('.inventory-table').parentElement;
        if(tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight;
    }, 100);
}

function addBlankToolRow() {
    let activeData = getActiveInvData();
    
    if (currentInvTab === 'tools') { 
        activeData.invData.tools.push({ name: "", category: "", vendor: "", bundle: false, url: "" }); 
    } else { 
        activeData.invData.consumables.push({ name: "", category: "", cost: 0, qty: 0, minLevel: 5, vendor: "", url: "" }); 
    }
    
    persistInventoryStorage(activeData.storageKey, activeData.db);
    renderTruckInventory();
    
    const tableContainer = document.querySelector('.inventory-table').parentElement;
    tableContainer.scrollTop = tableContainer.scrollHeight;
}

function removeToolFromTruck(index) {
    let activeData = getActiveInvData();
    
    if (currentInvTab === 'tools') { activeData.invData.tools.splice(index, 1); } 
    else { activeData.invData.consumables.splice(index, 1); }
    
    persistInventoryStorage(activeData.storageKey, activeData.db);
    renderTruckInventory();
}

function loadMasterTemplate(type) {
    let displayName = type.replace(/_/g, ' ').toUpperCase();
    if(!confirm(`Are you sure you want to load the ${displayName} template? This will add to any tools currently on this list.`)) return;

    let masterDB = getMasterTemplatesDB();
    let templateToLoad = masterDB[type];
    
    if (!templateToLoad) return;
    
    let toolsToLoad = Array.isArray(templateToLoad) ? templateToLoad : (templateToLoad.tools || []);
    let consToLoad = Array.isArray(templateToLoad) ? [] : (templateToLoad.consumables || []);

    let activeData = getActiveInvData();
    
    let copyTools = JSON.parse(JSON.stringify(toolsToLoad));
    let copyCons = JSON.parse(JSON.stringify(consToLoad));
    
    activeData.invData.tools = activeData.invData.tools.concat(copyTools);
    activeData.invData.consumables = activeData.invData.consumables.concat(copyCons);
    
    persistInventoryStorage(activeData.storageKey, activeData.db);
    renderTruckInventory();
}

function clearTruckInventory() {
    let targetLabel = editingTemplateType ? "the master template" : `${currentEditingTechInv}'s truck`;
    if(!confirm(`Are you sure? This will permanently delete ALL items from the ${currentInvTab} list for ${targetLabel}.`)) return;
    
    let activeData = getActiveInvData();
    
    if (currentInvTab === 'tools') { activeData.invData.tools = []; } 
    else { activeData.invData.consumables = []; }
    
    persistInventoryStorage(activeData.storageKey, activeData.db);
    renderTruckInventory();
}

function saveAndCloseTruckInventory(silent = false) {
    const rows = document.querySelectorAll('#inventoryTableBody tr');
    let updatedList = [];
    
    if (rows.length > 0 && !rows[0].innerText.includes('empty')) {
        rows.forEach(row => {
            if (row.classList && row.classList.contains('ghost-row')) return;
            let nameEl = row.querySelector('.p-name');
            if (nameEl) {
                if (currentInvTab === 'tools') {
                    updatedList.push({
                        name: nameEl.value,
                        category: row.querySelector('.p-cat').value,
                        vendor: row.querySelector('.p-ven').value,
                        bundle: row.querySelector('.p-bun').checked,
                        url: row.querySelector('.p-url').value
                    });
                } else {
                    updatedList.push({
                        name: nameEl.value,
                        category: row.querySelector('.p-cat').value,
                        cost: parseFloat(row.querySelector('.p-cost').value) || 0,
                        qty: parseInt(row.querySelector('.p-qty').value) || 0,
                        minLevel: parseInt(row.querySelector('.p-min').value) || 0,
                        vendor: row.querySelector('.p-ven').value,
                        url: row.querySelector('.p-url').value
                    });
                }
            }
        });
    }

    let activeData = getActiveInvData();

    if (currentInvTab === 'tools') { activeData.invData.tools = updatedList; } 
    else { activeData.invData.consumables = updatedList; }
    
    persistInventoryStorage(activeData.storageKey, activeData.db);
    
    if (!silent) {
        closeTruckInventory();
        let msg = editingTemplateType ? "✓ Master Template Saved" : "✓ Loadout Saved";
        if(typeof showSaveCue === 'function') showSaveCue(msg);
    }
}

// ====================================================================
// --- GLOBAL VMI ALERTS, REPORTING, & MODALS INJECTOR ---
// ====================================================================

(function injectSettingsModals() {
    document.addEventListener("DOMContentLoaded", function() {
        const header = document.querySelector('.app-header');
        if(header) {
            header.insertAdjacentHTML('beforeend', `
                <button id="vmiAlertBtn" class="gen-btn" 
                        style="background:#e74c3c; display:none; position:absolute; right:20px; font-size:14px; padding: 10px 20px; box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4); animation: pulse 2s infinite;" 
                        onclick="openVMIReport()">
                    ⚠️ Order Parts
                </button>
            `);
        }

        const modalsHTML = `
            <div id="vmiReportModal" class="modal-overlay" style="z-index: 10020;">
                <div class="modal-content" style="max-width: 900px; height: 80vh; display: flex; flex-direction: column;">
                    <div class="modal-header" style="flex-shrink: 0;">
                        <div>
                            <h2 style="color: #e74c3c; margin: 0;">Vendor Replenishment Report</h2>
                            <p style="margin: 5px 0 0 0; font-size: 13px; color: #7f8c8d;">Parts below minimum threshold across all active trucks.</p>
                        </div>
                        <div style="display:flex; gap: 8px; align-items:center;">
                            <button class="gen-btn" style="background:#f39c12; padding: 6px 12px; font-size: 12px;" onclick="copyVMIReportToClipboard()">📋 Copy Text</button>
                            <button class="gen-btn" style="background:#ea4335; padding: 6px 12px; font-size: 12px;" onclick="emailVMIReport('gmail')">✉️ Gmail</button>
                            <button class="gen-btn" style="background:#27ae60; padding: 6px 12px; font-size: 12px;" onclick="emailVMIReport('desktop')">📧 Outlook</button>
                            <button class="gen-btn" style="background:#0ea5e9; padding: 6px 12px; font-size: 12px;" onclick="printVMIReport()">🖨️ Print/PDF</button>
                            <span class="close-modal" style="margin-left: 10px;" onclick="document.getElementById('vmiReportModal').style.display='none'">×</span>
                        </div>
                    </div>
                    <div id="vmiReportContent" style="flex: 1; overflow-y: auto; padding: 10px 5px;">
                    </div>
                </div>
            </div>
            
            <div id="bulkImportModal" class="modal-overlay" style="z-index: 10030;">
                <div class="modal-content" style="max-width: 700px;">
                    <div class="modal-header">
                        <h2 style="color: #0ea5e9; margin: 0;">📋 Bulk Paste from Excel</h2>
                        <span class="close-modal" onclick="document.getElementById('bulkImportModal').style.display='none'">×</span>
                    </div>
                    <p style="font-size: 13px; color: #555; margin-top: 5px;" id="bulkImportInstructions">
                    </p>
                    <textarea id="bulkImportTextarea" style="width: 100%; height: 250px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; white-space: pre;"></textarea>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
                        <button class="gen-btn" style="background:#7f8c8d; padding: 8px 15px;" onclick="document.getElementById('bulkImportModal').style.display='none'">Cancel</button>
                        <button class="gen-btn" style="background:#27ae60; padding: 8px 15px;" onclick="processBulkImport()">Import Data</button>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                .vmi-vendor-block { background: #fff; border: 1px solid #c89b53; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
                .vmi-vendor-header { background: #0ea5e9; color: #fff; padding: 12px 15px; font-weight: bold; font-size: 16px; display: flex; justify-content: space-between; }
                .vmi-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .vmi-table th, .vmi-table td { padding: 10px; text-align: left; border-bottom: 1px solid #eaeaea; }
                .vmi-table th { background: #f4f6f7; color: #555; }
                .vmi-tech-header { cursor: pointer; color: #0ea5e9; display: inline-flex; align-items: center; gap: 6px; }
                .vmi-tech-header:hover { color: #2563eb; text-decoration: underline; }
                .vmi-tech-edit-icon { cursor: pointer; color: #2563eb; font-size: 14px; user-select: none; }
                .vmi-tech-edit-icon:hover { color: #1d4ed8; }
                .vmi-qty-input { width: 56px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-weight: bold; }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', modalsHTML);
    });
})();

function checkGlobalVMI() {
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let lowCount = 0;
    let affectedTechs = new Set();
    let estCost = 0;
    
    for (let tech in invDB) {
        let cons = invDB[tech].consumables || [];
        cons.forEach(item => {
            let q = parseInt(item.qty) || 0;
            let m = parseInt(item.minLevel) || 0;
            let c = parseFloat(item.cost) || 0;
            
            if (q <= m) {
                lowCount++;
                affectedTechs.add(tech.split(' ')[0]); 
                let orderQty = (m - q) > 0 ? (m - q) : 1; 
                estCost += (orderQty * c);
            }
        });
    }

    let alertBtn = document.getElementById('vmiAlertBtn');
    if(alertBtn) {
        if(lowCount > 0) {
            alertBtn.style.display = 'inline-block';
            alertBtn.innerHTML = `⚠️ Order Parts (${lowCount})`;
        } else {
            alertBtn.style.display = 'none';
        }
    }

    let dashAlert = document.getElementById('vmiDashBanner');
    if (!dashAlert) {
        let leftPanel = document.querySelector('.dispatch-left-panel');
        if (leftPanel) {
            let header = leftPanel.querySelector('.panel-header');
            dashAlert = document.createElement('div');
            dashAlert.id = 'vmiDashBanner';
            header.insertAdjacentElement('afterend', dashAlert);
        }
    }

    if (dashAlert) {
        if (lowCount > 0) {
            let techList = Array.from(affectedTechs).join(', ');
            dashAlert.style.display = 'block';
            dashAlert.innerHTML = `
                <div style="background: #fdf2e9; border-bottom: 2px solid #e74c3c; padding: 15px; display: flex; flex-direction: column; gap: 10px; box-shadow: inset 0 -2px 5px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #c0392b; font-weight: bold; font-size: 14px;"><i class="fas fa-exclamation-triangle"></i> LOW INVENTORY</span>
                        <span style="color: #27ae60; font-weight: bold; font-size: 14px;">Est: $${estCost.toFixed(2)}</span>
                    </div>
                    <div style="font-size: 12px; color: #555; line-height: 1.4;">
                        <strong>${lowCount} items</strong> are below minimum stock across <strong>${affectedTechs.size} trucks</strong> (${techList}).
                    </div>
                    <button class="gen-btn" style="background:#e74c3c; width: 100%; padding: 8px; font-size: 12px; margin-top: 5px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;" onclick="openVMIReport()">Review & Place Bulk Order</button>
                </div>
            `;
        } else {
            dashAlert.style.display = 'none';
        }
    }
}

function closeVmiAndOpenInventoryFromEncoded(enc) {
    const techName = decodeURIComponent(enc);
    const modal = document.getElementById("vmiReportModal");
    if (modal) modal.style.display = "none";
    openTruckInventory(techName, "consumables");
}

function vmiQtyChange(input) {
    const tech = decodeURIComponent(input.getAttribute("data-tech-enc") || "");
    const idx = parseInt(input.getAttribute("data-idx"), 10);
    if (!tech || isNaN(idx)) return;
    let invDB = JSON.parse(localStorage.getItem("tp_truck_inventories") || "{}");
    if (!invDB[tech] || !invDB[tech].consumables || invDB[tech].consumables[idx] === undefined) return;
    invDB[tech].consumables[idx].qty = Math.max(0, parseInt(input.value, 10) || 0);
    localStorage.setItem("tp_truck_inventories", JSON.stringify(invDB));
    syncTruckInventoriesToFirestore();
    checkGlobalVMI();
    openVMIReport();
}

function openVMIReport() {
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let lowItems = [];
    
    for (let tech in invDB) {
        let cons = invDB[tech].consumables || [];
        cons.forEach((item, idx) => {
            let q = parseInt(item.qty) || 0;
            let m = parseInt(item.minLevel) || 0;
            if (q <= m) {
                lowItems.push(Object.assign({}, item, { tech: tech, itemIndex: idx }));
            }
        });
    }

    let groupedByVendor = {};
    let grandTotal = 0;

    lowItems.forEach(item => {
        let v = (item.vendor && item.vendor.trim() !== '') ? item.vendor.toUpperCase() : 'UNSPECIFIED VENDOR';
        if(!groupedByVendor[v]) groupedByVendor[v] = {};
        if(!groupedByVendor[v][item.tech]) groupedByVendor[v][item.tech] = [];
        groupedByVendor[v][item.tech].push(item);
    });

    let html = '';

    for (let vendor in groupedByVendor) {
        let vendorTotal = 0;
        let vendorHtml = '';
        
        for (let techName in groupedByVendor[vendor]) {
            let techRows = '';
            const encTech = encodeURIComponent(techName);
            
            groupedByVendor[vendor][techName].forEach(item => {
                let q = parseInt(item.qty) || 0;
                let m = parseInt(item.minLevel) || 0;
                let c = parseFloat(item.cost) || 0;
                
                let orderQty = (m - q) > 0 ? (m - q) : 1; 
                let lineTotal = orderQty * c;
                
                vendorTotal += lineTotal;
                grandTotal += lineTotal;

                techRows += `
                    <tr>
                        <td style="font-weight:bold;">${escapeHTML(item.name)}</td>
                        <td>${escapeHTML(item.category || 'N/A')}</td>
                        <td>
                            <input type="number" class="vmi-qty-input" min="0" value="${q}"
                                data-tech-enc="${encTech}"
                                data-idx="${item.itemIndex}"
                                onchange="vmiQtyChange(this)" />
                            <span style="color:#555;"> / ${m}</span>
                        </td>
                        <td class="vmi-order-qty" style="font-weight:bold; color:#27ae60; font-size: 14px;">${orderQty}</td>
                        <td>$${c.toFixed(2)}</td>
                        <td class="vmi-line-total">$${lineTotal.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            vendorHtml += `
                <tr>
                    <td colspan="6" style="background:#eaf2f8; color:#0ea5e9; font-weight:bold; font-size:14px; padding:8px 10px; border-top: 2px solid #bdc3c7;">
                        <span class="vmi-tech-header" role="button" tabindex="0" title="Open truck inventory"
                            onclick="closeVmiAndOpenInventoryFromEncoded('${encTech}')"
                            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();closeVmiAndOpenInventoryFromEncoded('${encTech}');}">
                            📦 TECH BIN: <span style="text-decoration:underline;">${escapeHTML(techName.toUpperCase())}</span>
                        </span>
                        <span class="vmi-tech-edit-icon" title="Edit inventory" onclick="closeVmiAndOpenInventoryFromEncoded('${encTech}')">✏️</span>
                    </td>
                </tr>
                ${techRows}
            `;
        }

        html += `
            <div class="vmi-vendor-block">
                <div class="vmi-vendor-header">
                    <span>🏢 VENDOR: ${escapeHTML(vendor)}</span>
                    <span>Est. PO Total: $${vendorTotal.toFixed(2)}</span>
                </div>
                <table class="vmi-table">
                    <thead>
                        <tr>
                            <th width="35%">Part Name</th>
                            <th width="15%">Category</th>
                            <th width="15%">Stock / Min</th>
                            <th width="10%">Order QTY</th>
                            <th width="10%">Unit Cost</th>
                            <th width="15%">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vendorHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    if (html === '') { 
        html = '<p style="text-align:center; padding: 20px;">All trucks are currently fully stocked.</p>'; 
    } else { 
        html += `<div style="text-align:right; font-size:20px; font-weight:bold; padding:20px; border-top: 2px solid #ccc;">GRAND TOTAL ESTIMATE: <span style="color:#27ae60;">$${grandTotal.toFixed(2)}</span></div>`; 
    }

    document.getElementById('vmiReportContent').innerHTML = html;
    document.getElementById('vmiReportModal').style.display = 'block';
}

function generateVMIEmailText() {
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let lowItems = [];
    
    for (let tech in invDB) {
        let cons = invDB[tech].consumables || [];
        cons.forEach(item => {
            let q = parseInt(item.qty) || 0;
            let m = parseInt(item.minLevel) || 0;
            if (q <= m) lowItems.push({ tech: tech, ...item });
        });
    }

    if (lowItems.length === 0) return null;

    let groupedByVendor = {};
    lowItems.forEach(item => {
        let v = (item.vendor && item.vendor.trim() !== '') ? item.vendor.toUpperCase() : 'UNSPECIFIED VENDOR';
        if(!groupedByVendor[v]) groupedByVendor[v] = {};
        if(!groupedByVendor[v][item.tech]) groupedByVendor[v][item.tech] = [];
        groupedByVendor[v][item.tech].push(item);
    });

    let todayStr = new Date().toLocaleDateString();
    let emailBody = `USA Heating and Cooling - Parts Restock Order\nDate: ${todayStr}\n\nPlease pull the following parts and organize them into the respective Technician Bins:\n\n`;

    for (let vendor in groupedByVendor) {
        emailBody += `=========================================\n`;
        emailBody += `VENDOR: ${vendor}\n`;
        emailBody += `=========================================\n\n`;
        
        for (let techName in groupedByVendor[vendor]) {
            emailBody += `--- 📦 TECH BIN: ${techName.toUpperCase()} ---\n`;
            groupedByVendor[vendor][techName].forEach(item => {
                let q = parseInt(item.qty) || 0;
                let m = parseInt(item.minLevel) || 0;
                let orderQty = (m - q) > 0 ? (m - q) : 1; 
                emailBody += `${orderQty}x - ${item.name}\n`;
            });
            emailBody += `\n`;
        }
    }
    emailBody += `Thank you,\nUSA Heating and Cooling Dispatch`;
    
    return { subject: `USA Heating and Cooling Parts Restock Order - ${todayStr}`, body: emailBody };
}

function emailVMIReport(clientType) {
    let emailData = generateVMIEmailText();
    if (!emailData) { alert("No parts need to be ordered!"); return; }

    let subject = encodeURIComponent(emailData.subject);
    let body = encodeURIComponent(emailData.body);

    if (clientType === 'gmail') {
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank');
    } else {
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
}

function copyVMIReportToClipboard() {
    let emailData = generateVMIEmailText();
    if (!emailData) { alert("No parts need to be ordered!"); return; }
    
    navigator.clipboard.writeText(emailData.subject + "\n\n" + emailData.body).then(() => {
        if(typeof showSaveCue === 'function') showSaveCue("📋 Copied to Clipboard!");
    }).catch(err => {
        alert("Failed to copy text: " + err);
    });
}

function printVMIReport() {
    let printContents = document.getElementById('vmiReportContent').innerHTML;
    let originalContents = document.body.innerHTML;

    document.body.innerHTML = `
        <div style="padding: 40px; font-family: sans-serif;">
            <h1 style="color:#0ea5e9;">USA Heating and Cooling - Vendor Replenishment Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <hr style="margin-bottom: 30px;">
            ${printContents}
        </div>
    `;

    window.print();
    document.body.innerHTML = originalContents;
    location.reload(); 
}

// ====================================================================
// --- FIELD FORM TEMPLATES (Firestore form_templates) — Dispatcher UI ---
// ====================================================================

let fieldFormBuilderEditingId = null;

function slugifyFieldFormTemplateId(rawName) {
    let s = String(rawName || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (!s) s = "template";
    return s.slice(0, 72);
}

function fieldFormSlugFromLabel(label, index) {
    let s = slugifyFieldFormTemplateId(label).replace(/_/g, "");
    if (!s) s = "field";
    return s + "_" + index;
}

/** Parse "Yes, No, N/A" → ["Yes","No","N/A"] */
function parseCommaSeparatedOptions(str) {
    if (!str || !String(str).trim()) return [];
    return String(str)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
}

function mapUiTypeToFirestoreField(row, index) {
    const label = String(row.label || "").trim();
    const name = fieldFormSlugFromLabel(label, index);
    const base = { name, label, required: !!row.required };
    const u = String(row.uiType || "TEXT").toUpperCase();
    const optList = parseCommaSeparatedOptions(row.optionsStr);
    if (u === "NUMBER") return { ...base, type: "number" };
    if (u === "PHOTO") return { ...base, type: "photo" };
    if (u === "CHECKBOX") return { ...base, type: "checkbox" };
    if (u === "TOGGLE") return { ...base, type: "toggle" };
    if (u === "DROPDOWN") return { ...base, type: "dropdown", options: optList };
    if (u === "MULTI_CHECK") return { ...base, type: "multi_check", options: optList };
    if (u === "BELT") return { ...base, type: "text", group: "belt" };
    if (u === "FILTER") return { ...base, type: "text", group: "filter" };
    return { ...base, type: "text" };
}

function mapFirestoreFieldToUiType(f) {
    const g = f.group;
    if (g === "belt") return "BELT";
    if (g === "filter") return "FILTER";
    const t = String(f.type || "text").toLowerCase();
    if (t === "number") return "NUMBER";
    if (t === "photo") return "PHOTO";
    if (t === "checkbox") return "CHECKBOX";
    if (t === "toggle") return "TOGGLE";
    if (t === "dropdown") return "DROPDOWN";
    if (t === "multi_check") return "MULTI_CHECK";
    return "TEXT";
}

async function ensureUniqueFieldFormDocId(baseSlug) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
        return baseSlug + "_" + Date.now();
    }
    const db = firebase.firestore();
    let id = baseSlug;
    let n = 0;
    while (n < 200) {
        const snap = await db.collection("form_templates").doc(id).get();
        if (!fieldFormBuilderEditingId || id !== fieldFormBuilderEditingId) {
            if (!snap.exists) return id;
        } else {
            return id;
        }
        n++;
        id = baseSlug + "_" + n;
    }
    return baseSlug + "_" + Date.now();
}

function collectFieldFormBuilderRows() {
    const rows = document.querySelectorAll("#fieldFormBuilderRows .ffb-row");
    const out = [];
    rows.forEach((r) => {
        const label = r.querySelector(".ffb-label");
        const uiType = r.querySelector(".ffb-type");
        const req = r.querySelector(".ffb-req");
        const optIn = r.querySelector(".ffb-options");
        const lv = label && label.value ? String(label.value).trim() : "";
        if (!lv) return;
        out.push({
            label: lv,
            uiType: uiType && uiType.value ? uiType.value : "TEXT",
            required: !!(req && req.checked),
            optionsStr: optIn && optIn.value ? String(optIn.value) : "",
        });
    });
    return out;
}

function wireFfbRowOptionsVisibility(row) {
    const typeSel = row.querySelector(".ffb-type");
    const wrap = row.querySelector(".ffb-options-wrap");
    function apply() {
        const v = typeSel && typeSel.value;
        const show = v === "DROPDOWN" || v === "MULTI_CHECK";
        if (wrap) wrap.style.display = show ? "block" : "none";
    }
    if (typeSel) typeSel.addEventListener("change", apply);
    apply();
}

function addFieldFormBuilderRow(prefill) {
    const container = document.getElementById("fieldFormBuilderRows");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "ffb-row";
    row.style.cssText =
        "border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#fafbfc;display:flex;flex-direction:column;gap:8px;";
    const types = [
        ["TEXT", "Text"],
        ["NUMBER", "Number"],
        ["PHOTO", "Photo"],
        ["CHECKBOX", "Checkbox"],
        ["TOGGLE", "Toggle (Yes/No)"],
        ["DROPDOWN", "Dropdown"],
        ["MULTI_CHECK", "Multi-Check"],
        ["BELT", "Belt-Group"],
        ["FILTER", "Filter-Group"],
    ];
    const opts = types.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    const p = prefill || {};
    const optionsPreset = Array.isArray(p.options) ? p.options.join(", ") : p.optionsStr || "";
    row.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
            <div class="ffb-row-reorder" aria-label="Reorder field">
                <button type="button" class="ffb-arrow ffb-arrow-up" title="Move up" aria-label="Move up">▲</button>
                <button type="button" class="ffb-arrow ffb-arrow-down" title="Move down" aria-label="Move down">▼</button>
            </div>
            <div style="flex:1;min-width:180px;">
                <label style="font-size:11px;font-weight:600;color:#64748b;">Field label</label>
                <input type="text" class="ffb-label" placeholder="e.g. Gas pressure" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;" value="${escapeHTML(p.label || "")}" />
            </div>
            <div style="width:168px;">
                <label style="font-size:11px;font-weight:600;color:#64748b;">Type</label>
                <select class="ffb-type" style="width:100%;padding:8px;border-radius:6px;border:1px solid #cbd5e1;font-size:13px;">${opts}</select>
            </div>
        </div>
        <div class="ffb-options-wrap" style="display:none;">
            <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;">Options (comma-separated)</label>
            <input type="text" class="ffb-options" placeholder="e.g. Yes, No, N/A" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;" value="${escapeHTML(optionsPreset)}" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <label style="font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;">
                <input type="checkbox" class="ffb-req" ${p.required ? "checked" : ""} /> Required
            </label>
            <button type="button" class="gen-btn ffb-row-remove" style="background:#bdc3c7;padding:6px 12px;font-size:12px;color:#333;">Remove</button>
        </div>
    `;
    container.appendChild(row);
    if (p.uiType) {
        const sel = row.querySelector(".ffb-type");
        if (sel) sel.value = p.uiType;
    }
    wireFfbRowOptionsVisibility(row);
    wireFfbRowReorderControls(row);
    refreshFfbReorderState();
}

/**
 * Phase 34a — wires up-arrow / down-arrow / remove handlers on a single row,
 * plus refreshes the disabled state of arrows in the whole list.
 */
function wireFfbRowReorderControls(row) {
    const up = row.querySelector(".ffb-arrow-up");
    const down = row.querySelector(".ffb-arrow-down");
    const remove = row.querySelector(".ffb-row-remove");
    if (up) {
        up.addEventListener("click", function () {
            const prev = row.previousElementSibling;
            if (prev && prev.classList.contains("ffb-row")) {
                row.parentNode.insertBefore(row, prev);
                refreshFfbReorderState();
            }
        });
    }
    if (down) {
        down.addEventListener("click", function () {
            const next = row.nextElementSibling;
            if (next && next.classList.contains("ffb-row")) {
                row.parentNode.insertBefore(next, row);
                refreshFfbReorderState();
            }
        });
    }
    if (remove) {
        remove.addEventListener("click", function () {
            row.remove();
            refreshFfbReorderState();
        });
    }
}

function refreshFfbReorderState() {
    const rows = document.querySelectorAll("#fieldFormBuilderRows .ffb-row");
    rows.forEach((r, i) => {
        const up = r.querySelector(".ffb-arrow-up");
        const down = r.querySelector(".ffb-arrow-down");
        if (up) up.disabled = i === 0;
        if (down) down.disabled = i === rows.length - 1;
    });
}

function closeFieldFormBuilderModal() {
    const m = document.getElementById("fieldFormBuilderModal");
    if (m) m.style.display = "none";
}

function closeFieldFormPreviewModal() {
    const m = document.getElementById("fieldFormPreviewModal");
    if (m) m.style.display = "none";
}

/** Phase 34a — read/write chip multi-selects. */
function getFfbChipValues(containerId) {
    const out = [];
    const inputs = document.querySelectorAll(
        "#" + containerId + " .ffb-chip input[type=checkbox]"
    );
    inputs.forEach((cb) => {
        if (cb.checked && cb.value) out.push(String(cb.value));
    });
    return out;
}

function setFfbChipValues(containerId, vals) {
    const set = new Set(Array.isArray(vals) ? vals.map((v) => String(v)) : []);
    const inputs = document.querySelectorAll(
        "#" + containerId + " .ffb-chip input[type=checkbox]"
    );
    inputs.forEach((cb) => {
        cb.checked = set.has(String(cb.value));
    });
}

function openFieldFormBuilderCreate() {
    fieldFormBuilderEditingId = null;
    const title = document.getElementById("fieldFormBuilderModalTitle");
    if (title) title.textContent = "New field form template";
    const nameEl = document.getElementById("ffbTemplateName");
    const kwEl = document.getElementById("ffbTargetKeyword");
    const act = document.getElementById("ffbActive");
    const catEl = document.getElementById("ffbCategory");
    const sortEl = document.getElementById("ffbSortIndex");
    const defEl = document.getElementById("ffbIsDefault");
    const rows = document.getElementById("fieldFormBuilderRows");
    const del = document.getElementById("fieldFormBuilderDeleteBtn");
    if (nameEl) nameEl.value = "";
    if (kwEl) kwEl.value = "";
    if (act) act.checked = true;
    if (catEl) catEl.value = "general";
    if (sortEl) sortEl.value = "0";
    if (defEl) defEl.checked = false;
    setFfbChipValues("ffbJobTypeChips", []);
    setFfbChipValues("ffbRepairTypeChips", []);
    if (rows) rows.innerHTML = "";
    addFieldFormBuilderRow();
    if (del) del.style.display = "none";
    const m = document.getElementById("fieldFormBuilderModal");
    if (m) m.style.display = "flex";
}

function openFieldFormBuilderEdit(docId) {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    fieldFormBuilderEditingId = docId;
    firebase
        .firestore()
        .collection("form_templates")
        .doc(docId)
        .get()
        .then((snap) => {
            if (!snap.exists) {
                alert("Template not found.");
                return;
            }
            const d = snap.data() || {};
            const title = document.getElementById("fieldFormBuilderModalTitle");
            if (title) title.textContent = "Edit field form template";
            const nameEl = document.getElementById("ffbTemplateName");
            const kwEl = document.getElementById("ffbTargetKeyword");
            const act = document.getElementById("ffbActive");
            const catEl = document.getElementById("ffbCategory");
            const sortEl = document.getElementById("ffbSortIndex");
            const defEl = document.getElementById("ffbIsDefault");
            const rows = document.getElementById("fieldFormBuilderRows");
            const del = document.getElementById("fieldFormBuilderDeleteBtn");
            if (nameEl) nameEl.value = d.templateName || "";
            if (kwEl) kwEl.value = d.targetKeyword || "";
            if (act) act.checked = d.active !== false;
            if (catEl) catEl.value = d.formCategory || "general";
            if (sortEl) sortEl.value = Number.isFinite(Number(d.sortIndex)) ? String(d.sortIndex) : "0";
            if (defEl) defEl.checked = !!d.isDefault;
            setFfbChipValues("ffbJobTypeChips", Array.isArray(d.assignedJobTypes) ? d.assignedJobTypes : []);
            setFfbChipValues(
                "ffbRepairTypeChips",
                Array.isArray(d.assignedRepairTypes) ? d.assignedRepairTypes : []
            );
            if (rows) rows.innerHTML = "";
            const fields = Array.isArray(d.fields) ? d.fields : [];
            if (fields.length === 0) {
                addFieldFormBuilderRow();
            } else {
                fields.forEach((f) => {
                    addFieldFormBuilderRow({
                        label: f.label || "",
                        uiType: mapFirestoreFieldToUiType(f),
                        required: !!f.required,
                        options: Array.isArray(f.options) ? f.options : [],
                    });
                });
            }
            if (del) del.style.display = "inline-block";
            const m = document.getElementById("fieldFormBuilderModal");
            if (m) m.style.display = "flex";
        })
        .catch((e) => {
            console.error("openFieldFormBuilderEdit", e);
            alert("Could not load template.");
        });
}

async function saveFieldFormTemplate() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
        alert("Firebase is not available.");
        return;
    }
    const nameEl = document.getElementById("ffbTemplateName");
    const kwEl = document.getElementById("ffbTargetKeyword");
    const act = document.getElementById("ffbActive");
    const name = nameEl && nameEl.value ? nameEl.value.trim() : "";
    const kw = kwEl && kwEl.value ? kwEl.value.trim() : "";
    if (!name) {
        alert("Enter a template name.");
        return;
    }
    if (!kw) {
        alert("Enter the AI Trigger Word (target keyword) for Gemini.");
        return;
    }
    const collected = collectFieldFormBuilderRows();
    if (collected.length === 0) {
        if (!confirm("This template has no fields. Save anyway?")) return;
    }
    for (const row of collected) {
        const u = String(row.uiType || "TEXT").toUpperCase();
        if (
            (u === "DROPDOWN" || u === "MULTI_CHECK") &&
            parseCommaSeparatedOptions(row.optionsStr).length === 0
        ) {
            alert(
                `Field "${row.label}" needs at least one option (comma-separated) for Dropdown / Multi-Check.`
            );
            return;
        }
    }
    const fields = collected.map((row, i) => mapUiTypeToFirestoreField(row, i));
    let docId = fieldFormBuilderEditingId;
    if (!docId) {
        const base = slugifyFieldFormTemplateId(name);
        docId = await ensureUniqueFieldFormDocId(base);
    }
    const catEl = document.getElementById("ffbCategory");
    const sortEl = document.getElementById("ffbSortIndex");
    const defEl = document.getElementById("ffbIsDefault");
    const sortIdxRaw = sortEl && sortEl.value !== "" ? Number(sortEl.value) : 0;
    const sortIdx = Number.isFinite(sortIdxRaw) ? sortIdxRaw : 0;
    const payload = {
        templateName: name,
        targetKeyword: kw,
        active: !!(act && act.checked),
        fields,
        formCategory: catEl && catEl.value ? String(catEl.value) : "general",
        assignedJobTypes: getFfbChipValues("ffbJobTypeChips"),
        assignedRepairTypes: getFfbChipValues("ffbRepairTypeChips"),
        isDefault: !!(defEl && defEl.checked),
        sortIndex: sortIdx,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    try {
        await firebase.firestore().collection("form_templates").doc(docId).set(payload, { merge: true });
        closeFieldFormBuilderModal();
        await hydrateFieldFormTemplatesList();
        if (typeof showSaveCue === "function") showSaveCue("✓ Field form template saved");
        else alert("Saved.");
    } catch (e) {
        console.error("saveFieldFormTemplate", e);
        alert("Save failed: " + (e.message || e));
    }
}

async function deleteFieldFormTemplateFromBuilder() {
    if (!fieldFormBuilderEditingId) return;
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (!confirm("Delete this template permanently? The Field App will no longer show it.")) return;
    try {
        await firebase.firestore().collection("form_templates").doc(fieldFormBuilderEditingId).delete();
        closeFieldFormBuilderModal();
        fieldFormBuilderEditingId = null;
        await hydrateFieldFormTemplatesList();
        if (typeof showSaveCue === "function") showSaveCue("✓ Template deleted");
    } catch (e) {
        console.error("deleteFieldFormTemplateFromBuilder", e);
        alert("Delete failed: " + (e.message || e));
    }
}

function buildFieldFormPreviewHtml(doc) {
    const name = escapeHTML(doc.templateName || "Form");
    const fields = Array.isArray(doc.fields) ? doc.fields : [];
    let html =
        '<div style="background:#f4f7fa;border-radius:16px;padding:12px;max-width:390px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">';
    html += '<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">';
    html += `<h3 style="margin:0 0 12px 0;font-size:17px;color:#0ea5e9;">${name}</h3>`;
    html +=
        '<label style="display:block;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:4px;">Equipment</label>';
    html +=
        '<div style="padding:12px;border:1px solid #d1d9e0;border-radius:8px;background:#fafbfc;color:#95a5a6;font-size:14px;">Select equipment…</div>';
    html += '<div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px;border:1px solid #e8eef4;font-size:13px;">';
    html +=
        '<label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:default;"><input type="checkbox" disabled /> Direct drive (no belt)</label>';
    html += '<label style="display:block;font-size:11px;font-weight:600;color:#555;margin-bottom:4px;">Equipment type</label>';
    html +=
        '<div style="padding:8px;border:1px solid #d1d9e0;border-radius:8px;background:#fff;">Standard / RTU</div>';
    html += "</div>";
    fields.forEach((f, idx) => {
        const label = escapeHTML(f.label || "Field");
        const req = f.required ? ' <span style="color:#e74c3c">*</span>' : "";
        const t = String(f.type || "text").toLowerCase();
        const g = f.group;
        html += '<div style="margin-top:14px;">';
        if (t === "checkbox") {
            html += `<label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#333;"><input type="checkbox" disabled /> ${label}${req}</label>`;
        } else if (t === "toggle") {
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;color:#333;"><span>${label}${req}</span><span style="display:inline-block;width:48px;height:26px;background:#cbd5e1;border-radius:26px;position:relative;flex-shrink:0;"><span style="position:absolute;left:3px;top:3px;width:20px;height:20px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span></span></div>`;
        } else if (t === "photo") {
            html += `<label style="display:block;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:4px;">${label}${req}</label>`;
            html +=
                '<div style="padding:10px;border:1px dashed #cbd5e1;border-radius:8px;color:#95a5a6;font-size:13px;">📷 Photo capture</div>';
        } else if (t === "dropdown") {
            const opts = Array.isArray(f.options) ? f.options : [];
            html += `<label style="display:block;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:4px;">${label}${req}</label>`;
            html +=
                '<select disabled style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #d1d9e0;border-radius:8px;font-size:16px;background:#fff;">';
            html += '<option>Select...</option>';
            opts.forEach((o) => {
                html += `<option>${escapeHTML(String(o))}</option>`;
            });
            html += "</select>";
        } else if (t === "multi_check") {
            const opts = Array.isArray(f.options) ? f.options : [];
            html += `<div style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:6px;">${label}${req}</div>`;
            opts.forEach((o) => {
                html += `<label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#333;margin-bottom:6px;"><input type="checkbox" disabled /> ${escapeHTML(String(o))}</label>`;
            });
        } else {
            html += `<label style="display:block;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:4px;">${label}${req}`;
            if (g === "belt") html += ' <span style="font-size:10px;color:#7f8c8d;">(Belt group)</span>';
            if (g === "filter") html += ' <span style="font-size:10px;color:#7f8c8d;">(Filter group)</span>';
            html += "</label>";
            const inputType = t === "number" ? "number" : "text";
            html += `<input disabled type="${inputType}" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #d1d9e0;border-radius:8px;font-size:16px;" placeholder="…" />`;
        }
        html += "</div>";
    });
    html += '<div style="display:flex;gap:10px;margin-top:18px;">';
    html +=
        '<button type="button" disabled style="flex:1;padding:12px;border:1px solid #ccc;border-radius:8px;background:#f4f4f4;color:#999;">Cancel</button>';
    html +=
        '<button type="button" disabled style="flex:1;padding:12px;border:none;border-radius:8px;background:#0ea5e9;color:#fff;">Save</button>';
    html += "</div>";
    html += "</div></div>";
    return html;
}

function openFieldFormPreviewFromBuilder() {
    const nameEl = document.getElementById("ffbTemplateName");
    const collected = collectFieldFormBuilderRows();
    const name = nameEl && nameEl.value ? nameEl.value.trim() : "Untitled";
    if (collected.length === 0) {
        alert("Add at least one field with a label to preview.");
        return;
    }
    const fields = collected.map((row, i) => mapUiTypeToFirestoreField(row, i));
    const body = document.getElementById("fieldFormPreviewBody");
    if (body) body.innerHTML = buildFieldFormPreviewHtml({ templateName: name, fields });
    const m = document.getElementById("fieldFormPreviewModal");
    if (m) m.style.display = "flex";
}

async function deleteFieldFormTemplateById(id) {
    if (!id || typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;
    if (!confirm("Delete this field form template? The Field App will stop offering it.")) return;
    try {
        await firebase.firestore().collection("form_templates").doc(id).delete();
        await hydrateFieldFormTemplatesList();
        if (typeof showSaveCue === "function") showSaveCue("✓ Template deleted");
    } catch (e) {
        console.error("deleteFieldFormTemplateById", e);
        alert("Delete failed: " + (e.message || e));
    }
}

/** Delegated list clicks + Create button — inline onclick is blocked under some CSPs (e.g. GitHub Pages). */
function initFieldFormBuilderUi() {
    const container = document.getElementById("fieldFormTemplatesList");
    if (container && container.dataset.fieldFormDelegation !== "1") {
        container.dataset.fieldFormDelegation = "1";
        container.addEventListener("click", function (e) {
            const editBtn = e.target.closest(".field-form-template-edit");
            const delBtn = e.target.closest(".field-form-template-delete");
            if (editBtn) {
                const id = editBtn.getAttribute("data-template-id");
                if (id) openFieldFormBuilderEdit(id);
                e.preventDefault();
                return;
            }
            if (delBtn) {
                const id = delBtn.getAttribute("data-template-id");
                if (id) void deleteFieldFormTemplateById(id);
                e.preventDefault();
            }
        });
    }
    const createBtn = document.getElementById("btnFieldFormCreateTemplate");
    if (createBtn && createBtn.dataset.wired !== "1") {
        createBtn.dataset.wired = "1";
        createBtn.addEventListener("click", function () {
            openFieldFormBuilderCreate();
        });
    }
}

async function hydrateFieldFormTemplatesList() {
    const container = document.getElementById("fieldFormTemplatesList");
    if (!container) return;
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
        container.innerHTML =
            '<p style="color:#e74c3c;font-size:13px;">Connect to Firebase to manage field form templates.</p>';
        return;
    }
    container.innerHTML =
        '<p style="color:#7f8c8d;font-size:13px;">Loading templates…</p>';
    try {
        const snap = await firebase.firestore().collection("form_templates").get();
        const rows = [];
        snap.forEach((doc) => {
            rows.push({ id: doc.id, ...doc.data() });
        });
        rows.sort((a, b) => {
            const sa = Number.isFinite(Number(a.sortIndex)) ? Number(a.sortIndex) : 0;
            const sb = Number.isFinite(Number(b.sortIndex)) ? Number(b.sortIndex) : 0;
            if (sa !== sb) return sa - sb;
            return String(a.templateName || a.id || "").localeCompare(String(b.templateName || b.id || ""));
        });
        if (rows.length === 0) {
            container.innerHTML =
                '<p style="color:#7f8c8d;font-size:13px;">No templates yet. Create one to use in the Field App.</p>';
            return;
        }
        const CATEGORY_LABELS = {
            general: "General",
            service_call: "Service Call",
            pm_checklist: "PM Checklist",
            quote: "Quote",
            repair_checklist: "Repair Checklist",
            warranty: "Warranty",
        };
        const JOB_TYPE_LABELS = { service: "Service", pm: "PM", quote: "Quote" };
        const REPAIR_TYPE_LABELS = {
            supply_fan: "Supply Fan",
            condenser_fan: "Condenser Fan",
            gas_valve: "Gas Valve",
            compressor: "Compressor",
            refrigerant_leak: "Refrigerant Leak",
            other: "Other",
        };
        let html = "";
        rows.forEach((r) => {
            const active = r.active !== false;
            const kw = escapeHTML(String(r.targetKeyword || "—"));
            const nm = escapeHTML(String(r.templateName || r.id));
            const nf = Array.isArray(r.fields) ? r.fields.length : 0;
            const cat = CATEGORY_LABELS[String(r.formCategory || "general")] || "General";
            const jts = Array.isArray(r.assignedJobTypes)
                ? r.assignedJobTypes.map((x) => JOB_TYPE_LABELS[x] || x).filter(Boolean)
                : [];
            const rts = Array.isArray(r.assignedRepairTypes)
                ? r.assignedRepairTypes.map((x) => REPAIR_TYPE_LABELS[x] || x).filter(Boolean)
                : [];
            const def = !!r.isDefault;
            html += `<div style="background:#fff;border:1px solid #e1e8ed;border-radius:10px;padding:14px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.04);">`;
            html += `<div style="min-width:200px;flex:1;">`;
            html += `<div style="font-weight:800;color:#0ea5e9;font-size:15px;">${nm}`;
            if (def) html += ` <span style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:6px;letter-spacing:0.5px;">DEFAULT</span>`;
            html += `</div>`;
            html += `<div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHTML(cat)} · AI trigger: <strong style="color:#334155;">${kw}</strong> · ${nf} field(s) · `;
            html += active
                ? '<span style="color:#16a085;font-weight:700;">Active</span>'
                : '<span style="color:#95a5a6;font-weight:700;">Inactive</span>';
            html += ` · <span style="color:#94a3b8;">id: ${escapeHTML(r.id)}</span>`;
            html += `</div>`;
            if (jts.length || rts.length) {
                html += `<div style="font-size:11px;color:#475569;margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">`;
                jts.forEach((t) => {
                    html += `<span style="background:#e0f2fe;color:#0c4a6e;padding:2px 8px;border-radius:999px;">${escapeHTML(t)}</span>`;
                });
                rts.forEach((t) => {
                    html += `<span style="background:#fef9c3;color:#713f12;padding:2px 8px;border-radius:999px;">${escapeHTML(t)}</span>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
            html += `<div style="display:flex;gap:8px;flex-wrap:wrap;">`;
            html += `<button type="button" class="gen-btn field-form-template-edit" data-template-id="${escapeHTML(String(r.id))}" style="background:#f39c12;padding:8px 16px;font-size:13px;color:#fff;">Edit</button>`;
            html += `<button type="button" class="gen-btn field-form-template-delete" data-template-id="${escapeHTML(String(r.id))}" style="background:#e74c3c;padding:8px 16px;font-size:13px;color:#fff;">Delete</button>`;
            html += `</div></div>`;
        });
        container.innerHTML = html;
        initFieldFormBuilderUi();
    } catch (e) {
        console.error("hydrateFieldFormTemplatesList", e);
        container.innerHTML =
            '<p style="color:#e74c3c;font-size:13px;">Could not load templates. Check Firestore rules.</p>';
    }
}

window.openFieldFormBuilderCreate = openFieldFormBuilderCreate;
window.openFieldFormBuilderEdit = openFieldFormBuilderEdit;
window.deleteFieldFormTemplateById = deleteFieldFormTemplateById;

window.getTechAvailabilityForJobDate = getTechAvailabilityForJobDate;
window.formatWeekdayNameFromYmd = formatWeekdayNameFromYmd;

/** Called from User Import after writing tenants/.../users. */
window.mergeImportedTechsIntoRoster = function (names) {
    if (!Array.isArray(names)) return;
    var added = 0;
    names.forEach(function (n) {
        var u = String(n || "").trim().toUpperCase();
        if (!u || appTechList.includes(u)) return;
        appTechList.push(u);
        added++;
    });
    if (added > 0) {
        try {
            localStorage.setItem("tp_tech_list", JSON.stringify(appTechList));
        } catch (e) {}
        syncTechnicianRosterToFirestore();
        if (typeof renderTechSettings === "function") renderTechSettings();
        if (typeof populateTechDropdowns === "function") populateTechDropdowns();
    }
};
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFieldFormBuilderUi);
} else {
    initFieldFormBuilderUi();
}
