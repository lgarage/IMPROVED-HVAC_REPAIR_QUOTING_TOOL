// ====================================================================
// --- INVOICE CLOUD LOGIC & GENERATION ---
// ====================================================================

let cloudInvoices = []; // Recent batch for Invoice tab + search (limit 50)
let invoiceArchiveList = []; // Full archive page (limit 500)
let invoiceListExpanded = false;
const INVOICE_TAB_LIST_LIMIT = 3;

function clearInvoiceForm() {
    document.getElementById('invPasteArea').value = "";
    document.getElementById('invCustNameInput').value = "";
    document.getElementById('invCustNumInput').value = "";
    document.getElementById('invStreetInput').value = "";
    document.getElementById('invCityInput').value = "";
    document.getElementById('invStateInput').value = "";
    document.getElementById('invZipInput').value = "";
    document.getElementById('invLocNumInput').value = "";
    document.getElementById('invBillTo').value = "";
    document.getElementById('invServiceLoc').value = "";
    document.getElementById('invEquip').value = "";
    document.getElementById('invNotes').value = "";
    const invDiagEl = document.getElementById('invDiag');
    if (invDiagEl) invDiagEl.value = "";
    document.getElementById('invWork').value = "";
    document.getElementById('invLaborHours').value = "1.0";
    const invSdClear = document.getElementById('invServiceDate');
    if (invSdClear) invSdClear.valueAsDate = new Date();

    const invPs = document.getElementById('invParentSelect');
    const invPn = document.getElementById('invParentNew');
    if (invPs) invPs.value = "";
    if (invPn) invPn.value = "";
    ['invParentBillStreet', 'invParentBillCity', 'invParentBillState', 'invParentBillZip'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const invBillSite = document.getElementById('invBillToSite');
    const invBillParent = document.getElementById('invBillToParent');
    if (invBillSite) invBillSite.checked = true;
    if (invBillParent) invBillParent.disabled = true;
    
    document.getElementById('invCustNameInput').style.backgroundColor = "";
    document.getElementById('invStreetInput').style.backgroundColor = "";
    if(document.getElementById('invCustWarning')) document.getElementById('invCustWarning').remove();
    if(document.getElementById('invLocWarning')) document.getElementById('invLocWarning').remove();
    
    document.getElementById('invPartsContainer').innerHTML = `
        <div class="inv-parts-grid-layout part-header-row">
            <label>QTY</label><label>Part Description</label><label>Our Cost $</label><label style="color:#27ae60;">Retail $ (Auto)</label><label></label>
        </div>`;
    addInvoicePartRow("Preventative Maintenance parts");
    calcInvoice();
    document.getElementById('invoiceResultsSection').style.display = 'none';
    document.getElementById('invoiceBuilder').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addInvoicePartRow(desc = "", qty = 1) {
    const container = document.getElementById('invPartsContainer');
    const row = document.createElement('div');
    row.className = 'inv-parts-grid-layout part-row inv-part-line';
    row.innerHTML = `
        <input type="number" class="p-qty" value="${qty}" min="1" oninput="calcInvoice()">
        <input type="text" class="p-desc" value="${desc}" placeholder="Part Description">
        <div class="cost-wrapper"><span>$</span><input type="number" class="p-cost" placeholder="0.00" step="0.01" min="0" oninput="calcInvoice()"></div>
        <div class="cost-wrapper" style="color:#27ae60;"><span>$</span><input type="text" class="p-retail" value="0.00" readonly style="background:transparent; border:none; font-weight:bold; width:100%; outline:none;"></div>
        <div style="text-align: right;"><button type="button" class="remove-part-btn" onclick="this.parentElement.parentElement.remove(); calcInvoice();">X</button></div>
    `;
    container.appendChild(row);
}

function isolatePartsUsedSection(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let t = raw.trim();
    const stopRe = /\n\s*(?:Cost of parts|Parts needed for|Labor for repair|Recommendations|Pictures)\b/i;
    const m = t.match(stopRe);
    if (m && m.index !== undefined) t = t.slice(0, m.index).trim();
    return t;
}

function isInvoicePartsLineNoise(line) {
    const s = (line || '').trim();
    if (!s) return true;
    const u = s.toUpperCase();
    if (u === 'NONE' || u === 'UNKNOWN' || u === 'N/A' || u === 'NA') return true;
    if (/^COST OF PARTS/i.test(s)) return true;
    if (/\(IF KNOWN\)/i.test(s)) return true;
    if (/^PARTS NEEDED/i.test(s)) return true;
    return false;
}

/** PM-style paste: banner line, PM+Location block, or paired Notes/repairs + Work done labels. */
function looksLikePmPaste(rawText, parseSource) {
    const raw = rawText || "";
    const p = parseSource || "";
    if (/(?:^|[\r\n])\s*PM\s*(?:[\r\n]|$)/m.test(raw)) return true;
    if (/\bPM\s*[\r\n]+\s*[\r\n]*\s*Location\s*:/i.test(raw)) return true;
    if (/(?:^|[\r\n])\s*Notes\s*[/\\]\s*repairs\s*:/i.test(p) && /(?:^|[\r\n])\s*Work\s+done\s*:/i.test(p)) return true;
    return false;
}

// --- SMART PASTED NOTES PARSER (OMNIVOROUS) ---
// Gemini may run after parse when fields look incomplete (same API key as cleanIssueWithAI in service_call.js).
async function parsePastedNotes() {
    const text = document.getElementById("invPasteArea").value;
    if (!text) return;

    const parseSource = text
        .replace(/^\s*QUOTED\s+REPAIR\s*\n*/i, "")
        .replace(/^\s*SERVICE\s+CALL\s*\n*/i, "")
        .replace(/^\s*(?:PREVENTATIVE|PREVENTIVE)\s+MAINTENANCE\s*\r?\n*/i, "")
        .replace(/^\s*PM\s*\r?\n+/i, "")
        .trim();

    // Look ahead for labeled lines (must include Diagnosis, System Testing, etc.)
    const nextHeader = "(?:\\n\\s*(?:Location|Date|Equipment|Notes|Work|Parts|Cost|Pictures|Reason|Findings|Repairs|Original|System|Further|Labor|Diagnosis)[a-zA-Z0-9 \\/&]*?:|$)";

    const extract = (pattern) => {
        const regex = new RegExp(`${pattern}:?\\s*(.*?)(?=${nextHeader})`, "is");
        const m = parseSource.match(regex);
        return m && m[1] ? m[1].trim() : "";
    };

    // 1. Extract and Process Location via Google Maps
    const locRaw = extract("Location");
    if (locRaw) await smartProcessLocation(locRaw);

    // 2. Extract Equipment (site / repaired / worked on)
    const equip = extract("Equipment on [Ss]ite") || extract("Equipment worked on") || extract("Equipment Repaired");
    if (equip) document.getElementById("invEquip").value = equip.replace(/\n/g, ", ");

    // 3. Reason for call (invNotes) — plain text only; do not prefix "Original Issue:" (print view already labels it)
    const pmNotes = extract("Notes\\s*[/\\\\]\\s*repairs");
    const svcReason = extract("Reason for call");
    const quoteIssue = extract("Original Issue Resolved");
    const reasonParts = [];
    if (quoteIssue) reasonParts.push(quoteIssue.trim());
    if (svcReason) reasonParts.push(svcReason.trim());
    if (pmNotes) reasonParts.push(pmNotes.trim());
    if (reasonParts.length > 0) document.getElementById("invNotes").value = reasonParts.join("\n\n");

    // Diagnosis: explicit "Diagnosis:" beats "Findings / Diagnosis" from service template
    const invDiagInput = document.getElementById("invDiag");
    const svcDiag = extract("Findings\\s*[/\\\\]\\s*Diagnosis");
    const explicitDiag = extract("Diagnosis");
    let diagVal = "";
    if (explicitDiag) diagVal = explicitDiag.replace(/\n/g, " ").trim();
    else if (svcDiag) diagVal = svcDiag.replace(/\n/g, " ").trim();
    if (invDiagInput) {
        if (/^n\/?a\.?$/i.test(diagVal)) invDiagInput.value = "";
        else invDiagInput.value = diagVal;
    }

    const dateLoggedRaw = extract("Date\\s+logged");
    const dateGenericRaw = extract("Date");
    let isoService = "";
    const blob = [dateLoggedRaw, dateGenericRaw, parseSource.slice(0, 500)].filter(Boolean).join("\n");
    let dm = blob.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (dm) isoService = dm[1];
    if (!isoService) {
        dm = blob.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
        if (dm) isoService = `${dm[3]}-${String(dm[1]).padStart(2, "0")}-${String(dm[2]).padStart(2, "0")}`;
    }
    const invSd = document.getElementById("invServiceDate");
    if (isoService && invSd) invSd.value = isoService;

    // 4. Notes / Repairs field (invWork) — no redundant "Repairs:" prefix; system testing on its own line
    const pmWork = extract("Work done");
    let svcRepairs = extract("Repairs made");
    if (svcRepairs && /^none\.?$/i.test(svcRepairs.trim())) svcRepairs = "";
    const quoteRepairs = extract("Repairs Completed");
    const quoteTesting = extract("System Testing & Verification");
    const partsNeedQuote = extract("Parts needed for repair quote");
    const laborQuote = extract("Labor for repair quote");
    const workParts = [];
    if (quoteRepairs) workParts.push(quoteRepairs.trim());
    if (svcRepairs) workParts.push(svcRepairs.trim());
    if (pmWork) workParts.push(pmWork.trim());
    if (quoteTesting) workParts.push("System testing: " + quoteTesting.trim());
    if (partsNeedQuote) workParts.push("Parts needed for repair quote:\n" + partsNeedQuote.trim());
    if (laborQuote) workParts.push("Labor for repair quote (hrs): " + laborQuote.trim());

    const workEl = document.getElementById("invWork");
    if (workParts.length > 0 && workEl) workEl.value = workParts.join("\n\n");

    // Further recommendations → Notes / Repairs (not printed: picture / "repair photos" lines)
    const furtherRec = extract("Further Recommendations");
    if (furtherRec && !/^none\.?$/i.test(furtherRec.trim()) && workEl) {
        const fr = "Further recommendations: " + furtherRec.trim();
        const base = (workEl.value || "").trim();
        workEl.value = base ? base + "\n\n" + fr : fr;
    }

    // 5. Extract Parts & Build Invoice Lines
    let partsRaw = extract("Parts used");
    partsRaw = isolatePartsUsedSection(partsRaw);

    const container = document.getElementById('invPartsContainer');
    container.innerHTML = `
        <div class="inv-parts-grid-layout part-header-row">
            <label>QTY</label><label>Part Description</label><label>Our Cost $</label><label style="color:#27ae60;">Retail $ (Auto)</label><label></label>
        </div>`;

    const partsList = partsRaw
        .split(/\n|,/)
        .map(s => s.trim())
        .filter(s => s && !isInvoicePartsLineNoise(s));

    const isPmFallback = looksLikePmPaste(text, parseSource);

    if (partsList.length === 0) {
        if (isPmFallback) {
            addInvoicePartRow("Preventative Maintenance parts", 1);
        } else {
            addInvoicePartRow("Parts Used", 1);
        }
    } else {
        partsList.forEach(partStr => {
            let qty = 1;
            let desc = partStr;
            const match = partStr.match(/^(\d+)\s*-\s*(.+)$/);
            if (match) {
                qty = parseInt(match[1], 10);
                desc = match[2];
            }
            addInvoicePartRow(desc, qty);
        });
    }

    calcInvoice();

    const rawForAi = document.getElementById("invPasteArea") && document.getElementById("invPasteArea").value;
    if (shouldAutoRunGeminiInvoice(rawForAi, parseSource)) {
        await parseInvoicePasteWithGemini({ merge: true, silent: true });
    }
}

function countInvoiceFieldsFilled() {
    const ids = ["invEquip", "invNotes", "invWork", "invStreetInput", "invCustNameInput", "invDiag"];
    let n = 0;
    for (let i = 0; i < ids.length; i++) {
        const el = document.getElementById(ids[i]);
        if (el && el.value && String(el.value).trim()) n++;
    }
    return n;
}

function hasRecognizableInvoiceTemplate(src, rawOpt) {
    const s = src || "";
    const raw = rawOpt != null ? String(rawOpt) : s;
    const line = (re) => new RegExp("(?:^|\\n)\\s*" + re + "\\s*:", "i").test(s);
    return (
        /QUOTED\s+REPAIR/i.test(raw) ||
        /SERVICE\s+CALL/i.test(raw) ||
        /(?:^|[\r\n])\s*PM\s*(?:[\r\n]|$)/m.test(raw) ||
        /(?:^|[\r\n])\s*(?:PREVENTATIVE|PREVENTIVE)\s+MAINTENANCE\s*(?:[\r\n]|$)/m.test(raw) ||
        line("Location") ||
        line("(?:Equipment\\s+on\\s+Site|Equipment\\s+Repaired|Equipment\\s+worked\\s+on)") ||
        line("Original\\s+Issue\\s+Resolved") ||
        line("Repairs\\s+Completed") ||
        line("Reason\\s+for\\s+call") ||
        line("Findings\\s*/\\s*Diagnosis") ||
        line("Repairs\\s+made") ||
        line("Notes\\s*/\\s*repairs") ||
        line("Work\\s+done") ||
        line("System\\s+Testing\\s*&\\s*Verification")
    );
}

/** After local parse: run Gemini only when notes look unstructured or important fields stayed empty. */
function shouldAutoRunGeminiInvoice(rawText, parseSource) {
    if (typeof getGeminiApiKey !== "function" || !getGeminiApiKey()) return false;
    const t = (rawText || "").trim();
    if (t.length < 50) return false;

    const score = countInvoiceFieldsFilled();
    const structured = hasRecognizableInvoiceTemplate(parseSource, rawText);

    if (score >= 4) return false;
    if (structured && score >= 3) return false;
    if (!structured && t.length >= 100) return true;
    if (structured && score < 2) return true;
    if (!structured && t.length >= 80 && score < 2) return true;

    return false;
}

/**
 * Gemini 1.5 Flash (same key as service_call.js cleanIssueWithAI). Auto-called with { merge, silent }.
 * @param {{ merge?: boolean, silent?: boolean }} opts merge = only fill empty fields; silent = no alerts on failure
 */
async function parseInvoicePasteWithGemini(opts) {
    const options = opts || {};
    const merge = !!options.merge;
    const silent = !!options.silent;

    const ta = document.getElementById("invPasteArea");
    const text = ta && ta.value;
    if (!text || !String(text).trim()) {
        if (!silent) alert("Paste technician notes first.");
        return;
    }
    if (typeof getGeminiApiKey !== "function" || !getGeminiApiKey()) {
        if (!silent) {
            alert("Add geminiApiKey (or apiKey) in firebase-config.js. Enable the Generative Language API in Google Cloud if requests fail.");
        }
        return;
    }

    function setInputIfAllowed(id, val) {
        const el = document.getElementById(id);
        if (!el || val == null) return;
        const v = String(val).trim();
        if (!v) return;
        if (merge && el.value && String(el.value).trim()) return;
        el.value = v;
    }

    const safeBody = String(text).slice(0, 12000).replace(/`/g, "'");
    const prompt = `You parse HVAC technician notes into invoice form fields. Return ONLY valid JSON (no markdown code fences) with exactly these keys:
"equipmentOnSite","reasonForCall","diagnosis","repairsCompleted","systemTesting","locationLine","serviceDateIso"
Rules: Strings only. Use "" if unknown. diagnosis may be "N/A". serviceDateIso use YYYY-MM-DD or "". Ignore photo/attachment lines.
reasonForCall = only the service reason / issue (not picture notes).
Raw notes:
---
${safeBody}
---`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
                }),
            }
        );
        const data = await response.json();
        if (data.error) {
            console.error("Gemini invoice:", data.error);
            if (!silent) alert("Gemini API: " + (data.error.message || JSON.stringify(data.error)));
            return;
        }
        if (!data.candidates || !data.candidates.length || !data.candidates[0].content || !data.candidates[0].content.parts) {
            if (!silent) alert("No usable response from Gemini (blocked or empty).");
            return;
        }
        let raw = data.candidates[0].content.parts[0].text.trim();
        raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        const j = JSON.parse(raw);

        setInputIfAllowed("invEquip", j.equipmentOnSite);
        setInputIfAllowed("invNotes", j.reasonForCall);

        const invDiag = document.getElementById("invDiag");
        if (invDiag) {
            const d = j.diagnosis != null ? String(j.diagnosis).trim() : "";
            const diagVal = /^n\/?a\.?$/i.test(d) ? "" : d;
            if (!merge || !invDiag.value.trim()) invDiag.value = diagVal;
        }

        const workBits = [];
        if (j.repairsCompleted) workBits.push(String(j.repairsCompleted).trim());
        if (j.systemTesting) workBits.push("System testing: " + String(j.systemTesting).trim());
        if (workBits.length) {
            const wEl = document.getElementById("invWork");
            if (wEl && (!merge || !wEl.value.trim())) wEl.value = workBits.join("\n\n");
        }

        if (j.serviceDateIso && /^\d{4}-\d{2}-\d{2}$/.test(String(j.serviceDateIso).trim())) {
            const invSd = document.getElementById("invServiceDate");
            if (invSd && (!merge || !invSd.value.trim())) invSd.value = String(j.serviceDateIso).trim();
        }
        const streetEl = document.getElementById("invStreetInput");
        const custEl = document.getElementById("invCustNameInput");
        const locEmpty = !(streetEl && streetEl.value.trim()) && !(custEl && custEl.value.trim());
        if (j.locationLine && typeof smartProcessLocation === "function" && (!merge || locEmpty)) {
            await smartProcessLocation(String(j.locationLine));
        }

        calcInvoice();
        if (typeof showSaveCue === "function") showSaveCue("✨ Gemini filled remaining fields");
    } catch (e) {
        console.error("Gemini invoice parse:", e);
        if (!silent) alert("Could not use Gemini (JSON parse or network).");
    }
}

async function resolveInvoiceParentForSave() {
    const newIn = document.getElementById('invParentNew');
    const sel = document.getElementById('invParentSelect');
    const newName = newIn ? newIn.value.trim().toUpperCase() : "";
    if (newName) {
        try {
            if (typeof firebase !== 'undefined' && firebase.apps.length) {
                const st = document.getElementById('invParentBillStreet');
                const ci = document.getElementById('invParentBillCity');
                const stt = document.getElementById('invParentBillState');
                const zi = document.getElementById('invParentBillZip');
                const parentRef = await firebase.firestore().collection('ParentCompanies').add({
                    Name: newName,
                    Street: (st && st.value || '').trim().toUpperCase(),
                    City: (ci && ci.value || '').trim().toUpperCase(),
                    State: (stt && stt.value || '').trim().toUpperCase(),
                    Zip: (zi && zi.value || '').trim().toUpperCase()
                });
                if (typeof loadParentCompanies === 'function') await loadParentCompanies();
                if (sel) sel.value = parentRef.id;
                if (newIn) newIn.value = '';
                return parentRef.id;
            }
        } catch (e) {
            console.error('Could not create parent company:', e);
        }
        return null;
    }
    return sel && sel.value ? sel.value : null;
}

function formatInvoiceSiteAddressBlock() {
    const st = document.getElementById('invStreetInput');
    const ci = document.getElementById('invCityInput');
    const sEl = document.getElementById('invStateInput');
    const zEl = document.getElementById('invZipInput');
    if (!st) return '';
    const finalStreet = (st.value || '').trim();
    const finalCity = ci ? (ci.value || '').trim() : '';
    const finalState = sEl ? (sEl.value || '').trim() : '';
    const finalZip = zEl ? (zEl.value || '').trim() : '';
    let formattedLoc = finalStreet;
    const csz = [];
    if (finalCity) csz.push(finalCity);
    const sz = [];
    if (finalState) sz.push(finalState);
    if (finalZip) sz.push(finalZip);
    if (sz.length > 0) csz.push(sz.join(' '));
    if (csz.length > 0) formattedLoc += (formattedLoc ? '\n' : '') + csz.join(', ');
    return formattedLoc.trim();
}

function buildInvoiceSiteBillToText() {
    const custEl = document.getElementById('invCustNameInput');
    const cust = custEl ? custEl.value.trim().toUpperCase() : '';
    const loc = formatInvoiceSiteAddressBlock();
    if (!cust && !loc) return '';
    if (!loc) return cust;
    if (!cust) return loc;
    return cust + '\n' + loc;
}

function buildInvoiceParentBillToText() {
    const sel = document.getElementById('invParentSelect');
    const newIn = document.getElementById('invParentNew');
    let nameLine = '';
    if (sel && sel.value && sel.selectedIndex >= 0) {
        const opt = sel.options[sel.selectedIndex];
        nameLine = (opt ? opt.textContent : '').trim().toUpperCase();
    } else if (newIn && newIn.value.trim()) {
        nameLine = newIn.value.trim().toUpperCase();
    }
    if (!nameLine) return '';
    const pSt = document.getElementById('invParentBillStreet');
    const pCi = document.getElementById('invParentBillCity');
    const pS = document.getElementById('invParentBillState');
    const pZ = document.getElementById('invParentBillZip');
    const street = (pSt && pSt.value || '').trim().toUpperCase();
    const city = (pCi && pCi.value || '').trim().toUpperCase();
    const state = (pS && pS.value || '').trim().toUpperCase();
    const zip = (pZ && pZ.value || '').trim().toUpperCase();
    const parts = [nameLine];
    if (street) parts.push(street);
    const line2 = [];
    if (city) line2.push(city);
    const sz = [];
    if (state) sz.push(state);
    if (zip) sz.push(zip);
    if (sz.length) line2.push(sz.join(' '));
    if (line2.length) parts.push(line2.join(', '));
    return parts.join('\n');
}

function updateInvoiceBillToParentRadioState() {
    const hasParent = !!(document.getElementById('invParentSelect') && document.getElementById('invParentSelect').value)
        || !!(document.getElementById('invParentNew') && document.getElementById('invParentNew').value.trim());
    const pr = document.getElementById('invBillToParent');
    const sr = document.getElementById('invBillToSite');
    if (!pr || !sr) return;
    pr.disabled = !hasParent;
    if (!hasParent && pr.checked) {
        sr.checked = true;
        applyInvoiceBillTo();
    }
}

function buildInvoiceServiceLocationText() {
    return buildInvoiceSiteBillToText();
}

function applyInvoiceBillTo(dbaBillToOverride) {
    const billEl = document.getElementById('invBillTo');
    const svcEl = document.getElementById('invServiceLoc');
    if (!billEl || !svcEl) return;
    svcEl.value = buildInvoiceServiceLocationText();

    if (dbaBillToOverride !== undefined && dbaBillToOverride !== null && String(dbaBillToOverride).trim() !== '') {
        billEl.value = dbaBillToOverride;
        return;
    }

    const parentRadio = document.getElementById('invBillToParent');
    const useParent = parentRadio && parentRadio.checked && !parentRadio.disabled;
    const hasParent = !!(document.getElementById('invParentSelect') && document.getElementById('invParentSelect').value)
        || !!(document.getElementById('invParentNew') && document.getElementById('invParentNew').value.trim());

    if (useParent && hasParent) {
        const pb = buildInvoiceParentBillToText();
        billEl.value = pb || buildInvoiceSiteBillToText();
    } else {
        billEl.value = buildInvoiceSiteBillToText();
    }
}

async function loadInvoiceParentBillingAddress(parentId) {
    const st = document.getElementById('invParentBillStreet');
    const ci = document.getElementById('invParentBillCity');
    const stt = document.getElementById('invParentBillState');
    const zi = document.getElementById('invParentBillZip');
    if (!st || !parentId) return;
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    try {
        const snap = await firebase.firestore().collection('ParentCompanies').doc(parentId).get();
        if (!snap.exists) return;
        const d = snap.data();
        const street = (d.Street != null ? d.Street : d.street) || '';
        st.value = String(street).toUpperCase();
        if (ci) ci.value = String((d.City != null ? d.City : d.city) || '').toUpperCase();
        if (stt) stt.value = String((d.State != null ? d.State : d.state) || '').toUpperCase();
        if (zi) zi.value = String((d.Zip != null ? d.Zip : d.zip) || '').toUpperCase();
    } catch (e) {
        console.error('Failed to load parent billing address', e);
    }
}

async function onInvParentCompanySelectChange(val) {
    if (val) {
        const newIn = document.getElementById('invParentNew');
        if (newIn) newIn.value = '';
    }
    if (val) {
        await loadInvoiceParentBillingAddress(val);
    } else {
        ['invParentBillStreet', 'invParentBillCity', 'invParentBillState', 'invParentBillZip'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
    updateInvoiceBillToParentRadioState();
    applyInvoiceBillTo();
}

function onInvParentNewTyped() {
    const newIn = document.getElementById('invParentNew');
    const sel = document.getElementById('invParentSelect');
    if (newIn && newIn.value.trim() && sel) sel.value = '';
    updateInvoiceBillToParentRadioState();
    applyInvoiceBillTo();
}

async function saveInvoiceParentCompanyAddress() {
    const sel = document.getElementById('invParentSelect');
    const id = sel && sel.value;
    if (!id) {
        alert('Select an existing parent company from the dropdown before saving its billing address. (A new parent name is created first when you Save to Customer Directory or print.)');
        return;
    }
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        alert('Firebase is not connected.');
        return;
    }
    const st = document.getElementById('invParentBillStreet');
    const ci = document.getElementById('invParentBillCity');
    const stt = document.getElementById('invParentBillState');
    const zi = document.getElementById('invParentBillZip');
    const payload = {
        Street: (st && st.value || '').trim().toUpperCase(),
        City: (ci && ci.value || '').trim().toUpperCase(),
        State: (stt && stt.value || '').trim().toUpperCase(),
        Zip: (zi && zi.value || '').trim().toUpperCase()
    };
    try {
        await firebase.firestore().collection('ParentCompanies').doc(id).set(payload, { merge: true });
        if (typeof showSaveCue === 'function') showSaveCue('✓ Parent billing address saved');
        applyInvoiceBillTo();
    } catch (e) {
        console.error(e);
        alert('Could not save parent billing address.');
    }
}

// --- Service call intake: parent company (mirrors invoice UI, sc-prefixed fields) ---

async function loadServiceParentBillingAddress(parentId) {
    const st = document.getElementById('scParentBillStreet');
    const ci = document.getElementById('scParentBillCity');
    const stt = document.getElementById('scParentBillState');
    const zi = document.getElementById('scParentBillZip');
    if (!st || !parentId) return;
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    try {
        const snap = await firebase.firestore().collection('ParentCompanies').doc(parentId).get();
        if (!snap.exists) return;
        const d = snap.data();
        const street = (d.Street != null ? d.Street : d.street) || '';
        st.value = String(street).toUpperCase();
        if (ci) ci.value = String((d.City != null ? d.City : d.city) || '').toUpperCase();
        if (stt) stt.value = String((d.State != null ? d.State : d.state) || '').toUpperCase();
        if (zi) zi.value = String((d.Zip != null ? d.Zip : d.zip) || '').toUpperCase();
    } catch (e) {
        console.error('Failed to load service parent billing address', e);
    }
}

async function onScParentCompanySelectChange(val) {
    if (val) {
        const newIn = document.getElementById('scParentNew');
        if (newIn) newIn.value = '';
    }
    if (val) {
        await loadServiceParentBillingAddress(val);
    } else {
        ['scParentBillStreet', 'scParentBillCity', 'scParentBillState', 'scParentBillZip'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
    updateServiceBillToParentRadioState();
}

function onScParentNewTyped() {
    const newIn = document.getElementById('scParentNew');
    const sel = document.getElementById('scParentSelect');
    if (newIn && newIn.value.trim() && sel) sel.value = '';
    updateServiceBillToParentRadioState();
}

function updateServiceBillToParentRadioState() {
    const hasParent = !!(document.getElementById('scParentSelect') && document.getElementById('scParentSelect').value)
        || !!(document.getElementById('scParentNew') && document.getElementById('scParentNew').value.trim());
    const pr = document.getElementById('scBillToParent');
    const sr = document.getElementById('scBillToSite');
    if (!pr || !sr) return;
    pr.disabled = !hasParent;
    if (!hasParent && pr.checked) {
        sr.checked = true;
    }
}

async function saveServiceParentCompanyAddress() {
    const sel = document.getElementById('scParentSelect');
    const id = sel && sel.value;
    if (!id) {
        alert('Select an existing parent company from the dropdown before saving its billing address. (Type a new parent name in the box next to the dropdown, then save the service ticket to create it.)');
        return;
    }
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        alert('Firebase is not connected.');
        return;
    }
    const st = document.getElementById('scParentBillStreet');
    const ci = document.getElementById('scParentBillCity');
    const stt = document.getElementById('scParentBillState');
    const zi = document.getElementById('scParentBillZip');
    const payload = {
        Street: (st && st.value || '').trim().toUpperCase(),
        City: (ci && ci.value || '').trim().toUpperCase(),
        State: (stt && stt.value || '').trim().toUpperCase(),
        Zip: (zi && zi.value || '').trim().toUpperCase()
    };
    try {
        await firebase.firestore().collection('ParentCompanies').doc(id).set(payload, { merge: true });
        if (typeof showSaveCue === 'function') showSaveCue('✓ Parent billing address saved');
    } catch (e) {
        console.error(e);
        alert('Could not save parent billing address.');
    }
}

async function resolveServiceParentForSave() {
    const newIn = document.getElementById('scParentNew');
    const sel = document.getElementById('scParentSelect');
    const newName = newIn ? newIn.value.trim().toUpperCase() : '';
    if (newName) {
        try {
            if (typeof firebase !== 'undefined' && firebase.apps.length) {
                const st = document.getElementById('scParentBillStreet');
                const ci = document.getElementById('scParentBillCity');
                const stt = document.getElementById('scParentBillState');
                const zi = document.getElementById('scParentBillZip');
                const parentRef = await firebase.firestore().collection('ParentCompanies').add({
                    Name: newName,
                    Street: (st && st.value || '').trim().toUpperCase(),
                    City: (ci && ci.value || '').trim().toUpperCase(),
                    State: (stt && stt.value || '').trim().toUpperCase(),
                    Zip: (zi && zi.value || '').trim().toUpperCase()
                });
                if (typeof loadParentCompanies === 'function') await loadParentCompanies();
                if (sel) sel.value = parentRef.id;
                if (newIn) newIn.value = '';
                return parentRef.id;
            }
        } catch (e) {
            console.error('Could not create parent company:', e);
        }
        return null;
    }
    return sel && sel.value ? sel.value : null;
}

async function setServiceParentSelect(parentId) {
    if (!parentId) return;
    await loadParentCompanies();
    const sel = document.getElementById('scParentSelect');
    const newIn = document.getElementById('scParentNew');
    if (!sel) return;
    if ([...sel.options].some((o) => o.value === parentId)) {
        sel.value = parentId;
        if (newIn) newIn.value = '';
    }
    await loadServiceParentBillingAddress(parentId);
    updateServiceBillToParentRadioState();
}

function clearInvoiceCrmWarningsIfPresent() {
    const custEl = document.getElementById('invCustNameInput');
    const strEl = document.getElementById('invStreetInput');
    if (custEl) custEl.style.backgroundColor = '';
    if (strEl) strEl.style.backgroundColor = '';
    const w1 = document.getElementById('invCustWarning');
    const w2 = document.getElementById('invLocWarning');
    if (w1) w1.remove();
    if (w2) w2.remove();
}

/**
 * Pushes the current invoice Client & Site fields into the local + cloud customer directory.
 * @param {{ showCue?: boolean }} options — showCue true (default): validation alerts + success toast; false: silent (e.g. before print).
 */
async function persistInvoiceCustomerToCRM(options) {
    const showCue = !options || options.showCue !== false;

    const nameInput = document.getElementById('invCustNameInput').value.trim().toUpperCase() || '';
    const streetInput = document.getElementById('invStreetInput').value.trim().toUpperCase();

    if (!nameInput || nameInput === 'UNKNOWN CUSTOMER' || nameInput.length < 3) {
        if (showCue) {
            alert('Enter a customer name (at least 3 characters) before saving to the directory.');
        }
        return false;
    }

    const parentIdResolved = await resolveInvoiceParentForSave();

    syncCustomerToDirectory({
        customerName: nameInput,
        customerNum: document.getElementById('invCustNumInput').value,
        locationAddress: streetInput,
        locationNum: document.getElementById('invLocNumInput').value,
        custCity: document.getElementById('invCityInput').value.trim().toUpperCase(),
        custState: document.getElementById('invStateInput').value.trim().toUpperCase(),
        custZip: document.getElementById('invZipInput').value.trim().toUpperCase(),
        parentId: parentIdResolved
    });

    if (parentIdResolved && streetInput) {
        try {
            if (typeof firebase !== 'undefined' && firebase.apps.length) {
                await firebase.firestore().collection('MappedLocations').doc('MAP_' + Date.now()).set({
                    Parent_ID: parentIdResolved,
                    Sub_Company: nameInput,
                    City: document.getElementById('invCityInput').value.trim().toUpperCase(),
                    Street: streetInput
                });
            }
        } catch (mapErr) {
            console.warn('MappedLocations update skipped:', mapErr);
        }
    }

    if (typeof updateLocationDatalist === 'function') updateLocationDatalist();

    if (showCue) {
        clearInvoiceCrmWarningsIfPresent();
        if (typeof showSaveCue === 'function') showSaveCue('✓ Saved to Customer Directory');
    }

    return true;
}

async function saveInvoiceCustomerToDirectory() {
    await persistInvoiceCustomerToCRM({ showCue: true });
}

async function smartProcessLocation(locationStr) {
    let rawInput = locationStr.trim().toUpperCase().replace(/[–—]/g, '-');
    let custName = rawInput;
    let city = "";
    let streetSearch = "";
    let state = "WI"; 
    let zip = "";

    // 1. Check for specific DBA billing overrides
    const dbaAliases = {
        "TAKE 5": { company: "AMERICAN PLATINUM DOOR & GATE", billToAddress: "AMERICAN PLATINUM DOOR & GATE\n29001 SOLON RD UNIT Q\nSOLON, OH 44139" },
        "TAKE FIVE": { company: "AMERICAN PLATINUM DOOR & GATE", billToAddress: "AMERICAN PLATINUM DOOR & GATE\n29001 SOLON RD UNIT Q\nSOLON, OH 44139" }
    };

    let matchedAlias = Object.keys(dbaAliases).find(key => rawInput.includes(key));
    let customBillTo = null;

    if (matchedAlias) {
        custName = dbaAliases[matchedAlias].company;
        customBillTo = dbaAliases[matchedAlias].billToAddress;
    } else {
        if (rawInput.includes("-")) custName = rawInput.split('-')[0].trim();
        else custName = rawInput;
    }

    // 2. GOOGLE MAPS PLACES API SEARCH
    let googleAddressFound = false;
    
    // We only call Google if the API is loaded and ready
    if (window.google && google.maps && google.maps.places) {
        try {
            if (window.googleMapsPromise) await window.googleMapsPromise;
            
            // Clean up the query (e.g. "Take 5 Milwaukee Brown Deer Rd")
            const searchQuery = rawInput.replace(/-/g, ' ');
            const dummyNode = document.createElement('div');
            const service = new google.maps.places.PlacesService(dummyNode);
            const request = { query: searchQuery, fields: ['formatted_address'] };
            
            const googleResult = await new Promise((resolve) => {
                service.findPlaceFromQuery(request, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                        resolve(results[0].formatted_address);
                    } else { 
                        resolve(null); 
                    }
                });
            });

            if (googleResult) {
                // Google returns formats like: "7550 W Brown Deer Rd, Milwaukee, WI 53223, USA"
                const parts = googleResult.split(',').map(p => p.trim());
                if (parts.length >= 3) {
                    streetSearch = parts[0].toUpperCase();
                    city = parts[1].toUpperCase();
                    const stateZip = parts[2].split(' ');
                    state = stateZip[0] ? stateZip[0].toUpperCase() : "WI";
                    zip = stateZip[1] ? stateZip[1] : "";
                    googleAddressFound = true;
                }
            }
        } catch (err) {
            console.error("Google Places API error:", err);
        }
    }

    // 3. Fallback to basic string splitting if Google fails or is blocked
    if (!googleAddressFound) {
        let restOfStr = rawInput;
        if (matchedAlias) restOfStr = rawInput.replace(new RegExp(matchedAlias, "i"), "").replace(/^-+|-+$/g, '').trim();
        
        if (restOfStr.includes("-")) {
             let parts = restOfStr.split(/\s*-\s*/);
             if (parts.length >= 2) { city = parts[0].trim(); streetSearch = parts[1].trim(); } 
             else { streetSearch = restOfStr; }
             if (matchedAlias) streetSearch = `${matchedAlias} - ${streetSearch}`;
        } else {
             let addressMatch = restOfStr.match(/\b\d+\b/);
             if (addressMatch) {
                 let addrIndex = addressMatch.index;
                 city = restOfStr.substring(0, addrIndex).trim();
                 let foundStreet = restOfStr.substring(addrIndex).trim();
                 streetSearch = matchedAlias ? `${matchedAlias} - ${foundStreet}` : foundStreet;
             } else {
                 streetSearch = matchedAlias ? `${matchedAlias} - ${restOfStr}` : restOfStr;
             }
        }
    }

    const custNameInput = document.getElementById('invCustNameInput');
    const streetInput = document.getElementById('invStreetInput');
    
    custNameInput.value = custName;
    document.getElementById('invCityInput').value = city;
    document.getElementById('invStreetInput').value = streetSearch;
    document.getElementById('invStateInput').value = state;
    document.getElementById('invZipInput').value = zip;

    custNameInput.style.backgroundColor = "";
    streetInput.style.backgroundColor = "";
    if(document.getElementById('invCustWarning')) document.getElementById('invCustWarning').remove();
    if(document.getElementById('invLocWarning')) document.getElementById('invLocWarning').remove();

    // 4. Check against our local CRM cache
    let dbLocal = getCustomerDB(); 
    let custData = dbLocal[custName];
    let foundLocally = false;
    let matchedLocForParent = null;

    if (custData) {
        document.getElementById('invCustNumInput').value = custData.id;
        for (let locId in custData.locations) {
            let loc = custData.locations[locId];
            if ((streetSearch && loc.street.includes(streetSearch)) || (city && loc.city === city)) {
                document.getElementById('invLocNumInput').value = locId;
                document.getElementById('invStreetInput').value = loc.street;
                document.getElementById('invCityInput').value = loc.city;
                document.getElementById('invStateInput').value = loc.state;
                document.getElementById('invZipInput').value = loc.zip;
                foundLocally = true;
                matchedLocForParent = loc;
                break;
            }
        }
        if (!foundLocally && streetSearch) {
            document.getElementById('invLocNumInput').value = "LOC-" + Math.floor(1000 + Math.random() * 9000);
            streetInput.style.backgroundColor = "#fff3cd"; 
            const warning = document.createElement('div');
            warning.id = 'invLocWarning';
            warning.style.color = '#e74c3c';
            warning.style.fontSize = '11px';
            warning.style.marginTop = '4px';
            warning.innerText = "⚠ New Location. Will be added to CRM upon saving.";
            streetInput.parentNode.appendChild(warning);
        }
    } else {
        document.getElementById('invCustNumInput').value = "CST-" + Math.floor(1000 + Math.random() * 9000);
        document.getElementById('invLocNumInput').value = "LOC-" + Math.floor(1000 + Math.random() * 9000);
        
        custNameInput.style.backgroundColor = "#fff3cd"; 
        const warning = document.createElement('div');
        warning.id = 'invCustWarning';
        warning.style.color = '#e74c3c';
        warning.style.fontSize = '11px';
        warning.style.marginTop = '4px';
        warning.innerText = "⚠ New Customer. Will be created in CRM upon saving.";
        custNameInput.parentNode.appendChild(warning);
        
        if(streetSearch) streetInput.style.backgroundColor = "#fff3cd";
    }

    // 5. Link parent from CRM / mapping, then apply bill-to (site vs parent) and service location
    if (matchedLocForParent && matchedLocForParent.parentId && typeof setInvoiceParentSelect === 'function') {
        await setInvoiceParentSelect(matchedLocForParent.parentId);
    }
    if (typeof checkInvoiceParentCompany === 'function') await checkInvoiceParentCompany();
    applyInvoiceBillTo(customBillTo || undefined);
}

function calcInvoice() {
    let partsRetailTotal = 0;
    document.querySelectorAll('.inv-part-line').forEach(row => {
        const qty = parseInt(row.querySelector('.p-qty').value) || 1;
        const cost = parseFloat(row.querySelector('.p-cost').value) || 0;
        
        let retailUnit = 0;
        if(cost > 0) {
            const markup = getInvoiceMarkup(cost);
            retailUnit = cost + (cost * markup);
        }
        
        const lineRetailTotal = retailUnit * qty;
        
        row.querySelector('.p-retail').value = lineRetailTotal.toFixed(2);
        
        if(row.querySelector('.p-desc').value.trim() !== "") {
            partsRetailTotal += lineRetailTotal;
        }
    });

    const hours = parseFloat(document.getElementById("invLaborHours").value) || 0;
    const rate = parseFloat(document.getElementById("invLaborRate").value) || 0;
    const laborTotal = hours * rate;
    const trip = parseFloat(document.getElementById("invTruckCharge").value) || 0;
    
    const sub = partsRetailTotal + laborTotal + trip;
    const tax = sub * 0.055;
    const grand = sub + tax;
    
    document.getElementById("invSubtotalDisplay").innerText = "$" + sub.toFixed(2);
    document.getElementById("invTaxDisplay").innerText = "$" + tax.toFixed(2);
    document.getElementById("invGrandDisplay").innerText = "$" + grand.toFixed(2);
    
    return { sub, tax, grand, laborTotal, trip, partsRetailTotal };
}

function stripLeadingReasonForCallPrefix(text) {
    if (!text || typeof text !== "string") return text;
    return text
        .replace(/^\s*Reason for call:\s*/i, "")
        .replace(/^\s*Original Issue:\s*/i, "")
        .trim();
}

/** Remove photo attachment lines (not shown on printed invoice). */
function stripRepairPhotoLinesFromWorkText(text) {
    if (!text || typeof text !== "string") return "";
    return text
        .split(/\n/)
        .filter((line) => {
            const t = line.trim();
            if (!t) return true;
            if (/^repair photos attached\.?$/i.test(t)) return false;
            if (/^nameplate photos attached\.?$/i.test(t)) return false;
            if (/^photos attached\.?$/i.test(t)) return false;
            return true;
        })
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function escapeHtmlForInvoice(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Notes / Repairs print block: drop photo lines; bold "System testing:" like other tech-note labels.
 */
function formatInvoiceWorkPrintHtml(workRaw) {
    const stripped = stripRepairPhotoLinesFromWorkText(workRaw || "");
    if (!stripped) return "N/A";
    let splitRe = /\n\nSystem testing:\s*/i;
    let parts = stripped.split(splitRe);
    if (parts.length < 2) {
        splitRe = /\nSystem testing:\s*/i;
        parts = stripped.split(splitRe);
    }
    if (parts.length < 2) {
        return escapeHtmlForInvoice(stripped).replace(/\n/g, "<br>");
    }
    const head = (parts[0] || "").trim();
    const tail = parts.slice(1).join("\n\n").trim();
    const headHtml = head ? escapeHtmlForInvoice(head).replace(/\n/g, "<br>") : "";
    const tailHtml = tail ? escapeHtmlForInvoice(tail).replace(/\n/g, "<br>") : "";
    if (!tailHtml) return headHtml || "N/A";
    const sep = headHtml ? "<br><br>" : "";
    return `${headHtml}${sep}<strong>System testing:</strong> ${tailHtml}`;
}

function splitDiagnosisFromCombinedNotes(notesText) {
    const t = notesText || "";
    const match = t.match(/(?:^|\n)\s*Diagnosis:\s*/i);
    if (!match) return { rest: t.trim(), diag: "" };
    const idx = match.index;
    const rest = t.slice(0, idx).trim();
    const diag = t.slice(idx + match[0].length).trim();
    return { rest, diag };
}

function formatIsoDateUsDisplay(iso) {
    if (!iso || !String(iso).trim()) return "N/A";
    const p = String(iso).trim().split("-");
    if (p.length === 3 && p[0].length === 4) {
        return `${parseInt(p[1], 10)}/${parseInt(p[2], 10)}/${p[0]}`;
    }
    return String(iso).trim();
}

async function fetchNextInvoiceNumber() {
    let firestoreDb;
    try { firestoreDb = firebase.firestore(); } catch(e) { document.getElementById("invNum").value = "INV-10001 (Local)"; return; }

    try {
        const docRef = firestoreDb.collection('metadata').doc('invoiceData');
        const docSnap = await docRef.get();
        let nextNum = 10001; 
        
        if (docSnap.exists && docSnap.data().lastInvoiceNumber) {
            nextNum = docSnap.data().lastInvoiceNumber + 1;
            if (nextNum < 10001) nextNum = 10001; 
        } else {
            await docRef.set({ lastInvoiceNumber: 10000 }, { merge: true });
        }
        
        document.getElementById("invNum").value = "INV-" + nextNum;
        fetchedNextInvoice = true;
    } catch (error) {
        console.error("Firebase connection error:", error);
        document.getElementById("invNum").value = "INV-10001 (Local)";
    }
}

function generateInvoiceHTML() {
    const mathData = calcInvoice();
    const invNum = document.getElementById("invNum").value || "INV-XXXXXX";
    const billToText = document.getElementById("invBillTo").value || "Client Name";
    const shipToText = document.getElementById("invServiceLoc").value || "Service Location";
    const dateStr = today(); 
    
    document.getElementById("pInvNum").innerText = invNum;
    document.getElementById("pInvDate").innerText = dateStr;

    const svcDateEl = document.getElementById("invServiceDate");
    const svcIso = svcDateEl && svcDateEl.value ? svcDateEl.value : "";
    const pSvc = document.getElementById("pInvServiceDate");
    if (pSvc) pSvc.innerText = formatIsoDateUsDisplay(svcIso);
    
    document.getElementById("pInvBillName").innerHTML = billToText.replace(/\n/g, "<br>");
    document.getElementById("pInvShipName").innerHTML = shipToText.replace(/\n/g, "<br>");

    document.getElementById("pInvEquip").innerText = document.getElementById("invEquip").value || "N/A";

    const invDiagField = (document.getElementById("invDiag") && document.getElementById("invDiag").value || "").trim();
    const rawNotes = document.getElementById("invNotes").value || "";
    let notesForPrint = rawNotes.trim();
    let diagForPrint = invDiagField;
    if (!diagForPrint && rawNotes.trim()) {
        const sp = splitDiagnosisFromCombinedNotes(rawNotes);
        if (sp.diag) {
            diagForPrint = sp.diag;
            notesForPrint = sp.rest;
        }
    }
    notesForPrint = stripLeadingReasonForCallPrefix(notesForPrint);
    document.getElementById("pInvNotes").innerText = notesForPrint || "N/A";
    const pDiag = document.getElementById("pInvDiag");
    if (pDiag) pDiag.innerText = diagForPrint || "N/A";

    const workRaw = (document.getElementById("invWork") && document.getElementById("invWork").value) || "";
    const pInvWorkEl = document.getElementById("pInvWork");
    if (pInvWorkEl) pInvWorkEl.innerHTML = formatInvoiceWorkPrintHtml(workRaw);
    
    let tableHTML = "";
    const workDesc = document.getElementById("invWork").value;
    if(workDesc && document.querySelectorAll('.inv-part-line').length === 0) {
       tableHTML += `<tr><td>Preventative Maintenance - ${workDesc}</td><td></td></tr>`;
    }

    document.querySelectorAll('.inv-part-line').forEach(row => {
        const qty = parseInt(row.querySelector('.p-qty').value) || 1;
        const desc = row.querySelector('.p-desc').value.trim();
        const lineTotal = parseFloat(row.querySelector('.p-retail').value) || 0; 
        
        if(desc !== "") {
            let descDisplay = qty > 1 ? `${qty}x ${desc}` : desc;
            tableHTML += `<tr><td>${descDisplay}</td><td>$${lineTotal.toFixed(2)}</td></tr>`;
        }
    });
    
    if(mathData.laborTotal > 0) tableHTML += `<tr><td>Labor charge</td><td>$${mathData.laborTotal.toFixed(2)}</td></tr>`;
    if(mathData.trip > 0) tableHTML += `<tr><td>Trip charge</td><td>$${mathData.trip.toFixed(2)}</td></tr>`;
    if(mathData.tax > 0) tableHTML += `<tr><td>Sales Tax (5.5%)</td><td>$${mathData.tax.toFixed(2)}</td></tr>`;
    
    document.getElementById("pInvTableBody").innerHTML = tableHTML;
    
    const grandStr = "$" + mathData.grand.toFixed(2);
    document.getElementById("pTotal1").innerText = grandStr;
    document.getElementById("pTotal2").innerText = grandStr;
    document.getElementById("pInvGrandTotal").innerText = grandStr;
    document.getElementById("pBottomTotal").innerText = grandStr;
    
    let custId = document.getElementById('invCustNumInput').value || "N/A";
    let clientName = document.getElementById('invCustNameInput').value || billToText.split('\n')[0] || "Unknown Client";
    document.getElementById("pBottomCust").innerText = custId + " - " + clientName;
    document.getElementById("pBottomInv").innerText = invNum;
}

function previewInvoice() {
    generateInvoiceHTML();
    document.getElementById('invoiceResultsSection').style.display = 'block';
    document.getElementById('printInvoiceView').classList.add('screen-preview');
    document.getElementById('customerQuoteView').classList.remove('screen-preview');
    document.getElementById('printInvoiceView').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveAndPrintInvoice() {
    generateInvoiceHTML();

    await persistInvoiceCustomerToCRM({ showCue: false });

    const nameInput = document.getElementById('invCustNameInput').value.trim().toUpperCase() || "UNKNOWN CUSTOMER";
    const streetInput = document.getElementById('invStreetInput').value.trim().toUpperCase();

    let dbLoc = getCustomerDB();
    let finalCustId = dbLoc[nameInput] ? dbLoc[nameInput].id : "CST-XXXX";
    let finalLocId = "LOC-XXXX";
    if (dbLoc[nameInput] && dbLoc[nameInput].locations) {
        for (let locId in dbLoc[nameInput].locations) {
            if (dbLoc[nameInput].locations[locId].street === streetInput) { finalLocId = locId; break; }
        }
    }

    if (finalCustId === "CST-XXXX") finalCustId = document.getElementById('invCustNumInput').value;
    if (finalLocId === "LOC-XXXX") finalLocId = document.getElementById('invLocNumInput').value;

    let firestoreDb;
    try {
        firestoreDb = firebase.firestore();
    } catch(e) {
        alert("Firebase is not connected. Printing locally.");
        document.getElementById('customerQuoteView').style.display = 'none';
        document.getElementById('printInvoiceView').classList.remove('screen-preview');
        window.print();
        return;
    }

    const invNumText = document.getElementById("invNum").value;
    const grandTotal = document.getElementById("invGrandDisplay").innerText;
    
    const mathData = calcInvoice();
    let partsData = [];
    document.querySelectorAll('.inv-part-line').forEach(row => {
        const qty = parseInt(row.querySelector('.p-qty').value) || 1;
        const desc = row.querySelector('.p-desc').value.trim();
        const lineTotal = parseFloat(row.querySelector('.p-retail').value) || 0;
        const retailUnit = qty > 0 ? (lineTotal / qty) : 0; 
        if(desc !== "") partsData.push({ qty, desc, retailUnit });
    });

    document.getElementById("pBottomCust").innerText = finalCustId + " - " + nameInput;

    try {
        await firestoreDb.collection('invoices').add({
            invoiceNumber: invNumText,
            date: todayDB(),
            customerName: nameInput,
            customerId: finalCustId,
            locationId: finalLocId,
            locationStreet: streetInput,
            totalAmount: grandTotal,
            equip: document.getElementById('invEquip').value,
            notes: document.getElementById('invNotes').value,
            diagnosis: document.getElementById('invDiag') ? document.getElementById('invDiag').value : '',
            work: document.getElementById('invWork').value,
            serviceDate: document.getElementById('invServiceDate') ? document.getElementById('invServiceDate').value : '',
            billTo: document.getElementById('invBillTo').value,
            serviceLoc: document.getElementById('invServiceLoc').value,
            parts: partsData,
            laborTotal: mathData.laborTotal,
            tripTotal: mathData.trip,
            taxTotal: mathData.tax,
            subtotal: mathData.sub,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        const numOnly = parseInt(invNumText.replace("INV-", ""));
        if (!isNaN(numOnly)) {
             await firestoreDb.collection('metadata').doc('invoiceData').set({
                 lastInvoiceNumber: numOnly
             }, { merge: true });
        }
        
        showSaveCue("✓ Saved to Cloud!");
        
        document.getElementById('customerQuoteView').style.display = 'none';
        document.getElementById('printInvoiceView').classList.remove('screen-preview');
        setTimeout(() => { window.print(); }, 500);
        
        fetchedNextInvoice = false;
        loadFirebaseInvoices();
        
    } catch (error) {
        console.error("Error saving to cloud:", error);
        alert("Warning: Could not save invoice to Firebase database. Check Firestore rules. Proceeding to print.");
        document.getElementById('customerQuoteView').style.display = 'none';
        document.getElementById('printInvoiceView').classList.remove('screen-preview');
        window.print();
    }
}

function loadFirebaseInvoices() {
    let firestoreDb;
    try { firestoreDb = firebase.firestore(); } catch(e) { return; }

    invoiceListExpanded = false;

    firestoreDb.collection('invoices').orderBy('timestamp', 'desc').limit(50).get().then(snapshot => {
        cloudInvoices = [];
        snapshot.forEach(doc => { cloudInvoices.push({ id: doc.id, ...doc.data() }); });
        renderInvoiceTable();
    }).catch(e => { console.log("Could not load invoices: ", e); });
}

function loadFirebaseInvoiceArchive() {
    let firestoreDb;
    try { firestoreDb = firebase.firestore(); } catch(e) {
        const tbody = document.getElementById('invoiceArchiveTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#777;">Firebase not connected.</td></tr>`;
        return Promise.resolve();
    }

    return firestoreDb.collection('invoices').orderBy('timestamp', 'desc').limit(500).get().then(snapshot => {
        invoiceArchiveList = [];
        snapshot.forEach(doc => { invoiceArchiveList.push({ id: doc.id, ...doc.data() }); });
        renderInvoiceArchiveTable();
    }).catch(e => {
        console.log("Could not load invoice archive: ", e);
        const tbody = document.getElementById('invoiceArchiveTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#777;">Could not load invoices.</td></tr>`;
    });
}

function buildInvoiceTableRowHtml(data) {
    const safeId = String(data.id).replace(/'/g, "\\'");
    return `
        <tr style="border-bottom: 1px solid #eaeaea;">
            <td><button type="button" class="preview-btn" style="background:#3498db; cursor:pointer;" onclick="viewOldInvoice('${safeId}')">View</button></td>
            <td>${data.date || ''}</td>
            <td><strong>${data.invoiceNumber || ''}</strong></td>
            <td>${data.customerName || ''}<br><span style="font-size:11px; color:#777;">${data.customerId || ''}</span></td>
            <td>${data.locationStreet || ''}<br><span style="font-size:11px; color:#777;">${data.locationId || ''}</span></td>
            <td><strong style="color:#27ae60;">${data.totalAmount || ''}</strong></td>
        </tr>`;
}

function renderInvoiceTable(filterText = "") {
    const tbody = document.getElementById('invoiceDbTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    if (cloudInvoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#777;">No cloud invoices found.</td></tr>`;
        updateInvoiceShowMoreButtons(0, 0);
        return;
    }

    const lowerFilter = (filterText || "").toLowerCase();
    const filtered = [];
    cloudInvoices.forEach(data => {
        const searchString = `${data.invoiceNumber || ''} ${data.customerName || ''} ${data.locationStreet || ''} ${data.customerId || ''} ${data.locationId || ''}`.toLowerCase();
        if (searchString.includes(lowerFilter)) filtered.push(data);
    });

    const toShow = invoiceListExpanded ? filtered : filtered.slice(0, INVOICE_TAB_LIST_LIMIT);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#777;">No matching invoices.</td></tr>`;
    } else {
        toShow.forEach(data => { tbody.innerHTML += buildInvoiceTableRowHtml(data); });
    }

    updateInvoiceShowMoreButtons(filtered.length, toShow.length);
}

function updateInvoiceShowMoreButtons(filteredCount, shownCount) {
    const more = document.getElementById('invoiceShowMoreBtn');
    const less = document.getElementById('invoiceShowLessBtn');
    if (!more || !less) return;
    const hasMore = filteredCount > INVOICE_TAB_LIST_LIMIT;
    more.style.display = hasMore && !invoiceListExpanded ? 'inline-block' : 'none';
    less.style.display = hasMore && invoiceListExpanded ? 'inline-block' : 'none';
}

function toggleInvoiceShowMore() {
    invoiceListExpanded = true;
    const el = document.getElementById('invoiceSearch');
    renderInvoiceTable(el ? el.value : '');
}

function toggleInvoiceShowLess() {
    invoiceListExpanded = false;
    const el = document.getElementById('invoiceSearch');
    renderInvoiceTable(el ? el.value : '');
}

function renderInvoiceArchiveTable(filterText) {
    const tbody = document.getElementById('invoiceArchiveTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    if (invoiceArchiveList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#777;">No invoices found.</td></tr>`;
        return;
    }

    const searchEl = document.getElementById('invoiceArchiveSearch');
    const lowerFilter = (filterText !== undefined && filterText !== null
        ? filterText
        : (searchEl ? searchEl.value : '')).toLowerCase();
    let hasResults = false;

    invoiceArchiveList.forEach(data => {
        const searchString = `${data.invoiceNumber || ''} ${data.customerName || ''} ${data.locationStreet || ''} ${data.customerId || ''} ${data.locationId || ''}`.toLowerCase();
        if (searchString.includes(lowerFilter)) {
            hasResults = true;
            tbody.innerHTML += buildInvoiceTableRowHtml(data);
        }
    });

    if (!hasResults) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#777;">No matching invoices.</td></tr>`;
    }
}

function filterInvoices() {
    const filterText = document.getElementById('invoiceSearch').value;
    renderInvoiceTable(filterText);
}

function filterInvoiceArchive() {
    const el = document.getElementById('invoiceArchiveSearch');
    renderInvoiceArchiveTable(el ? el.value : '');
}

function findInvoiceDataById(docId) {
    let d = cloudInvoices.find(inv => inv.id === docId);
    if (d) return d;
    d = invoiceArchiveList.find(inv => inv.id === docId);
    return d || null;
}

async function ensureInvoiceDataForView(docId) {
    let d = findInvoiceDataById(docId);
    if (d) return d;
    try {
        const firestoreDb = firebase.firestore();
        const snap = await firestoreDb.collection('invoices').doc(docId).get();
        if (snap.exists) {
            d = { id: snap.id, ...snap.data() };
            if (!cloudInvoices.some(x => x.id === docId)) cloudInvoices.push(d);
            if (!invoiceArchiveList.some(x => x.id === docId)) invoiceArchiveList.push(d);
            return d;
        }
    } catch (e) {
        console.error("ensureInvoiceDataForView", e);
    }
    return null;
}

function applySavedInvoiceDataToPrintView(data, suffix) {
    const el = (id) => document.getElementById(id + suffix);

    el("pInvNum").innerText = data.invoiceNumber || "";

    let dateStr = data.date || "";
    if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        dateStr = `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}`;
    }
    el("pInvDate").innerText = dateStr;

    const pSvc = el("pInvServiceDate");
    if (pSvc) pSvc.innerText = formatIsoDateUsDisplay(data.serviceDate || "");

    el("pInvBillName").innerHTML = (data.billTo || data.customerName || "Unknown").replace(/\n/g, "<br>");
    el("pInvShipName").innerHTML = (data.serviceLoc || data.locationStreet || "Unknown").replace(/\n/g, "<br>");

    el("pInvEquip").innerText = data.equip || "N/A";

    const rawOldNotes = data.notes || "";
    const invDiagStored = (data.diagnosis || "").trim();
    let notesOld = rawOldNotes.trim();
    let diagOld = invDiagStored;
    if (!diagOld && rawOldNotes.trim()) {
        const sp = splitDiagnosisFromCombinedNotes(rawOldNotes);
        if (sp.diag) {
            diagOld = sp.diag;
            notesOld = sp.rest;
        }
    }
    notesOld = stripLeadingReasonForCallPrefix(notesOld);
    el("pInvNotes").innerText = notesOld || "N/A";
    const pDiag = el("pInvDiag");
    if (pDiag) pDiag.innerText = diagOld || "N/A";

    const pWork = el("pInvWork");
    if (pWork) pWork.innerHTML = formatInvoiceWorkPrintHtml(data.work || "");

    let tableHTML = "";
    if (data.work && (!data.parts || data.parts.length === 0)) {
        tableHTML += `<tr><td>Preventative Maintenance - ${data.work}</td><td></td></tr>`;
    }

    if (data.parts) {
        data.parts.forEach((p) => {
            const lineTotal = p.retailUnit * p.qty;
            const descDisplay = p.qty > 1 ? `${p.qty}x ${p.desc}` : p.desc;
            tableHTML += `<tr><td>${descDisplay}</td><td>$${lineTotal.toFixed(2)}</td></tr>`;
        });
    }

    if (data.laborTotal > 0) tableHTML += `<tr><td>Labor charge</td><td>$${data.laborTotal.toFixed(2)}</td></tr>`;
    if (data.tripTotal > 0) tableHTML += `<tr><td>Trip charge</td><td>$${data.tripTotal.toFixed(2)}</td></tr>`;
    if (data.taxTotal > 0) tableHTML += `<tr><td>Sales Tax (5.5%)</td><td>$${data.taxTotal.toFixed(2)}</td></tr>`;

    el("pInvTableBody").innerHTML = tableHTML;

    const grandStr = data.totalAmount || "$0.00";
    el("pTotal1").innerText = grandStr;
    el("pTotal2").innerText = grandStr;
    el("pInvGrandTotal").innerText = grandStr;
    el("pBottomTotal").innerText = grandStr;

    el("pBottomCust").innerText = (data.customerId || "N/A") + " - " + (data.customerName || "Unknown");
    el("pBottomInv").innerText = data.invoiceNumber || "";
}

function showArchiveInvoicePreviewUI() {
    const sec = document.getElementById("invoiceArchiveResultsSection");
    const pv = document.getElementById("printInvoiceViewArch");
    if (sec) sec.style.display = "block";
    if (pv) pv.classList.add("screen-preview");
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideInvoiceArchivePreview() {
    const sec = document.getElementById("invoiceArchiveResultsSection");
    const pv = document.getElementById("printInvoiceViewArch");
    if (sec) sec.style.display = "none";
    if (pv) pv.classList.remove("screen-preview");
}

async function viewOldInvoice(docId) {
    const data = await ensureInvoiceDataForView(docId);
    if (!data) {
        alert("Invoice not found.");
        return;
    }
    applySavedInvoiceDataToPrintView(data, "Arch");
    const archiveView = document.getElementById("view-invoice-archive");
    if (archiveView && !archiveView.classList.contains("active")) {
        switchTab("invoice-archive");
    }
    showArchiveInvoicePreviewUI();
}

function matchesInvoiceSearchFilter(data, lowerFilter) {
    if (!lowerFilter) return true;
    const searchString = `${data.invoiceNumber || ""} ${data.customerName || ""} ${data.locationStreet || ""} ${data.customerId || ""} ${data.locationId || ""}`.toLowerCase();
    return searchString.includes(lowerFilter);
}

async function openInvoiceSearchMatchInArchive() {
    const searchEl = document.getElementById("invoiceSearch");
    const filterText = (searchEl ? searchEl.value : "").trim();
    const lowerFilter = filterText.toLowerCase();

    if (!lowerFilter) {
        alert("Enter part of a name, invoice number, or address, then press Enter.");
        return;
    }

    let filtered = cloudInvoices.filter((d) => matchesInvoiceSearchFilter(d, lowerFilter));

    if (filtered.length === 0) {
        await loadFirebaseInvoiceArchive();
        filtered = invoiceArchiveList.filter((d) => matchesInvoiceSearchFilter(d, lowerFilter));
    }

    if (filtered.length === 0) {
        alert("No matching invoice found.");
        return;
    }

    const first = filtered[0];
    const searchArch = document.getElementById("invoiceArchiveSearch");
    if (searchArch) searchArch.value = searchEl ? searchEl.value : "";

    await viewOldInvoice(first.id);
    await loadFirebaseInvoiceArchive();
    renderInvoiceArchiveTable(searchArch ? searchArch.value : "");
}

// ✨ ADDED BACK IN: The Core Markup Engine
function getInvoiceMarkup(cost) {
    if (cost <= 5) return 4.00;
    if (cost <= 10) return 3.00;
    if (cost <= 15) return 2.00;
    if (cost <= 100) return 1.50;
    if (cost <= 500) return 1.00;
    if (cost <= 1000) return 0.85;
    if (cost <= 1500) return 0.75;
    return 0.65;
}
