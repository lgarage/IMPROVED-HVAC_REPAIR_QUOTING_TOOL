// ====================================================================
// --- MAP ENGINE & CLOUD DISPATCH BOARD LOGIC ---
// ====================================================================

// --- SIDEBAR TOGGLE ---
function toggleSidebar() {
    document.getElementById('appSidebar').classList.toggle('collapsed');
    document.querySelector('.main-content').classList.toggle('expanded');
    if (typeof repositionInvoicingSubmenu === 'function') repositionInvoicingSubmenu();
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

var _serviceCallsBoardUnsub = null;

function subscribeServiceCallsFromCloud() {
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
        void loadServiceCallsFromCloud();
        return;
    }
    try {
        if (_serviceCallsBoardUnsub) {
            _serviceCallsBoardUnsub();
            _serviceCallsBoardUnsub = null;
        }
        _serviceCallsBoardUnsub = firebase
            .firestore()
            .collection("service_calls")
            .onSnapshot(
                function (snapshot) {
                    var cloudDb = [];
                    snapshot.forEach(function (doc) {
                        cloudDb.push({ id: doc.id, ...doc.data() });
                    });
                    try {
                        localStorage.setItem("twinPillarsServiceDB", JSON.stringify(cloudDb));
                    } catch (e) {}
                    if (typeof renderServiceBoard === "function") renderServiceBoard();
                },
                function (err) {
                    console.warn("service_calls live listener:", err);
                    void loadServiceCallsFromCloud();
                }
            );
    } catch (e) {
        console.warn("subscribeServiceCallsFromCloud:", e);
        void loadServiceCallsFromCloud();
    }
}

window.addEventListener("DOMContentLoaded", function () {
    subscribeServiceCallsFromCloud();
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

/** Last plotted marker positions for “Zoom to fit” (Leaflet [lat, lng]). */
var dispatchMapMarkerCoords = [];

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

function escapeHtmlDispatchMap(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Same palette order as Gantt tech rows (avatar / row color). Kept in one place for map + legend. */
var DISPATCH_TECH_GANTT_COLORS = ["#2980b9", "#8e44ad", "#d35400", "#16a085", "#27ae60", "#f39c12", "#c0392b", "#34495e"];

function getTechColorForAssignedTech(assignedTech) {
    if (!assignedTech || assignedTech === "Unassigned") return "#95a5a6";
    var savedTechs = JSON.parse(localStorage.getItem("tp_tech_list") || "[]");
    var idx = savedTechs.indexOf(assignedTech);
    if (idx >= 0) return DISPATCH_TECH_GANTT_COLORS[idx % DISPATCH_TECH_GANTT_COLORS.length];
    return "#3498db";
}

/** Matches Gantt chart date visibility (day / week / month vs board date selector). */
function getGanttDateContextForMap() {
    var dateInputEl = document.getElementById("boardDateSelector");
    var dateInput = dateInputEl && dateInputEl.value;
    var safeDate = dateInput ? new Date(dateInput + "T12:00:00") : new Date();
    var month = safeDate.getMonth();
    var year = safeDate.getFullYear();
    var startOfWeek = new Date(safeDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    var weekStrings = [];
    for (var i = 0; i < 7; i++) {
        var d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        var dy = d.getFullYear();
        var dm = String(d.getMonth() + 1).padStart(2, "0");
        var dd = String(d.getDate()).padStart(2, "0");
        weekStrings.push(dy + "-" + dm + "-" + dd);
    }
    var monthString = year + "-" + String(month + 1).padStart(2, "0");
    return { dateInput: dateInput, weekStrings: weekStrings, monthString: monthString };
}

function isTicketVisibleOnGanttForMap(sc) {
    if (sc.archived) return false;
    if (!sc.assignedTech || sc.assignedTech === "Unassigned") return false;
    if (sc.status === "Completed" || sc.status === "Canceled") return false;
    if (!sc.date) return false;
    var ctx = getGanttDateContextForMap();
    if (currentBoardView === "day" && sc.date === ctx.dateInput) return true;
    if (currentBoardView === "week" && ctx.weekStrings.indexOf(sc.date) !== -1) return true;
    if (currentBoardView === "month" && sc.date.indexOf(ctx.monthString) === 0) return true;
    return false;
}

/** Dispatched or explicit In Progress — pulse on map for “live” jobs. */
function shouldPulseMapMarker(sc) {
    var s = (sc.status && String(sc.status).trim()) || "";
    if (s === "Dispatched") return true;
    if (s.toLowerCase() === "in progress") return true;
    return false;
}

function renderDispatchMapTechLegend() {
    var el = document.getElementById("dispatchMapTechLegend");
    if (!el) return;
    var savedTechs = JSON.parse(localStorage.getItem("tp_tech_list") || "[]");
    if (!savedTechs.length) {
        el.innerHTML = "";
        el.classList.add("dispatch-map-tech-legend--empty");
        return;
    }
    el.classList.remove("dispatch-map-tech-legend--empty");
    var html = "";
    savedTechs.forEach(function (techName, index) {
        var color = DISPATCH_TECH_GANTT_COLORS[index % DISPATCH_TECH_GANTT_COLORS.length];
        var shortName = (String(techName).split(" ")[0] || "?").toUpperCase();
        html +=
            '<span class="dispatch-map-tech-legend__item">' +
            '<span class="dispatch-map-tech-legend__swatch" style="background:' +
            color +
            '"></span>' +
            "<span>" +
            escapeHtmlDispatchMap(shortName) +
            "</span>" +
            "</span>";
    });
    el.innerHTML = html;
}

function buildFullAddressFromServiceCall(sc) {
    if (!sc) return "";
    var parts = [
        sc.locationAddress,
        sc.custCity,
        sc.custState,
        sc.custZip
    ].map(function (p) { return p != null ? String(p).trim() : ""; });
    return parts.filter(Boolean).join(", ");
}

function readLocalGeoCache(fullAddress) {
    try {
        var cache = JSON.parse(localStorage.getItem("tp_geo_cache") || "{}");
        return cache[fullAddress] || null;
    } catch (e) {
        return null;
    }
}

function writeLocalGeoCache(fullAddress, lat, lng) {
    try {
        var cache = JSON.parse(localStorage.getItem("tp_geo_cache") || "{}");
        cache[fullAddress] = [lat, lng];
        localStorage.setItem("tp_geo_cache", JSON.stringify(cache));
    } catch (e) {}
}

async function persistServiceCallGeocode(scId, lat, lng) {
    var db = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]");
    var idx = db.findIndex(function (s) { return s.id === scId; });
    if (idx === -1) return;
    db[idx].geoLat = lat;
    db[idx].geoLng = lng;
    localStorage.setItem("twinPillarsServiceDB", JSON.stringify(db));
    if (typeof syncSingleServiceCallToCloud === "function") {
        await syncSingleServiceCallToCloud(scId, { geoLat: lat, geoLng: lng });
    }
}

function addCustomPin(coords, sc) {
    var techColor = getTechColorForAssignedTech(sc.assignedTech);
    var pulseClass = shouldPulseMapMarker(sc) ? " dispatch-map-marker--pulse" : "";
    var markerHtml =
        '<div class="dispatch-map-marker-wrap"><div class="dispatch-map-marker-dot' +
        pulseClass +
        '" style="background-color:' +
        techColor +
        ';"></div></div>';
    var customIcon = L.divIcon({ html: markerHtml, className: "custom-leaflet-marker", iconSize: [22, 22], iconAnchor: [11, 11] });
    var marker = L.marker(coords, { icon: customIcon }).addTo(markerLayer);
    var popupHtml =
        "<div style=\"min-width:190px;\">" +
        "<strong style=\"color:#1e4b85;\">" +
        escapeHtmlDispatchMap(sc.customerName) +
        "</strong><br>" +
        "<span style=\"font-size:12px;color:#444;\">Status: " +
        escapeHtmlDispatchMap(sc.status || "—") +
        "</span><br>" +
        "<span style=\"font-size:12px;color:#444;\">Tech: " +
        escapeHtmlDispatchMap(sc.assignedTech || "Unassigned") +
        "</span><br>" +
        "<button type=\"button\" class=\"gen-btn dispatch-map-view-ticket-btn\" style=\"margin-top:10px;padding:8px 10px;font-size:12px;width:100%;background:#1e4b85;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;\">🔍 View Ticket</button>" +
        "</div>";
    marker.bindPopup(popupHtml);
    marker.on("popupopen", function () {
        var pu = marker.getPopup();
        var el = pu && pu.getElement ? pu.getElement() : null;
        var btn = el && el.querySelector(".dispatch-map-view-ticket-btn");
        if (btn) {
            btn.onclick = function () {
                openTicketDetails(sc.id);
                dispatchMap.closePopup();
            };
        }
    });
}

/**
 * Resolve coordinates (Firestore geo fields → local cache → Nominatim), persist when newly resolved.
 */
async function placeMarkerForServiceCall(sc) {
    var fullAddress = buildFullAddressFromServiceCall(sc);
    if (!fullAddress || fullAddress.indexOf("UNKNOWN") !== -1) return;

    var lat;
    var lng;

    var gLat = parseFloat(sc.geoLat);
    var gLng = parseFloat(sc.geoLng);
    if (isFinite(gLat) && isFinite(gLng)) {
        lat = gLat;
        lng = gLng;
    } else {
        var cached = readLocalGeoCache(fullAddress);
        if (cached && cached.length >= 2) {
            lat = parseFloat(cached[0]);
            lng = parseFloat(cached[1]);
            if (isFinite(lat) && isFinite(lng)) {
                await persistServiceCallGeocode(sc.id, lat, lng);
            } else {
                return;
            }
        } else if (typeof getCoordinatesForAddress === "function") {
            var resolved = await getCoordinatesForAddress(fullAddress);
            if (!resolved) return;
            lat = resolved.lat;
            lng = resolved.lng;
            writeLocalGeoCache(fullAddress, lat, lng);
            await persistServiceCallGeocode(sc.id, lat, lng);
        } else {
            return;
        }
    }

    var ll = [lat, lng];
    dispatchMapMarkerCoords.push(ll);
    addCustomPin(ll, sc);
}

function centerMapOnTicket(dbId) {
    var db = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]");
    var sc = db.find(function (s) { return s.id === dbId; });
    if (!sc || !dispatchMap) return;
    var fullAddress = buildFullAddressFromServiceCall(sc);
    var cLat = parseFloat(sc.geoLat);
    var cLng = parseFloat(sc.geoLng);
    if (isFinite(cLat) && isFinite(cLng)) {
        dispatchMap.flyTo([cLat, cLng], 16, { animate: true, duration: 1.2 });
        return;
    }
    var cache = readLocalGeoCache(fullAddress);
    if (cache && cache.length >= 2) {
        dispatchMap.flyTo([parseFloat(cache[0]), parseFloat(cache[1])], 16, { animate: true, duration: 1.2 });
    }
}

/** Fit the map to pins for the current Gantt date range (same set as updateMapMarkers). */
function zoomMapToFitMarkers() {
    if (!dispatchMap) return;
    if (!dispatchMapMarkerCoords.length) {
        if (typeof showSaveCue === "function") showSaveCue("No job pins in the current board view to show on the map.");
        return;
    }
    if (dispatchMapMarkerCoords.length === 1) {
        dispatchMap.setView(dispatchMapMarkerCoords[0], 14);
        return;
    }
    var bounds = L.latLngBounds(dispatchMapMarkerCoords);
    dispatchMap.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
}

async function updateMapMarkers() {
    if (!markerLayer || !dispatchMap) return;
    markerLayer.clearLayers();
    dispatchMapMarkerCoords = [];

    var db = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]");
    var active = db.filter(isTicketVisibleOnGanttForMap);

    for (var i = 0; i < active.length; i++) {
        await placeMarkerForServiceCall(active[i]);
    }
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
    renderServiceBoard(); 
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
        notes: document.getElementById('scNotesInput').value.trim(),
        parentId: (document.getElementById('scParentSelect') && document.getElementById('scParentSelect').value) || "",
        releasedToTech: document.getElementById('scReleasedToTech') ? document.getElementById('scReleasedToTech').checked : true
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
    const scTn = document.getElementById('scTechNotesReadonly');
    if (scTn) scTn.value = "";
    const scRel = document.getElementById('scReleasedToTech');
    if (scRel) scRel.checked = false;

    const scPs = document.getElementById('scParentSelect');
    const scPn = document.getElementById('scParentNew');
    if (scPs) scPs.value = "";
    if (scPn) scPn.value = "";
    ['scParentBillStreet', 'scParentBillCity', 'scParentBillState', 'scParentBillZip'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    const scSite = document.getElementById('scBillToSite');
    const scPar = document.getElementById('scBillToParent');
    if (scSite) scSite.checked = true;
    if (scPar) {
        scPar.checked = false;
        scPar.disabled = true;
    }

    document.getElementById('scDateInput').valueAsDate = new Date();
    document.getElementById('scStartTimeInput').value = "08:00"; 
    document.getElementById('scDurationInput').value = "2.0";   
    
    if(typeof toggleNewCustomerWarning === 'function') toggleNewCustomerWarning(false);
    document.getElementById('serviceFormContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Service Requests panel "+ New" — same as clearing the intake form for a fresh ticket. */
function scrollToServiceForm() {
    clearServiceForm();
}

async function saveServiceCall(isAutoSave = false) {
    let data = gatherServiceData();

    if (isAutoSave && data.id === "" && data.customerName === "UNKNOWN CUSTOMER") return false;

    if (!isAutoSave) {
        if (data.customerName === "UNKNOWN CUSTOMER" || data.issue === "") {
            alert("A Customer Name and Reported Issue are required to log a service call.");
            return false;
        }
        if (typeof resolveServiceParentForSave === 'function') {
            try {
                const pid = await resolveServiceParentForSave();
                if (pid) data.parentId = pid;
            } catch (e) {
                console.error(e);
            }
        }
        if (typeof syncCustomerToDirectory === 'function') syncCustomerToDirectory(data);
    } else if (data.id !== "") {
        if (typeof syncCustomerToDirectory === 'function') syncCustomerToDirectory(data);
    }

    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');

    if (data.id) {
        // EDITING EXISTING — merge so Field-app fields (e.g. techNotes) are not wiped; gatherServiceData() does not include them.
        const index = db.findIndex(sc => sc.id === data.id);
        if (index !== -1) {
            db[index] = { ...db[index], ...data };
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
    var recordToSync = data;
    if (data.id) {
        var merged = db.find(function (sc) { return sc.id === data.id; });
        if (merged) recordToSync = merged;
    }
    syncSingleServiceCallToCloud(recordToSync.id, recordToSync);
    renderServiceBoard();
    if (isAutoSave) showSaveCue("✓ Auto-Saved");
    return true;
}

// ====================================================================
// --- MODAL TICKET DETAILS WITH EDITABLE TIME/DATE ---
// ====================================================================

function openTicketDetails(dbId) {
    currentOpenDetailsId = dbId;
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const sc = db.find(s => s.id === dbId);
    if (!sc) return;

    // --- DYNAMICALLY GENERATE TECH DROPDOWN OPTIONS ---
    let savedTechs = JSON.parse(localStorage.getItem('tp_tech_list') || '[]');
    let techOptionsHtml = `<option value="Unassigned" ${sc.assignedTech === 'Unassigned' || !sc.assignedTech ? 'selected' : ''}>Unassigned</option>`;
    
    savedTechs.forEach(tech => {
        techOptionsHtml += `<option value="${tech}" ${sc.assignedTech === tech ? 'selected' : ''}>${tech}</option>`;
    });

    let custNumStr = sc.customerNum ? ` <span style="font-size: 14px; color: #7f8c8d; font-weight: normal;">(${sc.customerNum})</span>` : '';
    document.getElementById('tdModalTitle').innerHTML = `Ticket ${sc.ticketNum} - ${sc.customerName}${custNumStr}`;
    
    let contactStr = sc.contactName ? `<strong>${sc.contactName}</strong>` : `N/A`;
    if(sc.contactPhone) contactStr += `<br>${sc.contactPhone}`;
    if(sc.contactEmail) contactStr += `<br>${sc.contactEmail}`;
    
    let trackingStr = sc.tracking ? `<span style="color:#e74c3c; font-weight:bold; font-size:12px; margin-left:10px;">PO / Tracking: ${sc.tracking}</span>` : "";
    let locNumStr = sc.locationNum ? `<span style="font-size: 12px; color: #7f8c8d;">Loc ID: ${sc.locationNum}</span><br>` : '';

    // Inject Date and Time inputs directly into the modal
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
            <div style="margin-bottom: 15px;">
                <p style="margin-top:0; margin-bottom: 5px;"><strong>Assign Technician:</strong></p>
                <select id="tdTechSelect" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit;">
                    ${techOptionsHtml}
                </select>
            </div>
            <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; margin-bottom:12px; font-size:13px; line-height:1.35;">
                <input type="checkbox" id="tdReleasedToTech" style="width:18px; height:18px; margin-top:2px; flex-shrink:0;" ${sc.releasedToTech !== false ? 'checked' : ''}>
                <span><strong>Release to Field app</strong> — technician can see this job on their phone once checked. Leave unchecked to keep it dispatch-only until you are ready.</span>
            </label>
            
            <div style="display:flex; gap:10px; margin-bottom:5px;">
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:bold; color:#777;">Scheduled Date</label>
                    <input type="date" id="tdDate" value="${sc.date || ''}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:bold; color:#777;">Start Time</label>
                    <input type="time" id="tdStartTime" value="${sc.startTime || '08:00'}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:bold; color:#777;">Duration (Hrs)</label>
                    <input type="number" id="tdDuration" step="0.25" min="0.5" value="${sc.duration || '2.0'}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; font-family:inherit;">
                </div>
            </div>
            <div style="font-size: 11px; color: #777;">*Edits to scheduling auto-save when this window closes.</div>
        </div>
        
        <div style="display: flex; gap: 20px; margin-bottom: 15px;">
            <div style="flex: 1;">
                <p style="margin-top:0; margin-bottom:5px;"><strong>Customer ID:</strong> ${sc.customerNum || 'N/A'}</p>
                <p style="margin-top:5px;"><strong>Site Contact:</strong><br>${contactStr}</p>
            </div>
            <div style="flex: 1;">
                <p style="margin-top:0; margin-bottom:5px;"><strong>Location ID:</strong> ${sc.locationNum || 'N/A'}</p>
                <p style="margin-top:5px;"><strong>Location Address:</strong><br>${locNumStr}${sc.locationAddress}<br>${sc.custCity}, ${sc.custState} ${sc.custZip}</p>
            </div>
        </div>
        
        <hr style="border:0; border-top:1px solid #eaeaea; margin: 15px 0;">
        <p><strong>Reported Issue:</strong><br><span style="background:#f4f7f6; padding:10px; display:block; border-radius:4px; margin-top:5px; white-space: pre-wrap;">${sc.issue}</span></p>
        <p><strong>Equipment:</strong> ${sc.equip || 'N/A'}</p>
        <p><strong>Dispatch Notes:</strong> ${sc.notes || 'N/A'}</p>
        <hr style="border:0; border-top:1px solid #eaeaea; margin: 18px 0;">
        <div style="background:#fffbeb; border:1px solid #f0d78c; border-radius:6px; padding:14px; margin-bottom:14px;">
            <p style="margin:0 0 10px 0; font-weight:bold; color:#92400e;">📸 Customer-Provided Evidence</p>
            <p style="margin:0 0 10px 0; font-size:12px; color:#78350f; line-height:1.45;">Attach photos or documents supplied by the customer, or <strong>paste an image</strong> (Ctrl+V or long-press → Paste on mobile). Files are stored on this ticket and appear immediately in the technician Field app.</p>
            <input type="file" id="tdCustomerEvidenceInput" multiple accept="image/*,.pdf,.doc,.docx,application/pdf" style="width:100%; font-size:13px; margin-bottom:8px;">
            <p id="tdCustomerEvidenceStatus" style="margin:0; font-size:12px; color:#666; min-height:1.2em;"></p>
            <div id="tdCustomerEvidenceList" style="margin-top:10px;"></div>
        </div>
        ${sc.techNotes ? `<p style="margin-top:14px;"><strong>Technician report (Field app):</strong></p><pre style="background:#e8f4fc; padding:12px; border-radius:4px; margin-top:6px; white-space:pre-wrap; font-family:inherit; font-size:13px; line-height:1.45; border:1px solid #b8d4ea; max-height:280px; overflow:auto;">${escapeHtmlServiceArchive(sc.techNotes)}</pre>` : '<p style="font-size:12px; color:#999; margin-top:10px;"><em>No technician report yet (Field app).</em></p>'}
        <div id="tdFieldQuotesMount" style="margin-top:16px;"></div>
    `;

    document.getElementById('tdEditBtn').onclick = async function() {
        closeTicketDetails();
        await loadServiceCall(dbId);

        setTimeout(() => {
            const formEl = document.getElementById('serviceFormContainer');
            const scrollBox = document.querySelector('.main-content');
            
            if (formEl && scrollBox) {
                scrollBox.scrollTo({
                    top: formEl.offsetTop - 20,
                    behavior: 'smooth'
                });
                
                formEl.style.transition = "box-shadow 0.4s ease";
                formEl.style.boxShadow = "0 0 25px rgba(200, 155, 83, 0.8)";
                setTimeout(() => { formEl.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)"; }, 1500);
            }
        }, 300);
    };

    document.getElementById('tdArchiveBtn').onclick = function() {
        if (!confirm("Archive this ticket? It will leave the active service list and map, but the full record stays saved in the database for future reference.")) {
            return;
        }
        closeTicketDetails();
        let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
        const idx = db.findIndex((s) => s.id === dbId);
        if (idx === -1) return;
        db[idx].archived = true;
        db[idx].archivedAt = new Date().toISOString();
        localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
        if (typeof syncSingleServiceCallToCloud === 'function') {
            syncSingleServiceCallToCloud(dbId, db[idx]);
        }
        renderServiceBoard();
        if (typeof showSaveCue === 'function') showSaveCue('Ticket archived (saved to cloud)');
    };

    document.getElementById('ticketDetailsModal').style.display = 'block';

    if (typeof setupTicketDetailsCustomerEvidence === 'function') {
        setupTicketDetailsCustomerEvidence(sc.id);
    }

    if (typeof loadFieldQuotesForTicketIntoModal === 'function') {
        loadFieldQuotesForTicketIntoModal(sc.id);
    }
}

function closeTicketDetails() {
    if (currentOpenDetailsId) {
        let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
        let scIndex = db.findIndex(s => s.id === currentOpenDetailsId);
        if (scIndex !== -1) {
            
            // Capture updated data from modal
            const techSelect = document.getElementById('tdTechSelect');
            const dateInput = document.getElementById('tdDate');
            const timeInput = document.getElementById('tdStartTime');
            const durInput = document.getElementById('tdDuration');

            if (techSelect) {
                const selectedTech = techSelect.value;
                db[scIndex].assignedTech = selectedTech;
                
                if (selectedTech !== 'Unassigned' && db[scIndex].status === 'Unassigned') {
                    db[scIndex].status = 'Dispatched';
                } else if (selectedTech === 'Unassigned' && db[scIndex].status === 'Dispatched') {
                    db[scIndex].status = 'Unassigned';
                }
            }
            
            // Save the new date/time fields
            if(dateInput) db[scIndex].date = dateInput.value;
            if(timeInput) db[scIndex].startTime = timeInput.value;
            if(durInput) db[scIndex].duration = durInput.value;

            const tdRel = document.getElementById('tdReleasedToTech');
            if (tdRel) db[scIndex].releasedToTech = tdRel.checked;

            localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
            syncSingleServiceCallToCloud(db[scIndex].id, db[scIndex]);
            renderServiceBoard(); 
        }
    }
    document.getElementById('ticketDetailsModal').style.display = 'none';
    currentOpenDetailsId = null;
}

async function loadServiceCall(dbId) {
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
    const scRelEdit = document.getElementById('scReleasedToTech');
    if (scRelEdit) scRelEdit.checked = data.releasedToTech !== false;
    const scTechRo = document.getElementById('scTechNotesReadonly');
    if (scTechRo) scTechRo.value = data.techNotes || '';

    if (data.parentId && typeof setServiceParentSelect === 'function') {
        await setServiceParentSelect(data.parentId);
    } else {
        const scPs = document.getElementById('scParentSelect');
        const scPn = document.getElementById('scParentNew');
        if (scPs) scPs.value = '';
        if (scPn) scPn.value = '';
        if (typeof updateServiceBillToParentRadioState === 'function') updateServiceBillToParentRadioState();
    }
}

// --- HELPER FUNCTION: FORMAT TIME FOR BLOCKS ---
function formatTimeRange(startStr, durationStr) {
    if(!startStr) startStr = "08:00";
    let d = parseFloat(durationStr) || 1.5;
    let parts = startStr.split(':');
    let h = parseInt(parts[0]);
    let m = parseInt(parts[1]);

    let startAmPm = h >= 12 ? 'PM' : 'AM';
    let startH = h % 12 || 12;
    let startM = m.toString().padStart(2, '0');

    let totalMins = m + (d * 60);
    let endH = h + Math.floor(totalMins / 60);
    let endM = Math.round(totalMins % 60);

    let endAmPm = endH >= 12 && endH < 24 ? 'PM' : 'AM';
    let finalEndH = endH % 12 || 12;
    let finalEndM = endM.toString().padStart(2, '0');

    return `${startH}:${startM}${startAmPm} - ${finalEndH}:${finalEndM}${endAmPm}`;
}

/** Native tooltip text for gantt blocks (customer, time, address, issue). */
function buildGanttEventTooltip(sc, displayTime) {
    const addrParts = [];
    if (sc.locationAddress) addrParts.push(String(sc.locationAddress).trim());
    const cityState = [sc.custCity, sc.custState].filter(Boolean).join(", ");
    if (cityState) addrParts.push(cityState);
    if (sc.custZip) addrParts.push(String(sc.custZip).trim());
    const address = addrParts.length ? addrParts.join(" · ") : "—";
    const desc = sc.issue && String(sc.issue).trim()
        ? String(sc.issue).replace(/\s+/g, " ").trim()
        : "";
    const lines = [
        "Customer: " + (sc.customerName || ""),
        "Time: " + displayTime,
        "Address: " + address
    ];
    if (desc) lines.push("Description: " + desc);
    return lines.join("\n");
}

function renderServiceBoard() {
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const listContainer = document.getElementById('serviceRequestList');
    const timeline = document.getElementById('scheduleTimeline');
    const dateInput = document.getElementById('boardDateSelector').value;

    const ganttContainer = document.querySelector(".gantt-container");
    if (ganttContainer) {
        ganttContainer.classList.remove("board-view-day", "board-view-week", "board-view-month");
        ganttContainer.classList.add("board-view-" + currentBoardView);
    }

    // 1. RENDER LEFT PANEL
    listContainer.innerHTML = '';
    let listCount = 0;
    
    db.forEach(sc => {
        if (sc.archived) return;
        if (sc.status === 'Completed' || sc.status === 'Canceled') return;
        listCount++;
        
        let colorClass = 'priority-Standard';
        if (sc.priority === 'Emergency') colorClass = 'priority-Emergency';
        if (sc.priority === 'Urgent') colorClass = 'priority-Urgent';
        if (sc.priority === 'Routine') colorClass = 'priority-Routine';

        let techAssignStr = sc.assignedTech === 'Unassigned' || !sc.assignedTech ? `<span style="color:#e74c3c; font-weight:bold;">Unassigned</span>` : `<span style="color:#27ae60;"><i class="fas fa-user"></i> ${sc.assignedTech.split(' ')[0]}</span>`;
        const releaseBadge = sc.releasedToTech === false ? `<span style="font-size:9px; background:#fdebd0; color:#ca6f1e; padding:2px 6px; border-radius:4px; font-weight:700; margin-left:4px;">Field: hold</span>` : '';

        let cardHTML = `
            <div class="glass-card ${colorClass}" draggable="true" ondragstart="drag(event, '${sc.id}')" ondblclick="openTicketDetails('${sc.id}')">
                <div class="tc-title">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${sc.customerName}</span>
                    <span style="font-size:10px; color:#aaa;">${sc.ticketNum}${releaseBadge}</span>
                </div>
                <div class="tc-loc"><i class="fas fa-map-marker-alt" style="color:#c89b53;"></i> ${sc.locationAddress} | ${sc.custCity}, ${sc.custState}</div>
                <div class="tc-footer">
                    <select class="status-quick-select status-${sc.status.replace(/ /g, '')}" onchange="quickUpdateStatus(event, '${sc.id}', this.value)">
                        <option value="Unassigned" ${sc.status === 'Unassigned' ? 'selected' : ''}>Unassigned</option>
                        <option value="Dispatched" ${sc.status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
                        <option value="Needs Repair Quote" ${sc.status === 'Needs Repair Quote' ? 'selected' : ''}>Needs Repair Quote</option>
                        <option value="Parts on Order" ${sc.status === 'Parts on Order' ? 'selected' : ''}>Parts on Order</option>
                        <option value="Completed" ${sc.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                    <div style="font-size:11px;">${techAssignStr}</div>
                </div>
            </div>
        `;
        listContainer.innerHTML += cardHTML;
    });
    
    let badge = document.getElementById('ticketCountBadge');
    if(badge) badge.innerText = listCount;

    // 2. RENDER GANTT ROWS (DYNAMIC FROM SETTINGS)
    let savedTechs = JSON.parse(localStorage.getItem('tp_tech_list') || '[]');

    const techs = savedTechs.map((techName, index) => {
        return {
            name: techName.split(' ')[0], 
            full: techName,
            color: DISPATCH_TECH_GANTT_COLORS[index % DISPATCH_TECH_GANTT_COLORS.length] 
        };
    });

    const safeDate = dateInput ? new Date(dateInput + "T12:00:00") : new Date();
    let month = safeDate.getMonth();
    let year = safeDate.getFullYear();
    let daysInMonth = new Date(year, month + 1, 0).getDate();

    let bgSize = 'calc(100% / 10)'; 
    if(currentBoardView === 'week') bgSize = 'calc(100% / 7)';
    if(currentBoardView === 'month') bgSize = `calc(100% / ${daysInMonth})`;

    let html = '';
    techs.forEach(t => {
        const st = typeof evaluateTechStatus === "function"
            ? evaluateTechStatus(t.full)
            : { label: "Active", className: "tech-status-active" };
        html += `<div class="gantt-row" id="row-${t.name}" ondrop="drop(event, '${t.full}')" ondragover="allowDrop(event)">
            <div class="gantt-tech-cell">
                <div class="tech-avatar" style="background:${t.color};">${t.name.charAt(0)}</div>
                <div class="tech-info">
                    <div class="tech-name">${t.name}</div>
                    <div class="tech-status ${st.className}">${st.label}</div>
                </div>
            </div>
            <div class="gantt-timeline" id="timeline-${t.name}" data-tech="${t.full}" style="background-size: ${bgSize} 100%;"
                 ondragover="event.preventDefault(); this.style.background='rgba(52, 152, 219, 0.1)';" 
                 ondragleave="this.style.background='';" 
                 ondrop="handleTimelineDrop(event); this.style.background='';"></div>
        </div>`;
    });
    timeline.innerHTML = html;
    timeline.innerHTML += `<div id="currentTimeLine" style="left: 45%; display:none;"><div class="time-badge"></div></div>`;

    // 3. BULLETPROOF STRING MATCHING LOGIC
    let startOfWeek = new Date(safeDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Force Sunday
    
    let weekStrings = [];
    for(let i=0; i<7; i++) {
        let d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        let dy = d.getFullYear();
        let dm = String(d.getMonth() + 1).padStart(2, '0');
        let dd = String(d.getDate()).padStart(2, '0');
        weekStrings.push(`${dy}-${dm}-${dd}`);
    }
    
    let monthString = `${year}-${String(month + 1).padStart(2, '0')}`;

    db.forEach(sc => {
        if (sc.archived) return;
        if (!sc.assignedTech || sc.assignedTech === 'Unassigned') return;
        if (sc.status === 'Completed' || sc.status === 'Canceled') return;
        if (!sc.date) return;

        let isVisible = false;

        if (currentBoardView === 'day' && sc.date === dateInput) isVisible = true;
        if (currentBoardView === 'week' && weekStrings.includes(sc.date)) isVisible = true;
        if (currentBoardView === 'month' && sc.date.startsWith(monthString)) isVisible = true;

        if (!isVisible) return;

        let techObj = techs.find(t => t.full === sc.assignedTech);
        if (!techObj) return;

        let tContainer = document.getElementById('timeline-' + techObj.name);
        if (!tContainer) return;

        let timeParts = sc.startTime ? sc.startTime.split(':') : ['08', '00'];
        let startHour = parseFloat(timeParts[0]) + (parseFloat(timeParts[1]) / 60);
        let duration = parseFloat(sc.duration) || 1.5;

        let left = 0; let width = 0;
        let scDateObj = new Date(sc.date + "T12:00:00"); // Safe local time for column math

        if (currentBoardView === 'day') {
            left = ((startHour - 7) / 10) * 100;
            width = (duration / 10) * 100;
        } else if (currentBoardView === 'week') {
            let dayOfWeek = scDateObj.getDay(); 
            let dayWidth = 100 / 7; 
            left = (dayOfWeek * dayWidth) + (((startHour - 7) / 10) * dayWidth);
            width = (duration / 10) * dayWidth;
        } else if (currentBoardView === 'month') {
            let dayOfMonth = scDateObj.getDate();
            let dayWidth = 100 / daysInMonth;
            left = ((dayOfMonth - 1) * dayWidth) + (((startHour - 7) / 10) * dayWidth);
            width = (duration / 10) * dayWidth;
        }

        if (left < 0) left = 0;
        if (left > 99) left = 99;
        if (width < 0.5) width = 0.5; 
        if (left + width > 100) width = 100 - left;

        let color = '#3498db';
        if(sc.priority === 'Emergency') color = '#e74c3c';
        if(sc.priority === 'Urgent') color = '#f39c12';
        if(sc.priority === 'Routine') color = '#95a5a6';

        let block = document.createElement('div');
        block.className = 'gantt-job-block';
        
        block.style.boxSizing = 'border-box';
        block.style.left = left + '%';
        block.style.width = width + '%';
        block.style.backgroundColor = color;
        
        // Formatted strings for UI
        let displayTime = formatTimeRange(sc.startTime, sc.duration);
        let contactDisplay = sc.contactName ? sc.contactName : "No Contact";
        let zipDisplay = sc.custZip ? sc.custZip : "";

        // ADD DRAG AND RESIZE CAPABILITIES
        block.draggable = true;
        block.ondragstart = function(e) { drag(e, sc.id); };
        block.ondblclick = function(e) { e.stopPropagation(); openTicketDetails(sc.id); };
        
        if (currentBoardView === 'day') {
            block.innerHTML = `
                <div class="resize-handle resize-left" onmousedown="startTimelineResize(event, '${sc.id}', 'left')"></div>
                <div class="gantt-job-block-inner">
                    <div class="gantt-job-line gantt-job-time-row">
                        <i class="far fa-clock" aria-hidden="true"></i>
                        <span class="gantt-job-time-text">${displayTime}</span>
                    </div>
                    <div class="gantt-job-line gantt-job-name">${sc.customerName}</div>
                    <div class="gantt-job-line gantt-job-detail">${contactDisplay} · ${zipDisplay}</div>
                </div>
                <div class="resize-handle resize-right" onmousedown="startTimelineResize(event, '${sc.id}', 'right')"></div>
            `;
        } else if (currentBoardView === 'week') {
            block.innerHTML = `
                <div class="resize-handle resize-left" onmousedown="startTimelineResize(event, '${sc.id}', 'left')"></div>
                <div class="gantt-job-block-inner">
                    <div class="gantt-job-line gantt-job-time-row">
                        <i class="far fa-clock" aria-hidden="true"></i>
                        <span class="gantt-job-time-text">${displayTime}</span>
                    </div>
                    <div class="gantt-job-line gantt-job-name">${sc.customerName}</div>
                </div>
                <div class="resize-handle resize-right" onmousedown="startTimelineResize(event, '${sc.id}', 'right')"></div>
            `;
        } else {
            block.className = "gantt-job-block gantt-job-block--month";
            block.innerHTML = `
                <div class="gantt-job-block-inner gantt-job-block-inner--month">
                    <span class="gantt-job-month-text">${displayTime}</span>
                    <span class="gantt-job-month-text">${sc.customerName}</span>
                </div>
            `;
        }

        block.setAttribute("title", buildGanttEventTooltip(sc, displayTime));

        tContainer.appendChild(block);
    });
    
    if (typeof renderDispatchMapTechLegend === "function") renderDispatchMapTechLegend();
    if (typeof updateMapMarkers === "function") {
        void updateMapMarkers().catch(function (e) {
            console.warn("updateMapMarkers:", e);
        });
    }
    updateCurrentTimeLine();
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
    
    renderGanttHeaders();
    if(typeof renderServiceBoard === 'function') renderServiceBoard();
}

function changeBoardDate(direction) {
    let dateInput = document.getElementById('boardDateSelector');
    let d = dateInput.value ? new Date(dateInput.value + "T12:00:00") : new Date();

    if (currentBoardView === 'day') {
        d.setDate(d.getDate() + direction);
    } else if (currentBoardView === 'week') {
        d.setDate(d.getDate() + (direction * 7));
    } else if (currentBoardView === 'month') {
        d.setMonth(d.getMonth() + direction);
    }

    let year = d.getFullYear();
    let month = String(d.getMonth() + 1).padStart(2, '0');
    let day = String(d.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;

    renderGanttHeaders();
    if(typeof renderServiceBoard === 'function') renderServiceBoard();
}

let currentBoardView = 'day';

function switchBoardView(view) {
    currentBoardView = view;
    
    document.querySelectorAll('.view-toggle').forEach(btn => btn.classList.remove('active'));
    if(view === 'day') document.getElementById('btnViewDay').classList.add('active');
    if(view === 'week') document.getElementById('btnViewWeek').classList.add('active');
    if(view === 'month') document.getElementById('btnViewMonth').classList.add('active');
    
    renderGanttHeaders();
    if (typeof renderServiceBoard === 'function') renderServiceBoard(); 
}

function renderGanttHeaders() {
    const headerContainer = document.getElementById('ganttTimeHeaders');
    if(!headerContainer) return;
    
    const dateInput = document.getElementById('boardDateSelector').value;
    const selectedDate = dateInput ? new Date(dateInput + "T12:00:00") : new Date();
    
    let html = '';
    
    if (currentBoardView === 'day') {
        document.getElementById('boardDayOfWeek').innerText = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const hours = ['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
        hours.forEach(h => html += `<div class="gantt-hour-slot">${h}</div>`);
        
    } else if (currentBoardView === 'week') {
        let startOfWeek = new Date(selectedDate);
        let day = startOfWeek.getDay();
        startOfWeek.setDate(startOfWeek.getDate() - day); 
        
        let endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); 
        
        document.getElementById('boardDayOfWeek').innerText = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric'})}`;
        
        for(let i=0; i<7; i++) { 
            let d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            html += `<div class="gantt-hour-slot" style="text-align:center; min-width: 100px; border-right: 2px solid #ccc; font-size:12px;">${d.toLocaleDateString('en-US', {weekday:'short'})}<br><span style="font-size:16px; color:#333;">${d.getDate()}</span></div>`;
        }
        
    } else if (currentBoardView === 'month') {
        let month = selectedDate.getMonth();
        let year = selectedDate.getFullYear();
        let daysInMonth = new Date(year, month + 1, 0).getDate();
        
        document.getElementById('boardDayOfWeek').innerText = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        for(let i=1; i<=daysInMonth; i++) {
            html += `<div class="gantt-hour-slot" style="text-align:center; min-width: 40px; font-size: 11px; padding: 8px 0; border-right: 1px solid #ccc;">${i}</div>`;
        }
    }
    
    headerContainer.innerHTML = html;
}

function renderScheduleTimelineOnly() {
    renderServiceBoard();
}

// ====================================================================
// --- GANTT CHART DRAG, DROP, AND RESIZE ENGINE ---
// ====================================================================

function updateCurrentTimeLine() {
    const timelineContainer = document.getElementById('scheduleTimeline');
    if (!timelineContainer) return;

    const now = new Date();
    const dateInput = document.getElementById('boardDateSelector').value;
    
    if (currentBoardView !== 'day' || dateInput !== now.toISOString().split('T')[0]) {
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
            <div id="currentTimeLine" style="left: ${leftPercent}%; display:block;">
                <div class="time-badge">${timeString}</div>
            </div>
        `;
    }
}

// --- 1. Dragging Cards from Left Panel to Board (Now supports cross-day drop) ---
function drag(ev, dbId) {
    ev.dataTransfer.setData("text/plain", dbId);
}

function allowDrop(ev) {
    ev.preventDefault();
}

function handleTimelineDrop(e) {
    e.preventDefault();
    
    let ticketId = e.dataTransfer.getData("text/plain");
    if(!ticketId) {
        const draggedCard = document.querySelector('.glass-card.dragging');
        if (draggedCard) ticketId = draggedCard.getAttribute('data-id');
    }
    if (!ticketId) return;

    const timeline = e.currentTarget;
    const techId = timeline.getAttribute('data-tech');

    const rect = timeline.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentX = offsetX / rect.width;

    let dropTimeDecimal = 7;
    let newDateStr = null;

    let dateInput = document.getElementById('boardDateSelector').value;
    let safeDate = dateInput ? new Date(dateInput + "T12:00:00") : new Date();

    // Mathematically convert the drop X-coordinate to Date AND Time
    if (currentBoardView === 'day') {
        dropTimeDecimal = 7 + (percentX * 10);
        newDateStr = dateInput;
    } else if (currentBoardView === 'week') {
        let dayWidth = 1 / 7;
        let targetDayIndex = Math.floor(percentX / dayWidth);
        if(targetDayIndex < 0) targetDayIndex = 0;
        if(targetDayIndex > 6) targetDayIndex = 6;
        
        let percentInsideDay = (percentX % dayWidth) / dayWidth;
        dropTimeDecimal = 7 + (percentInsideDay * 10);
        
        let startOfWeek = new Date(safeDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setDate(startOfWeek.getDate() + targetDayIndex);
        newDateStr = startOfWeek.toISOString().split('T')[0];
    } else if (currentBoardView === 'month') {
        let month = safeDate.getMonth();
        let year = safeDate.getFullYear();
        let daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let dayWidth = 1 / daysInMonth;
        let targetDayIndex = Math.floor(percentX / dayWidth);
        if(targetDayIndex < 0) targetDayIndex = 0;
        if(targetDayIndex >= daysInMonth) targetDayIndex = daysInMonth - 1;
        
        let percentInsideDay = (percentX % dayWidth) / dayWidth;
        dropTimeDecimal = 7 + (percentInsideDay * 10);
        
        let newD = new Date(year, month, targetDayIndex + 1, 12, 0, 0);
        newDateStr = newD.toISOString().split('T')[0];
    }

    dropTimeDecimal = Math.round(dropTimeDecimal * 4) / 4;
    if(dropTimeDecimal < 7) dropTimeDecimal = 7;
    if(dropTimeDecimal > 16.5) dropTimeDecimal = 16.5;

    let h = Math.floor(dropTimeDecimal);
    let m = Math.round((dropTimeDecimal - h) * 60);
    let timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    let index = db.findIndex(sc => sc.id === ticketId);
    
    if (index !== -1) {
        db[index].assignedTech = techId;
        db[index].startTime = timeStr;
        if(newDateStr) db[index].date = newDateStr;
        
        if (db[index].status === 'Unassigned') {
            db[index].status = 'Dispatched';
        }
        
        localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
        if(typeof syncSingleServiceCallToCloud === 'function') syncSingleServiceCallToCloud(ticketId, db[index]);
        
        renderServiceBoard(); 
        let shortTechName = techId.split(' ')[0];
        if(typeof showSaveCue === 'function') showSaveCue(`✓ Dispatched to ${shortTechName}`);
    }
}

function drop(ev, techName) {
    allowDrop(ev); 
}

// --- 2. Moving Blocks ALREADY on the Grid (Now supports cross-day drag) ---
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

    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    let index = db.findIndex(sc => sc.id === tlState.id);
    if(index === -1) { tlState.action = null; return; }

    let sc = db[index];
    let dateInput = document.getElementById('boardDateSelector').value;
    let safeDate = dateInput ? new Date(dateInput + "T12:00:00") : new Date();

    let startHour = 7;
    let newStartDecimal = 7;
    let newDuration = 1.5;
    let newDateStr = sc.date;

    // Calculate Date and Time across week and month column drops
    if (currentBoardView === 'day') {
        newStartDecimal = startHour + (finalLeft / 100 * 10);
        newDuration = (finalWidth / 100 * 10);
    } else if (currentBoardView === 'week') {
        let dayWidth = 100 / 7;
        let targetDayIndex = Math.floor(finalLeft / dayWidth);
        if(targetDayIndex < 0) targetDayIndex = 0;
        if(targetDayIndex > 6) targetDayIndex = 6;
        
        let percentInsideDay = (finalLeft % dayWidth) / dayWidth;
        newStartDecimal = startHour + (percentInsideDay * 10);
        newDuration = (finalWidth / dayWidth) * 10;
        
        let startOfWeek = new Date(safeDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setDate(startOfWeek.getDate() + targetDayIndex);
        newDateStr = startOfWeek.toISOString().split('T')[0];
        
    } else if (currentBoardView === 'month') {
        let month = safeDate.getMonth();
        let year = safeDate.getFullYear();
        let daysInMonth = new Date(year, month + 1, 0).getDate();
        
        let dayWidth = 100 / daysInMonth;
        let targetDayIndex = Math.floor(finalLeft / dayWidth);
        if(targetDayIndex < 0) targetDayIndex = 0;
        if(targetDayIndex >= daysInMonth) targetDayIndex = daysInMonth - 1;
        
        let percentInsideDay = (finalLeft % dayWidth) / dayWidth;
        newStartDecimal = startHour + (percentInsideDay * 10);
        newDuration = (finalWidth / dayWidth) * 10;
        
        let newD = new Date(year, month, targetDayIndex + 1, 12, 0, 0);
        newDateStr = newD.toISOString().split('T')[0];
    }

    newStartDecimal = Math.round(newStartDecimal * 4) / 4;
    newDuration = Math.round(newDuration * 4) / 4;

    if (newStartDecimal < 7) newStartDecimal = 7;
    if (newStartDecimal > 16.5) newStartDecimal = 16.5;
    if (newDuration < 0.5) newDuration = 0.5;

    let h = Math.floor(newStartDecimal);
    let m = Math.round((newStartDecimal - h) * 60);
    let timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    db[index].date = newDateStr;
    db[index].startTime = timeStr;
    db[index].duration = newDuration.toString();
        
    localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
    if(typeof syncSingleServiceCallToCloud === 'function') syncSingleServiceCallToCloud(db[index].id, db[index]);

    tlState.action = null;
    renderServiceBoard(); 
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
/** Saved when the engine ends a segment (silence); prepended to the next session while still holding the button. */
let dispatcherVoiceCarryover = "";
let isDispatcherRecording = false;
let currentSearchResults = []; 

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    dispatcherRecognition = new SpeechRecognition();
    dispatcherRecognition.continuous = true;
    dispatcherRecognition.interimResults = true;
    dispatcherRecognition.maxAlternatives = 1;

    /** Full transcript = carryover from prior segment + this segment (Chrome clears results on restart). */
    dispatcherRecognition.onresult = (event) => {
        let segment = "";
        for (let i = 0; i < event.results.length; i++) {
            segment += event.results[i][0].transcript;
        }
        const seg = segment.trim();
        currentVoiceSearchText = (dispatcherVoiceCarryover + (dispatcherVoiceCarryover && seg ? " " : "") + seg).trim();

        const micBtn = document.getElementById('scMicBtn');
        if (isDispatcherRecording && micBtn) {
            micBtn.innerText = "🗣️ " + currentVoiceSearchText;
        }
    };

    /** After silence the engine stops; keep text and restart while the button is still held. */
    dispatcherRecognition.onend = () => {
        if (isDispatcherRecording) {
            dispatcherVoiceCarryover = currentVoiceSearchText;
            try {
                dispatcherRecognition.start();
            } catch (e) {}
        }
    };

    dispatcherRecognition.onerror = (event) => {
        if (event.error === "aborted") return;
        if (event.error === "no-speech" && isDispatcherRecording) return;
        console.error("Speech error", event.error);
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
    dispatcherVoiceCarryover = "";

    const micBtn = document.getElementById("scMicBtn");
    if (micBtn) {
        micBtn.innerText = "🔴 LISTENING... (release when done)";
        micBtn.style.backgroundColor = "#e74c3c";
        micBtn.style.transform = "scale(0.95)";
    }

    window.addEventListener("mouseup", stopDispatcherVoiceSearch);
    try {
        dispatcherRecognition.start();
    } catch (err) {}
}

async function stopDispatcherVoiceSearch() {
    if (!isDispatcherRecording) return;
    isDispatcherRecording = false;
    dispatcherVoiceCarryover = "";

    window.removeEventListener("mouseup", stopDispatcherVoiceSearch);
    try {
        dispatcherRecognition.stop();
    } catch (e) {}
    
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
/** Same pattern as customer mic: speech engine segments; carry over between restarts while holding. */
let issueVoiceCarryover = "";
let isIssueRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    issueRecognition = new SpeechRecognition();
    issueRecognition.continuous = true; 
    issueRecognition.interimResults = true; 

    issueRecognition.onresult = (event) => {
        let segment = "";
        for (let i = 0; i < event.results.length; i++) {
            segment += event.results[i][0].transcript;
        }
        const seg = segment.trim();
        currentIssueVoiceText = (issueVoiceCarryover + (issueVoiceCarryover && seg ? " " : "") + seg).trim();
        const micBtn = document.getElementById('scIssueMicBtn');
        if (isIssueRecording && micBtn) {
            micBtn.innerText = "🗣️ " + (currentIssueVoiceText.length > 48 ? currentIssueVoiceText.slice(0, 45) + "…" : currentIssueVoiceText);
        }
    };

    issueRecognition.onend = () => {
        if (isIssueRecording) {
            issueVoiceCarryover = currentIssueVoiceText;
            try { issueRecognition.start(); } catch (e) {}
        }
    };

    issueRecognition.onerror = (event) => {
        if (event.error === "aborted") return;
        if (event.error === "no-speech" && isIssueRecording) return;
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
    issueVoiceCarryover = "";
    
    const micBtn = document.getElementById('scIssueMicBtn');
    if(micBtn) {
        micBtn.innerText = "🔴 LISTENING... (release when done)";
        micBtn.style.backgroundColor = "#e74c3c";
        micBtn.style.transform = "scale(0.95)"; 
    }
    
    window.addEventListener('mouseup', stopIssueVoiceInput);
    try { issueRecognition.start(); } catch(e) {}
}

function stopIssueVoiceInput() {
    if (!isIssueRecording) return;
    isIssueRecording = false;
    issueVoiceCarryover = "";
    
    window.removeEventListener('mouseup', stopIssueVoiceInput);
    try { issueRecognition.stop(); } catch(e) {}
    
    const micBtn = document.getElementById('scIssueMicBtn');
    if(micBtn) micBtn.style.transform = "scale(1)"; 
    
    if (currentIssueVoiceText.trim() !== "") {
        appendIssueTranscriptLocal(currentIssueVoiceText);
    }
    resetIssueMicBtn();
}

function resetIssueMicBtn() {
    const micBtn = document.getElementById('scIssueMicBtn');
    if(micBtn) {
        micBtn.innerText = "🎤 HOLD TO SPEAK";
        micBtn.style.backgroundColor = "#f39c12";
    }
}

/** Append voice transcript with light local formatting only (no Gemini). Use Improve With AI to polish. */
function appendIssueTranscriptLocal(rawText) {
    let cleanText = String(rawText || "").trim().toUpperCase();
    if (!cleanText) return;
    if (!cleanText.endsWith(".") && !cleanText.endsWith("?") && !cleanText.endsWith("!")) {
        cleanText += ".";
    }
    const ta = document.getElementById("scIssueInput");
    if (!ta) return;
    const existingText = ta.value.trim();
    ta.value = existingText !== "" ? existingText + " " + cleanText : cleanText;
}

/** If Gemini returns API-not-enabled, show steps (Firebase key is already correct). */
function alertIfGeminiApiDisabled(errMsg) {
    const m = String(errMsg || "");
    if (
        !/generative\s*language|generativelanguage\.googleapis/i.test(m) ||
        !/not\s*been\s*used|disabled|PERMISSION_DENIED|SERVICE_DISABLED|403/i.test(m)
    ) {
        return false;
    }
    const proj =
        typeof firebaseConfig !== "undefined" && firebaseConfig.projectId
            ? firebaseConfig.projectId
            : "";
    const enableUrl =
        "https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com?project=" +
        encodeURIComponent(proj || "twin-pillars-app");
    alert(
        "You are already using your Firebase API key. Google also requires the Generative Language API to be turned ON for the same Google Cloud project as Firebase.\n\n" +
            "1) Open the link below\n" +
            "2) Click Enable\n" +
            "3) Wait 1–2 minutes, then try Improve With AI again\n\n" +
            enableUrl
    );
    return true;
}

/**
 * Replaces #scIssueInput content using Gemini + invoice-style editor rules (user speaks/types raw; this polishes on demand).
 */
async function improveIssueTextWithAI() {
    const ta = document.getElementById("scIssueInput");
    const btn = document.getElementById("scIssueImproveAiBtn");
    if (!ta) return;

    const raw = ta.value.trim();
    if (!raw) {
        alert("Enter or dictate text in the issue box first, then click Improve With AI.");
        return;
    }

    if (typeof getGeminiApiKey !== "function") {
        alert("Gemini API key is not available. Add it under Settings → Integrations & API Keys.");
        return;
    }
    const geminiKey = await getGeminiApiKey();
    if (!geminiKey) {
        alert("Gemini API key is not available. Add it under Settings → Integrations & API Keys.");
        return;
    }

    const safeRaw = String(raw).replace(/"""|```/g, " ");
    const editorRules = [
        "You are an expert HVAC Dispatch Editor. Your job is to take raw, hastily written, or voice-transcribed notes and transform them into clean, concise, and highly professional text for a customer invoice. Follow these strict rules:",
        "1. Fix all grammar, punctuation, and spelling.",
        "2. Remove repetitive statements, filler words (like 'um', 'uh'), and run-on sentences.",
        "3. Maintain an objective, professional tone.",
        "4. NEVER invent new information, parts, or complaints; only use the exact facts provided in the raw text.",
        "5. Output ONLY the finalized, cleaned text. Do not include any introductory or concluding remarks.",
    ].join("\n");

    const prompt =
        editorRules +
        "\n\nRAW TEXT TO EDIT:\n\"\"\"\n" +
        safeRaw +
        "\n\"\"\"";

    const label = "✨ Improve With AI";
    if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Improving…";
    }

    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/" +
                (typeof GEMINI_GENERATE_MODEL !== "undefined" ? GEMINI_GENERATE_MODEL : "gemini-2.5-flash") +
                ":generateContent?key=" +
                encodeURIComponent(geminiKey),
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
                }),
            }
        );

        const data = await response.json();
        if (data.error) {
            console.error("Gemini API error:", data.error);
            const msg = data.error.message || "Gemini request failed.";
            if (!alertIfGeminiApiDisabled(msg)) {
                alert(msg);
            }
            return;
        }

        const part =
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts[0];

        let out = part && part.text ? String(part.text).trim() : "";
        out = out.replace(/^["']|["']$/g, "").trim();
        const fence = out.match(/```(?:\w*)?\s*([\s\S]*?)```/);
        if (fence) out = fence[1].trim();

        if (!out) {
            alert("No text returned from AI. Try again or check the console.");
            return;
        }

        ta.value = out.replace(/\s+/g, " ").trim();
        if (typeof showSaveCue === "function") {
            showSaveCue("✨ Issue polished for invoice");
        }
    } catch (err) {
        console.error("improveIssueTextWithAI", err);
        alert("Improve With AI failed: " + (err && err.message ? err.message : String(err)));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = label;
        }
    }
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
    boardResizeState.el = e.currentTarget.parentElement; 
    boardResizeState.startHeight = boardResizeState.el.getBoundingClientRect().height;
    
    window.addEventListener('mousemove', doBoardResize);
    window.addEventListener('mouseup', stopBoardResize);
    
    document.body.style.cursor = 'ns-resize'; 
}

function doBoardResize(e) {
    if (!boardResizeState.isResizing) return;
    
    let deltaY = e.clientY - boardResizeState.startY;
    let newHeight = boardResizeState.startHeight + deltaY;
    
    if (newHeight < 150) newHeight = 150; 
    
    boardResizeState.el.style.flex = 'none'; 
    boardResizeState.el.style.height = newHeight + 'px';
    
    if (dispatchMap) dispatchMap.invalidateSize(); 
}

function stopBoardResize(e) {
    boardResizeState.isResizing = false;
    window.removeEventListener('mousemove', doBoardResize);
    window.removeEventListener('mouseup', stopBoardResize);
    
    document.body.style.cursor = 'default';
    
    let finalHeight = boardResizeState.el.style.height;
    localStorage.setItem('tp_board_height', finalHeight);
    
    if (dispatchMap) dispatchMap.invalidateSize(); 
}

// ====================================================================
// --- QUICK STATUS UPDATER ---
// ====================================================================
function quickUpdateStatus(event, ticketId, newStatus) {
    event.stopPropagation(); 
    
    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    let index = db.findIndex(sc => sc.id === ticketId);
    
    if (index !== -1) {
        db[index].status = newStatus;
        localStorage.setItem('twinPillarsServiceDB', JSON.stringify(db));
        
        if(typeof syncSingleServiceCallToCloud === 'function') {
            syncSingleServiceCallToCloud(ticketId, db[index]);
        }
        
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

    switchTab('quoting');

    if (typeof startNewQuote === 'function') startNewQuote();

    document.getElementById('custNameInput').value = sc.customerName || "";
    document.getElementById('custNumInput').value = sc.customerNum || "";
    document.getElementById('contactNameInput').value = sc.contactName || "";
    document.getElementById('custStreetInput').value = sc.locationAddress || "";
    document.getElementById('custCityInput').value = sc.custCity || "";
    document.getElementById('custStateInput').value = sc.custState || "";
    document.getElementById('custZipInput').value = sc.custZip || "";
    
    document.getElementById('quoteLocNumInput').value = sc.locationNum || "";

    let notesArea = document.getElementById('requoteNoteHistory');
    if (notesArea) {
        document.getElementById('requoteNoteContainer').style.display = 'flex';
        let block = `Originated from Service Ticket: ${sc.ticketNum}
Reported Issue: ${sc.issue || ''}
Equipment: ${sc.equip || 'N/A'}
Dispatch Notes: ${sc.notes || 'N/A'}`;
        if (sc.techNotes && String(sc.techNotes).trim()) {
            block += `\n\n--- Field technician report (full text) ---\n${sc.techNotes}`;
        }
        notesArea.value = block;
    }

    if (typeof populateQuoteFromServiceCall === 'function') populateQuoteFromServiceCall(sc);
    else if (typeof addPartRow === 'function') addPartRow();

    if (typeof handleQuoteStatusChange === 'function') handleQuoteStatusChange();
    if (typeof updateLocationDatalist === 'function') updateLocationDatalist();

    if (typeof showSaveCue === 'function') showSaveCue("✓ Copied to Quoting Tool");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function convertToInvoice(ticketId) {
    closeTicketDetails();

    let db = JSON.parse(localStorage.getItem('twinPillarsServiceDB') || '[]');
    const sc = db.find(s => s.id === ticketId);
    if (!sc) return;

    switchTab('invoice');

    if (typeof clearInvoiceForm === 'function') clearInvoiceForm();

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

    document.getElementById('invEquip').value = sc.equip || "";
    document.getElementById('invNotes').value = `Original Ticket: ${sc.ticketNum}\nReported Issue: ${sc.issue}`;
    const invDiagCopy = document.getElementById('invDiag');
    if (invDiagCopy) invDiagCopy.value = "";
    const invSdCopy = document.getElementById('invServiceDate');
    if (invSdCopy) {
        if (sc.date) invSdCopy.value = sc.date;
        else invSdCopy.valueAsDate = new Date();
    }

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
    const billAndServiceBlock = custName + "\n" + formattedLoc;
    if (billToEl) billToEl.value = billAndServiceBlock;
    if (serviceLocEl) serviceLocEl.value = billAndServiceBlock;

    if (typeof fetchNextInvoiceNumber === 'function') fetchNextInvoiceNumber();

    if (typeof checkInvoiceParentCompany === 'function') checkInvoiceParentCompany();
    if (typeof applyInvoiceBillTo === 'function') applyInvoiceBillTo();

    if (typeof showSaveCue === 'function') showSaveCue("✓ Copied to Invoicing Tool");
    
    setTimeout(() => {
        const formContainer = document.getElementById('invCustNameInput');
        if(formContainer) formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
}

async function ensureFirebaseStorageForEvidence() {
    if (typeof firebase !== "undefined" && firebase.storage) return;
    await new Promise(function (resolve, reject) {
        const s = document.createElement("script");
        s.src = "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage-compat.js";
        s.onload = function () {
            resolve();
        };
        s.onerror = function () {
            reject(new Error("Could not load Firebase Storage."));
        };
        document.head.appendChild(s);
    });
}

function sanitizeCustomerEvidenceFilename(name) {
    const n = String(name || "file")
        .replace(/[/\\]+/g, "_")
        .replace(/[<>:"|?*]/g, "_");
    return n.slice(0, 180) || "file";
}

async function uploadCustomerEvidenceFile(ticketId, file) {
    await ensureFirebaseStorageForEvidence();
    if (typeof firebase === "undefined" || !firebase.storage) {
        throw new Error("Firebase Storage is not available.");
    }
    const storage = firebase.storage();
    const orig = file && file.name ? file.name : "upload";
    const dot = orig.lastIndexOf(".");
    const ext = dot >= 0 ? orig.slice(dot) : "";
    const base = sanitizeCustomerEvidenceFilename(dot >= 0 ? orig.slice(0, dot) : orig);
    const path = "customer_evidence/" + ticketId + "/" + Date.now() + "_" + base + ext;
    const ref = storage.ref().child(path);
    await ref.put(file, { contentType: file.type || "application/octet-stream" });
    return await ref.getDownloadURL();
}

async function uploadPastedCustomerEvidenceFile(ticketId, blob) {
    await ensureFirebaseStorageForEvidence();
    if (typeof firebase === "undefined" || !firebase.storage) {
        throw new Error("Firebase Storage is not available.");
    }
    const storage = firebase.storage();
    const ts = Date.now();
    const path = "customer_evidence/" + ticketId + "/pasted_" + ts + ".png";
    const ref = storage.ref().child(path);
    await ref.put(blob, { contentType: blob.type || "image/png" });
    return await ref.getDownloadURL();
}

function getClipboardImageBlobForPaste(clipboardData) {
    if (!clipboardData) return null;
    if (clipboardData.items && clipboardData.items.length) {
        for (let i = 0; i < clipboardData.items.length; i++) {
            const it = clipboardData.items[i];
            if (it.type && it.type.indexOf("image") === 0) {
                const f = it.getAsFile();
                if (f) return f;
            }
        }
    }
    if (clipboardData.files && clipboardData.files.length) {
        const f = clipboardData.files[0];
        if (f && f.type && f.type.indexOf("image") === 0) return f;
    }
    return null;
}

function persistTicketCustomerEvidenceUrls(ticketId, urls) {
    let db = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]");
    const idx = db.findIndex((s) => s.id === ticketId);
    if (idx === -1) return;
    db[idx].customerEvidenceUrls = urls;
    localStorage.setItem("twinPillarsServiceDB", JSON.stringify(db));
    if (typeof syncSingleServiceCallToCloud === "function") {
        syncSingleServiceCallToCloud(ticketId, db[idx]);
    }
    if (typeof renderServiceBoard === "function") renderServiceBoard();
}

function setupTicketDetailsCustomerEvidence(ticketId) {
    const input = document.getElementById("tdCustomerEvidenceInput");
    const list = document.getElementById("tdCustomerEvidenceList");
    const statusEl = document.getElementById("tdCustomerEvidenceStatus");
    if (!input || !list) return;

    function getUrlsFromDb() {
        const db = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]");
        const sc = db.find((s) => s.id === ticketId);
        const raw = sc && sc.customerEvidenceUrls;
        return Array.isArray(raw) ? raw.filter(Boolean) : [];
    }

    let urls = getUrlsFromDb();

    function renderList() {
        if (!urls.length) {
            list.innerHTML =
                '<p style="margin:0; font-size:12px; color:#999;">No files attached yet.</p>';
            return;
        }
        list.innerHTML = urls
            .map((url, i) => {
                const safe = escapeHtmlServiceArchive(url);
                const isImg = /\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(String(url));
                const thumb = isImg
                    ? `<img src="${safe}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">`
                    : '<span style="font-size:22px;">📄</span>';
                return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:8px;background:#fafafa;border:1px solid #e5e5e5;border-radius:4px;">
                    ${thumb}
                    <a href="${safe}" target="_blank" rel="noopener" style="flex:1;word-break:break-all;font-size:12px;color:#1e4b85;">Open file</a>
                    <button type="button" class="gen-btn" style="padding:6px 10px;background:#e74c3c;font-size:12px;" data-td-ev-i="${i}">Remove</button>
                </div>`;
            })
            .join("");
        list.querySelectorAll("[data-td-ev-i]").forEach((btn) => {
            btn.onclick = function () {
                const i = parseInt(btn.getAttribute("data-td-ev-i"), 10);
                if (isNaN(i)) return;
                urls.splice(i, 1);
                persistTicketCustomerEvidenceUrls(ticketId, urls);
                urls = getUrlsFromDb();
                renderList();
            };
        });
    }

    input.onchange = async function () {
        const files = input.files;
        if (!files || !files.length) return;
        if (statusEl) statusEl.textContent = "Uploading…";
        input.disabled = true;
        const next = [...urls];
        try {
            for (let fi = 0; fi < files.length; fi++) {
                const url = await uploadCustomerEvidenceFile(ticketId, files[fi]);
                next.push(url);
            }
            persistTicketCustomerEvidenceUrls(ticketId, next);
            urls = getUrlsFromDb();
            renderList();
            if (statusEl) statusEl.textContent = "Saved.";
            setTimeout(function () {
                if (statusEl) statusEl.textContent = "";
            }, 2500);
        } catch (e) {
            console.error(e);
            alert("Upload failed: " + (e.message || e));
            if (statusEl) statusEl.textContent = "";
        }
        input.value = "";
        input.disabled = false;
    };

    renderList();
}

function escapeHtmlServiceArchive(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Field-app repair quotes (Firestore field_quotes): show data plate thumbnail as source-of-truth for dispatchers.
 */
function loadFieldQuotesForTicketIntoModal(ticketId) {
    const mount = document.getElementById("tdFieldQuotesMount");
    if (!mount) return;
    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
        mount.innerHTML = "";
        return;
    }
    mount.innerHTML = '<p style="font-size:12px;color:#95a5a6;margin:0;">Loading field repair quotes…</p>';
    firebase.firestore().collection("field_quotes").where("ticketId", "==", ticketId).get()
        .then((snap) => {
            if (snap.empty) {
                mount.innerHTML = '<p style="font-size:12px;color:#999;margin:0;">No field repair quotes saved for this ticket.</p>';
                return;
            }
            const rows = [];
            snap.forEach((doc) => rows.push({ id: doc.id, data: doc.data() || {} }));
            rows.sort((a, b) => String(b.data.savedAt || "").localeCompare(String(a.data.savedAt || "")));
            let html = '<div style="margin-top:4px;padding-top:12px;border-top:1px solid #eaeaea;"><strong style="color:#1e4b85;font-size:14px;">Field repair quotes (from app)</strong></div>';
            rows.forEach(({ data: q }) => {
                const plateUrl = q.dataPlatePhotoUrl && String(q.dataPlatePhotoUrl).trim();
                const overallUrl = q.overallPhotoUrl && String(q.overallPhotoUrl).trim();
                const desc = escapeHtmlServiceArchive(String(q.description || "").slice(0, 280));
                const when = escapeHtmlServiceArchive(String(q.date || q.savedAt || "—"));
                const tech = escapeHtmlServiceArchive(String(q.techName || "—"));
                html += `<div style="border:1px solid #e8eef4;border-radius:8px;padding:12px;margin-top:10px;background:#fafbfc;">`;
                html += `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">${when} · ${tech}</div>`;
                html += `<p style="margin:0 0 10px 0;font-size:13px;line-height:1.45;">${desc.replace(/\n/g, "<br>")}</p>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;">`;
                if (plateUrl) {
                    const safeP = escapeHtmlServiceArchive(plateUrl);
                    html += `<div style="text-align:center;max-width:140px;">`;
                    html += `<div style="font-size:10px;color:#475569;font-weight:700;margin-bottom:4px;">Data plate (source photo)</div>`;
                    html += `<a href="${safeP}" target="_blank" rel="noopener" title="Open full size">`;
                    html += `<img src="${safeP}" alt="Data plate" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid #cbd5e1;object-fit:cover;cursor:pointer;display:block;"/></a></div>`;
                }
                if (overallUrl) {
                    const safeO = escapeHtmlServiceArchive(overallUrl);
                    html += `<div style="text-align:center;max-width:140px;">`;
                    html += `<div style="font-size:10px;color:#475569;font-weight:700;margin-bottom:4px;">Overall unit</div>`;
                    html += `<a href="${safeO}" target="_blank" rel="noopener" title="Open full size">`;
                    html += `<img src="${safeO}" alt="Overall" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid #cbd5e1;object-fit:cover;cursor:pointer;display:block;"/></a></div>`;
                }
                if (!plateUrl && !overallUrl) {
                    html += `<span style="font-size:11px;color:#e74c3c;">No equipment photos stored on this quote record.</span>`;
                }
                html += `</div></div>`;
            });
            mount.innerHTML = html;
        })
        .catch((e) => {
            console.error("loadFieldQuotesForTicketIntoModal", e);
            mount.innerHTML = '<p style="font-size:12px;color:#e74c3c;margin:0;">Could not load field repair quotes.</p>';
        });
}

function openArchivedServiceModal() {
    const body = document.getElementById("archivedServiceModalBody");
    const modal = document.getElementById("archivedServiceModal");
    if (!body || !modal) return;
    let db = [];
    try {
        db = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]");
    } catch (e) {
        db = [];
    }
    const archived = db.filter((s) => s.archived).sort((a, b) => String(b.archivedAt || "").localeCompare(String(a.archivedAt || "")));
    if (archived.length === 0) {
        body.innerHTML = '<p style="color:#777; margin:0;">No archived service calls yet. Open a ticket, then use <strong>Archive</strong> in the details window.</p>';
    } else {
        const rows = archived
            .map((sc) => {
                const archWhen = sc.archivedAt ? new Date(sc.archivedAt).toLocaleString() : "—";
                return `<tr>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtmlServiceArchive(sc.ticketNum)}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtmlServiceArchive(sc.customerName)}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtmlServiceArchive(sc.date)}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee;">${escapeHtmlServiceArchive(sc.status)}</td>
                    <td style="padding:8px; border-bottom:1px solid #eee; font-size:12px; color:#555;">${escapeHtmlServiceArchive(archWhen)}</td>
                </tr>`;
            })
            .join("");
        body.innerHTML = `<table style="width:100%; border-collapse:collapse;">
            <thead><tr style="background:#f4f6f7; text-align:left; font-size:12px;">
                <th style="padding:8px;">Ticket</th><th>Customer</th><th>Sched. date</th><th>Status</th><th>Archived</th>
            </tr></thead><tbody>${rows}</tbody></table>`;
    }
    modal.style.display = "block";
}

document.addEventListener(
    "paste",
    function ticketDetailsModalPasteCapture(e) {
        const modal = document.getElementById("ticketDetailsModal");
        if (!modal || modal.style.display !== "block" || typeof currentOpenDetailsId === "undefined" || !currentOpenDetailsId) {
            return;
        }
        const ae = document.activeElement;
        if (!modal.contains(e.target) && !(ae && modal.contains(ae))) return;
        const blob = getClipboardImageBlobForPaste(e.clipboardData);
        if (!blob) return;
        e.preventDefault();
        e.stopPropagation();
        const ticketId = currentOpenDetailsId;
        const statusEl = document.getElementById("tdCustomerEvidenceStatus");
        if (statusEl) {
            statusEl.style.color = "#666";
            statusEl.textContent = "Uploading pasted image…";
        }
        (async function () {
            try {
                const url = await uploadPastedCustomerEvidenceFile(ticketId, blob);
                let db = JSON.parse(localStorage.getItem("twinPillarsServiceDB") || "[]");
                const idx = db.findIndex((s) => s.id === ticketId);
                if (idx === -1) throw new Error("Ticket not found in local data.");
                const cur = Array.isArray(db[idx].customerEvidenceUrls) ? db[idx].customerEvidenceUrls.filter(Boolean) : [];
                const next = cur.concat([url]);
                persistTicketCustomerEvidenceUrls(ticketId, next);
                setupTicketDetailsCustomerEvidence(ticketId);
                if (statusEl) {
                    statusEl.style.color = "#1e8449";
                    statusEl.textContent = "✓ Upload complete";
                    setTimeout(function () {
                        if (statusEl && statusEl.textContent === "✓ Upload complete") {
                            statusEl.textContent = "";
                            statusEl.style.color = "";
                        }
                    }, 3200);
                }
            } catch (err) {
                console.error(err);
                if (statusEl) {
                    statusEl.style.color = "#e74c3c";
                    statusEl.textContent = "Upload failed: " + (err.message || err);
                }
            }
        })();
    },
    true
);
