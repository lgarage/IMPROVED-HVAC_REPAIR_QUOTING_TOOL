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
    ...seedDataApprentice // J-Man gets everything the Apprentice gets too
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
    
    if(!localStorage.getItem('tp_master_templates')) {
        localStorage.setItem('tp_master_templates', JSON.stringify({
            jman: masterJmanTemplate,
            apprentice: masterApprenticeTemplate
        }));
    }

    renderTechSettings();
    populateTechDropdowns();
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
// --- VMI / INVENTORY MODAL LOGIC ---
// ====================================================================

function openTruckInventory(techName) {
    currentEditingTechInv = techName;
    document.getElementById('invModalTitle').innerText = `${techName}'s Truck`;
    switchInvTab('tools'); 
    document.getElementById('truckInventoryModal').style.display = 'block';
    renderTruckInventory();
}

function closeTruckInventory() {
    document.getElementById('truckInventoryModal').style.display = 'none';
    currentEditingTechInv = "";
}

function switchInvTab(tabName) {
    currentInvTab = tabName;
    document.getElementById('btnTabTools').classList.remove('active');
    document.getElementById('btnTabConsumables').classList.remove('active');
    
    if(tabName === 'tools') {
        document.getElementById('btnTabTools').classList.add('active');
        document.getElementById('invActionButtons').style.display = 'block';
    } else {
        document.getElementById('btnTabConsumables').classList.add('active');
        document.getElementById('invActionButtons').style.display = 'none';
    }
    renderTruckInventory();
}

function renderTruckInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';

    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let techInv = invDB[currentEditingTechInv];

    if (!techInv) {
        techInv = { tools: [], consumables: [] };
        invDB[currentEditingTechInv] = techInv;
        localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
    }

    const currentList = currentInvTab === 'tools' ? techInv.tools : techInv.consumables;

    if (currentList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #7f8c8d; padding: 30px;">This truck's ${currentInvTab} list is currently empty.</td></tr>`;
        return;
    }

    currentList.forEach((item, idx) => {
        let bundleCheck = item.bundle ? "checked" : "";
        tbody.innerHTML += `
            <tr>
                <td><input type="text" class="inventory-input p-name" value="${item.name}"></td>
                <td><input type="text" class="inventory-input p-cat" value="${item.category || ''}"></td>
                <td><input type="text" class="inventory-input p-ven" value="${item.vendor || ''}"></td>
                <td style="text-align: center;"><input type="checkbox" class="p-bun" ${bundleCheck}></td>
                <td><a href="${item.url || '#'}" target="_blank" class="inv-link">Shop Link</a><input type="hidden" class="p-url" value="${item.url || ''}"></td>
                <td><button class="gen-btn btn-sm" style="background:#e74c3c;" onclick="removeToolFromTruck(${idx})">X</button></td>
            </tr>
        `;
    });
}

function addBlankToolRow() {
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let techInv = invDB[currentEditingTechInv];
    
    let newItem = { name: "", category: "", vendor: "", bundle: false, url: "" };
    if (currentInvTab === 'tools') { techInv.tools.push(newItem); } 
    else { techInv.consumables.push(newItem); }
    
    localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
    renderTruckInventory();
    
    const tableContainer = document.querySelector('.inventory-table').parentElement;
    tableContainer.scrollTop = tableContainer.scrollHeight;
}

function removeToolFromTruck(index) {
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let techInv = invDB[currentEditingTechInv];
    
    if (currentInvTab === 'tools') { techInv.tools.splice(index, 1); } 
    else { techInv.consumables.splice(index, 1); }
    
    localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
    renderTruckInventory();
}

function loadMasterTemplate(type) {
    if(!confirm(`Are you sure you want to load the ${type.toUpperCase()} template? This will add to any tools currently on this list.`)) return;

    let masterDB = JSON.parse(localStorage.getItem('tp_master_templates') || '{}');
    let templateToLoad = type === 'jman' ? masterDB.jman : masterDB.apprentice;

    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    let techInv = invDB[currentEditingTechInv];
    
    let copy = JSON.parse(JSON.stringify(templateToLoad));
    techInv.tools = techInv.tools.concat(copy);
    
    localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
    renderTruckInventory();
}

function clearTruckInventory() {
    if(!confirm(`Are you sure you want to delete ALL tools from ${currentEditingTechInv}'s truck?`)) return;
    
    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    invDB[currentEditingTechInv].tools = [];
    
    localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
    renderTruckInventory();
}

function saveAndCloseTruckInventory() {
    const rows = document.querySelectorAll('#inventoryTableBody tr');
    let updatedList = [];
    
    if (rows.length > 0 && !rows[0].innerText.includes('empty')) {
        rows.forEach(row => {
            let nameEl = row.querySelector('.p-name');
            if (nameEl) {
                updatedList.push({
                    name: nameEl.value,
                    category: row.querySelector('.p-cat').value,
                    vendor: row.querySelector('.p-ven').value,
                    bundle: row.querySelector('.p-bun').checked,
                    url: row.querySelector('.p-url').value
                });
            }
        });
    }

    let invDB = JSON.parse(localStorage.getItem('tp_truck_inventories') || '{}');
    if (currentInvTab === 'tools') { invDB[currentEditingTechInv].tools = updatedList; } 
    else { invDB[currentEditingTechInv].consumables = updatedList; }
    
    localStorage.setItem('tp_truck_inventories', JSON.stringify(invDB));
    closeTruckInventory();
    if(typeof showSaveCue === 'function') showSaveCue("✓ Loadout Saved");
}
