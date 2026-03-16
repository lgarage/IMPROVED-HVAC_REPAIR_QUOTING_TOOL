// ====================================================================
// --- MAP ENGINE & CLOUD DISPATCH BOARD LOGIC ---
// ====================================================================

// --- SIDEBAR TOGGLE ---
function toggleSidebar() {
    document.getElementById('appSidebar').classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('expanded');
    setTimeout(() => { if(dispatchMap) dispatchMap.invalidateSize(); }, 300); // Redraw map to fit new space
}

function getPrefixForJobType(type) {
    if (type === "Quoted Repair") return "QR-";
    if (type === "Install") return "IS-";
    if (type === "Preventative Maintenance") return "PM-";
    if (type === "Warranty Call") return "WC-";
    return "SC-"; // Default
}

// --- DYNAMIC TICKET PREFIX LOGIC ---
function updateTicketPrefix() {
    if(document.getElementById('scCurrentId').value !== "") {
        let type = document.getElementById('scJobTypeInput').value;
        let prefix = getPrefixForJobType(type);
        let currentTicket = document.getElementById('scTicketNumberInput').value;
        
        let numberPart = currentTicket.split('-')[1];
        if(numberPart) document.getElementById('scTicketNumberInput').value = prefix + numberPart;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // FIX: Removed the 2000ms delay so Firebase loads instantly!
    loadServiceCallsFromCloud(); 
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

function triggerServiceAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => { saveServiceCall(true); }, 250); 
}

function gatherServiceData() {
    return {
        id: document.getElementById('scCurrentId').value,
        ticketNum: document.getElementById('scTicketNumberInput').value,
        tracking: document.getElementById('scTrackingInput').value.trim(),
        date: document.getElementById('scDateInput').value,
        startTime: document.getElementById('scStartTimeInput').value,
        duration: document.getElementById('scDurationInput').value,
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
    // Reset UI to "New Ticket" Mode
    document.getElementById('serviceFormTitle').innerText = "Log New Service Call";
    document.getElementById('serviceFormTitle').style.color = "#1e4b85";
    document.getElementById('serviceFormBadge').style.display = "none";
    document.getElementById('scClearBtn').style.display = "block";

    document.getElementById('scCurrentId').value = "";
    document.getElementById('scTicketNumberInput').value = ""; 
    document.getElementById('scTrackingInput').value = ""; 
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
    document.getElementById('scJobTypeInput').value = "Service Call";
    document.getElementById('scPriorityInput').value = "Standard";
    document.getElementById('scAssignedTechInput').value = "Unassigned";
    document.getElementById('scStatusInput').value = "Unassigned";
    document.getElementById('scIssueInput').value = "";
    document.getElementById('scEquipInput').value = "";
    document.getElementById('scNotesInput').value = "";
    
    document.getElementById('scDateInput').valueAsDate = new Date();
    document.getElementById('scStartTimeInput').value = "08:00"; 
    document.getElementById('scDurationInput').value = "2.0";    
    
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
        // EDITING EXISTING
        const index = db.findIndex(sc => sc.id === data.id);
        if (index !== -1) {
            db[index] = data;
            if (!isAutoSave) { showSaveCue("✓ Ticket Updated!"); clearServiceForm(); }
        }
    } else {
        // CREATING NEW
        if (!isAutoSave) { 
            data.id = 'SC-ID-' + Date.now(); 
            
            // GENERATE NUMBER
            let counter = parseInt(localStorage.getItem('tp_service_counter') || '1000');
            let prefix = getPrefixForJobType(data.jobType);
            data.ticketNum = prefix + counter;
            localStorage.setItem('tp_service_counter', counter + 1); 
            
            db.push(data);
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
    
    let contactStr = sc.contactName ? `${sc.contactName}` : `N/A`;
    if(sc.contactPhone) contactStr += `<br>${sc.contactPhone}`;
    if(sc.contactEmail) contactStr += `<br>${sc.contactEmail}`;
    
    let trackingStr = sc.tracking ? `<span style="color:#e74c3c; font-weight:bold; font-size:12px; margin-left:10px;">PO / Tracking: ${sc.tracking}</span>` : "";

    document.getElementById('tdModalContent').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <div style="display:flex; align-items:center;">
                <span class="badge badge-${sc.status.replace(' ','')}">${sc.status}</span>
                ${trackingStr}
            </div>
            <span class="badge badge-${sc.priority}">Priority: ${sc.priority}</span>
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <button class="gen-btn" style="background:#8e44ad; flex:1; padding:10px;" onclick="convertToQuote('${sc.id}')"><i class="fas fa-comment-dollar"></i> Create Quote</button>
            <button class="gen-btn" style="background:#3498db; flex:1; padding:10px;" onclick="convertToInvoice('${sc.id}')"><i class="fas fa-file-invoice"></i> Generate Invoice</button>
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
        
        <div style="display: flex; gap: 20px; margin-bottom: 15px;">
            <div style="flex: 1;">
                <p style="margin-top:0; margin-bottom:5px;"><strong>Customer ID:</strong> ${sc.customerNum || 'N/A'}</p>
                <p style="margin-top:5px;"><strong>Site Contact:</strong><br>${contactStr}</p>
            </div>
            <div style="flex: 1;">
                <p style="margin-top:0; margin-bottom:5px;"><strong>Location ID:</strong> ${sc.locationNum || 'N/A'}</p>
                <p style="margin-top:5px;"><strong>Location Address:</strong><br>${sc.locationAddress}<br>${sc.custCity}, ${sc.custState} ${sc.custZip}</p>
            </div>
        </div>
        
        <hr style="border:0; border-top:1px solid #eaeaea; margin: 15px 0;">
        <p><strong>Reported Issue:</strong><br><span style="background:#f4f7f6; padding:10px; display:block; border-radius:4px; margin-top:5px; white-space: pre-wrap;">${sc.issue}</span></p>
        <p><strong>Equipment:</strong> ${sc.equip || 'N/A'}</p>
        <p><strong>Dispatch Notes:</strong> ${sc.notes || 'N/A'}</p>
    `;

    document.getElementById('tdEditBtn').onclick = function() {
        closeTicketDetails();
        loadServiceCall(dbId);
        
        // robust scroll to fix the issue where it doesn't jump down
        setTimeout(() => {
            const formEl = document.getElementById('serviceFormContainer');
            if (formEl) {
                formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                formEl.style.transition = "box-shadow 0.4s ease";
                formEl.style.boxShadow = "0 0 25px rgba(200, 155, 83, 0.8)";
                setTimeout(() => { formEl.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)"; }, 1500);
            }
        }, 150);
    };

    document.getElementById('tdDeleteBtn').onclick = function() {
        if(confirm("Are you sure you want to permanently delete this ticket?")) {
            if(typeof deleteServiceCall === 'function') {
                deleteServiceCall(dbId);
            } else {
                let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
                db = db.filter(s => s.id !== dbId);
                localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
                if(typeof syncSingleServiceCallToCloud === 'function') syncSingleServiceCallToCloud(dbId, null);
                renderServiceBoard();
            }
            closeTicketDetails();
            if(typeof showSaveCue === 'function') showSaveCue("Ticket Deleted");
        }
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

function loadServiceCall(dbId) {
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const data = db.find(s => s.id === dbId);
    if(!data) return;
    
    // Set UI to "Edit Ticket" Mode
    document.getElementById('serviceFormTitle').innerText = "Edit Existing Service Ticket";
    document.getElementById('serviceFormTitle').style.color = "#e74c3c";
    
    const badge = document.getElementById('serviceFormBadge');
    badge.innerText = data.ticketNum;
    badge.style.display = "inline-block";
    
    document.getElementById('scClearBtn').style.display = "none";

    document.getElementById('scCurrentId').value = data.id;
    document.getElementById('scTicketNumberInput').value = data.ticketNum;
    document.getElementById('scTrackingInput').value = data.tracking || ""; 
    document.getElementById('scDateInput').value = data.date;
    document.getElementById('scStartTimeInput').value = data.startTime || "08:00";
    document.getElementById('scDurationInput').value = data.duration || "2.0"; 
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

function renderServiceBoard() {
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const listContainer = document.getElementById('serviceRequestList');
    const counter = document.getElementById('ticketCountBadge');
    
    listContainer.innerHTML = "";
    counter.innerText = db.length;

    if (db.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #555; font-style: italic; border-radius: 6px;">No active service calls.</div>`;
    }

    markerLayer.clearLayers();

    [...db].reverse().forEach((sc) => {
        if (sc.status !== 'Canceled' && sc.status !== 'Completed') {
            let fullAddr = `${sc.locationAddress}, ${sc.custCity}, ${sc.custState} ${sc.custZip}`;
            plotMarkerOnMap(fullAddr, sc);
        }

        let locStr = sc.locationAddress;
        if(sc.custCity) locStr += ` | ${sc.custCity}, ${sc.custState}`;
        
        let titleDisplay = sc.customerName;
        if (sc.contactName && sc.contactName !== "") {
            titleDisplay += ` <span style="font-size:11px; color:#7f8c8d; font-weight:normal;">(${sc.contactName})</span>`;
        }

        let techNameDisplay = sc.assignedTech && sc.assignedTech !== 'Unassigned' ? sc.assignedTech.split(' ')[0] : '';
        let techBadgeHTML = techNameDisplay ? `<span style="color:#1e4b85; font-weight:bold; font-size:11px; margin-left:8px; display:inline-flex; align-items:center;">👨‍🔧 ${techNameDisplay}</span>` : '';
        let trackingDisplay = sc.tracking ? `<div style="font-size:11px; color:#c0392b; font-weight:bold; margin-bottom:2px;">PO: ${sc.tracking}</div>` : '';

        // DENSE RAZORSYNC CARD (No buttons, Double click to open details)
        listContainer.innerHTML += `
            <div class="glass-card priority-${sc.priority}" draggable="true" data-id="${sc.id}" onclick="centerMapOnTicket('${sc.id}')" ondblclick="openTicketDetails('${sc.id}')" title="Double-click for details">
                <div style="display:flex; justify-content:space-between; align-items: center;">
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 2px;">
                            <strong style="color: #333; font-size: 13px; text-transform: uppercase;">${titleDisplay}</strong>
                            <span style="color:#777; font-size:11px;">${sc.ticketNum}</span>
                        </div>
                        ${trackingDisplay}
                        <div style="color: #666; font-size: 11px; margin-bottom: 6px; text-transform: uppercase;">📍 ${locStr}</div>
                        <div style="display:flex; align-items:center;">

                            <select class="status-quick-select status-${sc.status.replace(/ /g, '')}" 
                                    onchange="quickUpdateStatus(event, '${sc.id}', this.value)" 
                                    onclick="event.stopPropagation()">
                                <option value="Unassigned" ${sc.status === 'Unassigned' ? 'selected' : ''}>Unassigned</option>
                                <option value="Dispatched" ${sc.status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                                <option value="Needs Repair Quote" ${sc.status === 'Needs Repair Quote' ? 'selected' : ''}>Needs Quote</option>
                                <option value="Parts on Order" ${sc.status === 'Parts on Order' ? 'selected' : ''}>Parts Ordered</option>
                                <option value="Completed" ${sc.status === 'Completed' ? 'selected' : ''}>Completed</option>
                                <option value="Canceled" ${sc.status === 'Canceled' ? 'selected' : ''}>Canceled</option>
                            </select>
                            
                            ${techBadgeHTML}
                        </div>
                    </div>
                    <div class="drag-handle" style="color:#ddd; cursor:grab; font-size:18px; padding-left:10px; user-select:none;">⋮⋮</div>
                </div>
            </div>
        `;
    });
    
    if(typeof initBoardDate === 'function' && !activeBoardDate) {
        initBoardDate();
    } else {
        renderScheduleTimelineOnly();
    }
}

// ====================================================================
// --- DISPATCH BOARD DATE CONTROLS ---
// ====================================================================

let activeBoardDate = new Date().toISOString().split('T')[0];

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(initBoardDate, 500); 
});

function initBoardDate() {
    setBoardDate('today');
}

function setBoardDate(val) {
    if (val === 'today') {
        activeBoardDate = new Date().toISOString().split('T')[0];
    } else {
        activeBoardDate = val;
    }
    
    let dateInput = document.getElementById('boardDateSelector');
    if (dateInput) dateInput.value = activeBoardDate;
    
    const dateObj = new Date(activeBoardDate + 'T12:00:00'); 
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let banner = document.getElementById('boardDayOfWeek');
    if (banner) banner.innerText = dateObj.toLocaleDateString('en-US', options).toUpperCase();
    
    renderScheduleTimelineOnly();
}

function changeBoardDate(daysToAdd) {
    let d = new Date(activeBoardDate + 'T12:00:00');
    d.setDate(d.getDate() + daysToAdd);
    setBoardDate(d.toISOString().split('T')[0]);
}

function switchBoardView(view) {
    if (view !== 'day') {
        alert(view.charAt(0).toUpperCase() + view.slice(1) + " view is highly complex and currently in development. Sticking to Day view for now.");
        return;
    }
    document.querySelectorAll('.view-toggle').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btnViewDay').classList.add('active');
}

// ====================================================================
// --- GANTT CHART ENGINE (BUILDOPS STYLE WITH DRAG & RESIZE) ---
// ====================================================================

function renderScheduleTimelineOnly() {
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const timelineContainer = document.getElementById('scheduleTimeline');
    if (!timelineContainer) return;
    
    timelineContainer.innerHTML = "";

    const technicians = [
        { name: "Dave", id: "Dave (Tech 1)", status: "Active", color: "#2980b9" },
        { name: "Sarah", id: "Sarah (Tech 2)", status: "Active", color: "#8e44ad" },
        { name: "Mike", id: "Mike (Tech 3)", status: "Active", color: "#d35400" },
        { name: "Tom", id: "Tom (Tech 4)", status: "Active", color: "#16a085" }
    ];

    const startHour = 7; 
    const totalHours = 10;

    technicians.forEach(tech => {
      const techJobs = db.filter(sc => 
        sc.assignedTech === tech.id && 
        sc.status !== 'Canceled' && 
        sc.status !== 'Completed' &&
        sc.date === activeBoardDate // DATE FILTER
      );

        let rowHtml = `
            <div class="gantt-row">
                <div class="gantt-tech-cell">
                    <div class="tech-avatar" style="background:${tech.color};">${tech.name.charAt(0)}</div>
                    <div class="tech-info">
                        <div class="tech-name">${tech.name}</div>
                        <div class="tech-status">${tech.status}</div>
                    </div>
                </div>
                <div class="gantt-timeline" data-tech="${tech.id}" 
                     ondragover="event.preventDefault(); this.style.background='rgba(52, 152, 219, 0.1)';" 
                     ondragleave="this.style.background='';" 
                     ondrop="handleTimelineDrop(event); this.style.background='';">
        `;

        techJobs.forEach((sc) => {
            let timeStr = sc.startTime || "08:00"; 
            let durationHrs = parseFloat(sc.duration) || 2.0;

            let timeParts = timeStr.split(':');
            let jobStartDecimal = parseInt(timeParts[0]) + (parseInt(timeParts[1]) / 60);

            let leftPercent = Math.max(0, ((jobStartDecimal - startHour) / totalHours) * 100);
            let widthPercent = (durationHrs / totalHours) * 100;

            let blockColor = '#3498db'; 
            if (sc.priority === 'Emergency') blockColor = '#e74c3c';
            if (sc.priority === 'Urgent') blockColor = '#f39c12';
            if (sc.priority === 'Routine') blockColor = '#95a5a6';
            
            let shortName = sc.customerName.length > 15 ? sc.customerName.substring(0, 15) + "..." : sc.customerName;

            rowHtml += `
                <div class="gantt-job-block" style="left: ${leftPercent}%; width: ${widthPercent}%; background: ${blockColor};" 
                     data-id="${sc.id}" onmousedown="startTimelineDrag(event, '${sc.id}')" ondblclick="openTicketDetails('${sc.id}')" title="Double-click to view details">
                    <div class="resize-handle resize-left" onmousedown="startTimelineResize(event, '${sc.id}', 'left')"></div>
                    <div class="gantt-job-title">${shortName}</div>
                    <div class="gantt-job-sub">${sc.ticketNum} | ${timeStr}</div>
                    <div class="resize-handle resize-right" onmousedown="startTimelineResize(event, '${sc.id}', 'right')"></div>
                </div>
            `;
        });

        rowHtml += `</div></div>`;
        timelineContainer.innerHTML += rowHtml;
    });

    updateCurrentTimeLine();
}

function updateCurrentTimeLine() {
    const timelineContainer = document.getElementById('scheduleTimeline');
    if (!timelineContainer) return;

    const now = new Date();
    
    // ONLY show the red line if viewing TODAY
    if (activeBoardDate !== now.toISOString().split('T')[0]) {
        let line = document.getElementById('currentTimeLine');
        if(line) line.style.display = 'none';
        return;
    }

    const startHour = 7;
    const totalHours = 10;

    let currentHour = now.getHours() + (now.getMinutes() / 60);
    let leftPercent = ((currentHour - startHour) / totalHours) * 100;

    if (leftPercent >= 0 && leftPercent <= 100) {
        let timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        timelineContainer.innerHTML += `
            <div id="currentTimeLine" style="left: ${leftPercent}%;">
                <div class="time-badge">${timeString}</div>
            </div>
        `;
    }
}

function handleTimelineDrop(e) {
    e.preventDefault();
    
    // Find the card we are actively dragging
    const draggedCard = document.querySelector('.glass-card.dragging');
    if (!draggedCard) return; 

    const ticketId = draggedCard.getAttribute('data-id');
    const timeline = e.currentTarget;
    const techId = timeline.getAttribute('data-tech');

    // Calculate exactly what time we dropped the card on (7AM to 5PM)
    const rect = timeline.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentX = offsetX / rect.width;

    const startHour = 7;
    const totalHours = 10;
    let dropTimeDecimal = startHour + (percentX * totalHours);

    // Snap to the nearest 15 minutes (0.25)
    dropTimeDecimal = Math.round(dropTimeDecimal * 4) / 4;
    
    // Keep it within standard bounds
    if(dropTimeDecimal < 7) dropTimeDecimal = 7;
    if(dropTimeDecimal > 16.5) dropTimeDecimal = 16.5;

    // Convert decimal (e.g. 8.5) back to Time String (08:30)
    let h = Math.floor(dropTimeDecimal);
    let m = Math.round((dropTimeDecimal - h) * 60);
    let timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    // Update the Database!
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    let index = db.findIndex(sc => sc.id === ticketId);
    
    if (index !== -1) {
        db[index].assignedTech = techId;
        db[index].startTime = timeStr;
        
        // Auto-change status if it was unassigned
        if (db[index].status === 'Unassigned') {
            db[index].status = 'Dispatched';
        }
        
        // Save and re-render
        localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
        if(typeof syncSingleServiceCallToCloud === 'function') {
            syncSingleServiceCallToCloud(ticketId, db[index]);
        }
        
        renderServiceBoard(); 
        
        // Grab the tech's first name for the success message
        let shortTechName = techId.split(' ')[0];
        if(typeof showSaveCue === 'function') showSaveCue(`✓ Dispatched to ${shortTechName} at ${timeStr}`);
    }
}

// DRAG AND RESIZE LOGIC
let tlState = {
    action: null, 
    el: null,
    id: null,
    startX: 0,
    startLeft: 0,
    startWidth: 0,
    containerWidth: 0
};

function startTimelineDrag(e, id) {
    if(e.target.classList.contains('resize-handle')) return; 
    e.preventDefault();
    tlState.action = 'drag';
    tlState.id = id;
    tlState.el = e.currentTarget;
    initTimelineAction(e);
}

function startTimelineResize(e, id, side) {
    e.preventDefault();
    e.stopPropagation(); 
    tlState.action = side === 'left' ? 'resize-left' : 'resize-right';
    tlState.id = id;
    tlState.el = e.currentTarget.parentElement;
    initTimelineAction(e);
}

function initTimelineAction(e) {
    tlState.startX = e.clientX;
    tlState.startLeft = parseFloat(tlState.el.style.left) || 0;
    tlState.startWidth = parseFloat(tlState.el.style.width) || 0;
    tlState.containerWidth = tlState.el.parentElement.getBoundingClientRect().width;
    
    window.addEventListener('mousemove', timelineMouseMove);
    window.addEventListener('mouseup', timelineMouseUp);
}

function timelineMouseMove(e) {
    if(!tlState.action) return;
    let deltaX = e.clientX - tlState.startX;
    let deltaPercent = (deltaX / tlState.containerWidth) * 100;

    if (tlState.action === 'drag') {
        let newLeft = tlState.startLeft + deltaPercent;
        if (newLeft < 0) newLeft = 0; 
        if (newLeft + tlState.startWidth > 100) newLeft = 100 - tlState.startWidth; 
        tlState.el.style.left = newLeft + '%';
        
    } else if (tlState.action === 'resize-right') {
        let newWidth = tlState.startWidth + deltaPercent;
        if (newWidth < 2.5) newWidth = 2.5; 
        if (tlState.startLeft + newWidth > 100) newWidth = 100 - tlState.startLeft;
        tlState.el.style.width = newWidth + '%';
        
    } else if (tlState.action === 'resize-left') {
        let newLeft = tlState.startLeft + deltaPercent;
        let newWidth = tlState.startWidth - deltaPercent;
        
        if (newWidth < 2.5) { 
            newLeft = tlState.startLeft + tlState.startWidth - 2.5;
            newWidth = 2.5;
        }
        if (newLeft < 0) { 
            newLeft = 0;
            newWidth = tlState.startLeft + tlState.startWidth;
        }
        tlState.el.style.left = newLeft + '%';
        tlState.el.style.width = newWidth + '%';
    }
}

function timelineMouseUp(e) {
    window.removeEventListener('mousemove', timelineMouseMove);
    window.removeEventListener('mouseup', timelineMouseUp);
    
    if(!tlState.action) return;

    let finalLeft = parseFloat(tlState.el.style.left);
    let finalWidth = parseFloat(tlState.el.style.width);

    if (finalLeft === tlState.startLeft && finalWidth === tlState.startWidth) {
        tlState.action = null;
        return; 
    }

    const startHour = 7;
    const totalHours = 10;
    
    let newStartDecimal = startHour + (finalLeft / 100 * totalHours);
    let newDuration = (finalWidth / 100 * totalHours);

    newStartDecimal = Math.round(newStartDecimal * 4) / 4;
    newDuration = Math.round(newDuration * 4) / 4;

    let h = Math.floor(newStartDecimal);
    let m = Math.round((newStartDecimal - h) * 60);
    let timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    let index = db.findIndex(sc => sc.id === tlState.id);
    if(index !== -1) {
        db[index].startTime = timeStr;
        db[index].duration = newDuration.toString();
        
        localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
        if(typeof syncSingleServiceCallToCloud === 'function') {
            syncSingleServiceCallToCloud(db[index].id, db[index]);
        }
    }

    tlState.action = null;
    renderScheduleTimelineOnly(); 
    if(typeof showSaveCue === 'function') showSaveCue("✓ Schedule Updated");
}

// ====================================================================
// --- NEW CUSTOMER WARNING ---
// ====================================================================
function toggleNewCustomerWarning(isNew) {
    const inputIds = ['scCustNameInput', 'scCustStreetInput', 'scCustCityInput', 'scCustStateInput', 'scCustZipInput', 'scCustNumInput', 'scLocNumInput'];
    
    inputIds.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            if (isNew) {
                el.style.backgroundColor = '#fff9c4'; 
                el.style.border = '1px solid #f39c12'; 
            } else {
                if (id === 'scCustNumInput' || id === 'scLocNumInput') {
                    el.style.backgroundColor = '#f2f4f6';
                    el.style.border = '1px solid #ccc';
                } else {
                    el.style.backgroundColor = ''; 
                    el.style.border = ''; 
                }
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
// --- DISPATCHER VOICE SEARCH & AI NOTES ---
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

    for (let custName in db) {
        let cust = db[custName];
        if (cust.locations) {
            for (let locId in cust.locations) {
                let loc = cust.locations[locId];
                let contactName = (loc.contact || "").toUpperCase();
                let streetAddr = (loc.street || "").toUpperCase();

                if (custName.includes(q) || contactName.includes(q) || streetAddr.includes(q)) {
                    internalMatches.push({
                        source: 'internal', custName: custName, custId: cust.id, locId: locId,
                        contact: loc.contact || "", phone: loc.phone || "", email: loc.email || "",
                        street: loc.street || "", city: loc.city || "", state: loc.state || "", zip: loc.zip || ""
                    });
                }
            }
        }
    }

    if (internalMatches.length === 1) {
        applySearchResultToForm(internalMatches[0]);
        return; 
    } 
    else if (internalMatches.length > 1) {
        currentSearchResults = internalMatches;
        showSearchResultsModal("Internal Database Matches", "We found multiple locations in your CRM for this search. Please select the correct one:");
        return; 
    }

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
        document.getElementById('scContactPhoneInput').value = data.contact;
        document.getElementById('scContactEmailInput').value = data.email;
        toggleNewCustomerWarning(false);
    } else {
        document.getElementById('scContactNameInput').value = "";
        document.getElementById('scContactPhoneInput').value = "";
        document.getElementById('scContactEmailInput').value = "";
        if(typeof checkCustomerAutoNumber === 'function') checkCustomerAutoNumber('service');
        if(typeof checkLocationAutoNumber === 'function') checkLocationAutoNumber('service');
        
        let nextCust = parseInt(localStorage.getItem('tp_cust_counter') || '1000');
        let nextLoc = parseInt(localStorage.getItem('tp_loc_counter') || '1000');
        
        let custInput = document.getElementById('scCustNumInput');
        if(!custInput.value || custInput.value.includes("AUTO")) { custInput.value = "CST-" + nextCust; }
        
        let locInput = document.getElementById('scLocNumInput');
        if(!locInput.value || locInput.value.includes("AUTO")) { locInput.value = "LOC-" + nextLoc; }
        
        toggleNewCustomerWarning(true);
    }

    if(typeof updateLocationDatalist === 'function') updateLocationDatalist();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Form Populated: " + data.custName);
    resetDispatcherMicBtn();
}

let issueRecognition;
let currentIssueVoiceText = "";
let isIssueRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    issueRecognition = new SpeechRecognition();
    issueRecognition.continuous = true; 
    issueRecognition.interimResults = true; 

    issueRecognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
            if (event.results[i].isFinal) transcript += " ";
        }
        
        if (transcript.trim() !== "") {
            currentIssueVoiceText = transcript;
            const micBtn = document.getElementById('scIssueMicBtn');
            if (isIssueRecording && micBtn) { micBtn.innerText = "🗣️ Listening..."; }
        }
    };

    issueRecognition.onend = () => {
        if (isIssueRecording) { try { issueRecognition.start(); } catch(e) {} }
    };

    issueRecognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
            console.error('Speech error', event.error);
            resetIssueMicBtn();
        }
    };
}

function startIssueVoiceInput() {
    if (!issueRecognition) { alert("Voice input not supported."); return; }
    if (isIssueRecording) return;
    
    isIssueRecording = true;
    currentIssueVoiceText = ""; 
    
    const micBtn = document.getElementById('scIssueMicBtn');
    if(micBtn) {
        micBtn.innerText = "🔴 LISTENING... (Speak Now)";
        micBtn.style.backgroundColor = "#e74c3c";
        micBtn.style.transform = "scale(0.95)"; 
    }
    
    window.addEventListener('mouseup', stopIssueVoiceInput);
    try { issueRecognition.start(); } catch(e) {}
}

async function stopIssueVoiceInput() {
    if (!isIssueRecording) return;
    isIssueRecording = false; 
    
    window.removeEventListener('mouseup', stopIssueVoiceInput);
    try { issueRecognition.stop(); } catch(e) {}
    
    const micBtn = document.getElementById('scIssueMicBtn');
    if(micBtn) micBtn.style.transform = "scale(1)"; 
    
    if (currentIssueVoiceText.trim() !== "") {
        if(micBtn) {
            micBtn.innerText = "✨ Processing...";
            micBtn.style.backgroundColor = "#9b59b6"; 
        }
        await cleanIssueWithAI(currentIssueVoiceText);
    } else {
        resetIssueMicBtn();
    }
}

function resetIssueMicBtn() {
    const micBtn = document.getElementById('scIssueMicBtn');
    if(micBtn) {
        micBtn.innerText = "🎤 HOLD TO SPEAK";
        micBtn.style.backgroundColor = "#f39c12";
    }
}

async function cleanIssueWithAI(rawText) {
    let cleanText = "";
    let aiSuccess = false;

    if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey) {
        const prompt = `
        You are a professional HVAC Dispatcher. Rewrite the following spoken notes into a clean, concise, and highly professional service call description.
        Rules: Fix grammar/spelling, remove filler words, keep 1-3 sentences max, output in ALL CAPS, add proper punctuation. Return ONLY the cleaned description.
        Raw Spoken Notes: "${rawText}"
        `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${firebaseConfig.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })
            });

            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
                cleanText = data.candidates[0].content.parts[0].text.trim().toUpperCase();
                aiSuccess = true;
            }
        } catch (error) { console.error("AI Cleanup Failed:", error); }
    }

    if (!aiSuccess) {
        cleanText = rawText.trim().toUpperCase();
        if (!cleanText.endsWith('.') && !cleanText.endsWith('?') && !cleanText.endsWith('!')) { cleanText += '.'; }
    }

    let existingText = document.getElementById('scIssueInput').value.trim();
    if (existingText !== "") { document.getElementById('scIssueInput').value = existingText + " " + cleanText; } 
    else { document.getElementById('scIssueInput').value = cleanText; }

    if (aiSuccess && typeof showSaveCue === 'function') { showSaveCue("✨ Notes Cleaned by AI"); }
    resetIssueMicBtn();
}

// ====================================================================
// --- CUSTOM BOARD VERTICAL RESIZER ---
// ====================================================================

let boardResizeState = { 
    isResizing: false, 
    startY: 0, 
    startHeight: 0, 
    el: null 
};

function initBoardResize(e) {
    e.preventDefault();
    boardResizeState.isResizing = true;
    boardResizeState.startY = e.clientY;
    // Target the main container (dispatch-schedule-full)
    boardResizeState.el = e.currentTarget.parentElement; 
    boardResizeState.startHeight = boardResizeState.el.getBoundingClientRect().height;
    
    window.addEventListener('mousemove', doBoardResize);
    window.addEventListener('mouseup', stopBoardResize);
    
    // Force the cursor to stay up/down arrows while dragging anywhere on screen
    document.body.style.cursor = 'ns-resize'; 
}

function doBoardResize(e) {
    if (!boardResizeState.isResizing) return;
    
    // Calculate how far the mouse has moved
    let deltaY = e.clientY - boardResizeState.startY;
    let newHeight = boardResizeState.startHeight + deltaY;
    
    // Keep it from getting too squished
    if (newHeight < 150) newHeight = 150; 
    
    // Release the flexbox lock so the manual pixel height takes over
    boardResizeState.el.style.flex = 'none'; 
    boardResizeState.el.style.height = newHeight + 'px';
    
    // Smoothly redraw the Leaflet map as the space above it shrinks/grows
    if (dispatchMap) dispatchMap.invalidateSize(); 
}

function stopBoardResize(e) {
    boardResizeState.isResizing = false;
    window.removeEventListener('mousemove', doBoardResize);
    window.removeEventListener('mouseup', stopBoardResize);
    
    // Restore normal cursor
    document.body.style.cursor = 'default';
    
    // FINAL FIX: SAVE NEW HEIGHT TO LOCAL MEMORY
    let finalHeight = boardResizeState.el.style.height;
    localStorage.setItem('tp_board_height', finalHeight);
    
    // Final map redraw
    if (dispatchMap) dispatchMap.invalidateSize(); 
}

// ====================================================================
// --- QUICK STATUS UPDATER ---
// ====================================================================
function quickUpdateStatus(event, ticketId, newStatus) {
    event.stopPropagation(); // Stops the map from panning when you click the dropdown
    
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    let index = db.findIndex(sc => sc.id === ticketId);
    
    if (index !== -1) {
        db[index].status = newStatus;
        localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
        
        // Sync to cloud
        if(typeof syncSingleServiceCallToCloud === 'function') {
            syncSingleServiceCallToCloud(ticketId, db[index]);
        }
        
        // Re-render board to update colors
        renderServiceBoard();
        if(typeof showSaveCue === 'function') showSaveCue("✓ Status Updated");
    }
}

// ====================================================================
// --- WORKFLOW DATA ROUTING (TICKET TO QUOTE/INVOICE) ---
// ====================================================================

function convertToQuote(ticketId) {
    closeTicketDetails();

    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const sc = db.find(s => s.id === ticketId);
    if (!sc) return;

    // 1. Switch to Quoting Tab
    switchTab('quoting');

    // 2. Clear old quote data
    if (typeof startNewQuote === 'function') startNewQuote();

    // 3. Pre-fill customer data
    document.getElementById('custNameInput').value = sc.customerName || "";
    document.getElementById('custNumInput').value = sc.customerNum || "";
    document.getElementById('contactNameInput').value = sc.contactName || "";
    document.getElementById('custStreetInput').value = sc.locationAddress || "";
    document.getElementById('custCityInput').value = sc.custCity || "";
    document.getElementById('custStateInput').value = sc.custState || "";
    document.getElementById('custZipInput').value = sc.custZip || "";
    
    // THE FIX IS ON THIS LINE:
    document.getElementById('quoteLocNumInput').value = sc.locationNum || "";

    // 4. Inject original issue into notes
    let notesArea = document.getElementById('requoteNoteHistory');
    if (notesArea) {
        document.getElementById('requoteNoteContainer').style.display = 'flex';
        notesArea.value = `Originated from Service Ticket: ${sc.ticketNum}\nReported Issue: ${sc.issue}`;
    }

    if (typeof showSaveCue === 'function') showSaveCue("✓ Copied to Quoting Tool");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function convertToInvoice(ticketId) {
    closeTicketDetails();

    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const sc = db.find(s => s.id === ticketId);
    if (!sc) return;

    // 1. Switch to Invoicing Tab
    switchTab('invoice');

    // 2. Clear old invoice data
    if (typeof clearInvoiceForm === 'function') clearInvoiceForm();

    // 3. Pre-fill customer data
    const custName = sc.customerName || "";
    const street = sc.locationAddress || "";
    const city = sc.custCity || "";
    const state = sc.custState || "WI";
    const zip = sc.custZip || "";

    document.getElementById('invCustNameInput').value = custName;
    document.getElementById('invCustNumInput').value = sc.customerNum || "";
    document.getElementById('invStreetInput').value = street;
    document.getElementById('invCityInput').value = city;
    document.getElementById('invStateInput').value = state;
    document.getElementById('invZipInput').value = zip;
    document.getElementById('invLocNumInput').value = sc.locationNum || "";

    // 4. Inject equipment and original issue
    document.getElementById('invEquip').value = sc.equip || "";
    document.getElementById('invNotes').value = `Original Ticket: ${sc.ticketNum}\nReported Issue: ${sc.issue}`;

    // 5. CRITICAL FIX: Build the formatted text blocks for the printed PDF
    let formattedLoc = street;
    let csz = [];
    if(city) csz.push(city);
    let sz = [];
    if(state) sz.push(state);
    if(zip) sz.push(zip);
    if(sz.length > 0) csz.push(sz.join(" "));
    if(csz.length > 0) formattedLoc += "\n" + csz.join(", ");

    let billToEl = document.getElementById('invBillTo');
    let serviceLocEl = document.getElementById('invServiceLoc');
    if (billToEl) billToEl.value = custName + "\n" + formattedLoc;
    if (serviceLocEl) serviceLocEl.value = formattedLoc;

    // 6. Fetch the official official Invoice Number from the cloud
    if (typeof fetchNextInvoiceNumber === 'function') fetchNextInvoiceNumber();

    if (typeof showSaveCue === 'function') showSaveCue("✓ Copied to Invoicing Tool");
    
    // 7. Scroll past the yellow box so you instantly see your populated data
    setTimeout(() => {
        const formContainer = document.getElementById('invCustNameInput');
        if(formContainer) formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
}
