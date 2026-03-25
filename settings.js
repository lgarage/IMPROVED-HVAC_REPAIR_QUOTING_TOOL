// ====================================================================
// --- MASTER TEMPLATE SEED DATA (FROM SPREADSHEETS) ---
// ====================================================================
const seedDataApprentice = [
    { name: "LHKNL Headlamp Flashlight", category: "Accessories", vendor: "Amazon", bundle: false },
    { name: "3-Piece Magnetic Tray Holder", category: "Accessories", vendor: "Amazon", bundle: false },
    { name: "2-Piece Knipex Cobra Pliers Set", category: "Hand Tools", vendor: "Amazon", bundle: false },
    { name: "Milwaukee FASTBACK Flip Utility Knife", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Aluminum Pipe Wrench 14\"", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Aluminum Pipe Wrench 18\"", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Aluminum Pipe Wrench 24\"", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "PVC Cutter", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Drill Bit Set", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "5/8\" x 50 FT Heavy Rope", category: "Accessories", vendor: "Home Depot", bundle: false },
    { name: "Klein Tools Digital Dual-Range Non-Contact Voltage Tester", category: "Diagnostic", vendor: "Home Depot", bundle: false },
    { name: "Husky 10 in. Adjustable Wrench", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Klein Tools Heavy-Duty Flathead Demolition Screwdriver", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Milwaukee Folding Drywall Jab Saw", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Klein Tools Kurve Wire Stripper", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "9 in. Crimping and Cutting Tool", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "8\" High-Leverage Diagonal-Cutting Pliers", category: "Hand Tools", vendor: "Home Depot", bundle: false },
    { name: "Malco TBP33 Heavy-Duty Tool Backpack Bundle", category: "Tool Bag", vendor: "USA Tool Depot", bundle: false },
    { name: "C5R REDLINE 5-Blade Pipe Crimper", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "SL1R REDLINE Snap Lock Punch", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "N1R REDLINE Hand Notcher", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "S2R REDLINE Hand Seamer", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "12F Folding Tool (12\")", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "18 Divider", category: "Hand Tool (Sheet Metal)", vendor: "USA Tool Depot", bundle: true },
    { name: "M2001 Aviation Snip (Left Cut)", category: "Hand Tool (Cutting)", vendor: "USA Tool Depot", bundle: true },
    { name: "M2002 Aviation Snip (Right Cut)", category: "Hand Tool (Cutting)", vendor: "USA Tool Depot", bundle: true },
    { name: "M2005 Bulldog Aviation Snip", category: "Hand Tool (Cutting)", vendor: "USA Tool Depot", bundle: true },
    { name: "M14N 14\" Aluminum Handled Pattern Snip", category: "Hand Tool (Cutting)", vendor: "USA Tool Depot", bundle: true },
    { name: "A0 1/8\" Scratch Awl", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "A1 7/32\" Scratch Awl", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "SH3 Setting Hammer", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "DB1 Dead Blow Hammer", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "DS2 Offset Duct Stretcher", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "L9M Magnetic Torpedo Level", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "T416M 1\" x 16' Magnetic Tape Measure", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "W29 Hex Key Set", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "RD6 6-in-1 Reversible Driver", category: "Hand Tool (Driving)", vendor: "USA Tool Depot", bundle: true },
    { name: "HHD1S 1/4\" Magnetic Hex Driver", category: "Hand Tool (Driving)", vendor: "USA Tool Depot", bundle: true },
    { name: "HHD2S 5/16\" Magnetic Hex Driver", category: "Hand Tool (Driving)", vendor: "USA Tool Depot", bundle: true },
    { name: "TY4G Tie Tensioning Tool", category: "Hand Tool", vendor: "USA Tool Depot", bundle: true },
    { name: "TS1 TurboShear Attachment", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true },
    { name: "HC1 Hole Cutter", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true },
    { name: "MSH1/4 Magnetic Hex Chuck Driver", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true },
    { name: "MSH5/16 Magnetic Hex Chuck Driver", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true },
    { name: "4MC24 Reciprocating Saw Blade (6\" 24TPI)", category: "Power Tool Accessory", vendor: "USA Tool Depot", bundle: true }
];

const seedDataJman = [
    { name: "Test Lead Set & Alligator Clips", category: "Diagnostic", vendor: "Amazon", bundle: false },
    { name: "LCD Writing Tablet", category: "General", vendor: "Amazon", bundle: false },
    { name: "HVAC Service Wrench", category: "Hand Tool", vendor: "Amazon", bundle: false },
    { name: "Grease Gun", category: "Heavy Service", vendor: "Amazon", bundle: false },
    { name: "SAE 7-in-1 Impact Rated Socket Set", category: "Heavy Service", vendor: "Amazon", bundle: false },
    { name: "Shiv / Hub Puller (Posi-Lock)", category: "Heavy Service", vendor: "Amazon", bundle: false },
    { name: "1/4 in. x 3/8 in. Square Socket Adapter", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "1.5 in. Stiff Putty Knife", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "Alloy Steel Screw Driver Bit Set", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "4 in. Pocket Caliper", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "4-in-1 Precision Electronics Screwdriver", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "Telescoping Magnetic Pickup Tool", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "6 in. Magnetic Locking Bit Holder", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "12 in. Magnetic Locking Bit Holder", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "11-in-1 Magnetic Multi Bit Screwdriver", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "Electrician Scissors", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "Right Angle Drill Adapter", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "SAE Quad Drive Ratcheting Wrench Set", category: "Hand Tool", vendor: "Home Depot", bundle: false },
    { name: "5/16 x 1/4 Short Drill Gun Bit", category: "Hand Tool", vendor: "Johnstone", bundle: false },
    { name: "Inspection Mirror", category: "Hand Tool", vendor: "Johnstone", bundle: false },
    { name: "Valve Core Removal Tool", category: "Hand Tool", vendor: "Johnstone", bundle: false },
    { name: "Folding Pocket Thermometer", category: "Diagnostic", vendor: "Johnstone", bundle: false },
    { name: "Rechargeable LED Flashlight", category: "Hand Tool", vendor: "Johnstone", bundle: false },
    { name: "SAE & Metric Ratcheting Wrenches", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Nitrogen Regulator", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Pulley Puller", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Vacuum Cleaner", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Refrigerant Scale", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Combustion Analyzer", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Vacuum Pump (Minimum 7 CFM)", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Refrigerant Recovery Machine", category: "Heavy Service", vendor: "Johnstone", bundle: false },
    { name: "Appion MGAVCR Valve Core Removal Tools", category: "Refrigeration", vendor: "TruTech", bundle: false },
    { name: "Dual-Port Digital Manometer", category: "Diagnostic", vendor: "TruTech", bundle: false },
    { name: "Wireless Vacuum Micron Gauge", category: "Refrigeration", vendor: "TruTech", bundle: false },
    { name: "Refrigerant Leak Detector", category: "Diagnostic", vendor: "TruTech", bundle: false },
    { name: "Hilmor Tool Tote Bag", category: "Tool Bag", vendor: "TruTech", bundle: false },
    { name: "1/4 inch Charging Hoses", category: "Refrigeration", vendor: "TruTech", bundle: true },
    { name: "Compact Clamp Meter", category: "Diagnostic", vendor: "TruTech", bundle: true },
    { name: "3-Port Digital Manifold", category: "Diagnostic", vendor: "TruTech", bundle: true },
    { name: "7 inch Wire Stripper", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "8 inch Tongue and Groove Pliers", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "9-in-1 Multi-Tool Driver", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "Compact Tubing Cutter", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "Folding Hex Key Set", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "Pen Style Deburring Tool", category: "Hand Tool", vendor: "TruTech", bundle: true },
    { name: "Reversible Magnetic Nut Driver", category: "Hand Tool", vendor: "TruTech", bundle: true },
    ...seedDataApprentice
];

const seedDataConsumables = [
    { name: "Wire Nuts (Assorted)", category: "Electrical", cost: 0.15, qty: 0, minLevel: 100, vendor: "Home Depot" },
    { name: "3M Super 33+ Electrical Tape", category: "Electrical", cost: 4.50, qty: 0, minLevel: 10, vendor: "Home Depot" },
    { name: "Clear PVC Glue", category: "Plumbing", cost: 8.00, qty: 0, minLevel: 3, vendor: "Home Depot" },
    { name: "PVC Primer", category: "Plumbing", cost: 7.00, qty: 0, minLevel: 3, vendor: "Home Depot" },
    { name: "Zip-in Screws HW8x1/2ZG", category: "Hardware", cost: 0.05, qty: 0, minLevel: 250, vendor: "USA Tool Depot" }
];

function processSeedData(arr) {
    let uniqueList = [];
    arr.forEach(item => {
        if (!uniqueList.find(u => u.name === item.name)) {
            item.url = `https://www.google.com/search?q=${encodeURIComponent(item.vendor + " " + item.name)}`;
            uniqueList.push(item);
        }
    });
    return uniqueList;
}

const masterJmanTemplate = processSeedData(seedDataJman);
const masterApprenticeTemplate = processSeedData(seedDataApprentice);

// ====================================================================
// --- SETTINGS & TECHNICIAN LOGIC ---
// ====================================================================
let appTechList = [];
let currentEditingTechInv = "";
let editingTemplateType = null; 
let currentInvTab = "tools";
const defaultTechs = ["Dave (Tech 1)", "Sarah (Tech 2)", "Mike (Tech 3)", "Tom (Tech 4)"];

function loadAppTechs() {
    const saved = localStorage.getItem('tp_tech_list');
    if (saved) {
        appTechList = JSON.parse(saved);
    } else {
        appTechList = [...defaultTechs];
        localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));
    }
    
    let masterDB = JSON.parse(localStorage.getItem('tp_master_templates') || '{}');
    let needsUpdate = false;

    if (Object.keys(masterDB).length === 0) {
        masterDB = {
            jman: { tools: masterJmanTemplate, consumables: [] },
            apprentice: { tools: masterApprenticeTemplate, consumables: [] },
            jman_consumables: { tools: [], consumables: seedDataConsumables }
        };
        needsUpdate = true;
    } else {
        if (!masterDB['jman_consumables']) {
            masterDB['jman_consumables'] = { tools: [], consumables: seedDataConsumables };
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        localStorage.setItem('tp_master_templates', JSON.stringify(masterDB));
    }

    renderTechSettings();
    renderMasterTemplates(); 
    populateTechDropdowns();
    
    setTimeout(checkGlobalVMI, 500); 
}

function renderTechSettings() {
    const container = document.getElementById('techListContainer');
    if (!container) return;
    container.innerHTML = '';
    
    if (appTechList.length === 0) {
        container.innerHTML = '<div style="padding: 15px; background: #fdfefe; border: 1px solid #eaeaea; border-radius: 4px; color: #7f8c8d; font-style: italic;">No technicians currently added.</div>';
        return;
    }

    appTechList.forEach((tech, index) => {
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:12px 15px; border-radius:6px; border:1px solid #e1e8ed; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <span style="font-weight:bold; color:#2c3e50; font-size:15px; text-transform:uppercase;">👤 ${tech}</span>
                <div style="display:flex; gap:8px;">
                    <button class="gen-btn" style="background:#1e4b85; padding:6px 12px; font-size:12px; border-radius:4px;" onclick="openTruckInventory('${tech}')">🎒 Inventory</button>
                    <button class="gen-btn" style="background:#3498db; padding:6px 12px; font-size:12px; border-radius:4px;" onclick="editTechnician(${index})">Edit</button>
                    <button class="gen-btn" style="background:#e74c3c; padding:6px 12px; font-size:12px; border-radius:4px;" onclick="removeTechnician(${index})">Remove</button>
                </div>
            </div>
        `;
    });
}

function addNewTechnician() {
    const input = document.getElementById('newTechNameInput');
    const name = input.value.trim().toUpperCase();
    if (name === '') return;
    if (appTechList.includes(name)) {
        alert("This technician is already on the roster!");
        return;
    }
    appTechList.push(name);
    localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));
    input.value = '';
    renderTechSettings();
    populateTechDropdowns();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Technician Added");
}

function editTechnician(index) {
    const currentName = appTechList[index];
    const newName = prompt("Edit Technician Name:", currentName);
    if (newName === null || newName.trim() === '') return;
    
    const cleanName = newName.trim().toUpperCase();
    if (cleanName === currentName) return;

    if (appTechList.includes(cleanName)) {
        alert("This technician name is already in use!");
        return;
    }

    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    if (invDB[currentName]) {
        invDB[cleanName] = invDB[currentName];
        delete invDB[currentName];
        localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
    }

    appTechList[index] = cleanName;
    localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));
    
    renderTechSettings();
    populateTechDropdowns();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Technician Updated");
}

function removeTechnician(index) {
    const techName = appTechList[index];
    if (confirm(`Are you sure you want to remove ${techName} from the roster?`)) {
        appTechList.splice(index, 1);
        localStorage.setItem('tp_tech_list', JSON.stringify(appTechList));
        
        let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
        if (invDB[techName]) {
            delete invDB[techName];
            localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
        }

        renderTechSettings();
        populateTechDropdowns();
        if(typeof showSaveCue === 'function') showSaveCue("✓ Technician Removed");
        checkGlobalVMI(); 
    }
}

function populateTechDropdowns() {
    const scTechSelect = document.getElementById('scAssignedTechInput');
    if (!scTechSelect) return;
    
    const currentVal = scTechSelect.value;
    scTechSelect.innerHTML = '<option value="Unassigned">Unassigned</option>';
    
    appTechList.forEach(tech => {
        const opt = document.createElement('option');
        opt.value = tech;
        opt.textContent = tech;
        scTechSelect.appendChild(opt);
    });

    if (appTechList.includes(currentVal) || currentVal === 'Unassigned') {
        scTechSelect.value = currentVal;
    }
    
    if (typeof renderGanttHeaders === 'function') {
        try { renderGanttHeaders(); renderServiceBoard(); } catch(e) {}
    }
}

// ====================================================================
// --- DYNAMIC TEMPLATE MANAGEMENT ---
// ====================================================================

function renderMasterTemplates() {
    let masterDB = JSON.parse(localStorage.getItem('tp_master_templates') || '{}');
    let container = document.getElementById('masterTemplatesContainer');
    if(!container) return;
    
    container.innerHTML = '';
    for(let key in masterDB) {
        let displayName = key.replace(/_/g, ' ').toUpperCase();
        container.innerHTML += `
            <div style="background:#fff; border:1px solid #e1e8ed; padding:12px 15px; border-radius:6px; display:flex; align-items:center; gap:15px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <strong style="color:#1e4b85; min-width: 170px;">${displayName}</strong>
                <button class="gen-btn btn-sm" style="background:#f39c12; padding:6px 15px;" onclick="openMasterTemplateEditor('${key}')">Edit List</button>
            </div>
        `;
    }
    renderTemplateLoaders(); 
}

function createNewTemplate() {
    let name = prompt("Enter a name for the new template (e.g., 'Install Crew', 'Maintenance'):");
    if(!name || name.trim() === '') return;
    
    let key = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'); 
    
    let masterDB = JSON.parse(localStorage.getItem('tp_master_templates') || '{}');
    if(masterDB[key]) { 
        alert("A template with a similar name already exists!"); 
        return; 
    }
    
    masterDB[key] = { tools: [], consumables: [] };
    localStorage.setItem('tp_master_templates', JSON.stringify(masterDB));
    renderMasterTemplates();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Template Created");
}

function deleteCurrentTemplate() {
    if (!editingTemplateType) return;
    let displayName = editingTemplateType.replace(/_/g, ' ').toUpperCase();
    
    let confirmation = prompt(`WARNING: You are about to permanently delete the '${displayName}' template.\n\nTo confirm, type DELETE in the box below:`);
    
    if (confirmation === "DELETE") {
        let masterDB = JSON.parse(localStorage.getItem('tp_master_templates') || '{}');
        delete masterDB[editingTemplateType];
        localStorage.setItem('tp_master_templates', JSON.stringify(masterDB));
        renderMasterTemplates();
        closeTruckInventory();
        if(typeof showSaveCue === 'function') showSaveCue("✓ Template Deleted");
    } else if (confirmation !== null) {
        alert("Deletion canceled. You did not type DELETE exactly.");
    }
}

function renderTemplateLoaders() {
    let masterDB = JSON.parse(localStorage.getItem('tp_master_templates') || '{}');
    let container = document.getElementById('dynamicTemplateLoaders');
    if(!container) return;
    
    container.innerHTML = '';
    const colors = ['#f39c12', '#8e44ad', '#3498db', '#16a085'];
    let colorIndex = 0;
    
    for(let key in masterDB) {
        let displayName = key.replace(/_/g, ' ').toUpperCase();
        let color = colors[colorIndex % colors.length];
        container.innerHTML += `<button class="gen-btn btn-sm" style="background:${color}; margin-right:8px; padding:8px 15px;" onclick="loadMasterTemplate('${key}')">Load ${displayName}</button>`;
        colorIndex++;
    }
}

// ====================================================================
// --- VMI / INVENTORY MODAL LOGIC & REPLENISHMENT REPORTING ---
// ====================================================================

function openTruckInventory(techName) {
    editingTemplateType = null; 
    currentEditingTechInv = techName;
    document.getElementById('invModalTitle').innerText = `${techName}'s Truck`;
    
    document.getElementById('btnDeleteTemplate').style.display = 'none';
    document.getElementById('btnClearInvBtn').style.display = 'inline-block';
    
    switchInvTab('tools'); 
    document.getElementById('truckInventoryModal').style.display = 'block';
    renderTruckInventory();
}

function openMasterTemplateEditor(type) {
    editingTemplateType = type; 
    currentEditingTechInv = "";
    
    let titleText = "Master " + type.replace(/_/g, ' ').toUpperCase() + " Template";
    document.getElementById('invModalTitle').innerText = titleText;
    
    document.getElementById('btnDeleteTemplate').style.display = 'inline-block';
    document.getElementById('btnClearInvBtn').style.display = 'none';
    
    if (type.includes('consumables')) {
        switchInvTab('consumables');
    } else {
        switchInvTab('tools'); 
    }
    
    document.getElementById('truckInventoryModal').style.display = 'block';
    renderTruckInventory();
}

function closeTruckInventory() {
    document.getElementById('truckInventoryModal').style.display = 'none';
    currentEditingTechInv = "";
    editingTemplateType = null;
    checkGlobalVMI(); 
}

function switchInvTab(tabName) {
    currentInvTab = tabName;
    document.getElementById('btnTabTools').classList.remove('active');
    document.getElementById('btnTabConsumables').classList.remove('active');
    
    const btnAdd = document.getElementById('btnAddCustomItem');
    
    if(tabName === 'tools') {
        document.getElementById('btnTabTools').classList.add('active');
        if (!editingTemplateType) document.getElementById('invActionButtons').style.display = 'block';
        if (btnAdd) btnAdd.innerText = "+ Add Custom Tool";
    } else {
        document.getElementById('btnTabConsumables').classList.add('active');
        document.getElementById('invActionButtons').style.display = 'none';
        if (btnAdd) btnAdd.innerText = "+ Add Custom Part";
    }
    renderTruckInventory();
}

function getActiveInvData() {
    let storageKey = editingTemplateType ? 'tp_master_templates' : 'tp_truck_inventories';
    let targetKey = editingTemplateType ? editingTemplateType : currentEditingTechInv;
    let db = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    if (!db[targetKey] || Array.isArray(db[targetKey])) {
        let oldTools = Array.isArray(db[targetKey]) ? db[targetKey] : [];
        db[targetKey] = { tools: oldTools, consumables: [] };
        localStorage.setItem(storageKey, JSON.stringify(db));
    }
    
    return { db, storageKey, targetKey, invData: db[targetKey] };
}

function renderTruckInventory() {
    const thead = document.querySelector('.inventory-table thead');
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';

    if (currentInvTab === 'tools') {
        thead.innerHTML = `
            <tr>
                <th width="30%">Tool Name</th>
                <th width="20%">Category</th>
                <th width="20%">Vendor</th>
                <th width="10%">Bundle?</th>
                <th width="15%">Link</th>
                <th width="5%"></th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr>
                <th width="20%">Part Name</th>
                <th width="12%">Category</th>
                <th width="10%">Unit Cost $</th>
                <th width="10%">Current QTY</th>
                <th width="10%">Min Level</th>
                <th width="13%">Vendor</th>
                <th width="10%">Status</th>
                <th width="10%">Link</th>
                <th width="5%"></th>
            </tr>
        `;
    }

    let activeData = getActiveInvData();
    const currentList = currentInvTab === 'tools' ? activeData.invData.tools : activeData.invData.consumables;

    if (currentList.length === 0) {
        let cols = currentInvTab === 'tools' ? 6 : 9;
        tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align: center; color: #7f8c8d; padding: 30px;">This ${currentInvTab} list is currently empty.</td></tr>`;
        return;
    }

    currentList.forEach((item, idx) => {
        if (currentInvTab === 'tools') {
            let bundleCheck = item.bundle ? "checked" : "";
            tbody.innerHTML += `
                <tr>
                    <td><input type="text" class="inventory-input p-name" value="${item.name || ''}"></td>
                    <td><input type="text" class="inventory-input p-cat" value="${item.category || ''}"></td>
                    <td><input type="text" class="inventory-input p-ven" value="${item.vendor || ''}"></td>
                    <td style="text-align: center;"><input type="checkbox" class="p-bun" ${bundleCheck}></td>
                    <td><a href="${item.url || '#'}" target="_blank" class="inv-link">Shop Link</a><input type="hidden" class="p-url" value="${item.url || ''}"></td>
                    <td><button class="gen-btn btn-sm" style="background:#e74c3c;" onclick="removeToolFromTruck(${idx})">X</button></td>
                </tr>
            `;
        } else {
            let qty = parseInt(item.qty) || 0;
            let min = parseInt(item.minLevel) || 0;
            let cost = parseFloat(item.cost) || 0.00;
            let isLow = qty <= min;
            
            let statusHtml = isLow ? `<span style="color:#e74c3c; font-weight:bold; font-size:11px;">⚠️ LOW STOCK</span>` : `<span style="color:#27ae60; font-weight:bold; font-size:11px;">✓ OK</span>`;
            let rowBg = isLow ? "background-color: #fdedec;" : "";

            tbody.innerHTML += `
                <tr style="${rowBg}">
                    <td><input type="text" class="inventory-input p-name" value="${item.name || ''}"></td>
                    <td><input type="text" class="inventory-input p-cat" value="${item.category || ''}"></td>
                    <td><input type="number" class="inventory-input p-cost" value="${cost.toFixed(2)}" step="0.01" onchange="liveRecalculateStock()"></td>
                    <td><input type="number" class="inventory-input p-qty" value="${qty}" style="width:100%;" min="0" onchange="liveRecalculateStock()"></td>
                    <td><input type="number" class="inventory-input p-min" value="${min}" style="width:100%;" min="0" onchange="liveRecalculateStock()"></td>
                    <td><input type="text" class="inventory-input p-ven" value="${item.vendor || ''}"></td>
                    <td style="text-align: center; vertical-align: middle;">${statusHtml}</td>
                    <td><a href="${item.url || '#'}" target="_blank" class="inv-link">Shop Link</a><input type="hidden" class="p-url" value="${item.url || ''}"></td>
                    <td><button class="gen-btn btn-sm" style="background:#e74c3c;" onclick="removeToolFromTruck(${idx})">X</button></td>
                </tr>
            `;
        }
    });
}

function liveRecalculateStock() {
    saveAndCloseTruckInventory(true); 
    renderTruckInventory(); 
}

// ====================================================================
// --- NEW SMART SPREADSHEET PARSER (HYPERLINK INCLUDED) ---
// ====================================================================
function bulkImportTools() {
    let inst = document.getElementById('bulkImportInstructions');
    if (inst) {
        inst.innerHTML = "Copy columns from Excel/Google Sheets <strong>INCLUDING the Header Row</strong> and paste below.<br><span style='color:#27ae60; font-weight:bold;'>The smart parser will extract your Data and Hyperlinks automatically!</span>";
    }
    
    const textarea = document.getElementById('bulkImportTextarea');
    if(textarea) {
        textarea.value = "";
        textarea.dataset.html = ""; 
        
        if (!textarea.dataset.listening) {
            textarea.addEventListener('paste', function(e) {
                let html = e.clipboardData.getData('text/html');
                if (html) {
                    this.dataset.html = html;
                }
            });
            textarea.dataset.listening = "true";
        }
    }
    
    document.getElementById('bulkImportModal').style.display = 'block';
}

function processBulkImport() {
    const textarea = document.getElementById('bulkImportTextarea');
    let text = textarea.value.trim();
    let htmlData = textarea.dataset.html;

    if (!text && !htmlData) {
        document.getElementById('bulkImportModal').style.display = 'none';
        return;
    }

    let activeData = getActiveInvData();
    let addedCount = 0;
    
    let map = { name: 0, cat: 1, cost: 2, qty: 3, min: 4, ven: 5 };
    let parsedRows = [];

    // Extract data from HTML or plain text
    if (htmlData && htmlData.trim() !== '') {
        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlData, 'text/html');
        let rows = doc.querySelectorAll('tr');

        rows.forEach(row => {
            let tds = row.querySelectorAll('td, th');
            if(tds.length === 0) return;

            let rowData = { texts: [], link: "" };
            tds.forEach(td => {
                rowData.texts.push(td.innerText.trim());
                let a = td.querySelector('a');
                if (a && !rowData.link) {
                    rowData.link = a.href;
                }
            });
            parsedRows.push(rowData);
        });
    } else {
        let rows = text.split('\n');
        rows.forEach(row => {
            let delimiter = row.includes('\t') ? '\t' : ',';
            let texts = row.split(delimiter).map(c => c.trim());
            if(texts.length > 0 && texts[0] !== "") {
                parsedRows.push({ texts: texts, link: "" });
            }
        });
    }

    if (parsedRows.length === 0) return;

    // Map headers
    let firstRowTexts = parsedRows[0].texts.map(c => c.toLowerCase());
    let hasHeaders = false;

    if (firstRowTexts.some(c => c.includes('name') || c.includes('tool') || c.includes('part') || c.includes('desc') || c.includes('category'))) {
        hasHeaders = true;
        
        let nIdx = firstRowTexts.findIndex(c => c.includes('name') || c.includes('tool') || c.includes('part') || c.includes('desc'));
        let catIdx = firstRowTexts.findIndex(c => c.includes('category') || c.includes('cat'));
        let costIdx = firstRowTexts.findIndex(c => c.includes('cost') || c.includes('price') || c.includes('each'));
        let qtyIdx = firstRowTexts.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('stock'));
        let minIdx = firstRowTexts.findIndex(c => c.includes('min') || c.includes('level'));
        let venIdx = firstRowTexts.findIndex(c => c.includes('vendor') || c.includes('brand') || c.includes('supplier'));

        if (nIdx !== -1) map.name = nIdx;
        if (catIdx !== -1) map.cat = catIdx;
        if (costIdx !== -1) map.cost = costIdx;
        if (qtyIdx !== -1) map.qty = qtyIdx;
        if (minIdx !== -1) map.min = minIdx;
        if (venIdx !== -1) map.ven = venIdx;
    }

    let startIndex = hasHeaders ? 1 : 0;

    for (let i = startIndex; i < parsedRows.length; i++) {
        let rowData = parsedRows[i];
        let cols = rowData.texts;
        if (cols.length < 2 && !cols[0]) continue; 

        let partName = cols[map.name] || "Unknown Item";
        let partCat = cols[map.cat] || "Imported";
        let partVen = cols[map.ven] || "";
        
        let partUrl = rowData.link || `https://www.google.com/search?q=${encodeURIComponent(partVen + " " + partName)}`;

        if (currentInvTab === 'tools') {
            activeData.invData.tools.push({
                name: partName,
                category: partCat,
                vendor: partVen,
                bundle: false,
                url: partUrl
            });
            addedCount++;
        } else {
            let costStr = (cols[map.cost] || "0").replace(/[^0-9.]/g, '');
            activeData.invData.consumables.push({
                name: partName,
                category: partCat,
                cost: parseFloat(costStr) || 0,
                qty: parseInt(cols[map.qty]) || 0,
                minLevel: parseInt(cols[map.min]) || 0,
                vendor: partVen,
                url: partUrl
            });
            addedCount++;
        }
    }

    localStorage.setItem(activeData.storageKey, JSON.stringify(activeData.db));
    renderTruckInventory();
    
    document.getElementById('bulkImportModal').style.display = 'none';
    if(typeof showSaveCue === 'function') showSaveCue(`✓ Imported ${addedCount} items`);

    setTimeout(() => {
        const tableContainer = document.querySelector('.inventory-table').parentElement;
        if(tableContainer) tableContainer.scrollTop = tableContainer.scrollHeight;
    }, 100);
}

function addBlankToolRow() {
    let activeData = getActiveInvData();
    
    if (currentInvTab === 'tools') { 
        activeData.invData.tools.push({ name: "", category: "", vendor: "", bundle: false, url: "" }); 
    } else { 
        activeData.invData.consumables.push({ name: "", category: "", cost: 0, qty: 0, minLevel: 5, vendor: "", url: "" }); 
    }
    
    localStorage.setItem(activeData.storageKey, JSON.stringify(activeData.db));
    renderTruckInventory();
    
    const tableContainer = document.querySelector('.inventory-table').parentElement;
    tableContainer.scrollTop = tableContainer.scrollHeight;
}

function removeToolFromTruck(index) {
    let activeData = getActiveInvData();
    
    if (currentInvTab === 'tools') { activeData.invData.tools.splice(index, 1); } 
    else { activeData.invData.consumables.splice(index, 1); }
    
    localStorage.setItem(activeData.storageKey, JSON.stringify(activeData.db));
    renderTruckInventory();
}

function loadMasterTemplate(type) {
    let displayName = type.replace(/_/g, ' ').toUpperCase();
    if(!confirm(`Are you sure you want to load the ${displayName} template? This will add to any tools currently on this list.`)) return;

    let masterDB = JSON.parse(localStorage.getItem('tp_master_templates') || '{}');
    let templateToLoad = masterDB[type];
    
    if (!templateToLoad) return;
    
    let toolsToLoad = Array.isArray(templateToLoad) ? templateToLoad : (templateToLoad.tools || []);
    let consToLoad = Array.isArray(templateToLoad) ? [] : (templateToLoad.consumables || []);

    let activeData = getActiveInvData();
    
    let copyTools = JSON.parse(JSON.stringify(toolsToLoad));
    let copyCons = JSON.parse(JSON.stringify(consToLoad));
    
    activeData.invData.tools = activeData.invData.tools.concat(copyTools);
    activeData.invData.consumables = activeData.invData.consumables.concat(copyCons);
    
    localStorage.setItem(activeData.storageKey, JSON.stringify(activeData.db));
    renderTruckInventory();
}

function clearTruckInventory() {
    let targetLabel = editingTemplateType ? "the master template" : `${currentEditingTechInv}'s truck`;
    if(!confirm(`Are you sure? This will permanently delete ALL items from the ${currentInvTab} list for ${targetLabel}.`)) return;
    
    let activeData = getActiveInvData();
    
    if (currentInvTab === 'tools') { activeData.invData.tools = []; } 
    else { activeData.invData.consumables = []; }
    
    localStorage.setItem(activeData.storageKey, JSON.stringify(activeData.db));
    renderTruckInventory();
}

function saveAndCloseTruckInventory(silent = false) {
    const rows = document.querySelectorAll('#inventoryTableBody tr');
    let updatedList = [];
    
    if (rows.length > 0 && !rows[0].innerText.includes('empty')) {
        rows.forEach(row => {
            let nameEl = row.querySelector('.p-name');
            if (nameEl) {
                if (currentInvTab === 'tools') {
                    updatedList.push({
                        name: nameEl.value,
                        category: row.querySelector('.p-cat').value,
                        vendor: row.querySelector('.p-ven').value,
                        bundle: row.querySelector('.p-bun').checked,
                        url: row.querySelector('.p-url').value
                    });
                } else {
                    updatedList.push({
                        name: nameEl.value,
                        category: row.querySelector('.p-cat').value,
                        cost: parseFloat(row.querySelector('.p-cost').value) || 0,
                        qty: parseInt(row.querySelector('.p-qty').value) || 0,
                        minLevel: parseInt(row.querySelector('.p-min').value) || 0,
                        vendor: row.querySelector('.p-ven').value,
                        url: row.querySelector('.p-url').value
                    });
                }
            }
        });
    }

    let activeData = getActiveInvData();

    if (currentInvTab === 'tools') { activeData.invData.tools = updatedList; } 
    else { activeData.invData.consumables = updatedList; }
    
    localStorage.setItem(activeData.storageKey, JSON.stringify(activeData.db));
    
    if (!silent) {
        closeTruckInventory();
        let msg = editingTemplateType ? "✓ Master Template Saved" : "✓ Loadout Saved";
        if(typeof showSaveCue === 'function') showSaveCue(msg);
    }
}

// ====================================================================
// --- GLOBAL VMI ALERTS, REPORTING, & MODALS INJECTOR ---
// ====================================================================

(function injectSettingsModals() {
    document.addEventListener("DOMContentLoaded", function() {
        const header = document.querySelector('.app-header');
        if(header) {
            header.insertAdjacentHTML('beforeend', `
                <button id="vmiAlertBtn" class="gen-btn" 
                        style="background:#e74c3c; display:none; position:absolute; right:20px; font-size:14px; padding: 10px 20px; box-shadow: 0 2px 8px rgba(231, 76, 60, 0.4); animation: pulse 2s infinite;" 
                        onclick="openVMIReport()">
                    ⚠️ Order Parts
                </button>
            `);
        }

        const modalsHTML = `
            <div id="vmiReportModal" class="modal-overlay" style="z-index: 10020;">
                <div class="modal-content" style="max-width: 900px; height: 80vh; display: flex; flex-direction: column;">
                    <div class="modal-header" style="flex-shrink: 0;">
                        <div>
                            <h2 style="color: #e74c3c; margin: 0;">Vendor Replenishment Report</h2>
                            <p style="margin: 5px 0 0 0; font-size: 13px; color: #7f8c8d;">Parts below minimum threshold across all active trucks.</p>
                        </div>
                        <div style="display:flex; gap: 8px; align-items:center;">
                            <button class="gen-btn" style="background:#f39c12; padding: 6px 12px; font-size: 12px;" onclick="copyVMIReportToClipboard()">📋 Copy Text</button>
                            <button class="gen-btn" style="background:#ea4335; padding: 6px 12px; font-size: 12px;" onclick="emailVMIReport('gmail')">✉️ Gmail</button>
                            <button class="gen-btn" style="background:#27ae60; padding: 6px 12px; font-size: 12px;" onclick="emailVMIReport('desktop')">📧 Outlook</button>
                            <button class="gen-btn" style="background:#1e4b85; padding: 6px 12px; font-size: 12px;" onclick="printVMIReport()">🖨️ Print/PDF</button>
                            <span class="close-modal" style="margin-left: 10px;" onclick="document.getElementById('vmiReportModal').style.display='none'">×</span>
                        </div>
                    </div>
                    <div id="vmiReportContent" style="flex: 1; overflow-y: auto; padding: 10px 5px;">
                    </div>
                </div>
            </div>
            
            <div id="bulkImportModal" class="modal-overlay" style="z-index: 10030;">
                <div class="modal-content" style="max-width: 700px;">
                    <div class="modal-header">
                        <h2 style="color: #1e4b85; margin: 0;">📋 Bulk Paste from Excel</h2>
                        <span class="close-modal" onclick="document.getElementById('bulkImportModal').style.display='none'">×</span>
                    </div>
                    <p style="font-size: 13px; color: #555; margin-top: 5px;" id="bulkImportInstructions">
                    </p>
                    <textarea id="bulkImportTextarea" style="width: 100%; height: 250px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; white-space: pre;"></textarea>
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
                        <button class="gen-btn" style="background:#7f8c8d; padding: 8px 15px;" onclick="document.getElementById('bulkImportModal').style.display='none'">Cancel</button>
                        <button class="gen-btn" style="background:#27ae60; padding: 8px 15px;" onclick="processBulkImport()">Import Data</button>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                .vmi-vendor-block { background: #fff; border: 1px solid #c89b53; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
                .vmi-vendor-header { background: #1e4b85; color: #fff; padding: 12px 15px; font-weight: bold; font-size: 16px; display: flex; justify-content: space-between; }
                .vmi-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .vmi-table th, .vmi-table td { padding: 10px; text-align: left; border-bottom: 1px solid #eaeaea; }
                .vmi-table th { background: #f4f6f7; color: #555; }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', modalsHTML);
    });
})();

function checkGlobalVMI() {
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let lowCount = 0;
    let affectedTechs = new Set();
    let estCost = 0;
    
    for (let tech in invDB) {
        let cons = invDB[tech].consumables || [];
        cons.forEach(item => {
            let q = parseInt(item.qty) || 0;
            let m = parseInt(item.minLevel) || 0;
            let c = parseFloat(item.cost) || 0;
            
            if (q <= m) {
                lowCount++;
                affectedTechs.add(tech.split(' ')[0]); 
                let orderQty = (m - q) > 0 ? (m - q) : 1; 
                estCost += (orderQty * c);
            }
        });
    }

    let alertBtn = document.getElementById('vmiAlertBtn');
    if(alertBtn) {
        if(lowCount > 0) {
            alertBtn.style.display = 'inline-block';
            alertBtn.innerHTML = `⚠️ Order Parts (${lowCount})`;
        } else {
            alertBtn.style.display = 'none';
        }
    }

    let dashAlert = document.getElementById('vmiDashBanner');
    if (!dashAlert) {
        let leftPanel = document.querySelector('.dispatch-left-panel');
        if (leftPanel) {
            let header = leftPanel.querySelector('.panel-header');
            dashAlert = document.createElement('div');
            dashAlert.id = 'vmiDashBanner';
            header.insertAdjacentElement('afterend', dashAlert);
        }
    }

    if (dashAlert) {
        if (lowCount > 0) {
            let techList = Array.from(affectedTechs).join(', ');
            dashAlert.style.display = 'block';
            dashAlert.innerHTML = `
                <div style="background: #fdf2e9; border-bottom: 2px solid #e74c3c; padding: 15px; display: flex; flex-direction: column; gap: 10px; box-shadow: inset 0 -2px 5px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #c0392b; font-weight: bold; font-size: 14px;"><i class="fas fa-exclamation-triangle"></i> LOW INVENTORY</span>
                        <span style="color: #27ae60; font-weight: bold; font-size: 14px;">Est: $${estCost.toFixed(2)}</span>
                    </div>
                    <div style="font-size: 12px; color: #555; line-height: 1.4;">
                        <strong>${lowCount} items</strong> are below minimum stock across <strong>${affectedTechs.size} trucks</strong> (${techList}).
                    </div>
                    <button class="gen-btn" style="background:#e74c3c; width: 100%; padding: 8px; font-size: 12px; margin-top: 5px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;" onclick="openVMIReport()">Review & Place Bulk Order</button>
                </div>
            `;
        } else {
            dashAlert.style.display = 'none';
        }
    }
}

function openVMIReport() {
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let lowItems = [];
    
    for (let tech in invDB) {
        let cons = invDB[tech].consumables || [];
        cons.forEach(item => {
            let q = parseInt(item.qty) || 0;
            let m = parseInt(item.minLevel) || 0;
            if (q <= m) {
                lowItems.push({ tech: tech, ...item });
            }
        });
    }

    let groupedByVendor = {};
    let grandTotal = 0;

    lowItems.forEach(item => {
        let v = (item.vendor && item.vendor.trim() !== '') ? item.vendor.toUpperCase() : 'UNSPECIFIED VENDOR';
        if(!groupedByVendor[v]) groupedByVendor[v] = {};
        if(!groupedByVendor[v][item.tech]) groupedByVendor[v][item.tech] = [];
        groupedByVendor[v][item.tech].push(item);
    });

    let html = '';

    for (let vendor in groupedByVendor) {
        let vendorTotal = 0;
        let vendorHtml = '';
        
        for (let techName in groupedByVendor[vendor]) {
            let techRows = '';
            
            groupedByVendor[vendor][techName].forEach(item => {
                let q = parseInt(item.qty) || 0;
                let m = parseInt(item.minLevel) || 0;
                let c = parseFloat(item.cost) || 0;
                
                let orderQty = (m - q) > 0 ? (m - q) : 1; 
                let lineTotal = orderQty * c;
                
                vendorTotal += lineTotal;
                grandTotal += lineTotal;

                techRows += `
                    <tr>
                        <td style="font-weight:bold;">${item.name}</td>
                        <td>${item.category || 'N/A'}</td>
                        <td><span style="color:#e74c3c; font-weight:bold;">${q}</span> / ${m}</td>
                        <td style="font-weight:bold; color:#27ae60; font-size: 14px;">${orderQty}</td>
                        <td>$${c.toFixed(2)}</td>
                        <td>$${lineTotal.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            vendorHtml += `
                <tr>
                    <td colspan="6" style="background:#eaf2f8; color:#1e4b85; font-weight:bold; font-size:14px; padding:8px 10px; border-top: 2px solid #bdc3c7;">
                        📦 TECH BIN: ${techName.toUpperCase()}
                    </td>
                </tr>
                ${techRows}
            `;
        }

        html += `
            <div class="vmi-vendor-block">
                <div class="vmi-vendor-header">
                    <span>🏢 VENDOR: ${vendor}</span>
                    <span>Est. PO Total: $${vendorTotal.toFixed(2)}</span>
                </div>
                <table class="vmi-table">
                    <thead>
                        <tr>
                            <th width="35%">Part Name</th>
                            <th width="15%">Category</th>
                            <th width="15%">Stock / Min</th>
                            <th width="10%">Order QTY</th>
                            <th width="10%">Unit Cost</th>
                            <th width="15%">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vendorHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    if (html === '') { 
        html = '<p style="text-align:center; padding: 20px;">All trucks are currently fully stocked.</p>'; 
    } else { 
        html += `<div style="text-align:right; font-size:20px; font-weight:bold; padding:20px; border-top: 2px solid #ccc;">GRAND TOTAL ESTIMATE: <span style="color:#27ae60;">$${grandTotal.toFixed(2)}</span></div>`; 
    }

    document.getElementById('vmiReportContent').innerHTML = html;
    document.getElementById('vmiReportModal').style.display = 'block';
}

function generateVMIEmailText() {
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let lowItems = [];
    
    for (let tech in invDB) {
        let cons = invDB[tech].consumables || [];
        cons.forEach(item => {
            let q = parseInt(item.qty) || 0;
            let m = parseInt(item.minLevel) || 0;
            if (q <= m) lowItems.push({ tech: tech, ...item });
        });
    }

    if (lowItems.length === 0) return null;

    let groupedByVendor = {};
    lowItems.forEach(item => {
        let v = (item.vendor && item.vendor.trim() !== '') ? item.vendor.toUpperCase() : 'UNSPECIFIED VENDOR';
        if(!groupedByVendor[v]) groupedByVendor[v] = {};
        if(!groupedByVendor[v][item.tech]) groupedByVendor[v][item.tech] = [];
        groupedByVendor[v][item.tech].push(item);
    });

    let todayStr = new Date().toLocaleDateString();
    let emailBody = `Twin Pillars Heating & Cooling - Parts Restock Order\nDate: ${todayStr}\n\nPlease pull the following parts and organize them into the respective Technician Bins:\n\n`;

    for (let vendor in groupedByVendor) {
        emailBody += `=========================================\n`;
        emailBody += `VENDOR: ${vendor}\n`;
        emailBody += `=========================================\n\n`;
        
        for (let techName in groupedByVendor[vendor]) {
            emailBody += `--- 📦 TECH BIN: ${techName.toUpperCase()} ---\n`;
            groupedByVendor[vendor][techName].forEach(item => {
                let q = parseInt(item.qty) || 0;
                let m = parseInt(item.minLevel) || 0;
                let orderQty = (m - q) > 0 ? (m - q) : 1; 
                emailBody += `${orderQty}x - ${item.name}\n`;
            });
            emailBody += `\n`;
        }
    }
    emailBody += `Thank you,\nTwin Pillars Dispatch`;
    
    return { subject: `Twin Pillars Parts Restock Order - ${todayStr}`, body: emailBody };
}

function emailVMIReport(clientType) {
    let emailData = generateVMIEmailText();
    if (!emailData) { alert("No parts need to be ordered!"); return; }

    let subject = encodeURIComponent(emailData.subject);
    let body = encodeURIComponent(emailData.body);

    if (clientType === 'gmail') {
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank');
    } else {
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
}

function copyVMIReportToClipboard() {
    let emailData = generateVMIEmailText();
    if (!emailData) { alert("No parts need to be ordered!"); return; }
    
    navigator.clipboard.writeText(emailData.subject + "\n\n" + emailData.body).then(() => {
        if(typeof showSaveCue === 'function') showSaveCue("📋 Copied to Clipboard!");
    }).catch(err => {
        alert("Failed to copy text: " + err);
    });
}

function printVMIReport() {
    let printContents = document.getElementById('vmiReportContent').innerHTML;
    let originalContents = document.body.innerHTML;

    document.body.innerHTML = `
        <div style="padding: 40px; font-family: sans-serif;">
            <h1 style="color:#1e4b85;">Twin Pillars - Vendor Replenishment Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <hr style="margin-bottom: 30px;">
            ${printContents}
        </div>
    `;

    window.print();
    document.body.innerHTML = originalContents;
    location.reload(); 
}
