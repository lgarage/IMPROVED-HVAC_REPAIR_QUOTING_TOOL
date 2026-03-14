// ====================================================================
// --- MAP ENGINE & CLOUD DISPATCH BOARD LOGIC ---
// ====================================================================

// 1. Initial Cloud Sync (Pulls active tickets from Firebase on load)
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadServiceCallsFromCloud, 2000); 
});

async function loadServiceCallsFromCloud() {
    try {
        let firestoreDb = firebase.firestore();
        const snapshot = await firestoreDb.collection('service_calls').get();
        let cloudDb = [];
        
        snapshot.forEach(doc => {
            cloudDb.push({ id: doc.id, ...doc.data() });
        });
        
        if (cloudDb.length > 0) {
            localStorage.setItem('twinPillarsServiceDB', JSON.stringify(cloudDb));
            renderServiceBoard();
        }
    } catch (e) {
        console.warn("Cloud Service Call load failed. Using local cache.", e);
    }
}

// 2. Master Sync Function (Pushes local changes to Firebase silently)
async function syncSingleServiceCallToCloud(dbId, data) {
    try {
        let firestoreDb = firebase.firestore();
        if (data === null) {
            await firestoreDb.collection('service_calls').doc(dbId).delete();
        } else {
            await firestoreDb.collection('service_calls').doc(dbId).set(data, { merge: true });
        }
    } catch (e) {
        console.error("Failed to sync service call to cloud:", e);
    }
}

function initMap() {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    dispatchMap = L.map('dispatchMapContainer', { zoomControl: false }).setView([44.5133, -88.0133], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(dispatchMap);

    streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' });

    streetLayer.addTo(dispatchMap); 
    markerLayer = L.layerGroup().addTo(dispatchMap);
}

function setMapType(type) {
    if (type === 'm') { dispatchMap.removeLayer(satLayer); streetLayer.addTo(dispatchMap); } 
    else { dispatchMap.removeLayer(streetLayer); satLayer.addTo(dispatchMap); }
}

async function plotMarkerOnMap(address, sc) {
    if (!address || address.includes("UNKNOWN LOCATION")) return;
    let cache = JSON.parse(localStorage.getItem('tp_geo_cache') || '{}');
    if (cache[address]) { addCustomPin(cache[address], sc); return; }

    try {
        let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
        let data = await res.json();
        if (data && data.length > 0) {
            let coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            cache[address] = coords;
            localStorage.setItem('tp_geo_cache', JSON.stringify(cache));
            addCustomPin(coords, sc);
        } else {
            let fallback = [44.5133 + (Math.random()-0.5)*0.05, -88.0133 + (Math.random()-0.5)*0.05];
            addCustomPin(fallback, sc);
        }
    } catch(e) { console.log("Geocode failed", e); }
}

function addCustomPin(coords, sc) {
    let color = '#3498db'; 
    if(sc.priority === 'Emergency') color = '#e74c3c';
    if(sc.priority === 'Urgent') color = '#f39c12';
    if(sc.priority === 'Routine') color = '#95a5a6';

    const markerHtml = `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.6);"></div>`;
    const customIcon = L.divIcon({ html: markerHtml, className: 'custom-leaflet-marker', iconSize: [22, 22], iconAnchor: [11, 11] });
    let marker = L.marker(coords, {icon: customIcon}).addTo(markerLayer);
    marker.bindPopup(`<strong style="color:#1e4b85;">${sc.customerName}</strong><br>${sc.ticketNum}<br><button class="gen-btn" style="margin-top:8px; padding:4px 8px; font-size:11px; background:#2ecc71; width:100%;" onclick="openTicketDetails('${sc.id}')">View Details</button>`);
}

function centerMapOnTicket(dbId) {
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const sc = db.find(s => s.id === dbId);
    if (!sc) return;
    const fullAddress = `${sc.locationAddress}, ${sc.custCity}, ${sc.custState} ${sc.custZip}`;
    let cache = JSON.parse(localStorage.getItem('tp_geo_cache') || '{}');
    if (cache[fullAddress]) { dispatchMap.flyTo(cache[fullAddress], 16, { animate: true, duration: 1.5 }); }
}

function initDragAndDrop() {
    const requestList = document.getElementById('serviceRequestList');
    requestList.addEventListener('dragstart', e => { if(e.target.classList.contains('glass-card')) e.target.classList.add('dragging'); });
    requestList.addEventListener('dragend', e => { if(e.target.classList.contains('glass-card')) { e.target.classList.remove('dragging'); saveBoardOrder(); }});
    requestList.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(requestList, e.clientY);
        const draggable = document.querySelector('.dragging');
        if(draggable) {
            if (afterElement == null) requestList.appendChild(draggable);
            else requestList.insertBefore(draggable, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.glass-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } 
        else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveBoardOrder() {
    const cards = document.querySelectorAll('#serviceRequestList .glass-card');
    const visualIds = Array.from(cards).map(card => card.getAttribute('data-id'));
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    let newDb = [];
    visualIds.reverse().forEach(id => { let item = db.find(sc => sc.id === id); if(item) newDb.push(item); });
    localStorage.setItem('twinPillarsServiceDB', JSON.stringify(newDb));
    renderScheduleTimelineOnly(); 
}

function renderScheduleTimelineOnly() {
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const timelineContainer = document.getElementById('scheduleTimeline');
    timelineContainer.innerHTML = "";
    let techCounter = 1; 

    [...db].reverse().forEach((sc, index) => {
        if (sc.status !== 'Canceled') {
            let leftOffset = 10 + (index * 15) % 60; 
            let width = 20 + (sc.issue.length % 20); 
            let blockColor = sc.priority === 'Emergency' ? '#e74c3c' : (sc.priority === 'Urgent' ? '#f39c12' : '#3498db');
            let statusLabel = sc.status === 'Unassigned' ? 'Unassigned Block' : sc.ticketNum;
            if (sc.status === 'Unassigned') blockColor = '#bdc3c7'; 
            let techNameDisplay = sc.assignedTech && sc.assignedTech !== 'Unassigned' ? sc.assignedTech.split(' ')[0] : 'Unassigned';

            timelineContainer.innerHTML += `
                <div class="tech-row">
                    <div class="tech-name" title="${sc.assignedTech || 'Unassigned'}">${techNameDisplay}</div>
                    <div class="time-blocks" style="width: 100%; position: relative; margin-left: 90px; height: 100%;">
                        <div class="job-block" style="left: ${leftOffset}%; width: ${width}%; background: ${blockColor}; cursor: pointer;" onclick="openTicketDetails('${sc.id}')" title="${sc.customerName} - ${sc.issue}">
                            ${statusLabel}
                        </div>
                    </div>
                </div>
            `;
            techCounter++;
            if(techCounter > 5) techCounter = 1; 
        }
    });
}

function triggerServiceAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => { saveServiceCall(true); }, 250); 
}

function setNextServiceNumber() {
    let counter = parseInt(localStorage.getItem('tp_service_counter') || '1000');
    document.getElementById('scTicketNumberInput').value = 'SRV-' + counter;
}

function incrementServiceNumber() {
    let counter = parseInt(localStorage.getItem('tp_service_counter') || '1000');
    localStorage.setItem('tp_service_counter', counter + 1);
}

function gatherServiceData() {
    return {
        id: document.getElementById('scCurrentId').value,
        ticketNum: document.getElementById('scTicketNumberInput').value,
        date: document.getElementById('scDateInput').value,
        customerName: document.getElementById('scCustNameInput').value.trim().toUpperCase() || "UNKNOWN CUSTOMER",
        customerNum: document.getElementById('scCustNumInput').value || "N/A",
        contactName: document.getElementById('scContactNameInput').value.trim().toUpperCase(),
        contactPhone: document.getElementById('scContactPhoneInput').value.trim(),
        contactEmail: document.getElementById('scContactEmailInput').value.trim(),
        locationAddress: document.getElementById('scCustStreetInput').value.trim().toUpperCase(),
        custCity: document.getElementById('scCustCityInput').value.trim().toUpperCase(),
        custState: document.getElementById('scCustStateInput').value.trim().toUpperCase(),
        custZip: document.getElementById('scCustZipInput').value.trim().toUpperCase(),
        locationNum: document.getElementById('scLocNumInput').value || "N/A",
        jobType: document.getElementById('scJobTypeInput').value,
        priority: document.getElementById('scPriorityInput').value,
        assignedTech: document.getElementById('scAssignedTechInput').value,
        status: document.getElementById('scStatusInput').value,
        issue: document.getElementById('scIssueInput').value.trim(),
        equip: document.getElementById('scEquipInput').value.trim().toUpperCase(),
        notes: document.getElementById('scNotesInput').value.trim()
    };
}

function clearServiceForm() {
    document.getElementById('scCurrentId').value = "";
    document.getElementById('scCustNameInput').value = "";
    document.getElementById('scCustNumInput').value = "";
    document.getElementById('scContactNameInput').value = "";
    document.getElementById('scContactPhoneInput').value = "";
    document.getElementById('scContactEmailInput').value = "";
    document.getElementById('scCustStreetInput').value = "";
    document.getElementById('scCustCityInput').value = "";
    document.getElementById('scCustStateInput').value = "";
    document.getElementById('scCustZipInput').value = "";
    document.getElementById('scLocNumInput').value = "";
    document.getElementById('scJobTypeInput').value = "Diagnostic / Repair";
    document.getElementById('scPriorityInput').value = "Standard";
    document.getElementById('scAssignedTechInput').value = "Unassigned";
    document.getElementById('scStatusInput').value = "Unassigned";
    document.getElementById('scIssueInput').value = "";
    document.getElementById('scEquipInput').value = "";
    document.getElementById('scNotesInput').value = "";
    
    document.getElementById('scDateInput').valueAsDate = new Date();
    setNextServiceNumber();
    
    // Reset the yellow warning background!
    if(typeof toggleNewCustomerWarning === 'function') toggleNewCustomerWarning(false);
    
    document.getElementById('serviceFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveServiceCall(isAutoSave = false) {
    const data = gatherServiceData();
    
    if (isAutoSave && data.id === "" && data.customerName === "UNKNOWN CUSTOMER") return false;

    if (!isAutoSave) {
        if (data.customerName === "UNKNOWN CUSTOMER" || data.issue === "") {
            alert("A Customer Name and Reported Issue are required to log a service call.");
            return false;
        }
        if(typeof syncCustomerToDirectory === 'function') syncCustomerToDirectory(data);
    } else if (data.id !== "") {
        if(typeof syncCustomerToDirectory === 'function') syncCustomerToDirectory(data); 
    }

    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');

    if (data.id) {
        const index = db.findIndex(sc => sc.id === data.id);
        if (index !== -1) {
            db[index] = data;
            if (!isAutoSave) { showSaveCue("✓ Ticket Updated!"); clearServiceForm(); }
        }
    } else {
        if (!isAutoSave) { 
            data.id = 'SC-ID-' + Date.now(); 
            db.push(data);
            incrementServiceNumber(); 
            showSaveCue(`✓ Ticket Logged! (${data.ticketNum})`);
            clearServiceForm();
        } else { return false; } 
    }

    localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
    syncSingleServiceCallToCloud(data.id, data); 
    renderServiceBoard();
    if (isAutoSave) showSaveCue("✓ Auto-Saved");
    return true;
}

function openTicketDetails(dbId) {
    currentOpenDetailsId = dbId;
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const sc = db.find(s => s.id === dbId);
    if (!sc) return;

    document.getElementById('tdModalTitle').innerText = `Ticket ${sc.ticketNum} - ${sc.customerName}`;
    
    let contactStr = sc.contactName ? `<strong>${sc.contactName}</strong>` : `N/A`;
    if(sc.contactPhone) contactStr += ` | ${sc.contactPhone}`;
    if(sc.contactEmail) contactStr += ` | ${sc.contactEmail}`;

    document.getElementById('tdModalContent').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <span class="badge badge-${sc.status.replace(' ','')}">${sc.status}</span>
            <span class="badge badge-${sc.priority}">Priority: ${sc.priority}</span>
        </div>
        <div style="background: #fcfdfe; padding: 15px; border: 1px solid #eaeaea; border-radius: 4px; margin-bottom: 15px;">
            <p style="margin-top:0; margin-bottom: 5px;"><strong>Assign Technician:</strong></p>
            <select id="tdTechSelect" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">
                <option value="Unassigned" ${sc.assignedTech === 'Unassigned' || !sc.assignedTech ? 'selected' : ''}>Unassigned</option>
                <option value="Dave (Tech 1)" ${sc.assignedTech === 'Dave (Tech 1)' ? 'selected' : ''}>Dave (Tech 1)</option>
                <option value="Sarah (Tech 2)" ${sc.assignedTech === 'Sarah (Tech 2)' ? 'selected' : ''}>Sarah (Tech 2)</option>
                <option value="Mike (Tech 3)" ${sc.assignedTech === 'Mike (Tech 3)' ? 'selected' : ''}>Mike (Tech 3)</option>
                <option value="Tom (Tech 4)" ${sc.assignedTech === 'Tom (Tech 4)' ? 'selected' : ''}>Tom (Tech 4)</option>
            </select>
            <div style="font-size: 11px; color: #777; margin-top: 5px;">*Closing this window automatically saves the assignment.</div>
        </div>
        <p><strong>Location:</strong><br>${sc.locationAddress}<br>${sc.custCity}, ${sc.custState} ${sc.custZip}</p>
        <p><strong>Site Contact:</strong><br>${contactStr}</p>
        <hr style="border:0; border-top:1px solid #eaeaea; margin: 15px 0;">
        <p><strong>Reported Issue:</strong><br><span style="background:#f4f7f6; padding:10px; display:block; border-radius:4px; margin-top:5px;">${sc.issue}</span></p>
        <p><strong>Equipment:</strong> ${sc.equip || 'N/A'}</p>
        <p><strong>Dispatch Notes:</strong> ${sc.notes || 'N/A'}</p>
    `;

    document.getElementById('tdEditBtn').onclick = function() {
        closeTicketDetails();
        loadServiceCall(dbId);
        setTimeout(() => {
            const formEl = document.getElementById('serviceFormContainer');
            formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            formEl.style.boxShadow = "0 0 25px rgba(200, 155, 83, 0.8)";
            setTimeout(() => { formEl.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)"; }, 1200);
        }, 200);
    };

    document.getElementById('ticketDetailsModal').style.display = 'block';
}

function closeTicketDetails() {
    if (currentOpenDetailsId) {
        let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
        let scIndex = db.findIndex(s => s.id === currentOpenDetailsId);
        if (scIndex !== -1) {
            const techSelect = document.getElementById('tdTechSelect');
            if (techSelect) {
                const selectedTech = techSelect.value;
                db[scIndex].assignedTech = selectedTech;
                
                if (selectedTech !== 'Unassigned' && db[scIndex].status === 'Unassigned') {
                    db[scIndex].status = 'Dispatched';
                } else if (selectedTech === 'Unassigned' && db[scIndex].status === 'Dispatched') {
                    db[scIndex].status = 'Unassigned';
                }
            }
            localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
            syncSingleServiceCallToCloud(db[scIndex].id, db[scIndex]);
            renderServiceBoard(); 
        }
    }
    document.getElementById('ticketDetailsModal').style.display = 'none';
    currentOpenDetailsId = null;
}

function renderServiceBoard() {
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const listContainer = document.getElementById('serviceRequestList');
    const timelineContainer = document.getElementById('scheduleTimeline');
    const counter = document.getElementById('ticketCountBadge');
    
    listContainer.innerHTML = "";
    timelineContainer.innerHTML = "";
    counter.innerText = db.length;

    if (db.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #555; font-style: italic; background: rgba(255,255,255,0.7); border-radius: 6px;">No active service calls.</div>`;
        timelineContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #999; font-style: italic;">Schedule clear.</div>`;
        return;
    }

    markerLayer.clearLayers();

    [...db].reverse().forEach((sc, index) => {
        if (sc.status !== 'Canceled' && sc.status !== 'Completed') {
            let fullAddr = `${sc.locationAddress}, ${sc.custCity}, ${sc.custState} ${sc.custZip}`;
            plotMarkerOnMap(fullAddr, sc);
        }

        let locStr = sc.locationAddress;
        if(sc.custCity) locStr += ` | ${sc.custCity}, ${sc.custState}`;
        let issueStr = sc.issue.length > 60 ? sc.issue.substring(0, 60) + "..." : sc.issue;
        
        let titleDisplay = sc.customerName;
        if (sc.contactName && sc.contactName !== "") {
            titleDisplay += ` <span style="font-size:12px; color:#7f8c8d; font-weight:normal;">(${sc.contactName})</span>`;
        }

        let techNameDisplay = sc.assignedTech && sc.assignedTech !== 'Unassigned' ? sc.assignedTech.split(' ')[0] : '';
        let techBadgeHTML = techNameDisplay ? `<span style="color:#1e4b85; font-weight:bold; font-size:12px; margin-left:8px; display:inline-flex; align-items:center;">👨‍🔧 ${techNameDisplay}</span>` : '';

        listContainer.innerHTML += `
            <div class="glass-card priority-${sc.priority}" draggable="true" data-id="${sc.id}" onclick="centerMapOnTicket('${sc.id}')">
                <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                    <div style="flex:1;">
                        <div class="tc-title">
                            <span>${titleDisplay}</span>
                            <span style="color:#555; font-size:12px; margin-left:10px;">${sc.ticketNum}</span>
                        </div>
                        <div class="tc-loc">📍 ${locStr}</div>
                        <div class="tc-issue"><strong>Issue:</strong> ${issueStr}</div>
                        <div class="tc-footer">
                            <div style="display:flex; align-items:center;">
                                <span class="badge badge-${sc.status.replace(' ','')}">${sc.status}</span>
                                ${techBadgeHTML}
                            </div>
                            <div style="display:flex; gap:5px;">
                                <button class="gen-btn" style="background:#2ecc71; padding: 4px 8px; font-size:11px;" onclick="event.stopPropagation(); openTicketDetails('${sc.id}')">Details</button>
                                <button class="gen-btn" style="background:#e74c3c; padding: 4px 8px; font-size:11px;" onclick="event.stopPropagation(); deleteServiceCall('${sc.id}')">Delete</button>
                            </div>
                        </div>
                    </div>
                    <div class="drag-handle" style="color:#aaa; cursor:grab; font-size:20px; padding-left:10px; user-select:none;" title="Drag to reorder">⋮⋮</div>
                </div>
            </div>
        `;
    });
    
    renderScheduleTimelineOnly();
}

function deleteServiceCall(dbId) {
    if(confirm("Permanently delete this service ticket?")) {
        let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
        db = db.filter(s => s.id !== dbId);
        localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
        syncSingleServiceCallToCloud(dbId, null);
        renderServiceBoard();
    }
}

function loadServiceCall(dbId) {
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const data = db.find(s => s.id === dbId);
    if(!data) return;
    
    document.getElementById('scCurrentId').value = data.id;
    document.getElementById('scTicketNumberInput').value = data.ticketNum;
    document.getElementById('scDateInput').value = data.date;
    document.getElementById('scCustNameInput').value = data.customerName;
    document.getElementById('scCustNumInput').value = data.customerNum;
    document.getElementById('scContactNameInput').value = data.contactName;
    document.getElementById('scContactPhoneInput').value = data.contactPhone;
    document.getElementById('scContactEmailInput').value = data.contactEmail;
    document.getElementById('scCustStreetInput').value = data.locationAddress;
    document.getElementById('scCustCityInput').value = data.custCity;
    document.getElementById('scCustStateInput').value = data.custState;
    document.getElementById('scCustZipInput').value = data.custZip;
    document.getElementById('scLocNumInput').value = data.locationNum;
    document.getElementById('scJobTypeInput').value = data.jobType;
    document.getElementById('scPriorityInput').value = data.priority;
    document.getElementById('scAssignedTechInput').value = data.assignedTech;
    document.getElementById('scStatusInput').value = data.status;
    document.getElementById('scIssueInput').value = data.issue;
    document.getElementById('scEquipInput').value = data.equip;
    document.getElementById('scNotesInput').value = data.notes;
}

// ====================================================================
// --- NEW: YELLOW WARNING FOR NEW GOOGLE CUSTOMERS ---
// ====================================================================
function toggleNewCustomerWarning(isNew) {
    const inputIds = ['scCustNameInput', 'scCustStreetInput', 'scCustCityInput', 'scCustStateInput', 'scCustZipInput'];
    
    inputIds.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            if (isNew) {
                el.style.backgroundColor = '#fff9c4'; // Light yellow
                el.style.border = '1px solid #f39c12'; // Orange border
            } else {
                el.style.backgroundColor = ''; // Reset
                el.style.border = ''; // Reset
            }
        }
    });

    let warningEl = document.getElementById('newCustomerWarningNote');
    
    if (isNew) {
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'newCustomerWarningNote';
            warningEl.style.color = '#d35400';
            warningEl.style.backgroundColor = '#fdf2e9';
            warningEl.style.padding = '10px';
            warningEl.style.borderRadius = '4px';
            warningEl.style.fontSize = '12px';
            warningEl.style.fontWeight = 'bold';
            warningEl.style.marginBottom = '15px';
            warningEl.innerHTML = '⚠️ <strong>New Location Detected:</strong> This address is not currently in your CRM. The data below was pulled from Google Maps. Saving this ticket will automatically add this location to your Customer Directory.';
            
            // Insert right after the header
            const section = document.getElementById('scCustNameInput').closest('.form-section');
            if (section) {
                const h4 = section.querySelector('h4');
                if (h4) h4.insertAdjacentElement('afterend', warningEl);
            }
        }
    } else {
        if (warningEl) warningEl.remove();
    }
}

// ====================================================================
// --- DISPATCHER VOICE SEARCH (PUSH-TO-TALK) & SMART CRM SEARCH ---
// ====================================================================

let dispatcherRecognition;
let currentVoiceSearchText = "";
let isDispatcherRecording = false;
let currentSearchResults = []; 

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    dispatcherRecognition = new SpeechRecognition();
    dispatcherRecognition.continuous = true; 
    dispatcherRecognition.interimResults = true; 

    dispatcherRecognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        currentVoiceSearchText = transcript;
        
        const micBtn = document.getElementById('scMicBtn');
        if (isDispatcherRecording && micBtn) {
            micBtn.innerText = "🗣️ " + currentVoiceSearchText;
        }
    };

    dispatcherRecognition.onerror = (event) => {
        console.error('Speech error', event.error);
        resetDispatcherMicBtn();
    };
}

function startDispatcherVoiceSearch() {
    if (!dispatcherRecognition) {
        alert("Voice search not supported in this browser. Please use Chrome or Safari.");
        return;
    }
    if (isDispatcherRecording) return;
    
    isDispatcherRecording = true;
    currentVoiceSearchText = ""; 
    
    const micBtn = document.getElementById('scMicBtn');
    if(micBtn) {
        micBtn.innerText = "🔴 LISTENING... (Speak Now)";
        micBtn.style.backgroundColor = "#e74c3c";
        micBtn.style.transform = "scale(0.95)"; 
    }
    
    window.addEventListener('mouseup', stopDispatcherVoiceSearch);
    try { dispatcherRecognition.start(); } catch(e) {}
}

async function stopDispatcherVoiceSearch() {
    if (!isDispatcherRecording) return;
    isDispatcherRecording = false;
    
    window.removeEventListener('mouseup', stopDispatcherVoiceSearch);
    try { dispatcherRecognition.stop(); } catch(e) {}
    
    const micBtn = document.getElementById('scMicBtn');
    if(micBtn) micBtn.style.transform = "scale(1)"; 
    
    if (currentVoiceSearchText.trim() !== "") {
        if(micBtn) {
            micBtn.innerText = "⏳ Searching CRM & Google...";
            micBtn.style.backgroundColor = "#95a5a6";
        }
        if(typeof showSaveCue === 'function') showSaveCue("🎤 Heard: " + currentVoiceSearchText);
        
        await processDispatcherVoiceSearch(currentVoiceSearchText);
    } else {
        resetDispatcherMicBtn();
    }
}

function resetDispatcherMicBtn() {
    const micBtn = document.getElementById('scMicBtn');
    if(micBtn) {
        micBtn.innerText = "🎤 HOLD TO SPEAK";
        micBtn.style.backgroundColor = "#f39c12";
    }
}

async function processDispatcherVoiceSearch(query) {
    const q = query.trim().toUpperCase();
    let db = typeof getCustomerDB === 'function' ? getCustomerDB() : {};
    let internalMatches = [];

    // 1. SEARCH INTERNAL CRM FIRST
    for (let custName in db) {
        let cust = db[custName];
        if (cust.locations) {
            for (let locId in cust.locations) {
                let loc = cust.locations[locId];
                let contactName = (loc.contact || "").toUpperCase();
                let streetAddr = (loc.street || "").toUpperCase();

                if (custName.includes(q) || contactName.includes(q) || streetAddr.includes(q)) {
                    internalMatches.push({
                        source: 'internal',
                        custName: custName,
                        custId: cust.id,
                        locId: locId,
                        contact: loc.contact || "",
                        phone: loc.phone || "",
                        email: loc.email || "",
                        street: loc.street || "",
                        city: loc.city || "",
                        state: loc.state || "",
                        zip: loc.zip || ""
                    });
                }
            }
        }
    }

    // 2. PROCESS INTERNAL MATCHES
    if (internalMatches.length === 1) {
        applySearchResultToForm(internalMatches[0]);
        return; 
    } 
    else if (internalMatches.length > 1) {
        currentSearchResults = internalMatches;
        showSearchResultsModal("Internal Database Matches", "We found multiple locations in your CRM for this search. Please select the correct one:");
        return; 
    }

    // 3. NO INTERNAL MATCHES? FALLBACK TO GOOGLE MAPS
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        alert("No internal matches found, and Google Maps API is unavailable.");
        resetDispatcherMicBtn();
        return;
    }
    
    const dummyDiv = document.createElement('div');
    const service = new google.maps.places.PlacesService(dummyDiv);
    
    service.textSearch({ query: query }, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            
            let formattedGoogleResults = results.map(place => {
                const name = place.name.toUpperCase();
                const addressStr = place.formatted_address.toUpperCase(); 
                let addrParts = addressStr.split(',').map(p => p.trim());
                if (addrParts[addrParts.length - 1] === "USA") addrParts.pop(); 
                
                let city = ""; let state = ""; let zip = ""; let street = "";
                if (addrParts.length >= 3) {
                    const stateZip = addrParts[addrParts.length - 1].split(' ');
                    city = addrParts[addrParts.length - 2];
                    street = addrParts.slice(0, addrParts.length - 2).join(', ');
                    if(stateZip.length >= 1) state = stateZip[0];
                    if(stateZip.length >= 2) zip = stateZip[1];
                } else { street = addressStr; }

                return {
                    source: 'google', custName: name, street: street, city: city, state: state, zip: zip,
                    custId: "", locId: "", contact: "", phone: "", email: "", rawAddress: addressStr
                };
            });

            if (formattedGoogleResults.length === 1) {
                applySearchResultToForm(formattedGoogleResults[0]);
            } else {
                currentSearchResults = formattedGoogleResults;
                showSearchResultsModal("Google Maps Results", "This customer isn't in your CRM yet. Google found a few matches. Select one to add them to your system:");
            }
        } else {
            alert("No internal matches found, and Google Maps couldn't find a match for: " + query);
            resetDispatcherMicBtn();
        }
    });
}

function showSearchResultsModal(titleText, subtitleText) {
    const modal = document.getElementById('googleResultsModal');
    const listContainer = document.getElementById('googleResultsList');
    
    if(modal) {
        modal.querySelector('h2').innerText = titleText;
        modal.querySelector('p').innerText = subtitleText;
        
        listContainer.innerHTML = ""; 
        
        currentSearchResults.forEach((result, index) => {
            let displayHtml = "";
            
            if (result.source === 'internal') {
                displayHtml = `
                    <div style="padding: 15px; border-bottom: 1px solid #eaeaea; cursor: pointer; transition: background 0.2s; border-left: 4px solid #2ecc71;" 
                         onmouseover="this.style.background='#f4f7f6'" onmouseout="this.style.background='#fff'" onclick="selectSearchResult(${index})">
                        <strong style="color: #1e4b85; font-size: 16px;">${result.custName}</strong>
                        <span style="color:#e74c3c; font-size:12px; font-weight:bold; margin-left:10px;">👤 Contact: ${result.contact || "None"}</span><br>
                        <span style="color: #555; font-size: 13px;">📍 ${result.street}, ${result.city}, ${result.state} ${result.zip}</span><br>
                        <span style="color: #999; font-size: 11px;">Cust #: ${result.custId} | Loc #: ${result.locId}</span>
                    </div>
                `;
            } else {
                displayHtml = `
                    <div style="padding: 15px; border-bottom: 1px solid #eaeaea; cursor: pointer; transition: background 0.2s; border-left: 4px solid #f39c12;" 
                         onmouseover="this.style.background='#f4f7f6'" onmouseout="this.style.background='#fff'" onclick="selectSearchResult(${index})">
                        <strong style="color: #1e4b85; font-size: 16px;">${result.custName}</strong> <span style="font-size:11px; color:#f39c12; font-weight:bold;">(New from Google)</span><br>
                        <span style="color: #555; font-size: 13px;">📍 ${result.rawAddress}</span>
                    </div>
                `;
            }
            listContainer.innerHTML += displayHtml;
        });
        
        modal.style.display = 'block';
        if(typeof showSaveCue === 'function') showSaveCue("⚠️ Multiple matches found");
    }
}

function selectSearchResult(index) {
    const selectedResult = currentSearchResults[index];
    const modal = document.getElementById('googleResultsModal');
    if(modal) modal.style.display = 'none'; 
    applySearchResultToForm(selectedResult); 
}

function applySearchResultToForm(data) {
    document.getElementById('scCustNameInput').value = data.custName;
    document.getElementById('scCustStreetInput').value = data.street;
    document.getElementById('scCustCityInput').value = data.city;
    document.getElementById('scCustStateInput').value = data.state;
    document.getElementById('scCustZipInput').value = data.zip;
    
    if (data.source === 'internal') {
        document.getElementById('scCustNumInput').value = data.custId;
        document.getElementById('scLocNumInput').value = data.locId;
        document.getElementById('scContactNameInput').value = data.contact;
        document.getElementById('scContactPhoneInput').value = data.phone;
        document.getElementById('scContactEmailInput').value = data.email;
        
        // Turn OFF yellow warning for existing CRM customers
        toggleNewCustomerWarning(false);
    } else {
        document.getElementById('scContactNameInput').value = "";
        document.getElementById('scContactPhoneInput').value = "";
        document.getElementById('scContactEmailInput').value = "";
        if(typeof checkCustomerAutoNumber === 'function') checkCustomerAutoNumber('service');
        if(typeof checkLocationAutoNumber === 'function') checkLocationAutoNumber('service');
        
        // Turn ON yellow warning for brand new Google Map customers
        toggleNewCustomerWarning(true);
    }

    if(typeof updateLocationDatalist === 'function') updateLocationDatalist();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Form Populated: " + data.custName);
    resetDispatcherMicBtn();
}
