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
    document.getElementById('locNumInput').value = "";
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

function addPartRow() {
    const container = document.getElementById('partsContainer');
    const row = document.createElement('div');
    row.className = 'parts-grid-layout part-row part-entry-line';
    row.innerHTML = `
        <input type="number" placeholder="QTY" class="p-qty" value="1" min="1" oninput="calcQuoteLiveMath()">
        <input type="text" placeholder="e.g. FILTER, MOTOR" class="p-desc">
        <input type="text" placeholder="Optional" class="p-num">
        <input type="text" placeholder="Vendor" class="p-vendor text-uppercase">
        <input type="text" placeholder="e.g. 3" class="p-lead">
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
            partsData.push({ qty, desc, num: row.querySelector('.p-num').value.trim().toUpperCase(), vendor, lead: row.querySelector('.p-lead').value.trim().toUpperCase() || "IN STOCK", cost, markupPercent: (markupMultiplier * 100).toFixed(0), retailUnit: retailPricePerUnit, retailTotal: totalRetailAmount });
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
        locationNum: document.getElementById('locNumInput').value.trim().toUpperCase() || "N/A",
        quoteNum: document.getElementById('quoteNumberInput').value || "N/A",
        status: document.getElementById('quoteStatusInput').value,
        jobWorkflow: document.getElementById('jobWorkflowInput').value,
        requoteNote: document.getElementById('requoteNoteHistory').value, 
        quoteDate: document.getElementById('quoteDateInput').value,
        dueDate: document.getElementById('dueDateInput').value,
        laborHours, laborRate, truckCharge, totalLaborAmount, parts: partsData, subtotal, tax, grandTotal
    };
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

function saveQuoteToDatabase(silent = false, isAutoSave = false) {
    if (!isAutoSave) { const pendingNote = document.getElementById('newRequoteNote').value.trim(); if (pendingNote !== "") addRequoteNote(); }
    const data = gatherFormData();

    if (isAutoSave && data.id === "") return false;
    if (data.status === 'Requote Requested' && data.requoteNote.trim() === '') {
        if(!silent) alert("A note explaining why the requote was requested is required. Please type a note and click 'Add Note'.");
        if(!isAutoSave) document.getElementById('newRequoteNote').focus(); return false; 
    }

    if (!isAutoSave || data.id !== "") syncCustomerToDirectory(data);

    let db = JSON.parse(localStorage.getItem('twinPillarsQuotesDB') || '[]');
    if (data.id) {
        const index = db.findIndex(q => q.id === data.id);
        if (index !== -1) { db[index] = data; if(!silent) showSaveCue("✓ Quote Updated!"); }
    } else {
        data.id = 'DB-ID-' + Date.now(); db.push(data);
        document.getElementById('currentQuoteId').value = data.id; incrementQuoteNumber(); 
        if(!silent) showSaveCue(`✓ New Quote Created! (${data.quoteNum})`); 
    }
    localStorage.setItem('twinPillarsQuotesDB', JSON.stringify(db));
    renderQuoteHistory();
    if (isAutoSave) showSaveCue("✓ Auto-Saved"); 
    return true; 
}

function renderQuoteHistory() {
    let db = JSON.parse(localStorage.getItem('twinPillarsQuotesDB') || '[]');
    const tableBody = document.getElementById('dbTableBody');
    tableBody.innerHTML = "";

    [...db].reverse().forEach(quote => {
        let workflowText = (quote.jobWorkflow && quote.jobWorkflow !== 'N/A') ? quote.jobWorkflow : '';
        if (quote.jobWorkflow === 'Needs to be Scheduled') workflowText = `<span style="color:#e74c3c; font-weight:bold; animation: pulse 2s infinite;">Needs to be Scheduled</span>`;
        else if (workflowText) workflowText = `<span style="color:#555; font-weight:bold;">${workflowText}</span>`;

        let statusColor = '#333';
        if(quote.status === 'Pending') statusColor = '#f39c12'; if(quote.status === 'Approved') statusColor = '#27ae60';
        if(quote.status === 'Rejected') statusColor = '#7f8c8d'; if(quote.status === 'Requote Requested') statusColor = '#8e44ad';

        let statusText = `<strong style="color:${statusColor}; font-size:13px;">${quote.status}</strong>`;
        let tableLoc = quote.locationAddress;
        let subLocStr = "";
        if(quote.custCity) subLocStr += quote.custCity + ", ";
        if(quote.custState) subLocStr += quote.custState + " ";
        if(quote.custZip) subLocStr += quote.custZip;
        if(subLocStr.trim() !== "") tableLoc += `<br><span style="font-size:11px; color:#777;">${subLocStr}</span>`;

        tableBody.innerHTML += `
            <tr>
                <td><button class="preview-btn" onclick="previewQuote('${quote.id}')">Preview</button></td>
                <td>${quote.quoteDate}</td>
                <td><strong>${quote.quoteNum}</strong></td>
                <td>${quote.customerName}</td>
                <td>${tableLoc}</td>
                <td>$${quote.grandTotal.toFixed(2)}</td>
                <td>${workflowText}</td>
                <td style="text-align: center;">${statusText}</td>
                <td>
                    <button class="edit-btn" onclick="loadQuoteForEditing('${quote.id}')">Edit</button>
                    <button class="delete-btn" onclick="deleteQuote('${quote.id}')">X</button>
                </td>
            </tr>
        `;
    });
}

function previewQuote(dbId) {
    loadQuoteForEditing(dbId);
    updatePreviewHTML(); 
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('internalView').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function loadQuoteForEditing(dbId) {
    let db = JSON.parse(localStorage.getItem('twinPillarsQuotesDB') || '[]');
    const quote = db.find(q => q.id === dbId);
    if (!quote) return;

    document.getElementById('currentQuoteId').value = quote.id;
    document.getElementById('custNameInput').value = quote.customerName;
    document.getElementById('custNumInput').value = quote.customerNum;
    document.getElementById('contactNameInput').value = quote.contactName || "";
    document.getElementById('custStreetInput').value = quote.locationAddress;
    document.getElementById('custCityInput').value = quote.custCity || "";
    document.getElementById('custStateInput').value = quote.custState || "";
    document.getElementById('custZipInput').value = quote.custZip || "";
    document.getElementById('locNumInput').value = quote.locationNum;
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
    
    quote.parts.forEach(p => {
        const row = document.createElement('div'); row.className = 'parts-grid-layout part-row part-entry-line';
        const loadedLineRetail = p.retailTotal || 0;
        
        row.innerHTML = `<input type="number" class="p-qty" value="${p.qty}" min="1" oninput="calcQuoteLiveMath()"><input type="text" class="p-desc" value="${p.desc}"><input type="text" class="p-num" value="${p.num}"><input type="text" class="p-vendor text-uppercase" value="${p.vendor || ''}"><input type="text" class="p-lead" value="${p.lead}"><div class="cost-wrapper"><span>$</span><input type="number" class="p-cost" step="0.01" value="${p.cost}" oninput="calcQuoteLiveMath()"></div><div class="cost-wrapper" style="color:#27ae60;"><span>$</span><input type="text" class="p-retail" value="${loadedLineRetail.toFixed(2)}" readonly style="background:transparent; border:none; font-weight:bold; width:100%; outline:none;"></div><div style="text-align: right;"><button class="remove-part-btn" onclick="this.parentElement.parentElement.remove(); triggerQuoteAutoSave();">X</button></div>`;
        document.getElementById('partsContainer').appendChild(row);
    });

    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('mainFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteQuote(dbId) {
    if(confirm("Are you sure you want to completely delete this quote?")) {
        let db = JSON.parse(localStorage.getItem('twinPillarsQuotesDB') || '[]');
        db = db.filter(q => q.id !== dbId);
        localStorage.setItem('twinPillarsQuotesDB', JSON.stringify(db));
        renderQuoteHistory();
    }
}

function printQuote() {
    document.getElementById('customerQuoteView').classList.add('screen-preview');
    document.getElementById('printInvoiceView').classList.remove('screen-preview');
    window.print();
}
