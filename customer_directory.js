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
        console.error("Failed to sync customer to cloud:", e);
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

function saveCustomerFromDirectory() {
    // 1. Grab Parent Company from either the dropdown OR the new text box
    const selectedParent = document.getElementById('dirParentSelect').value;
    const newParent = document.getElementById('dirParentNew').value.trim().toUpperCase();
    const parentCompany = newParent || selectedParent; // Prioritizes the text box if both are filled
    
    const name = document.getElementById('dirNewName').value.trim().toUpperCase();
    const contact = document.getElementById('dirNewContact').value.trim().toUpperCase();
    const phone = document.getElementById('dirNewPhone').value.trim();
    const email = document.getElementById('dirNewEmail').value.trim();
    const street = document.getElementById('dirNewStreet').value.trim().toUpperCase();
    const city = document.getElementById('dirNewCity').value.trim().toUpperCase();
    const state = document.getElementById('dirNewState').value.trim().toUpperCase();
    const zip = document.getElementById('dirNewZip').value.trim().toUpperCase();

    if (!name || name.length < 3) { alert("Valid Customer Name is required."); return; }

    // 2. Normal Twin Pillars Local/Cloud Save Logic
    let db = getCustomerDB();
    if (!db[name]) db[name] = { id: `CST-${Math.floor(1000+Math.random()*9000)}`, locations: {} };
    
    if (street && street.length > 3) {
        let locId = `LOC-${Math.floor(1000+Math.random()*9000)}`;
        db[name].locations[locId] = { street, city, state, zip, contact, phone, email };
    }

    syncSingleCustomerToCloud(name, db[name]);
    
    // 3. NEW: If they typed or selected a Parent Company, silently map it in Firebase
    if (parentCompany && street) {
        handleFirebaseHierarchy(parentCompany, name, city, street);
    }
    
    // Clear fields
    document.getElementById('dirParentSelect').value = '';
    document.getElementById('dirParentNew').value = '';
    document.getElementById('dirNewName').value = ''; document.getElementById('dirNewContact').value = '';
    document.getElementById('dirNewPhone').value = ''; document.getElementById('dirNewEmail').value = '';
    document.getElementById('dirNewStreet').value = ''; document.getElementById('dirNewCity').value = '';
    document.getElementById('dirNewState').value = ''; document.getElementById('dirNewZip').value = '';
    
    toggleNewCustomerForm();
    renderCustomerDirectory();
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
        db[data.customerName].locations[locId] = {
            street: street, city: data.custCity || "", state: data.custState || "", zip: data.custZip || "", 
            contact: data.contactName || existingLoc.contact || "",
            phone: data.contactPhone || existingLoc.phone || "",
            email: data.contactEmail || existingLoc.email || ""
        };

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
                    <td style="color: #1e4b85;"><em>${locCount} Location${locCount !== 1 ? 's' : ''}</em></td>
                    <td style="text-align: right;">
                        <button class="gen-btn" style="background-color: #7f8c8d; padding: 6px 10px; font-size: 11px;" onclick="event.stopPropagation(); deleteCustomerEntirely('${safeRawName}')">Delete Cust</button>
                        <span id="icon-${safeCustName}" style="margin-left: 10px; font-size: 14px;">${expandIcon}</span>
                    </td>
                </tr>
            `;

            let locsHTML = `<tr id="locs-${safeCustName}" style="display: ${displayStyle}; border-bottom: 2px solid #1e4b85;"><td colspan="4" style="padding: 0;"><table class="submenu-table" style="width: 100%; background: #fff; font-size: 13px;">`;
            
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

                    locsHTML += `
                        <tr>
                            <td style="width: 5%; color:#ccc; text-align:right;">↳</td>
                            <td style="width: 45%;">${displayLoc}</td>
                            <td style="width: 20%; color:#555;">${locId}</td>
                            <td style="width: 30%; text-align: right;">
                                <button class="select-cust-btn" onclick="loadCustomerIntoForm('${safeRawName}', '${custId}', '${street.replace(/'/g, "\\'")}', '${city.replace(/'/g, "\\'")}', '${state.replace(/'/g, "\\'")}', '${zip}', '${locId}', '${contact.replace(/'/g, "\\'")}', '${phone}', '${email}')">Select Location</button>
                                <button class="delete-btn" style="padding: 6px 10px; margin-left: 5px;" onclick="deleteCustomerLocation('${safeRawName}', '${locId}')">X</button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                locsHTML += `<tr><td colspan="4" style="text-align: center; padding: 15px; color: #999;">No locations saved for this customer.<br><button class="select-cust-btn" style="margin-top: 8px;" onclick="loadCustomerIntoForm('${safeRawName}', '${custId}', '', '', '', '', '', '', '', '')">Load Customer Only</button></td></tr>`;
            }
            locsHTML += `</table></td></tr>`;
            tbody.innerHTML += locsHTML;
        }
    }
    if (!hasResults) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color:#777;">No customers found.</td></tr>`;
}

function loadCustomerIntoForm(name, custId, street, city, state, zip, locId, contact, phone, email) {
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
        
        let formattedLoc = name + "\n" + street;
        if(city) formattedLoc += "\n" + city + ", " + state + " " + zip;
        document.getElementById('invBillTo').value = formattedLoc;
        document.getElementById('invServiceLoc').value = formattedLoc;
    } else {
        document.getElementById(custIdStr).value = custId;
        document.getElementById(pfx+'custStreetInput').value = street;
        document.getElementById(pfx+'custCityInput').value = city;
        document.getElementById(pfx+'custStateInput').value = state;
        document.getElementById(pfx+'custZipInput').value = zip;
        document.getElementById(locIdStr).value = locId === "N/A" ? "" : locId;
        
        if(document.getElementById(pfx+'contactNameInput')) document.getElementById(pfx+'contactNameInput').value = contact || "";
        if(document.getElementById(pfx+'contactPhoneInput')) document.getElementById(pfx+'contactPhoneInput').value = phone || "";
        if(document.getElementById(pfx+'contactEmailInput')) document.getElementById(pfx+'contactEmailInput').value = email || "";
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
        } else {
            let pfx = context === 'quoting' ? '' : 'sc';
            document.getElementById(pfx+'custCityInput').value = matchedLocData.city || "";
            document.getElementById(pfx+'custStateInput').value = matchedLocData.state || "";
            document.getElementById(pfx+'custZipInput').value = matchedLocData.zip || "";
            if (document.getElementById(pfx+'contactNameInput') && matchedLocData.contact) document.getElementById(pfx+'contactNameInput').value = matchedLocData.contact;
            if (document.getElementById(pfx+'contactPhoneInput') && matchedLocData.phone) document.getElementById(pfx+'contactPhoneInput').value = matchedLocData.phone;
            if (document.getElementById(pfx+'contactEmailInput') && matchedLocData.email) document.getElementById(pfx+'contactEmailInput').value = matchedLocData.email;
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
        if(context === 'quoting') triggerQuoteAutoSave();
        if(context === 'service') triggerServiceAutoSave();
    });
}

// ==========================================
// PARENT COMPANY & LOCATION MAPPING LOGIC
// ==========================================





async function loadParentCompanies() {
    const select = document.getElementById('parentCompSelect');
    if (typeof firebase === 'undefined' || !firebase.apps.length) return; 
    
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection("ParentCompanies").orderBy("Name").get();
        
        select.innerHTML = '<option value="">Select Parent Company...</option>';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id; 
            option.textContent = data.Name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading parents:", error);
    }
}

async function mapLocationToParent() {
    const parentId = document.getElementById('parentCompSelect').value;
    const subCompany = document.getElementById('subCompName').value.trim().toUpperCase();
    const city = document.getElementById('mapCity').value.trim().toUpperCase();
    const street = document.getElementById('mapStreet').value.trim().toUpperCase();

    if (!parentId || !subCompany || !city || !street) {
        return alert("Please fill out all location fields and select a Parent Company.");
    }

    try {
        const db = firebase.firestore();
        const locId = 'MAP_' + Date.now();

        // SAVING TO THE NEW ISOLATED COLLECTION
        await db.collection("MappedLocations").doc(locId).set({
            Parent_ID: parentId,
            Sub_Company: subCompany,
            City: city,
            Street: street
        });

        alert("Success! This location is now mapped. The tech app will automatically link them.");
        
        document.getElementById('subCompName').value = '';
        document.getElementById('mapCity').value = '';
        document.getElementById('mapStreet').value = '';
    } catch (error) {
        console.error("Error mapping location:", error);
        alert("Failed to save location mapping to Firebase.");
    }
}
