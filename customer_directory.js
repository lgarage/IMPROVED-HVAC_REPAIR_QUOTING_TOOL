// ====================================================================
// --- CUSTOMER DIRECTORY & CLOUD CRM LOGIC ---
// ====================================================================

// 1. Initial Cloud Sync (Pulls from Firebase when the app loads)
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadCustomersFromCloud, 1500); 
});

async function loadCustomersFromCloud() {
    try {
        let firestoreDb = firebase.firestore();
        const snapshot = await firestoreDb.collection('customers').get();
        let cloudDb = {};
        
        snapshot.forEach(doc => {
            let data = doc.data();
            if(data.name) {
                cloudDb[data.name] = { id: doc.id, locations: data.locations || {} };
            }
        });
        
        localStorage.setItem('tp_customers_db', JSON.stringify(cloudDb));
        updateCustomerDatalist();
        
        // If the directory modal is open, refresh it with the new cloud data
        const modal = document.getElementById('customerModal');
        if (modal && modal.style.display === 'block') {
            renderCustomerDirectory();
        }
    } catch (e) {
        console.warn("Cloud CRM load failed. Using local cache.", e);
    }
}

function getCustomerDB() { 
    return JSON.parse(localStorage.getItem('tp_customers_db') || '{}'); 
}

// 2. Master Sync Function (Updates local UI instantly, pushes to Firebase silently)
async function syncSingleCustomerToCloud(custName, custData) {
    let db = getCustomerDB();
    
    if (custData === null) {
        delete db[custName]; // Delete command
    } else {
        db[custName] = custData; // Update/Create command
    }
    
    localStorage.setItem('tp_customers_db', JSON.stringify(db));
    updateCustomerDatalist();

    try {
        let firestoreDb = firebase.firestore();
        if (custData === null) {
            // Delete from Cloud
            const snapshot = await firestoreDb.collection('customers').where('name', '==', custName).get();
            snapshot.forEach(doc => doc.ref.delete());
        } else {
            // Update/Create in Cloud
            await firestoreDb.collection('customers').doc(custData.id).set({
                name: custName,
                locations: custData.locations
            }, { merge: true });
        }
    } catch (e) {
        /* KI-002 Plan A7 — visible failure cue on cloud sync miss. The local UI already updated
           (datalist + tp_customers_db) so the user thinks the save stuck; without this they'll
           keep editing on a stale cloud copy and overwrite the next dispatcher's work. */
        if (typeof window.VCSurfaceWriteFailure === "function") {
            window.VCSurfaceWriteFailure("syncSingleCustomerToCloud:" + String(custName || "?"), e);
        } else {
            console.error("Failed to sync customer to cloud:", e);
        }
        if (typeof showSaveCue === "function") {
            try {
                showSaveCue(
                    "⚠ Customer saved locally only — cloud sync FAILED for " +
                    String(custName || "(unknown)") +
                    ". Check connection."
                );
            } catch (eC) {}
        }
    }
}

function repairAndSyncCustomerDB() {
    let db = getCustomerDB();
    let needsSave = false;

    for (let custName in db) {
        let cust = db[custName];
        let cleanLocs = {};
        if (cust.locations) {
            for (let key in cust.locations) {
                let val = cust.locations[key];
                if (key.startsWith("LOC-") && typeof val === 'object') {
                    if (val.state) {
                        let stateMatch = val.state.match(/^([a-zA-Z]{2})\s*(\d{5})$/);
                        if (stateMatch) { val.state = stateMatch[1]; if (!val.zip) val.zip = stateMatch[2]; needsSave = true; }
                    }
                    cleanLocs[key] = val;
                } 
                else if (typeof val === 'string' && val.startsWith("LOC-")) {
                    let parts = key.split('|');
                    let street = parts[0] || "UNKNOWN LOCATION";
                    if (street !== "UNKNOWN LOCATION" && street.length > 3) {
                        if (!cleanLocs[val] || street.length > (cleanLocs[val].street || "").length) {
                            cleanLocs[val] = { street: street, city: parts[1] || "", state: parts[2] || "", zip: parts[3] || "", contact: "", phone: "", email: "" };
                        }
                    }
                    needsSave = true;
                } else { needsSave = true; }
            }
        }
        cust.locations = cleanLocs;
        
        if (needsSave) {
            syncSingleCustomerToCloud(custName, cust);
            needsSave = false; 
        }
    }

    for (let custName in db) {
        if (custName.length < 3 || custName === "UNKNOWN CUSTOMER") {
            syncSingleCustomerToCloud(custName, null); 
        }
    }
}

function toggleNewCustomerForm() {
    const form = document.getElementById('newCustDirForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') {
        document.getElementById('dirNewName').focus();
        loadParentCompanyDropdown(); // Load the dropdown options
    }
}

// Loads existing Parent Companies into the physical dropdown
async function loadParentCompanyDropdown() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    try {
        const snapshot = await firebase.firestore().collection("ParentCompanies").orderBy("Name").get();
        const select = document.getElementById('dirParentSelect');
        
        select.innerHTML = '<option value="">-- No Parent / Select Existing --</option>';
        
        snapshot.forEach(doc => {
            const opt = document.createElement('option');
            opt.value = doc.data().Name; // Use the name as the value
            opt.textContent = doc.data().Name;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error loading parents:", e); }
}

// Background worker to link Firebase databases silently
async function handleFirebaseHierarchy(parentName, subCompany, city, street) {
    if (!parentName || !subCompany || !street || typeof firebase === 'undefined') return;
    
    try {
        const db = firebase.firestore();
        let parentId = null;
        
        // 1. Check if this parent company already exists
        const parentQuery = await db.collection("ParentCompanies").where("Name", "==", parentName).get();
        
        if (!parentQuery.empty) {
            parentId = parentQuery.docs[0].id; // Use existing
        } else {
            // 2. Doesn't exist, create it!
            parentId = 'PARENT_' + Date.now();
            await db.collection("ParentCompanies").doc(parentId).set({ Name: parentName });
        }

        // 3. Map this specific location to the parent
        const locId = 'MAP_' + Date.now() + Math.floor(Math.random()*1000);
        await db.collection("MappedLocations").doc(locId).set({
            Parent_ID: parentId,
            Sub_Company: subCompany,
            City: city,
            Street: street
        });
        
    } catch (e) {
        console.error("Error linking parent hierarchy:", e);
    }
}

async function saveCustomerFromDirectory() {
    const name = document.getElementById('dirNewName').value.trim().toUpperCase();
    const contact = document.getElementById('dirNewContact').value.trim().toUpperCase();
    const phone = document.getElementById('dirNewPhone').value.trim();
    const email = document.getElementById('dirNewEmail').value.trim();
    const street = document.getElementById('dirNewStreet').value.trim().toUpperCase();
    const city = document.getElementById('dirNewCity').value.trim().toUpperCase();
    const state = document.getElementById('dirNewState').value.trim().toUpperCase();
    const zip = document.getElementById('dirNewZip').value.trim();

    const selectedParentId = document.getElementById('dirParentSelect').value;
    const newParentName = document.getElementById('dirParentNew').value.trim().toUpperCase();

    if (!name || name.length < 3) { alert("Valid Customer Name is required."); return; }

    try {
        let finalParentId = null;

        // 1. Handle Parent Company logic first
        if (newParentName) {
            // Create new parent in the ParentCompanies collection
            const parentRef = await firebase.firestore().collection("ParentCompanies").add({ Name: newParentName });
            finalParentId = parentRef.id;
        } else if (selectedParentId) {
            finalParentId = selectedParentId;
        }

        // 2. Normal USA Heating and Cooling Local/Cloud Save Logic
        let db = getCustomerDB();
        let custId = `CST-${Math.floor(1000+Math.random()*9000)}`;
        if (!db[name]) db[name] = { id: custId, locations: {} };
        
        if (street && street.length > 3) {
            let locId = `LOC-${Math.floor(1000+Math.random()*9000)}`;
            db[name].locations[locId] = { street, city, state, zip, contact, phone, email, parentId: finalParentId };
            
            // If there's a parent, also write to the MappedLocations collection (based on your old logic)
            if (finalParentId) {
                const mapId = 'MAP_' + Date.now();
                await firebase.firestore().collection("MappedLocations").doc(mapId).set({
                    Parent_ID: finalParentId,
                    Sub_Company: name,
                    City: city,
                    Street: street
                });
            }
        }

        await syncSingleCustomerToCloud(name, db[name]);
        
        // Clear fields & close
        document.getElementById('dirParentSelect').value = '';
        document.getElementById('dirParentNew').value = '';
        document.getElementById('dirNewName').value = ''; document.getElementById('dirNewContact').value = '';
        document.getElementById('dirNewPhone').value = ''; document.getElementById('dirNewEmail').value = '';
        document.getElementById('dirNewStreet').value = ''; document.getElementById('dirNewCity').value = '';
        document.getElementById('dirNewState').value = ''; document.getElementById('dirNewZip').value = '';
        
        toggleNewCustomerForm();
        renderCustomerDirectory();

    } catch (error) {
        console.error("Error saving customer hierarchy:", error);
        alert("Failed to save customer.");
    }
}

function syncCustomerToDirectory(data) {
    if (!data.customerName || data.customerName === "UNKNOWN CUSTOMER" || data.customerName.length < 3) return;
    let db = getCustomerDB();
    
    if (!db[data.customerName]) {
        let custId = data.customerNum;
        if (!custId || custId === "N/A" || custId === "Auto-generated" || custId === "") {
            custId = `CST-${Math.floor(1000+Math.random()*9000)}`;
        }
        db[data.customerName] = { id: custId, locations: {} };
        
        let pfx = currentActiveView === 'service' ? 'sc' : (currentActiveView === 'invoice' ? 'inv' : '');
        let idField = pfx ? pfx + 'CustNumInput' : 'custNumInput';
        if (document.getElementById(idField)) document.getElementById(idField).value = custId;

    } else if (data.customerNum && data.customerNum !== "N/A" && data.customerNum !== "" && data.customerNum !== "Auto-generated") {
        db[data.customerName].id = data.customerNum;
    } 
    
    let street = data.locationAddress;
    if (street && street !== "UNKNOWN LOCATION" && street.length > 3) {
        let locId = data.locationNum;
        if (!locId || locId === "N/A" || locId === "Auto-generated" || locId === "") {
            locId = `LOC-${Math.floor(1000+Math.random()*9000)}`;
        }
        
        let existingLoc = db[data.customerName].locations[locId] || {};
        let newLoc = {
            street: street, city: data.custCity || "", state: data.custState || "", zip: data.custZip || "", 
            contact: data.contactName || existingLoc.contact || "",
            phone: data.contactPhone || existingLoc.phone || "",
            email: data.contactEmail || existingLoc.email || ""
        };
        if (Object.prototype.hasOwnProperty.call(data, 'parentId')) {
            if (data.parentId) newLoc.parentId = data.parentId;
        } else if (existingLoc.parentId) {
            newLoc.parentId = existingLoc.parentId;
        }
        db[data.customerName].locations[locId] = newLoc;

        let pfx = currentActiveView === 'service' ? 'sc' : (currentActiveView === 'invoice' ? 'inv' : '');
        let locField = pfx ? pfx + 'LocNumInput' : 'locNumInput';
        if (document.getElementById(locField)) document.getElementById(locField).value = locId;
    }
    
    syncSingleCustomerToCloud(data.customerName, db[data.customerName]);
}

function updateCustomerDatalist() {
    const db = getCustomerDB();
    const datalist = document.getElementById('customerNamesList');
    datalist.innerHTML = '';
    for (let custName in db) {
        let option = document.createElement('option'); option.value = custName; datalist.appendChild(option);
    }
}

function updateLocationDatalist() {
    const db = getCustomerDB();
    let inputId = 'custNameInput';
    if(currentActiveView === 'service') inputId = 'scCustNameInput';
    if(currentActiveView === 'invoice') inputId = 'invCustNameInput';
    
    const nameEl = document.getElementById(inputId);
    if(!nameEl) return;
    const custName = nameEl.value.trim().toUpperCase();
    
    const datalist = document.getElementById('locationStreetsList');
    datalist.innerHTML = '';
    
    if (db[custName] && db[custName].locations) {
        for (let locId in db[custName].locations) {
            let street = db[custName].locations[locId].street;
            if (street && street !== "UNKNOWN LOCATION") {
                let option = document.createElement('option'); option.value = street; datalist.appendChild(option);
            }
        }
    }
}

function openCustomerDirectory() {
    document.getElementById('customerModal').style.display = 'block';
    document.getElementById('customerSearch').value = '';
    document.getElementById('newCustDirForm').style.display = 'none';
    renderCustomerDirectory();
    document.getElementById('customerSearch').focus();
    loadParentCompanies();
}

function closeCustomerDirectory() { document.getElementById('customerModal').style.display = 'none'; }

function toggleLocs(safeCustName) {
    const row = document.getElementById('locs-' + safeCustName);
    const icon = document.getElementById('icon-' + safeCustName);
    if (row.style.display === 'none') { row.style.display = 'table-row'; icon.innerText = '▲'; } 
    else { row.style.display = 'none'; icon.innerText = '▼'; }
}

function renderCustomerDirectory() {
    const db = getCustomerDB();
    const tbody = document.getElementById('customerDirectoryBody');
    const filter = document.getElementById('customerSearch').value.toUpperCase();
    tbody.innerHTML = "";
    let hasResults = false;

    for (const custName in db) {
        const cust = db[custName];
        const custId = cust.id || "N/A";
        const locIds = Object.keys(cust.locations || {});
        let customerMatches = filter === "" || custName.includes(filter) || custId.includes(filter);
        let matchingLocs = [];
        
        locIds.forEach(locId => {
            const locData = cust.locations[locId];
            const street = locData.street || ""; const city = locData.city || "";
            const state = locData.state || ""; const zip = locData.zip || "";
            const contact = locData.contact || ""; const phone = locData.phone || "";
            let searchLocStr = `${contact} ${phone} ${street} ${city} ${state} ${zip}`.toUpperCase();
            if (customerMatches || searchLocStr.includes(filter) || locId.includes(filter)) matchingLocs.push({ locId, ...locData });
        });

        if (matchingLocs.length > 0 && !customerMatches) customerMatches = true; 

        if (customerMatches) {
            hasResults = true;
            const safeCustName = custName.replace(/[^a-zA-Z0-9]/g, "_");
            const safeRawName = custName.replace(/'/g, "\\'"); 
            const locCount = locIds.length;
            const expandIcon = filter !== "" ? "▲" : "▼"; 
            const displayStyle = filter !== "" ? "table-row" : "none"; 

            tbody.innerHTML += `
                <tr class="customer-row" style="background-color: #f2f4f6; cursor: pointer; border-bottom: 1px solid #ddd;" onclick="toggleLocs('${safeCustName}')">
                    <td><strong>${custName}</strong></td>
                    <td>${custId}</td>
                    <td style="color: #0ea5e9;"><em>${locCount} Location${locCount !== 1 ? 's' : ''}</em></td>
                    <td style="text-align: right;">
                        <button class="gen-btn" style="background-color: #7f8c8d; padding: 6px 10px; font-size: 11px;" onclick="event.stopPropagation(); deleteCustomerEntirely('${safeRawName}')">Delete Cust</button>
                        <span id="icon-${safeCustName}" style="margin-left: 10px; font-size: 14px;">${expandIcon}</span>
                    </td>
                </tr>
            `;

            let locsHTML = `<tr id="locs-${safeCustName}" style="display: ${displayStyle}; border-bottom: 2px solid #0ea5e9;"><td colspan="4" style="padding: 0;"><table class="submenu-table" style="width: 100%; background: #fff; font-size: 13px;">`;
            
            if (locCount > 0) {
                locIds.forEach(locId => {
                    const locData = cust.locations[locId];
                    const street = locData.street || ""; const city = locData.city || "";
                    const state = locData.state || ""; const zip = locData.zip || "";
                    const contact = locData.contact || ""; const phone = locData.phone || "";
                    const email = locData.email || "";
                    
                    let displayLoc = `<strong>${street}</strong>`;
                    if(contact) displayLoc += ` <span style="color:#e74c3c; font-size:11px;">(Attn: ${contact})</span>`;
                    if(phone) displayLoc += ` <span style="color:#3498db; font-size:11px;">${phone}</span>`;
                    if(city || state || zip) displayLoc += `<br><span style="color:#777;">${city}, ${state} ${zip}</span>`;

                    const safeStreet = street.replace(/'/g, "\\'");
                    const safeCity   = city.replace(/'/g, "\\'");
                    const safeState  = state.replace(/'/g, "\\'");
                    const safeZip    = String(zip).replace(/'/g, "\\'");
                    locsHTML += `
                        <tr>
                            <td style="width: 5%; color:#ccc; text-align:right;">↳</td>
                            <td style="width: 40%;">${displayLoc}</td>
                            <td style="width: 20%; color:#555;">${locId}</td>
                            <td style="width: 35%; text-align: right;">
                                <button class="vc-site-history-btn" title="Show everything that has happened at this site" onclick="openSiteHistoryFromDirectory('${safeRawName}', '${custId}', '${locId}', '${safeStreet}', '${safeCity}', '${safeState}', '${safeZip}')">📜 History</button>
                                <button class="select-cust-btn" style="margin-left:5px;" onclick="loadCustomerIntoForm('${safeRawName}', '${custId}', '${safeStreet}', '${safeCity}', '${safeState}', '${safeZip}', '${locId}', '${contact.replace(/'/g, "\\'")}', '${phone}', '${email}', '${(locData.parentId || '').replace(/'/g, "\\'")}')">Select Location</button>
                                <button class="delete-btn" style="padding: 6px 10px; margin-left: 5px;" onclick="deleteCustomerLocation('${safeRawName}', '${locId}')">X</button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                locsHTML += `<tr><td colspan="4" style="text-align: center; padding: 15px; color: #999;">No locations saved for this customer.<br><button class="select-cust-btn" style="margin-top: 8px;" onclick="loadCustomerIntoForm('${safeRawName}', '${custId}', '', '', '', '', '', '', '', '', '')">Load Customer Only</button></td></tr>`;
            }
            locsHTML += `</table></td></tr>`;
            tbody.innerHTML += locsHTML;
        }
    }
    if (!hasResults) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:#777;">No customers found.</td></tr>`;
}

async function loadCustomerIntoForm(name, custId, street, city, state, zip, locId, contact, phone, email, parentId) {
    let pfx = '';
    let custIdStr = 'custNumInput';
    let locIdStr = 'locNumInput';
    
    if(currentActiveView === 'service') { pfx = 'sc'; custIdStr = 'scCustNumInput'; locIdStr = 'scLocNumInput'; }
    if(currentActiveView === 'invoice') { pfx = 'inv'; custIdStr = 'invCustNumInput'; locIdStr = 'invLocNumInput'; }
    
    document.getElementById(pfx+'CustNameInput') ? document.getElementById(pfx+'CustNameInput').value = name : document.getElementById('custNameInput').value = name;
    
    if(currentActiveView === 'invoice') {
        document.getElementById('invCustNameInput').value = name;
        document.getElementById('invCustNumInput').value = custId;
        document.getElementById('invStreetInput').value = street;
        document.getElementById('invCityInput').value = city;
        document.getElementById('invStateInput').value = state;
        document.getElementById('invZipInput').value = zip;
        document.getElementById('invLocNumInput').value = locId === "N/A" ? "" : locId;
        
        if (parentId && typeof setInvoiceParentSelect === 'function') await setInvoiceParentSelect(parentId);
        else if (typeof updateInvoiceBillToParentRadioState === 'function') updateInvoiceBillToParentRadioState();
        if (typeof applyInvoiceBillTo === 'function') applyInvoiceBillTo();
    } else if (currentActiveView === 'service') {
        document.getElementById(custIdStr).value = custId;
        document.getElementById('scCustStreetInput').value = street;
        document.getElementById('scCustCityInput').value = city;
        document.getElementById('scCustStateInput').value = state;
        document.getElementById('scCustZipInput').value = zip;
        document.getElementById(locIdStr).value = locId === "N/A" ? "" : locId;
        if (document.getElementById('scContactNameInput')) document.getElementById('scContactNameInput').value = contact || "";
        if (document.getElementById('scContactPhoneInput')) document.getElementById('scContactPhoneInput').value = phone || "";
        if (document.getElementById('scContactEmailInput')) document.getElementById('scContactEmailInput').value = email || "";
        if (parentId && typeof setServiceParentSelect === 'function') await setServiceParentSelect(parentId);
    } else {
        document.getElementById(custIdStr).value = custId;
        document.getElementById('custStreetInput').value = street;
        document.getElementById('custCityInput').value = city;
        document.getElementById('custStateInput').value = state;
        document.getElementById('custZipInput').value = zip;
        document.getElementById(locIdStr).value = locId === "N/A" ? "" : locId;
        if (document.getElementById('contactNameInput')) document.getElementById('contactNameInput').value = contact || "";
    }
    
    updateLocationDatalist(); 
    closeCustomerDirectory();
    
    if(currentActiveView === 'quoting') triggerQuoteAutoSave();
    if(currentActiveView === 'service') triggerServiceAutoSave();
}

function deleteCustomerLocation(custName, locId) {
    if(confirm(`Remove Location ID ${locId} from ${custName}?`)) {
        let db = getCustomerDB();
        if(db[custName] && db[custName].locations) { 
            delete db[custName].locations[locId]; 
            syncSingleCustomerToCloud(custName, db[custName]); 
            renderCustomerDirectory(); 
        }
    }
}

function deleteCustomerEntirely(custName) {
    if(confirm(`Are you sure you want to completely delete ${custName} and all of its locations?`)) {
        syncSingleCustomerToCloud(custName, null); 
        renderCustomerDirectory();
    }
}

function checkCustomerAutoNumber(context) {
    let nameInput, numInput;
    if(context === 'quoting') { nameInput = document.getElementById('custNameInput'); numInput = document.getElementById('custNumInput'); }
    else if(context === 'service') { nameInput = document.getElementById('scCustNameInput'); numInput = document.getElementById('scCustNumInput'); }
    else if(context === 'invoice') { nameInput = document.getElementById('invCustNameInput'); numInput = document.getElementById('invCustNumInput'); }

    const name = nameInput.value.trim().toUpperCase();
    if (name === "") return;
    let db = getCustomerDB();
    if (db[name] && db[name].id) {
        numInput.value = db[name].id;
    } else if (numInput.value === "" || numInput.value === "Auto-generated") {
        numInput.value = `CST-${Math.floor(1000 + Math.random() * 9000)}`;
    }
}

function checkLocationAutoNumber(context) {
    let nameInput, streetInput, locInput;
    if(context === 'quoting') { nameInput = document.getElementById('custNameInput'); streetInput = document.getElementById('custStreetInput'); locInput = document.getElementById('locNumInput'); }
    else if(context === 'service') { nameInput = document.getElementById('scCustNameInput'); streetInput = document.getElementById('scCustStreetInput'); locInput = document.getElementById('scLocNumInput'); }
    else if(context === 'invoice') { nameInput = document.getElementById('invCustNameInput'); streetInput = document.getElementById('invStreetInput'); locInput = document.getElementById('invLocNumInput'); }

    const name = nameInput.value.trim().toUpperCase();
    const street = streetInput.value.trim().toUpperCase();

    if (name === "" || street === "") return;
    let db = getCustomerDB();
    if (!db[name]) return; 

    let matchedLocId = null; let matchedLocData = null;
    for (let locId in db[name].locations) {
        if (db[name].locations[locId].street.toUpperCase() === street) { matchedLocId = locId; matchedLocData = db[name].locations[locId]; break; }
    }

        if (matchedLocId) {
        locInput.value = matchedLocId;
        if(context === 'invoice') {
            document.getElementById('invCityInput').value = matchedLocData.city || "";
            document.getElementById('invStateInput').value = matchedLocData.state || "";
            document.getElementById('invZipInput').value = matchedLocData.zip || "";
            if (matchedLocData.parentId && typeof setInvoiceParentSelect === 'function') {
                setInvoiceParentSelect(matchedLocData.parentId);
            }
        } else if (context === 'service') {
            document.getElementById('scCustCityInput').value = matchedLocData.city || "";
            document.getElementById('scCustStateInput').value = matchedLocData.state || "";
            document.getElementById('scCustZipInput').value = matchedLocData.zip || "";
            if (document.getElementById('scContactNameInput') && matchedLocData.contact) document.getElementById('scContactNameInput').value = matchedLocData.contact;
            if (document.getElementById('scContactPhoneInput') && matchedLocData.phone) document.getElementById('scContactPhoneInput').value = matchedLocData.phone;
            if (document.getElementById('scContactEmailInput') && matchedLocData.email) document.getElementById('scContactEmailInput').value = matchedLocData.email;
        } else {
            document.getElementById('custCityInput').value = matchedLocData.city || "";
            document.getElementById('custStateInput').value = matchedLocData.state || "";
            document.getElementById('custZipInput').value = matchedLocData.zip || "";
        }
    } else if (locInput.value === "" || locInput.value === "Auto-generated") {
        locInput.value = `LOC-${Math.floor(1000 + Math.random() * 9000)}`;
    }
}

function attachTabAutocomplete(inputId, datalistId, context, type, nextFocusId) {
    const inputEl = document.getElementById(inputId);
    inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            const val = this.value.trim().toUpperCase();
            if (val !== "") {
                const datalist = document.getElementById(datalistId);
                const options = datalist.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value.toUpperCase().startsWith(val)) {
                        e.preventDefault(); 
                        this.value = options[i].value; 
                        
                        if (type === 'customer') {
                            checkCustomerAutoNumber(context);
                            updateLocationDatalist();
                        } else if (type === 'location') {
                            checkLocationAutoNumber(context);
                        }

                        if (context === 'invoice') {
                            if (typeof checkInvoiceParentCompany === 'function') checkInvoiceParentCompany();
                            if (typeof applyInvoiceBillTo === 'function') applyInvoiceBillTo();
                        }

                        if(context === 'quoting') triggerQuoteAutoSave();
                        if(context === 'service') triggerServiceAutoSave();
                        
                        if(nextFocusId && document.getElementById(nextFocusId)) {
                            document.getElementById(nextFocusId).focus();
                        } else {
                            this.blur();
                        }
                        break; 
                    }
                }
            }
        }
    });

    inputEl.addEventListener('change', function() {
        if (type === 'customer') { checkCustomerAutoNumber(context); updateLocationDatalist(); } 
        else if (type === 'location') { checkLocationAutoNumber(context); }
        if (context === 'invoice') {
            if (typeof checkInvoiceParentCompany === 'function') checkInvoiceParentCompany();
            if (typeof applyInvoiceBillTo === 'function') applyInvoiceBillTo();
        }
        if(context === 'quoting') triggerQuoteAutoSave();
        if(context === 'service') triggerServiceAutoSave();
    });
}

// ==========================================
// PARENT COMPANY & LOCATION MAPPING LOGIC
// ==========================================

async function loadParentCompanies() {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    
    try {
        const db = firebase.firestore();
        // Assuming your parent companies are stored in a specific collection or marked with isParent
        // Adjust this query if your database structure is different
        const snapshot = await db.collection("ParentCompanies").orderBy("Name").get();
        
        let options = '<option value="">-- No Parent / Select Existing --</option>';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            options += `<option value="${doc.id}">${data.Name}</option>`;
        });
        
        // Populate Add Customer Modal Dropdown
        const addSelect = document.getElementById('dirParentSelect');
        if (addSelect) addSelect.innerHTML = options;

        // Populate Link Modal Dropdown
        const linkSelect = document.getElementById('linkParentSelect');
        if (linkSelect) linkSelect.innerHTML = options.replace('-- No Parent / Select Existing --', '-- Select Existing Parent --');

        const invSelect = document.getElementById('invParentSelect');
        if (invSelect) invSelect.innerHTML = options;

        const scParentSel = document.getElementById('scParentSelect');
        if (scParentSel) scParentSel.innerHTML = options;

    } catch (error) {
        console.error("Error loading parents:", error);
    }
}

async function setInvoiceParentSelect(parentId) {
    if (!parentId || currentActiveView !== 'invoice') return;
    await loadParentCompanies();
    const sel = document.getElementById('invParentSelect');
    const newIn = document.getElementById('invParentNew');
    if (!sel) return;
    if ([...sel.options].some(o => o.value === parentId)) {
        sel.value = parentId;
        if (newIn) newIn.value = '';
    }
    if (typeof loadInvoiceParentBillingAddress === 'function') await loadInvoiceParentBillingAddress(parentId);
    if (typeof updateInvoiceBillToParentRadioState === 'function') updateInvoiceBillToParentRadioState();
    if (typeof applyInvoiceBillTo === 'function') applyInvoiceBillTo();
}

async function checkInvoiceParentCompany() {
    const custInput = document.getElementById('invCustNameInput');
    const streetInput = document.getElementById('invStreetInput');
    const sel = document.getElementById('invParentSelect');
    const newIn = document.getElementById('invParentNew');
    if (!custInput || !streetInput || !sel || !newIn) return;

    const customerName = custInput.value.trim().toUpperCase();
    const street = streetInput.value.trim().toUpperCase();
    if (!customerName || !street) return;
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;

    try {
        await loadParentCompanies();
        const db = firebase.firestore();
        const locSnapshot = await db.collection('MappedLocations')
            .where('Sub_Company', '==', customerName)
            .where('Street', '==', street)
            .get();

        if (!locSnapshot.empty) {
            const parentId = locSnapshot.docs[0].data().Parent_ID;
            if (parentId && [...sel.options].some(o => o.value === parentId)) {
                sel.value = parentId;
                newIn.value = '';
                if (typeof loadInvoiceParentBillingAddress === 'function') await loadInvoiceParentBillingAddress(parentId);
                if (typeof updateInvoiceBillToParentRadioState === 'function') updateInvoiceBillToParentRadioState();
                if (typeof applyInvoiceBillTo === 'function') applyInvoiceBillTo();
            }
        }
    } catch (e) {
        console.error('Invoice parent lookup error:', e);
    }
}

let currentLinkCustName = null;
let currentLinkLocId = null;

function openLinkModal(custName, locId, street) {
    currentLinkCustName = custName;
    currentLinkLocId = locId;
    
    document.getElementById('linkLocStreetDisplay').innerText = street;
    document.getElementById('linkParentNew').value = '';
    
    loadParentCompanies().then(() => {
        document.getElementById('linkParentModal').style.display = 'block';
    });
}

async function confirmLinkParent() {
    const selectedParentId = document.getElementById('linkParentSelect').value;
    const newParentName = document.getElementById('linkParentNew').value.trim().toUpperCase();

    if (!selectedParentId && !newParentName) {
        alert("Please select an existing parent or enter a new one.");
        return;
    }

    try {
        let finalParentId = null;
        let dbRef = firebase.firestore();

        if (newParentName) {
            const parentRef = await dbRef.collection("ParentCompanies").add({ Name: newParentName });
            finalParentId = parentRef.id;
        } else {
            finalParentId = selectedParentId;
        }

        // Update Local DB
        let localDb = getCustomerDB();
        if(localDb[currentLinkCustName] && localDb[currentLinkCustName].locations[currentLinkLocId]) {
            localDb[currentLinkCustName].locations[currentLinkLocId].parentId = finalParentId;
            
            const locData = localDb[currentLinkCustName].locations[currentLinkLocId];
            
            // Save to the MappedLocations collection as requested by your old logic
            const mapId = 'MAP_' + Date.now();
            await dbRef.collection("MappedLocations").doc(mapId).set({
                Parent_ID: finalParentId,
                Sub_Company: currentLinkCustName,
                City: locData.city || "",
                Street: locData.street || ""
            });

            // Sync updated customer data to cloud
            await syncSingleCustomerToCloud(currentLinkCustName, localDb[currentLinkCustName]);
        }

        document.getElementById('linkParentModal').style.display = 'none';
        alert("Location successfully linked to Parent Company!");
        renderCustomerDirectory();

    } catch (error) {
        console.error("Error linking parent:", error);
        alert("Failed to link parent company.");
    }
}


// ====================================================================
// --- SITE HISTORY MODAL ---
// Click 📜 History on any location row in the Customer Directory →
// shows everything that has happened at that exact site:
//   • service tickets (matched by locationNum LOC-XXXX, fallback customerName + street)
//   • completed visit reports (per matching ticket)
//   • Site Intelligence (Field Access Notes + access photo count)
// All reads go through the bridge-aware VCFirestore helpers; no writes.
// ====================================================================

(function vcSiteHistoryBoot() {
    "use strict";

    // -------- helpers --------

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function normStreet(s) {
        return String(s || "").trim().toUpperCase().replace(/\s+/g, " ");
    }

    function normName(s) {
        return String(s || "").trim().toUpperCase().replace(/\s+/g, " ");
    }

    function fmtDate(s) {
        var v = String(s || "").trim();
        if (!v) return "—";
        // Accept YYYY-MM-DD or full ISO; render YYYY-MM-DD
        var m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[0];
        try {
            var d = new Date(v);
            if (!isNaN(d.getTime())) {
                return d.getFullYear() + "-" +
                    String(d.getMonth() + 1).padStart(2, "0") + "-" +
                    String(d.getDate()).padStart(2, "0");
            }
        } catch (e) {}
        return v;
    }

    function fmtTs(ts) {
        if (!ts) return "—";
        try {
            if (typeof ts.toDate === "function") {
                return ts.toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
            }
            if (ts.seconds != null) {
                return new Date(ts.seconds * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
            }
            var d = new Date(ts);
            if (!isNaN(d.getTime())) {
                return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
            }
        } catch (e) {}
        return "—";
    }

    function statusChipColor(status) {
        var s = String(status || "").toLowerCase();
        if (s.indexOf("complete") >= 0 || s.indexOf("verified") >= 0 || s.indexOf("ready for billing") >= 0) return "#16a34a";
        if (s.indexOf("cancel") >= 0) return "#7f8c8d";
        if (s.indexOf("dispatch") >= 0 || s.indexOf("in progress") >= 0) return "#0ea5e9";
        if (s.indexOf("unassign") >= 0 || s.indexOf("scheduled") >= 0) return "#f59e0b";
        return "#64748b";
    }

    function buildSiteIntelDocId(displayLine) {
        // Mirror technician/js/data_provider.js#siteIntelDocIdFromLocationLine
        var key = String(displayLine || "").trim().toLowerCase().replace(/\s+/g, " ");
        if (!key) return "";
        var h = 5381;
        for (var i = 0; i < key.length; i++) {
            h = (h * 33) ^ key.charCodeAt(i);
        }
        return "vc_site_" + (h >>> 0).toString(16);
    }

    function injectStylesOnce() {
        if (document.getElementById("vcSiteHistoryStyles")) return;
        var css = document.createElement("style");
        css.id = "vcSiteHistoryStyles";
        css.textContent = ""
            + ".vc-site-history-btn{background:#0ea5e9;color:#fff;border:none;padding:6px 10px;font-size:11px;border-radius:4px;cursor:pointer;font-weight:600;}"
            + ".vc-site-history-btn:hover{background:#0284c7;}"
            + "#vcSiteHistoryModal{display:none;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:10001;align-items:flex-start;justify-content:center;padding:30px 16px;overflow-y:auto;}"
            + "#vcSiteHistoryModal.is-open{display:flex;}"
            + ".vc-sh-card{background:#fff;width:min(820px,100%);border-radius:10px;box-shadow:0 18px 50px rgba(15,23,42,0.35);border:1px solid #e2e8f0;display:flex;flex-direction:column;max-height:calc(100vh - 60px);}"
            + ".vc-sh-head{padding:16px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}"
            + ".vc-sh-title{margin:0;font-size:16px;color:#0ea5e9;}"
            + ".vc-sh-sub{margin:4px 0 0;font-size:12px;color:#64748b;}"
            + ".vc-sh-close{background:transparent;border:none;font-size:22px;color:#64748b;cursor:pointer;line-height:1;padding:0 4px;}"
            + ".vc-sh-close:hover{color:#e74c3c;}"
            + ".vc-sh-body{padding:14px 18px 18px;overflow-y:auto;}"
            + ".vc-sh-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}"
            + ".vc-sh-pill{font-size:11px;padding:4px 10px;border-radius:999px;background:#eef2f5;color:#475569;font-weight:600;}"
            + ".vc-sh-pill.is-warn{background:#fef3c7;color:#92400e;}"
            + ".vc-sh-section{margin-top:10px;}"
            + ".vc-sh-section h3{margin:0 0 8px;font-size:12px;color:#0ea5e9;text-transform:uppercase;letter-spacing:.04em;}"
            + ".vc-sh-row{padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#fafbfc;margin-bottom:8px;cursor:pointer;transition:background .15s;}"
            + ".vc-sh-row:hover{background:#eef2f5;border-color:#cbd5e1;}"
            + ".vc-sh-row.is-static{cursor:default;}"
            + ".vc-sh-row.is-static:hover{background:#fafbfc;border-color:#e2e8f0;}"
            + ".vc-sh-row-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;color:#1e293b;}"
            + ".vc-sh-chip{font-size:10px;padding:2px 8px;border-radius:999px;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}"
            + ".vc-sh-row-meta{font-size:12px;color:#64748b;margin-top:4px;}"
            + ".vc-sh-row-issue{font-size:12px;color:#334155;margin-top:6px;line-height:1.4;}"
            + ".vc-sh-empty{padding:14px;text-align:center;color:#94a3b8;font-style:italic;font-size:13px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:6px;}"
            + ".vc-sh-loading{padding:30px;text-align:center;color:#64748b;font-size:13px;}"
            + ".vc-sh-err{padding:12px;background:#fee2e2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-size:12px;}";
        document.head.appendChild(css);
    }

    function injectModalOnce() {
        if (document.getElementById("vcSiteHistoryModal")) return;
        injectStylesOnce();
        var wrap = document.createElement("div");
        wrap.id = "vcSiteHistoryModal";
        wrap.innerHTML = ""
            + "<div class='vc-sh-card' role='dialog' aria-modal='true' aria-labelledby='vcSiteHistoryTitle'>"
            + "  <div class='vc-sh-head'>"
            + "    <div>"
            + "      <h2 id='vcSiteHistoryTitle' class='vc-sh-title'>Site History</h2>"
            + "      <p id='vcSiteHistorySub' class='vc-sh-sub'></p>"
            + "    </div>"
            + "    <button type='button' class='vc-sh-close' aria-label='Close' onclick='closeSiteHistoryModal()'>×</button>"
            + "  </div>"
            + "  <div id='vcSiteHistoryBody' class='vc-sh-body'><div class='vc-sh-loading'>Loading site history…</div></div>"
            + "</div>";
        document.body.appendChild(wrap);
        // Click-outside dismiss
        wrap.addEventListener("click", function (e) {
            if (e.target === wrap) closeSiteHistoryModal();
        });
        // Escape dismiss (single global listener; idempotent via flag)
        if (!window.__vcSiteHistoryEscWired) {
            window.__vcSiteHistoryEscWired = true;
            document.addEventListener("keydown", function (e) {
                if (e.key === "Escape") {
                    var m = document.getElementById("vcSiteHistoryModal");
                    if (m && m.classList.contains("is-open")) closeSiteHistoryModal();
                }
            });
        }
    }

    // -------- public openers --------

    window.openSiteHistoryFromDirectory = function (custName, custId, locId, street, city, state, zip) {
        injectModalOnce();
        var modal = document.getElementById("vcSiteHistoryModal");
        var titleEl = document.getElementById("vcSiteHistoryTitle");
        var subEl = document.getElementById("vcSiteHistorySub");
        var bodyEl = document.getElementById("vcSiteHistoryBody");

        var addressLine = [street, [city, state].filter(Boolean).join(", "), zip]
            .filter(function (p) { return p && String(p).trim(); })
            .join("  ·  ");

        titleEl.textContent = "Site History — " + custName;
        subEl.textContent = addressLine + "   ·   " + (locId || "(no LOC id)");
        bodyEl.innerHTML = "<div class='vc-sh-loading'>Loading site history…</div>";
        modal.classList.add("is-open");

        loadAndRenderSiteHistory({
            custName: custName,
            custId: custId,
            locId: locId,
            street: street,
            city: city,
            state: state,
            zip: zip,
        }).catch(function (err) {
            console.error("[Site History] load failed:", err);
            bodyEl.innerHTML = "<div class='vc-sh-err'>Failed to load site history: " +
                escapeHtml(err && err.message ? err.message : String(err)) + "</div>";
        });
    };

    window.closeSiteHistoryModal = function () {
        var modal = document.getElementById("vcSiteHistoryModal");
        if (modal) modal.classList.remove("is-open");
    };

    // -------- data load + render --------

    async function loadAndRenderSiteHistory(site) {
        var bodyEl = document.getElementById("vcSiteHistoryBody");

        if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
            bodyEl.innerHTML = "<div class='vc-sh-err'>Firebase is not initialized — cannot load site history.</div>";
            return;
        }
        if (typeof VCFirestore === "undefined" || typeof VCFirestore.loadServiceCallsMergedOnce !== "function") {
            bodyEl.innerHTML = "<div class='vc-sh-err'>VCFirestore helpers are missing — cannot load site history.</div>";
            return;
        }

        var db = firebase.firestore();

        // 1. Service tickets — pull all (bridge-aware) and filter client-side.
        //    Match priority:
        //      a) ticket.locationNum === site.locId  (precise; LOC-XXXX captured at intake)
        //      b) ticket.customerName matches  AND  ticket.locationAddress matches site.street
        var matchedTickets = [];
        try {
            var snap = await VCFirestore.loadServiceCallsMergedOnce(db);
            var targetLoc = String(site.locId || "").trim();
            var targetCustU = normName(site.custName);
            var targetStreetU = normStreet(site.street);
            snap.forEach(function (doc) {
                var d = (doc && typeof doc.data === "function") ? (doc.data() || {}) : (doc.data || {});
                var id = doc.id;
                var ticketLoc = String(d.locationNum || "").trim();
                var matchedByLoc = !!(targetLoc && ticketLoc && ticketLoc === targetLoc);
                var matchedByCustStreet = false;
                if (!matchedByLoc) {
                    var tCustU = normName(d.customerName);
                    var tStreetU = normStreet(d.locationAddress);
                    matchedByCustStreet = (
                        targetCustU && tCustU === targetCustU &&
                        targetStreetU && tStreetU === targetStreetU
                    );
                }
                if (matchedByLoc || matchedByCustStreet) {
                    d._id = id;
                    d._matchKind = matchedByLoc ? "loc" : "cust+street";
                    matchedTickets.push(d);
                }
            });
        } catch (e) {
            console.warn("[Site History] service_calls load failed:", e);
        }

        // Sort: newest date first; tickets without a date sink to bottom.
        matchedTickets.sort(function (a, b) {
            var ad = String(a.date || "");
            var bd = String(b.date || "");
            if (!ad && bd) return 1;
            if (ad && !bd) return -1;
            if (ad < bd) return 1;
            if (ad > bd) return -1;
            return 0;
        });

        // 2. Site Intel doc (Field Access Notes + access photo count).
        var siteIntel = null;
        try {
            var displayLine = String(site.custName || "").trim() + " - " + String(site.street || "").trim();
            var docId = buildSiteIntelDocId(displayLine);
            if (docId && typeof VCFirestore.getSiteIntelDocOnceBridged === "function") {
                var got = await VCFirestore.getSiteIntelDocOnceBridged(db, docId);
                if (got && got.exists) siteIntel = got.data || {};
            }
        } catch (e) {
            console.warn("[Site History] site_intelligence load failed:", e);
        }

        // 3. Completed reports — query by linkedTicketId for the matched tickets (keeps it cheap).
        //    `linkedTicketId` is what `technician/index.html#uploadReportToCloud` writes on every
        //    completed_reports doc (NOT `serviceCallId`). Bridge-aware via VCFirestore helper.
        var reportsByTicketId = {};
        try {
            if (typeof VCFirestore.queryCompletedReportsWhereMerged === "function" && matchedTickets.length) {
                var ids = matchedTickets.slice(0, 30).map(function (t) { return t._id; }).filter(Boolean);
                var chunks = [];
                for (var i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
                for (var c = 0; c < chunks.length; c++) {
                    try {
                        var rows = await VCFirestore.queryCompletedReportsWhereMerged(
                            db, "linkedTicketId", "in", chunks[c], 50
                        );
                        rows.forEach(function (r) {
                            var d = r.data || {};
                            var sid = String(d.linkedTicketId || "");
                            if (!sid) return;
                            if (!reportsByTicketId[sid]) reportsByTicketId[sid] = [];
                            reportsByTicketId[sid].push({ id: r.id, data: d });
                        });
                    } catch (e2) {
                        console.warn("[Site History] completed_reports chunk failed:", e2);
                    }
                }
            }
        } catch (e) {
            console.warn("[Site History] completed_reports load failed:", e);
        }

        renderSiteHistory(site, matchedTickets, siteIntel, reportsByTicketId);
    }

    function renderSiteHistory(site, tickets, siteIntel, reportsByTicketId) {
        var bodyEl = document.getElementById("vcSiteHistoryBody");

        // Top-level summary pills.
        var lastDate = tickets.length ? fmtDate(tickets[0].date) : "—";
        var statuses = {};
        tickets.forEach(function (t) {
            var s = String(t.status || "Unknown");
            statuses[s] = (statuses[s] || 0) + 1;
        });
        var pills = [];
        pills.push("<span class='vc-sh-pill'>" + tickets.length + " ticket" + (tickets.length === 1 ? "" : "s") + "</span>");
        pills.push("<span class='vc-sh-pill'>Last visit: " + escapeHtml(lastDate) + "</span>");
        var siteIntelHas = !!(siteIntel && (
            (siteIntel.notes && String(siteIntel.notes).trim()) ||
            (Array.isArray(siteIntel.accessPhotoUrls) && siteIntel.accessPhotoUrls.length)
        ));
        pills.push("<span class='vc-sh-pill" + (siteIntelHas ? "" : " is-warn") + "'>Site Intel: " + (siteIntelHas ? "yes" : "none") + "</span>");
        Object.keys(statuses).slice(0, 4).forEach(function (s) {
            pills.push("<span class='vc-sh-pill'>" + escapeHtml(s) + ": " + statuses[s] + "</span>");
        });

        var html = "<div class='vc-sh-meta'>" + pills.join("") + "</div>";

        // -- Site Intel section --
        html += "<div class='vc-sh-section'><h3>Site Intelligence (Field Access Notes)</h3>";
        if (siteIntelHas) {
            var notes = siteIntel.notes ? String(siteIntel.notes).trim() : "";
            var photoCount = Array.isArray(siteIntel.accessPhotoUrls) ? siteIntel.accessPhotoUrls.length : 0;
            var updatedAt = siteIntel.updatedAt || siteIntel.accessPhotoUpdatedAt;
            html += "<div class='vc-sh-row is-static'>";
            html += "<div class='vc-sh-row-top'>";
            html += "<span class='vc-sh-chip' style='background:#0ea5e9;'>NOTES</span>";
            html += "<span>" + (siteIntel.updatedByTech ? escapeHtml(siteIntel.updatedByTech) : "Unknown tech") + "</span>";
            html += "<span style='color:#94a3b8;font-size:11px;'>· updated " + escapeHtml(fmtTs(updatedAt)) + "</span>";
            if (photoCount) html += "<span class='vc-sh-pill' style='margin-left:auto;'>📷 " + photoCount + " photo" + (photoCount === 1 ? "" : "s") + "</span>";
            html += "</div>";
            if (notes) html += "<div class='vc-sh-row-issue'>" + escapeHtml(notes).replace(/\n/g, "<br>") + "</div>";
            else html += "<div class='vc-sh-row-meta'><em>No text notes — only access photos.</em></div>";
            html += "</div>";
        } else {
            html += "<div class='vc-sh-empty'>No Site Intelligence recorded for this site yet.</div>";
        }
        html += "</div>";

        // -- Service tickets section --
        html += "<div class='vc-sh-section'><h3>Service tickets &amp; visits</h3>";
        if (!tickets.length) {
            html += "<div class='vc-sh-empty'>No service tickets recorded for this site (matched by LOC id or customer + street).</div>";
        } else {
            tickets.forEach(function (t) {
                var color = statusChipColor(t.status);
                var tid = String(t._id || "");
                var safeTid = tid.replace(/'/g, "\\'");
                var date = fmtDate(t.date);
                var jt = t.jobType ? String(t.jobType) : "Service";
                var status = t.status ? String(t.status) : "—";
                var ticketNum = t.ticketNum ? String(t.ticketNum) : tid;
                var techs = "";
                if (Array.isArray(t.assignedTechs) && t.assignedTechs.length) techs = t.assignedTechs.join(", ");
                else if (t.assignedTech) techs = String(t.assignedTech);
                var issueRaw = String(t.issue || "").trim();
                var issue = issueRaw ? (issueRaw.length > 220 ? issueRaw.slice(0, 220) + "…" : issueRaw) : "";
                var matchHint = t._matchKind === "loc" ? "matched LOC" : "matched cust+street";
                var reports = reportsByTicketId[tid] || [];
                var reportLine = reports.length
                    ? "📄 " + reports.length + " completed report" + (reports.length === 1 ? "" : "s")
                    : "";

                html += "<div class='vc-sh-row' onclick=\"openTicketFromSiteHistory('" + safeTid + "')\" title='Open ticket #" + escapeHtml(ticketNum) + " in Service Call Intake'>";
                html += "<div class='vc-sh-row-top'>";
                html += "<span class='vc-sh-chip' style='background:" + color + ";'>" + escapeHtml(status) + "</span>";
                html += "<strong>" + escapeHtml(date) + "</strong>";
                html += "<span style='color:#475569;'>· " + escapeHtml(jt) + "</span>";
                html += "<span style='color:#94a3b8;font-size:11px;margin-left:auto;'>#" + escapeHtml(ticketNum) + " · " + escapeHtml(matchHint) + "</span>";
                html += "</div>";
                var metaBits = [];
                if (techs) metaBits.push("👷 " + escapeHtml(techs));
                if (t.priority) metaBits.push("🏷️ " + escapeHtml(String(t.priority)));
                if (reportLine) metaBits.push(reportLine);
                if (metaBits.length) html += "<div class='vc-sh-row-meta'>" + metaBits.join("   ·   ") + "</div>";
                if (issue) html += "<div class='vc-sh-row-issue'>" + escapeHtml(issue) + "</div>";
                html += "</div>";
            });
        }
        html += "</div>";

        bodyEl.innerHTML = html;
    }

    // Click on a ticket row → load it in Service Call Intake (uses existing dispatcher flow).
    window.openTicketFromSiteHistory = function (ticketId) {
        if (!ticketId) return;
        try {
            // Customer Directory + Site History modals out of the way.
            if (typeof closeSiteHistoryModal === "function") closeSiteHistoryModal();
            if (typeof closeCustomerDirectory === "function") closeCustomerDirectory();
            // Switch to Service Call Intake if we know how.
            if (typeof switchTab === "function") {
                try { switchTab("service"); } catch (e) {}
            }
            if (typeof loadServiceCall === "function") {
                loadServiceCall(ticketId);
            } else {
                console.warn("[Site History] loadServiceCall not available — leaving ticket id in clipboard.");
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ticketId);
                } catch (e2) {}
                alert("Ticket id copied: " + ticketId);
            }
        } catch (e) {
            console.error("[Site History] openTicketFromSiteHistory failed:", e);
        }
    };
})();
