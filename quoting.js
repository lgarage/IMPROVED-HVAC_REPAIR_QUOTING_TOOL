// ====================================================================
// --- QUOTING TOOL LOGIC ---
// ====================================================================

function triggerQuoteAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        const successfullySaved = saveQuoteToDatabase(true, true);
        if (successfullySaved && document.getElementById('resultsSection').style.display === 'block') { updatePreviewHTML(); }
    }, 250); 
}

function handleQuoteStatusChange() {
    const status = document.getElementById('quoteStatusInput').value;
    const workflow = document.getElementById('jobWorkflowInput');
    const requoteContainer = document.getElementById('requoteNoteContainer');
    const historyText = document.getElementById('requoteNoteHistory').value.trim();
    if (status !== 'Approved') workflow.value = 'N/A';
    if (status === 'Requote Requested' || historyText !== "") requoteContainer.style.display = 'flex';
    else requoteContainer.style.display = 'none';
}

function handleJobWorkflowChange() {
    const status = document.getElementById('quoteStatusInput');
    const workflow = document.getElementById('jobWorkflowInput').value;
    if (workflow !== 'N/A') { status.value = 'Approved'; handleQuoteStatusChange(); }
}

function addRequoteNote() {
    const newNoteInput = document.getElementById('newRequoteNote');
    const newNote = newNoteInput.value.trim(); 
    if (newNote === "") return;
    const historyArea = document.getElementById('requoteNoteHistory');
    const dateStr = new Date().toLocaleString();
    const formattedNote = `[${dateStr}] ${newNote}`;
    if (historyArea.value === "") historyArea.value = formattedNote;
    else historyArea.value += `\n\n` + formattedNote;
    newNoteInput.value = ""; 
    historyArea.scrollTop = historyArea.scrollHeight;
    handleQuoteStatusChange(); 
    triggerQuoteAutoSave();
}

function setDates() {
    document.getElementById('quoteDateInput').valueAsDate = new Date();
    var dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);
    document.getElementById('dueDateInput').valueAsDate = dueDate;
}

function setNextQuoteNumber() {
    let counter = parseInt(localStorage.getItem('tp_quote_counter') || '1000');
    document.getElementById('quoteNumberInput').value = 'QT-' + counter;
}

function incrementQuoteNumber() {
    let counter = parseInt(localStorage.getItem('tp_quote_counter') || '1000');
    localStorage.setItem('tp_quote_counter', counter + 1);
}

function startNewQuote() {
    if (document.getElementById('currentQuoteId').value !== "") {
        saveQuoteToDatabase(true, false); 
    } else if (document.getElementById('custNameInput').value.trim() !== "") {
        if(!confirm("You have an unsaved quote in progress. Discard it and start over?")) return; 
    }
    
    document.getElementById('currentQuoteId').value = "";
    document.getElementById('custNameInput').value = "";
    document.getElementById('custNumInput').value = "";
    document.getElementById('contactNameInput').value = "";
    document.getElementById('custStreetInput').value = "";
    document.getElementById('custCityInput').value = "";
    document.getElementById('custStateInput').value = "";
    document.getElementById('custZipInput').value = "";
    
    // THE FIX IS ON THIS LINE:
    document.getElementById('quoteLocNumInput').value = "";
    
    document.getElementById('quoteStatusInput').value = "Pending";
    document.getElementById('jobWorkflowInput').value = "N/A";
    document.getElementById('requoteNoteHistory').value = "";
    document.getElementById('newRequoteNote').value = "";
    document.getElementById('laborHoursInput').value = "1.0";
    handleQuoteStatusChange(); 
    
    document.getElementById('partsContainer').innerHTML = `
    <div class="parts-grid-layout part-header-row">
        <label>QTY</label>
        <label>Part Description</label>
        <label>Part Number</label>
        <label>Vendor</label>
        <label>Lead Time (Days)</label>
        <label>Our Cost $</label>
        <label style="color:#27ae60;">Retail $ (Auto)</label>
        <label></label>
    </div>`;
    addPartRow(); setDates(); setNextQuoteNumber(); 
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('mainFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function gatherFormData() {
    const laborHours = parseFloat(document.getElementById('laborHoursInput').value) || 0;
    const laborRate = parseFloat(document.getElementById('laborRateInput').value) || 0;
    const truckCharge = parseFloat(document.getElementById('truckChargeInput').value) || 0;
    const totalLaborAmount = laborHours * laborRate;
    
    let partsData = []; let partsRetailSubtotal = 0;
    document.querySelectorAll('.part-entry-line').forEach(row => {
        const qty = parseInt(row.querySelector('.p-qty').value) || 1;
        const desc = row.querySelector('.p-desc').value.trim().toUpperCase();
        const cost = parseFloat(row.querySelector('.p-cost').value);
        const vendor = row.querySelector('.p-vendor').value.trim().toUpperCase();

        if (!isNaN(cost) && desc !== "") {
            const markupMultiplier = getMarkupPercentage(cost);
            const retailPricePerUnit = cost + (cost * markupMultiplier);
            const totalRetailAmount = retailPricePerUnit * qty;
            partsRetailSubtotal += totalRetailAmount;
            partsData.push({ qty, desc, num: row.querySelector('.p-num').value.trim().toUpperCase(), vendor, lead: row.querySelector('.p-lead').value.trim().toUpperCase() || "N/A", cost, markupPercent: (markupMultiplier * 100).toFixed(0), retailUnit: retailPricePerUnit, retailTotal: totalRetailAmount });
        }
    });

    const subtotal = partsRetailSubtotal + totalLaborAmount + truckCharge;
    const tax = subtotal * 0.055;
    const grandTotal = subtotal + tax;

    return {
        id: document.getElementById('currentQuoteId').value, 
        customerName: document.getElementById('custNameInput').value.trim().toUpperCase() || "UNKNOWN CUSTOMER",
        customerNum: document.getElementById('custNumInput').value.trim().toUpperCase() || "N/A",
        contactName: document.getElementById('contactNameInput').value.trim().toUpperCase() || "",
        locationAddress: document.getElementById('custStreetInput').value.trim().toUpperCase() || "UNKNOWN LOCATION",
        custCity: document.getElementById('custCityInput').value.trim().toUpperCase() || "",
        custState: document.getElementById('custStateInput').value.trim().toUpperCase() || "",
        custZip: document.getElementById('custZipInput').value.trim().toUpperCase() || "",
        
        // THE FIX IS ON THIS LINE:
        locationNum: document.getElementById('quoteLocNumInput').value.trim().toUpperCase() || "N/A",
        
        quoteNum: document.getElementById('quoteNumberInput').value || "N/A",
        status: document.getElementById('quoteStatusInput').value,
        jobWorkflow: document.getElementById('jobWorkflowInput').value,
        requoteNote: document.getElementById('requoteNoteHistory').value, 
        quoteDate: document.getElementById('quoteDateInput').value,
        dueDate: document.getElementById('dueDateInput').value,
        laborHours, laborRate, truckCharge, totalLaborAmount, parts: partsData, subtotal, tax, grandTotal
    };
}

function loadQuoteForEditing(dbId) {
    try {
        var fsDb = firebase.firestore();
        var ref = window.VCFirestore ? window.VCFirestore.officeQuotes(fsDb) : fsDb.collection("office_quotes");
        ref.doc(dbId).get().then(function(doc) {
            if (doc.exists) {
                var quote = doc.data();
                quote.id = doc.id;
                _populateQuoteForm(quote);
            } else {
                _loadQuoteFromLocalStorage(dbId);
            }
        }).catch(function(err) {
            console.warn("[Quoting] Firestore load failed, trying localStorage:", err);
            _loadQuoteFromLocalStorage(dbId);
        });
    } catch (e) {
        console.warn("[Quoting] Firestore unavailable for load, using localStorage:", e);
        _loadQuoteFromLocalStorage(dbId);
    }
}

function _loadQuoteFromLocalStorage(dbId) {
    var lsDb = JSON.parse(localStorage.getItem('twinPillarsQuotesDB') || '[]');
    var quote = null;
    for (var i = 0; i < lsDb.length; i++) {
        if (lsDb[i].id === dbId) { quote = lsDb[i]; break; }
    }
    if (!quote) return;
    _populateQuoteForm(quote);
}

function _populateQuoteForm(quote) {
    document.getElementById('currentQuoteId').value = quote.id;
    document.getElementById('custNameInput').value = quote.customerName;
    document.getElementById('custNumInput').value = quote.customerNum;
    document.getElementById('contactNameInput').value = quote.contactName || "";
    document.getElementById('custStreetInput').value = quote.locationAddress;
    document.getElementById('custCityInput').value = quote.custCity || "";
    document.getElementById('custStateInput').value = quote.custState || "";
    document.getElementById('custZipInput').value = quote.custZip || "";
    document.getElementById('quoteLocNumInput').value = quote.locationNum || "";
    document.getElementById('quoteNumberInput').value = quote.quoteNum;
    document.getElementById('quoteStatusInput').value = quote.status;
    document.getElementById('jobWorkflowInput').value = quote.jobWorkflow || "N/A";
    document.getElementById('requoteNoteHistory').value = quote.requoteNote || "";
    document.getElementById('newRequoteNote').value = "";
    handleQuoteStatusChange(); updateLocationDatalist();

    document.getElementById('quoteDateInput').value = quote.quoteDate;
    document.getElementById('dueDateInput').value = quote.dueDate;
    document.getElementById('laborHoursInput').value = quote.laborHours;
    document.getElementById('laborRateInput').value = quote.laborRate;
    document.getElementById('truckChargeInput').value = quote.truckCharge;

    document.getElementById('partsContainer').innerHTML =
    '<div class="parts-grid-layout part-header-row">' +
        '<label>QTY</label>' +
        '<label>Part Description</label>' +
        '<label>Part Number</label>' +
        '<label>Vendor</label>' +
        '<label>Lead Time (Days)</label>' +
        '<label>Our Cost $</label>' +
        '<label style="color:#27ae60;">Retail $ (Auto)</label>' +
        '<label></label>' +
    '</div>';

    var parts = quote.parts || [];
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var row = document.createElement('div');
        row.className = 'parts-grid-layout part-row part-entry-line';
        var loadedLineRetail = p.retailTotal || 0;

        row.innerHTML = '<input type="number" class="p-qty" value="' + p.qty + '" min="1" oninput="calcQuoteLiveMath()">' +
            '<input type="text" class="p-desc" value="' + (p.desc || '') + '">' +
            '<input type="text" class="p-num" value="' + (p.num || '') + '">' +
            '<input type="text" class="p-vendor text-uppercase" value="' + (p.vendor || '') + '">' +
            '<input type="text" class="p-lead" value="' + (p.lead || '') + '">' +
            '<div class="cost-wrapper"><span>$</span><input type="number" class="p-cost" step="0.01" value="' + p.cost + '" oninput="calcQuoteLiveMath()"></div>' +
            '<div class="cost-wrapper" style="color:#27ae60;"><span>$</span><input type="text" class="p-retail" value="' + loadedLineRetail.toFixed(2) + '" readonly style="background:transparent; border:none; font-weight:bold; width:100%; outline:none;"></div>' +
            '<div style="text-align: right;"><button class="remove-part-btn" onclick="this.parentElement.parentElement.remove(); triggerQuoteAutoSave();">X</button></div>';
        document.getElementById('partsContainer').appendChild(row);
    }

    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('mainFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Parses Field app report text (SERVICE CALL template) for quote lines.
 * Sections: "Parts needed for repair quote:" and "Labor for repair quote:"
 */
function parseFieldTechNotesForQuote(techNotes) {
    const out = { partDescriptions: [], laborHours: null };
    if (!techNotes || typeof techNotes !== 'string') return out;
    const normalized = techNotes.replace(/\r\n/g, '\n');
    const partsMatch = normalized.match(/Parts needed for repair quote:\s*([\s\S]*?)(?=\n\n(?:Labor for repair quote|Recommendations|Next steps|Pictures):)/i);
    const laborMatch = normalized.match(/Labor for repair quote:\s*([^\n]+)/i);
    if (laborMatch) {
        const lab = laborMatch[1].trim();
        const num = lab.match(/(\d+(?:\.\d+)?)/);
        if (num) out.laborHours = parseFloat(num[1]);
    }
    if (partsMatch) {
        let block = partsMatch[1].trim();
        if (block && !/^NONE\.?$/i.test(block)) {
            const chunks = block.split(/\s*,\s*|\s+and\s+|\n+/i).map(s => s.trim()).filter(s => s && !/^NONE\.?$/i.test(s));
            out.partDescriptions = chunks.length ? chunks : [block];
        }
    }
    return out;
}

function setQuotePartsHeaderOnly() {
    document.getElementById('partsContainer').innerHTML = `
    <div class="parts-grid-layout part-header-row">
        <label>QTY</label>
        <label>Part Description</label>
        <label>Part Number</label>
        <label>Vendor</label>
        <label>Lead Time (Days)</label>
        <label>Our Cost $</label>
        <label style="color:#27ae60;">Retail $ (Auto)</label>
        <label></label>
    </div>`;
}

/** After startNewQuote + customer fields: fills labor hours and part rows from ticket / techNotes. */
function populateQuoteFromServiceCall(sc) {
    const parsed = parseFieldTechNotesForQuote(sc.techNotes || '');
    setQuotePartsHeaderOnly();
    if (parsed.partDescriptions.length > 0) {
        parsed.partDescriptions.forEach((d) => {
            addPartRow();
            const rows = document.querySelectorAll('#partsContainer .part-entry-line');
            const last = rows[rows.length - 1];
            const descEl = last.querySelector('.p-desc');
            if (descEl) descEl.value = d.toUpperCase();
        });
    } else {
        addPartRow();
        const first = document.querySelector('#partsContainer .part-entry-line');
        if (first) {
            const bits = [];
            if (sc.equip && String(sc.equip).trim() && sc.equip !== 'N/A') bits.push(`EQUIPMENT: ${sc.equip}`);
            if (sc.issue && String(sc.issue).trim()) bits.push(`ISSUE: ${sc.issue}`);
            const line = bits.join(' — ');
            if (line) first.querySelector('.p-desc').value = line.toUpperCase();
        }
    }
    if (parsed.laborHours != null && !isNaN(parsed.laborHours) && parsed.laborHours > 0) {
        document.getElementById('laborHoursInput').value = String(parsed.laborHours);
    }
    if (typeof calcQuoteLiveMath === 'function') calcQuoteLiveMath();
}

function addPartRow() {
    const container = document.getElementById('partsContainer');
    const row = document.createElement('div');
    row.className = 'parts-grid-layout part-row part-entry-line';
    row.innerHTML = `
        <input type="number" placeholder="QTY" class="p-qty" value="1" min="1" oninput="calcQuoteLiveMath()">
        <input type="text" placeholder="e.g. FILTER, MOTOR" class="p-desc">
        <input type="text" placeholder="Optional" class="p-num">
        <input type="text" placeholder="Vendor" class="p-vendor text-uppercase">
        <input type="text" class="p-lead" value="N/A" placeholder="e.g. 3">
        <div class="cost-wrapper"><span>$</span><input type="number" placeholder="0.00" class="p-cost" step="0.01" min="0" oninput="calcQuoteLiveMath()"></div>
        <div class="cost-wrapper" style="color:#27ae60;"><span>$</span><input type="text" class="p-retail" value="0.00" readonly style="background:transparent; border:none; font-weight:bold; width:100%; outline:none;"></div>
        <div style="text-align: right;"><button class="remove-part-btn" onclick="this.parentElement.parentElement.remove(); triggerQuoteAutoSave();">X</button></div>
    `;
    container.appendChild(row);
}

function calcQuoteLiveMath() {
    document.querySelectorAll('.part-entry-line').forEach(row => {
        const qty = parseInt(row.querySelector('.p-qty').value) || 1;
        const cost = parseFloat(row.querySelector('.p-cost').value) || 0;
        
        let retailUnit = 0;
        if(cost > 0) {
            const markupPercentage = getMarkupPercentage(cost); 
            retailUnit = cost + (cost * markupPercentage);
        }
        
        const lineRetailTotal = retailUnit * qty;
        row.querySelector('.p-retail').value = lineRetailTotal.toFixed(2);
    });
    triggerQuoteAutoSave();
}

function getMarkupPercentage(cost) {
    if (cost <= 5) return 4.00; if (cost <= 10) return 3.00; if (cost <= 15) return 2.00;      
    if (cost <= 100) return 1.50; if (cost <= 500) return 1.00; if (cost <= 1000) return 0.85;   
    if (cost <= 1500) return 0.75; return 0.65;                      
}

function updatePreviewHTML() {
    const data = gatherFormData();
    let requoteHTML = data.requoteNote !== "" ? `<div style="color:#e74c3c; margin-bottom:10px;"><strong>Requote Notes:</strong><br><pre style="margin:5px 0; font-family:inherit; white-space:pre-wrap;">${data.requoteNote}</pre></div>` : "";

    let fullAddressString = data.locationAddress;
    let cityStateZip = [];
    if(data.custCity) cityStateZip.push(data.custCity);
    let stateZip = [];
    if(data.custState) stateZip.push(data.custState);
    if(data.custZip) stateZip.push(data.custZip);
    if(stateZip.length > 0) cityStateZip.push(stateZip.join(" "));
    let finalCityStateStr = cityStateZip.join(", ");
    let contactHTML = data.contactName ? `<br><strong>Site Contact:</strong> ${data.contactName}` : "";

    let internalHTML = `
        <p><strong>Status:</strong> ${data.status} | <strong>Quote #:</strong> ${data.quoteNum}</p>
        <p><strong>Job Workflow:</strong> ${data.jobWorkflow}</p>
        ${requoteHTML}
        <p><strong>Location:</strong> ${fullAddressString} ${finalCityStateStr} ${contactHTML}</p>
        <p><strong>Repair Labor:</strong> ${data.laborHours} hrs @ $${data.laborRate.toFixed(2)}/hr = <strong>$${data.totalLaborAmount.toFixed(2)}</strong></p>
        <p><strong>Truck Charge:</strong> <strong>$${data.truckCharge.toFixed(2)}</strong></p>
        <h4>Parts Detailed List:</h4>
        <table class="internal-table">
            <thead><tr><th>QTY</th><th>Description (Num)</th><th>Vendor</th><th>Lead Time (Days)</th><th>Our Cost</th><th>Markup %</th><th>Unit Retail</th><th>Total Retail</th></tr></thead>
            <tbody>
    `;
    data.parts.forEach(p => { internalHTML += `<tr><td>${p.qty}</td><td>${p.desc} (${p.num})</td><td>${p.vendor || 'N/A'}</td><td>${p.lead}</td><td>$${p.cost.toFixed(2)}</td><td>${p.markupPercent}%</td><td>$${p.retailUnit.toFixed(2)}</td><td>$${p.retailTotal.toFixed(2)}</td></tr>`; });
    internalHTML += `</tbody></table><br><p>Subtotal Retail: <strong>$${data.subtotal.toFixed(2)}</strong></p><p>Tax (5.5%): <strong>$${data.tax.toFixed(2)}</strong></p><p>Grand Total: <span class="grand-total-internal">$${data.grandTotal.toFixed(2)}</span></p>`;
    document.getElementById('internalQuoteContent').innerHTML = internalHTML;

    document.getElementById('printCustName').innerText = data.customerName;
    if (data.contactName) {
        document.getElementById('printContactName').innerText = "ATTN: " + data.contactName;
        document.getElementById('printContactName').style.display = "inline-block";
        document.getElementById('printContactNameBr').style.display = "inline";
    } else {
        document.getElementById('printContactName').style.display = "none";
        document.getElementById('printContactNameBr').style.display = "none";
    }
    document.getElementById('printCustStreet').innerText = data.locationAddress;
    document.getElementById('printCustCityStateZip').innerText = finalCityStateStr;
    document.getElementById('printCustNum').innerText = data.customerNum;
    document.getElementById('printLocNum').innerText = data.locationNum;
    document.getElementById('quoteNumberPrint').innerText = data.quoteNum;
    document.getElementById('printQuoteStatus').innerText = data.status.toUpperCase();
    if (data.quoteDate) document.getElementById('quoteDatePrint').innerText = data.quoteDate.split('-').reverse().join('-');

    const tableBody = document.getElementById('printTableBody');
    tableBody.innerHTML = "";
    data.parts.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${p.qty}</td><td>${p.desc}</td><td>${p.lead}</td><td>$${p.retailUnit.toFixed(2)}</td><td>$${p.retailTotal.toFixed(2)}</td>`;
        tableBody.appendChild(row);
    });
    if (data.totalLaborAmount > 0) {
        const laborRow = document.createElement('tr');
        laborRow.innerHTML = `<td>${data.laborHours}</td><td>REPAIR LABOR</td><td>N/A</td><td></td><td>$${data.totalLaborAmount.toFixed(2)}</td>`;
        tableBody.appendChild(laborRow);
    }
    if (data.truckCharge > 0) {
        const truckRow = document.createElement('tr');
        truckRow.innerHTML = `<td>1</td><td>TRUCK / DISPATCH CHARGE</td><td>N/A</td><td></td><td>$${data.truckCharge.toFixed(2)}</td>`;
        tableBody.appendChild(truckRow);
    }

    document.getElementById('printSubtotal').innerText = `$${data.subtotal.toFixed(2)}`;
    document.getElementById('printTax').innerText = `$${data.tax.toFixed(2)}`;
    document.getElementById('printGrandTotal').innerText = `$${data.grandTotal.toFixed(2)}`;
}

function createQuote() {
    const savedSuccessfully = saveQuoteToDatabase(false, false);
    if (!savedSuccessfully) return; 
    updatePreviewHTML(); 
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('internalView').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveQuoteToDatabase(silent, isAutoSave) {
    if (silent === undefined) silent = false;
    if (isAutoSave === undefined) isAutoSave = false;
    if (!isAutoSave) { var pendingNote = document.getElementById('newRequoteNote').value.trim(); if (pendingNote !== "") addRequoteNote(); }
    var data = gatherFormData();

    if (isAutoSave && data.id === "") return false;
    if (data.status === 'Requote Requested' && data.requoteNote.trim() === '') {
        if(!silent) alert("A note explaining why the requote was requested is required. Please type a note and click 'Add Note'.");
        if(!isAutoSave) document.getElementById('newRequoteNote').focus(); return false;
    }

    if (!isAutoSave || data.id !== "") syncCustomerToDirectory(data);

    data.updatedAt = new Date().toISOString();
    var currentId = data.id;
    var isNewQuote = !currentId || currentId.indexOf("DB-ID-") === 0;

    if (isNewQuote) {
        data.createdAt = new Date().toISOString();
    }

    try {
        var db = firebase.firestore();
        var ref = window.VCFirestore ? window.VCFirestore.officeQuotes(db) : db.collection("office_quotes");

        if (isNewQuote) {
            var localData = Object.assign({}, data);
            delete localData.id;
            ref.add(localData).then(function(docRef) {
                data.id = docRef.id;
                document.getElementById('currentQuoteId').value = docRef.id;
                incrementQuoteNumber();
                _saveQuoteToLocalStorage(data, true);
                renderQuoteHistory();
                if (!silent && !isAutoSave) showSaveCue("\u2713 New Quote Created! (" + data.quoteNum + ")");
                if (isAutoSave) showSaveCue("\u2713 Auto-Saved");
            }).catch(function(err) {
                console.warn("[Quoting] Firestore write failed, localStorage fallback:", err);
                data.id = 'DB-ID-' + Date.now();
                document.getElementById('currentQuoteId').value = data.id;
                incrementQuoteNumber();
                _saveQuoteToLocalStorage(data, true);
                renderQuoteHistory();
                if (!silent && !isAutoSave) showSaveCue("\u2713 New Quote Created (offline)");
                if (isAutoSave) showSaveCue("\u2713 Auto-Saved (offline)");
            });
        } else {
            var updateData = Object.assign({}, data);
            delete updateData.id;
            ref.doc(currentId).set(updateData, { merge: true }).then(function() {
                _saveQuoteToLocalStorage(data, false);
                renderQuoteHistory();
                if (!silent && !isAutoSave) showSaveCue("\u2713 Quote Updated!");
                if (isAutoSave) showSaveCue("\u2713 Auto-Saved");
            }).catch(function(err) {
                console.warn("[Quoting] Firestore update failed, localStorage fallback:", err);
                _saveQuoteToLocalStorage(data, false);
                renderQuoteHistory();
                if (!silent && !isAutoSave) showSaveCue("\u2713 Quote Updated (offline)");
                if (isAutoSave) showSaveCue("\u2713 Auto-Saved (offline)");
            });
        }
    } catch (e) {
        console.warn("[Quoting] Firestore unavailable, localStorage only:", e);
        if (isNewQuote) {
            data.id = 'DB-ID-' + Date.now();
            document.getElementById('currentQuoteId').value = data.id;
            incrementQuoteNumber();
        }
        _saveQuoteToLocalStorage(data, isNewQuote);
        renderQuoteHistory();
        if (!silent && !isAutoSave) showSaveCue(isNewQuote ? "\u2713 New Quote Created (offline)" : "\u2713 Quote Updated (offline)");
        if (isAutoSave) showSaveCue("\u2713 Auto-Saved (offline)");
    }
    return true;
}

function _saveQuoteToLocalStorage(data, isNew) {
    try {
        var lsDb = JSON.parse(localStorage.getItem('twinPillarsQuotesDB') || '[]');
        if (isNew) {
            lsDb.push(data);
        } else {
            var idx = -1;
            for (var i = 0; i < lsDb.length; i++) {
                if (lsDb[i].id === data.id) { idx = i; break; }
            }
            if (idx !== -1) { lsDb[idx] = data; }
            else { lsDb.push(data); }
        }
        localStorage.setItem('twinPillarsQuotesDB', JSON.stringify(lsDb));
    } catch (e) {
        console.warn("[Quoting] localStorage backup write failed:", e);
    }
}

function renderQuoteHistory() {
    var tableBody = document.getElementById('dbTableBody');
    tableBody.innerHTML = "";

    try {
        var db = firebase.firestore();
        var ref = window.VCFirestore ? window.VCFirestore.officeQuotes(db) : db.collection("office_quotes");
        ref.orderBy("createdAt", "desc").limit(100).get().then(function(snapshot) {
            tableBody.innerHTML = "";
            snapshot.forEach(function(doc) {
                var quote = doc.data();
                quote.id = doc.id;
                _renderQuoteRow(tableBody, quote);
            });
        }).catch(function(err) {
            console.warn("[Quoting] Firestore read failed, falling back to localStorage:", err);
            _renderQuoteHistoryFromLocalStorage(tableBody);
        });
    } catch (e) {
        console.warn("[Quoting] Firestore unavailable for history, using localStorage:", e);
        _renderQuoteHistoryFromLocalStorage(tableBody);
    }
}

function _renderQuoteHistoryFromLocalStorage(tableBody) {
    var lsDb = JSON.parse(localStorage.getItem('twinPillarsQuotesDB') || '[]');
    var reversed = lsDb.slice().reverse();
    for (var i = 0; i < reversed.length; i++) {
        _renderQuoteRow(tableBody, reversed[i]);
    }
}

function _renderQuoteRow(tableBody, quote) {
    var workflowText = (quote.jobWorkflow && quote.jobWorkflow !== 'N/A') ? quote.jobWorkflow : '';
    if (quote.jobWorkflow === 'Needs to be Scheduled') workflowText = '<span style="color:#e74c3c; font-weight:bold; animation: pulse 2s infinite;">Needs to be Scheduled</span>';
    else if (workflowText) workflowText = '<span style="color:#555; font-weight:bold;">' + workflowText + '</span>';

    var statusColor = '#333';
    if(quote.status === 'Pending') statusColor = '#f39c12';
    if(quote.status === 'Approved') statusColor = '#27ae60';
    if(quote.status === 'Rejected') statusColor = '#7f8c8d';
    if(quote.status === 'Requote Requested') statusColor = '#8e44ad';

    var statusText = '<strong style="color:' + statusColor + '; font-size:13px;">' + quote.status + '</strong>';
    var tableLoc = quote.locationAddress || '';
    var subLocStr = "";
    if(quote.custCity) subLocStr += quote.custCity + ", ";
    if(quote.custState) subLocStr += quote.custState + " ";
    if(quote.custZip) subLocStr += quote.custZip;
    if(subLocStr.trim() !== "") tableLoc += '<br><span style="font-size:11px; color:#777;">' + subLocStr + '</span>';

    var gt = (typeof quote.grandTotal === 'number') ? quote.grandTotal.toFixed(2) : '0.00';

    tableBody.innerHTML += '<tr>' +
        '<td><button class="preview-btn" onclick="previewQuote(\'' + quote.id + '\')">Preview</button></td>' +
        '<td>' + (quote.quoteDate || '') + '</td>' +
        '<td><strong>' + (quote.quoteNum || '') + '</strong></td>' +
        '<td>' + (quote.customerName || '') + '</td>' +
        '<td>' + tableLoc + '</td>' +
        '<td>$' + gt + '</td>' +
        '<td>' + workflowText + '</td>' +
        '<td style="text-align: center;">' + statusText + '</td>' +
        '<td>' +
            '<button class="edit-btn" onclick="loadQuoteForEditing(\'' + quote.id + '\')">Edit</button>' +
            ' <button class="delete-btn" onclick="deleteQuote(\'' + quote.id + '\')">X</button>' +
        '</td>' +
    '</tr>';
}

function previewQuote(dbId) {
    try {
        var fsDb = firebase.firestore();
        var ref = window.VCFirestore ? window.VCFirestore.officeQuotes(fsDb) : fsDb.collection("office_quotes");
        ref.doc(dbId).get().then(function(doc) {
            if (doc.exists) {
                var quote = doc.data();
                quote.id = doc.id;
                _populateQuoteForm(quote);
            } else {
                _loadQuoteFromLocalStorage(dbId);
            }
            _showPreviewAfterLoad();
        }).catch(function() {
            _loadQuoteFromLocalStorage(dbId);
            _showPreviewAfterLoad();
        });
    } catch (e) {
        _loadQuoteFromLocalStorage(dbId);
        _showPreviewAfterLoad();
    }
}

function _showPreviewAfterLoad() {
    updatePreviewHTML();
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('internalView').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteQuote(dbId) {
    if(confirm("Are you sure you want to completely delete this quote?")) {
        try {
            var lsDb = JSON.parse(localStorage.getItem('twinPillarsQuotesDB') || '[]');
            var filtered = [];
            for (var i = 0; i < lsDb.length; i++) {
                if (lsDb[i].id !== dbId) filtered.push(lsDb[i]);
            }
            localStorage.setItem('twinPillarsQuotesDB', JSON.stringify(filtered));
        } catch (e) {
            console.warn("[Quoting] localStorage delete cleanup failed:", e);
        }

        try {
            var db = firebase.firestore();
            var ref = window.VCFirestore ? window.VCFirestore.officeQuotes(db) : db.collection("office_quotes");
            ref.doc(dbId).delete().then(function() {
                renderQuoteHistory();
            }).catch(function(err) {
                console.warn("[Quoting] Firestore delete failed:", err);
                renderQuoteHistory();
            });
        } catch (e) {
            console.warn("[Quoting] Firestore unavailable for delete:", e);
            renderQuoteHistory();
        }
    }
}

function printQuote() {
    document.getElementById('customerQuoteView').classList.add('screen-preview');
    document.getElementById('printInvoiceView').classList.remove('screen-preview');
    window.print();
}
