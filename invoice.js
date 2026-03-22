// ====================================================================
// --- INVOICE CLOUD LOGIC & GENERATION ---
// ====================================================================

let cloudInvoices = []; // Memory array for instant searching

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
    document.getElementById('invWork').value = "";
    document.getElementById('invLaborHours').value = "1.0";
    
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

// --- SMART PASTED NOTES PARSER (OMNIVOROUS) ---
async function parsePastedNotes() {
    const text = document.getElementById("invPasteArea").value;
    if (!text) return;

    // Look ahead for ANY possible header from a PM, Service Call, or Quote ticket
    const nextHeader = "(?:\\n\\s*(?:Location|Date|Equipment|Notes|Work|Parts|Cost|Pictures|Reason|Findings|Repairs|Original|System|Further|Labor)[a-zA-Z0-9 \\/&]*?:|$)";
    
    const extract = (pattern) => {
        const regex = new RegExp(`${pattern}:?\\s*(.*?)(?=${nextHeader})`, 'is');
        const m = text.match(regex);
        return m && m[1] ? m[1].trim() : "";
    };

    // 1. Extract and Process Location via Google Maps
    const locRaw = extract("Location");
    if (locRaw) await smartProcessLocation(locRaw);

    // 2. Extract Equipment
    const equip = extract("Equipment on [Ss]ite") || extract("Equipment worked on") || extract("Equipment Repaired");
    if (equip) document.getElementById("invEquip").value = equip.replace(/\n/g, ", ");

    // 3. Extract & Combine Notes (Handles all 3 ticket types)
    let combinedNotes = [];
    const pmNotes = extract("Notes\\s*[/\\\\]\\s*repairs");
    const svcReason = extract("Reason for call");
    const svcDiag = extract("Findings\\s*[/\\\\]\\s*Diagnosis");
    const quoteIssue = extract("Original Issue Resolved");

    if (quoteIssue) combinedNotes.push("Original Issue: " + quoteIssue);
    if (svcReason) combinedNotes.push("Reason for call: " + svcReason);
    if (svcDiag) combinedNotes.push("Diagnosis: " + svcDiag);
    if (pmNotes) combinedNotes.push(pmNotes);
    
    if (combinedNotes.length > 0) document.getElementById("invNotes").value = combinedNotes.join("\n\n");

    // 4. Extract & Combine Work Done (Handles all 3 ticket types)
    let combinedWork = [];
    const pmWork = extract("Work done");
    const svcRepairs = extract("Repairs made");
    const quoteRepairs = extract("Repairs Completed");
    const quoteTesting = extract("System Testing & Verification");

    if (quoteRepairs) combinedWork.push("Repairs: " + quoteRepairs);
    if (quoteTesting) combinedWork.push("System Testing: " + quoteTesting);
    if (svcRepairs) combinedWork.push(svcRepairs);
    if (pmWork) combinedWork.push(pmWork);

    if (combinedWork.length > 0) document.getElementById("invWork").value = combinedWork.join("\n\n");

    // 5. Extract Parts & Build Invoice Lines
    const partsRaw = extract("Parts used");
    
    const container = document.getElementById('invPartsContainer');
    container.innerHTML = `
        <div class="inv-parts-grid-layout part-header-row">
            <label>QTY</label><label>Part Description</label><label>Our Cost $</label><label style="color:#27ae60;">Retail $ (Auto)</label><label></label>
        </div>`;
        
    if (partsRaw && partsRaw.toUpperCase() !== "NONE" && partsRaw.toUpperCase() !== "UNKNOWN") {
        const partsList = partsRaw.split(/\n|,/).map(s => s.trim()).filter(Boolean);
        
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
    } else if (text.includes("PM\n\nLocation")) {
        // Fallback only if it is explicitly a PM ticket without parts
        addInvoicePartRow("Preventative Maintenance parts", 1);
    }
    
    calcInvoice();
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

    // 5. Finalize formatted addresses for PDF output
    const finalStreet = document.getElementById('invStreetInput').value;
    const finalCity = document.getElementById('invCityInput').value;
    const finalState = document.getElementById('invStateInput').value;
    const finalZip = document.getElementById('invZipInput').value;

    let formattedLoc = finalStreet;
    let csz = [];
    if(finalCity) csz.push(finalCity);
    let sz = [];
    if(finalState) sz.push(finalState);
    if(finalZip) sz.push(finalZip);
    if(sz.length > 0) csz.push(sz.join(" "));
    if(csz.length > 0) formattedLoc += "\n" + csz.join(", ");

    document.getElementById('invServiceLoc').value = formattedLoc;

    if (customBillTo) {
        document.getElementById('invBillTo').value = customBillTo;
    } else {
        document.getElementById('invBillTo').value = custName + "\n" + formattedLoc;
    }
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
    
    document.getElementById("pInvBillName").innerHTML = billToText.replace(/\n/g, "<br>");
    document.getElementById("pInvShipName").innerHTML = shipToText.replace(/\n/g, "<br>");

    document.getElementById("pInvEquip").innerText = document.getElementById("invEquip").value || "N/A";
    document.getElementById("pInvNotes").innerText = document.getElementById("invNotes").value || "N/A";
    document.getElementById("pInvWork").innerText = document.getElementById("invWork").value || "N/A";
    
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
    
    const nameInput = document.getElementById('invCustNameInput').value.trim().toUpperCase() || "UNKNOWN CUSTOMER";
    const streetInput = document.getElementById('invStreetInput').value.trim().toUpperCase();
    
    syncCustomerToDirectory({
        customerName: nameInput,
        customerNum: document.getElementById('invCustNumInput').value,
        locationAddress: streetInput,
        locationNum: document.getElementById('invLocNumInput').value,
        custCity: document.getElementById('invCityInput').value.trim().toUpperCase(),
        custState: document.getElementById('invStateInput').value.trim().toUpperCase(),
        custZip: document.getElementById('invZipInput').value.trim().toUpperCase()
    });

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
            work: document.getElementById('invWork').value,
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
    
    firestoreDb.collection('invoices').orderBy('timestamp', 'desc').limit(50).get().then(snapshot => {
        cloudInvoices = [];
        snapshot.forEach(doc => { cloudInvoices.push({ id: doc.id, ...doc.data() }); });
        renderInvoiceTable();
    }).catch(e => { console.log("Could not load invoices: ", e); });
}

function renderInvoiceTable(filterText = "") {
    const tbody = document.getElementById('invoiceDbTableBody');
    tbody.innerHTML = "";
    
    if (cloudInvoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#777;">No cloud invoices found.</td></tr>`;
        return;
    }

    const lowerFilter = filterText.toLowerCase();
    let hasResults = false;

    cloudInvoices.forEach(data => {
        const searchString = `${data.invoiceNumber} ${data.customerName} ${data.locationStreet} ${data.customerId} ${data.locationId}`.toLowerCase();
        
        if (searchString.includes(lowerFilter)) {
            hasResults = true;
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eaeaea;">
                    <td><button class="preview-btn" style="background:#3498db; cursor:pointer;" onclick="viewOldInvoice('${data.id}')">View</button></td>
                    <td>${data.date || ''}</td>
                    <td><strong>${data.invoiceNumber || ''}</strong></td>
                    <td>${data.customerName || ''}<br><span style="font-size:11px; color:#777;">${data.customerId || ''}</span></td>
                    <td>${data.locationStreet || ''}<br><span style="font-size:11px; color:#777;">${data.locationId || ''}</span></td>
                    <td><strong style="color:#27ae60;">${data.totalAmount || ''}</strong></td>
                </tr>
            `;
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

function viewOldInvoice(docId) {
    const data = cloudInvoices.find(inv => inv.id === docId);
    if(!data) return;

    document.getElementById("pInvNum").innerText = data.invoiceNumber || "";
    
    let dateStr = data.date || "";
    if (dateStr.includes('-')) {
        let parts = dateStr.split('-');
        dateStr = `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0]}`; 
    }
    document.getElementById("pInvDate").innerText = dateStr;
    
    document.getElementById("pInvBillName").innerHTML = (data.billTo || data.customerName || "Unknown").replace(/\n/g, "<br>");
    document.getElementById("pInvShipName").innerHTML = (data.serviceLoc || data.locationStreet || "Unknown").replace(/\n/g, "<br>");

    document.getElementById("pInvEquip").innerText = data.equip || "N/A";
    document.getElementById("pInvNotes").innerText = data.notes || "N/A";
    document.getElementById("pInvWork").innerText = data.work || "N/A";
    
    let tableHTML = "";
    if (data.work && (!data.parts || data.parts.length === 0)) {
       tableHTML += `<tr><td>Preventative Maintenance - ${data.work}</td><td></td></tr>`;
    }

    if (data.parts) {
        data.parts.forEach(p => {
            let lineTotal = p.retailUnit * p.qty;
            let descDisplay = p.qty > 1 ? `${p.qty}x ${p.desc}` : p.desc;
            tableHTML += `<tr><td>${descDisplay}</td><td>$${lineTotal.toFixed(2)}</td></tr>`;
        });
    }
    
    if(data.laborTotal > 0) tableHTML += `<tr><td>Labor charge</td><td>$${data.laborTotal.toFixed(2)}</td></tr>`;
    if(data.tripTotal > 0) tableHTML += `<tr><td>Trip charge</td><td>$${data.tripTotal.toFixed(2)}</td></tr>`;
    if(data.taxTotal > 0) tableHTML += `<tr><td>Sales Tax (5.5%)</td><td>$${data.taxTotal.toFixed(2)}</td></tr>`;
    
    document.getElementById("pInvTableBody").innerHTML = tableHTML;
    
    const grandStr = data.totalAmount || "$0.00";
    document.getElementById("pTotal1").innerText = grandStr;
    document.getElementById("pTotal2").innerText = grandStr;
    document.getElementById("pInvGrandTotal").innerText = grandStr;
    document.getElementById("pBottomTotal").innerText = grandStr;
    
    document.getElementById("pBottomCust").innerText = (data.customerId || "N/A") + " - " + (data.customerName || "Unknown");
    document.getElementById("pBottomInv").innerText = data.invoiceNumber || "";

    document.getElementById('invoiceResultsSection').style.display = 'block';
    document.getElementById('printInvoiceView').classList.add('screen-preview');
    document.getElementById('customerQuoteView').classList.remove('screen-preview');
    document.getElementById('printInvoiceView').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
