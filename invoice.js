// ====================================================================
// --- INVOICE CLOUD LOGIC & GOOGLE MAPS PARSING ---
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

function addInvoicePartRow(desc = "") {
    const container = document.getElementById('invPartsContainer');
    const row = document.createElement('div');
    row.className = 'inv-parts-grid-layout part-row inv-part-line';
    row.innerHTML = `
        <input type="number" class="p-qty" value="1" min="1" oninput="calcInvoice()">
        <input type="text" class="p-desc" value="${desc}" placeholder="Part Description">
        <div class="cost-wrapper"><span>$</span><input type="number" class="p-cost" placeholder="0.00" step="0.01" min="0" oninput="calcInvoice()"></div>
        <div class="cost-wrapper" style="color:#27ae60;"><span>$</span><input type="text" class="p-retail" value="0.00" readonly style="background:transparent; border:none; font-weight:bold; width:100%; outline:none;"></div>
        <div style="text-align: right;"><button type="button" class="remove-part-btn" onclick="this.parentElement.parentElement.remove(); calcInvoice();">X</button></div>
    `;
    container.appendChild(row);
}

function performGoogleSearch(query) {
    return new Promise((resolve, reject) => {
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            console.log("Google Maps API not loaded yet.");
            resolve(null);
            return;
        }
        const dummyDiv = document.createElement('div');
        const service = new google.maps.places.PlacesService(dummyDiv);
        service.textSearch({ query: query }, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                resolve(results[0].formatted_address);
            } else {
                resolve(null);
            }
        });
    });
}

// --- UPGRADED SMART CRM LOOKUP ENGINE ---
async function smartProcessLocation(locationStr) {
    // Force normal hyphens to fix iOS/Android em-dash formatting
    let rawInput = locationStr.trim().toUpperCase().replace(/[–—]/g, '-');
    let custName = rawInput;
    let city = "";
    let streetSearch = "";
    let state = "WI"; 
    let originalSiteName = rawInput;

    const dbaAliases = {
        "TAKE 5": {
            company: "AMERICAN PLATINUM DOOR & GATE",
            billToAddress: "AMERICAN PLATINUM DOOR & GATE\n29001 SOLON RD UNIT Q\nSOLON, OH 44139"
        },
        "TAKE FIVE": { // Captures the spelled out version!
            company: "AMERICAN PLATINUM DOOR & GATE",
            billToAddress: "AMERICAN PLATINUM DOOR & GATE\n29001 SOLON RD UNIT Q\nSOLON, OH 44139"
        }
    };

    let matchedAlias = Object.keys(dbaAliases).find(key => rawInput.includes(key));
    let customBillTo = null;

    if (matchedAlias) {
        // Step 1: Swap Customer Name to the Management Company
        originalSiteName = matchedAlias;
        custName = dbaAliases[matchedAlias].company;
        customBillTo = dbaAliases[matchedAlias].billToAddress;
        
        // Step 2: Strip the DBA name out of the string so the parser doesn't get confused
        let restOfStr = rawInput.replace(new RegExp(matchedAlias, "i"), "").replace(/^-+|-+$/g, '').trim();

        // Step 3: Handle hyphens vs non-hyphens
        if (restOfStr.includes("-")) {
             let parts = restOfStr.split(/\s*-\s*/);
             if (parts.length >= 2) {
                 city = parts[0].trim();
                 streetSearch = parts[1].trim();
             } else {
                 streetSearch = restOfStr;
             }
             streetSearch = `${matchedAlias} - ${streetSearch}`;
        } else {
             // Fallback for no hyphens (e.g. "NEW LONDON 1821 N SHAWANO ST")
             let addressMatch = restOfStr.match(/\b\d+\b/);
             if (addressMatch) {
                 let addrIndex = addressMatch.index;
                 city = restOfStr.substring(0, addrIndex).trim();
                 let foundStreet = restOfStr.substring(addrIndex).trim();
                 streetSearch = `${matchedAlias} - ${foundStreet}`;
             } else {
                 streetSearch = `${matchedAlias} - ${restOfStr}`;
             }
        }
    } else {
        // Normal parsing for non-aliased names
        if (rawInput.includes("-")) {
            const parts = rawInput.split(/\s*-\s*/);
            custName = parts[0].trim();
            originalSiteName = custName;
            if (parts.length >= 3) {
                city = parts[1].trim();
                streetSearch = parts[2].trim();
            } else if (parts.length === 2) {
                streetSearch = parts[1].trim();
            }
        } else {
            let addressMatch = rawInput.match(/\b\d+\s+[A-Z]+/i);
            if (addressMatch) {
                originalSiteName = rawInput.substring(0, addressMatch.index).trim();
                custName = originalSiteName;
                streetSearch = rawInput.substring(addressMatch.index).trim();
            }
        }
    }

    const custNameInput = document.getElementById('invCustNameInput');
    const streetInput = document.getElementById('invStreetInput');
    
    custNameInput.value = custName;
    document.getElementById('invCityInput').value = city;
    document.getElementById('invStreetInput').value = streetSearch;
    document.getElementById('invStateInput').value = state;

    custNameInput.style.backgroundColor = "";
    streetInput.style.backgroundColor = "";
    if(document.getElementById('invCustWarning')) document.getElementById('invCustWarning').remove();
    if(document.getElementById('invLocWarning')) document.getElementById('invLocWarning').remove();

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

    if (!foundLocally && (city || streetSearch)) {
        try {
            document.getElementById("invServiceLoc").value = "Asking Google Maps...";
            let cleanGoogleStreet = streetSearch;
            if (matchedAlias) {
                 cleanGoogleStreet = streetSearch.replace(`${matchedAlias} - `, '');
            }
            
            let query = `${cleanGoogleStreet} ${city} ${state}`.trim();
            let googleAddress = await performGoogleSearch(query);

            if (!googleAddress && matchedAlias) {
                query = `${matchedAlias} ${cleanGoogleStreet} ${city} ${state}`.trim();
                googleAddress = await performGoogleSearch(query);
            }

            if (googleAddress) {
                let addrParts = googleAddress.split(',').map(p => p.trim());
                if (addrParts[addrParts.length - 1] === "USA") addrParts.pop();
                
                if (addrParts.length >= 3) {
                    const stateZip = addrParts[addrParts.length - 1].split(' ');
                    const parsedCity = addrParts[addrParts.length - 2];
                    const parsedStreet = addrParts.slice(0, addrParts.length - 2).join(', ');
                    
                    let finalStreetDisplay = parsedStreet.toUpperCase();
                    if (matchedAlias) {
                        finalStreetDisplay = `${matchedAlias} - ${finalStreetDisplay}`;
                    }

                    document.getElementById('invStreetInput').value = finalStreetDisplay;
                    document.getElementById('invCityInput').value = parsedCity.toUpperCase();
                    if(stateZip.length >= 1) document.getElementById('invStateInput').value = stateZip[0].toUpperCase();
                    if(stateZip.length >= 2) document.getElementById('invZipInput').value = stateZip[1];
                }
            }
        } catch (err) {
            console.log("Google Maps search failed:", err);
        }
    }

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

async function parsePastedNotes() {
    const text = document.getElementById("invPasteArea").value;
    if (!text) return;

    // Smart lookahead prevents the extractor from needing double line-breaks
    const nextHeader = "(?:\\n\\s*(?:Location|Date|Equipment|Notes|Work|Parts|Cost|Pictures)[a-zA-Z0-9 \\/\\(\\)]*?:|$)";
    
    const extract = (pattern) => {
        const regex = new RegExp(`${pattern}:?\\s*(.*?)(?=${nextHeader})`, 'is');
        const m = text.match(regex);
        return m && m[1] ? m[1].trim() : "";
    };

    const locRaw = extract("Location");
    if (locRaw) await smartProcessLocation(locRaw);

    const equip = extract("Equipment on [Ss]ite") || extract("Equipment worked on");
    if (equip) document.getElementById("invEquip").value = equip.replace(/\n/g, ", ");

    const notes = extract("Notes\\s*[/\\\\]\\s*repairs") || extract("Findings\\s*[/\\\\]\\s*Diagnosis");
    if (notes) document.getElementById("invNotes").value = notes;

    const work = extract("Work done") || extract("Repairs made");
    if (work) document.getElementById("invWork").value = work;

    // Always pre-fill PM Parts Row for default ease of use
    document.getElementById('invPartsContainer').innerHTML = `<div class="inv-parts-grid-layout part-header-row"><label>QTY</label><label>Part Description</label><label>Our Cost $</label><label style="color:#27ae60;">Retail $ (Auto)</label><label></label></div>`;
    addInvoicePartRow("Preventative Maintenance parts"); 
    
    calcInvoice();
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
        row.querySelector('.p-retail').value = retailUnit.toFixed(2);
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
    try {
        firestoreDb = firebase.firestore();
    } catch(e) {
        document.getElementById("invNum").value = "INV-10001 (Local)";
        return;
    }

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
        const retailUnit = parseFloat(row.querySelector('.p-retail').value) || 0;
        const lineTotal = retailUnit * qty;
        
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
        const retailUnit = parseFloat(row.querySelector('.p-retail').value) || 0;
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
    try {
        firestoreDb = firebase.firestore();
    } catch(e) {
        return;
    }
    
    firestoreDb.collection('invoices').orderBy('timestamp', 'desc').limit(50).get().then(snapshot => {
        cloudInvoices = [];
        snapshot.forEach(doc => {
            cloudInvoices.push({ id: doc.id, ...doc.data() });
        });
        renderInvoiceTable();
    }).catch(e => {
        console.log("Could not load invoices: ", e);
    });
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
