# AI-Driven Repair Quote Pipeline — Design Specification

> **Author:** Dan (Vertex Concept Creator) + AI design session  
> **Date:** May 16, 2026  
> **Status:** Design complete — not yet built  
> **Depends on:** Field Intelligence Phase 63 (checklists, OCR, equipment history), Quoting Tool port to Firestore

---

## Core Vision

Turn the technician's natural field conversation into a fully priced repair quote — without the tech ever touching a quote form, and without the dispatcher manually entering parts or pricing.

**The tech describes what's wrong. The AI handles the rest.**

---

## Design Principles

1. **The tech never sees the word "quote."** They describe repairs, answer a few quick questions, and take photos. Quote assembly is invisible to them.
2. **The AI asks the minimum questions possible.** Nameplate OCR, passive conversation capture, and checklist templates eliminate most manual data gathering.
3. **The dispatcher reviews and approves — never types.** The AI drafts vendor emails, parses pricing responses, and pre-fills the quote. The dispatcher's job is review, not data entry.
4. **Every step has a human gate.** The AI never sends an email, finalizes a quote, or commits pricing without dispatcher approval.

---

## End-to-End Flow

### Phase 1: Field — Tech Works Naturally

```
Tech speaks → AI listens → AI detects repair trigger → Checklist loaded silently
```

1. Tech describes the problem naturally in the conversational timeline.
2. AI detects a repair-related intent (e.g., "supply fan motor is shot," "contactor is pitted," "coil is leaking").
3. AI loads the matching checklist template(s) from the Field Form & Checklist Builder. Templates tagged with `Quote` are flagged as quote-relevant.
4. AI passively captures information from the tech's natural speech:
   - Equipment symptoms and observations
   - Part references ("it's belt drive," "3/4 horse motor")
   - Actions taken or recommended
5. Tech takes a nameplate photo → Gemini Vision OCR extracts: manufacturer, model, serial, HP, voltage, RPM, frame size, tonnage (slice 63g capability).
6. AI compares what it has against the checklist's required fields. Gaps are tracked silently.

### Phase 2: Field — Minimum Questions at Natural Pause

```
Tech finishes describing repair → AI asks only what it can't get another way
```

**Rules for questioning:**
- Never interrupt the tech mid-diagnosis.
- Wait for a natural pause (tech moves to next topic, says "that's it for that unit," or prepares to compile).
- Never ask for something the nameplate photo already provided.
- Batch remaining gaps into one natural prompt (max 2–3 questions).
- Labor hours is always the last question asked.

**Example — single repair:**
> AI: "Quick question on the motor replacement — how many labor hours, and did you catch the belt size?"  
> Tech: "Two hours. A42."

**Example — multiple repairs on one call:**
> AI: "Before I compile — labor hours on the motor replacement? The contactor? And the coil?"  
> Tech: "Motor is two hours, contactor is thirty minutes, coil is four hours."

**If nameplate photo is missing:**
> AI: "Can you grab a nameplate photo for this unit? It'll help with the parts info."

### Phase 3: Compile — AI Builds Quote Data Silently

```
Tech hits Compile Notes → AI structures repair data + enriches with suggested parts
```

1. Compiled notes include the standard service report sections (Equipment Info, Symptoms, Actions Taken, etc.).
2. Behind the scenes, AI also builds a `quote_data` payload for each repair identified:

```
quote_data: {
  repairs: [
    {
      repairType: "Supply Fan Motor Replacement",
      checklistTemplateId: "supply_fan_motor_replacement",
      equipment: {
        unitNumber: "RTU-3",
        manufacturer: "Carrier",
        model: "48TM-D16A2A5A0A0A0",
        serial: "3416G48912",
        // ... from nameplate OCR
      },
      primaryParts: [
        {
          description: "Supply Fan Motor",
          specs: "3/4 HP, 208-230V, 1075 RPM, Frame 48Y",
          qty: 1,
          source: "confirmed"  // tech mentioned this
        }
      ],
      suggestedParts: [
        {
          description: "Run Capacitor",
          specs: "7.5 MFD, 370/440V",
          qty: 1,
          source: "checklist"  // AI added from template
        },
        {
          description: "V-Belt",
          specs: "A42",
          qty: 1,
          source: "confirmed"  // tech provided size
        },
        {
          description: "Motor Mounting Hardware Kit",
          specs: "",
          qty: 1,
          source: "checklist"
        }
      ],
      laborHours: 2,
      driveType: "belt",
      nameplatePhotoUrl: "https://storage.../nameplate_rtu3.jpg",
      fieldNotes: "Motor drawing high amps, bearings screaming. Belt drive."
    },
    // ... additional repairs
  ],
  totalLaborHours: 6.5,
  quoteNeeded: true,
  techName: "Dan Day",
  ticketId: "SC-1002",
  customerId: "CST-6580",
  syncedAt: "2026-05-16T14:30:00Z"
}
```

3. The `suggestedParts` come from the checklist template's **associated parts list** — parts that typically accompany this repair type. These are defined by the service manager when building the template.

### Phase 4: Sync — Quote Data Arrives at Office

```
Compiled notes sync → quote_data attached to ticket → draft quote auto-created
```

1. Compiled report syncs to the office via existing sync mechanism.
2. `quote_data` is written to the ticket's Firestore document (or a linked subcollection).
3. **System auto-creates a draft quote** — no dispatcher click needed. The moment a `Quote`-tagged checklist was triggered, the system knows a quote is needed.
4. Draft quote is created in Firestore (`office_quotes` collection) with:
   - Customer/location pre-filled from the ticket
   - Line items pre-built from `quote_data.repairs`
   - Each line item has: repair type, part description + specs, qty, labor hours
   - Primary parts marked `confirmed`, suggested parts marked `suggested`
   - Status: `Draft`
   - Linked to ticket ID and field_quotes submission

### Phase 5: Office — AI Drafts Vendor Email

```
Draft quote exists → AI drafts vendor pricing request → dispatcher reviews and sends
```

1. Dispatcher receives notification: "Quote QT-1017 ready for review. 3 repairs identified. Vendor email drafted."
2. Dispatcher opens the draft quote — sees all line items with specs, labor hours, suggested parts.
3. AI has already drafted a vendor email:

```
Subject: Parts Quote Request — Ref QT-1017-REQ

Equipment: Carrier 48TM Series
Model: 48TM-D16A2A5A0A0A0
Serial: 3416G48912
Unit #: RTU-3

Parts Needed:
1. Supply Fan Motor — 3/4 HP, 208-230V, 1075 RPM, Frame 48Y — Qty: 1
2. Run Capacitor — 7.5 MFD, 370/440V — Qty: 1
3. V-Belt — A42 — Qty: 1
4. Motor Mounting Hardware Kit — Qty: 1

[Nameplate photo attached]

Please include reference QT-1017-REQ in your reply
with individual part pricing and availability.
```

4. **AI prompts dispatcher:** "Send to one vendor or multiple?"
   - Dispatcher selects from vendor list (e.g., Vendor A and Vendor B)
   - If multiple: AI sends identical emails with suffixed refs (`QT-1017-REQ-A`, `QT-1017-REQ-B`)
5. Dispatcher reviews the drafted email and clicks **Send**.
6. Email sent via Gmail API (Google Workspace integration).
7. Quote status updates: `Draft` → `Awaiting Vendor Pricing`

### Phase 6: Office — AI Watches for Vendor Response

```
Vendor replies via email → AI parses pricing → auto-fills draft quote
```

1. AI monitors inbox via Gmail API (push notifications or periodic polling).
2. When a reply arrives, AI scans for the reference number (`QT-1017-REQ-A`).
3. AI parses the vendor's pricing from the email body and maps each price to the corresponding line item.
4. **Confidence check before auto-fill:**
   - All line items matched and prices look reasonable → auto-fill and notify dispatcher
   - Partial match, ambiguous pricing, or unexpected items → flag for manual review
   - Price seems unusually high/low vs historical data (future enhancement) → flag with note
5. If multiple vendors responded:
   - AI shows comparison: "Vendor A: $205 total, ships 3 days. Vendor B: $188 total, ships next day."
   - Dispatcher selects preferred vendor per line item or overall.
6. Quote status updates: `Awaiting Vendor Pricing` → `Pricing Received`

### Phase 7: Office — Dispatcher Reviews and Sends to Customer

```
Quote fully priced → dispatcher reviews → sends PDF to customer via email
```

1. Dispatcher gets notification: "Quote QT-1017 pricing received. Review and send."
2. Dispatcher opens the quote — all prices filled, totals calculated:
   - Parts costs (from vendor)
   - Markup applied (per company settings — residential/commercial rates)
   - Labor calculated (hours from tech × labor rate by customer type)
   - Service & dispatch fee
   - Sales tax (togglable for tax-exempt jobs)
3. Dispatcher toggles display options:
   - Show itemized parts to customer? Or parts summary line?
   - Show service & dispatch fee as separate line item?
   - Include sales tax?
4. Dispatcher clicks **Send to Customer** → PDF generated → emailed to customer contact.
5. Quote status: `Pricing Received` → `Sent to Customer`
6. Follow-up: if no customer response in X days, system reminds dispatcher.

---

## Quote Statuses

| Status | Meaning |
|--------|---------|
| `Draft` | Auto-created from field data. Waiting for review. |
| `Awaiting Vendor Pricing` | Vendor email sent. Waiting for response. |
| `Pricing Received` | Vendor responded. Prices auto-filled. Ready for dispatcher review. |
| `Sent to Customer` | PDF emailed to customer. Awaiting approval. |
| `Approved` | Customer approved. Ready to schedule. |
| `Rejected` | Customer declined. |
| `Requote Requested` | Customer wants changes. New version needed. |

## Job Workflow (post-approval)

| Status | Meaning |
|--------|---------|
| `To Be Ordered` | Parts need to be ordered from vendor. |
| `Parts Ordered` | Order placed. Waiting for delivery. |
| `Parts Received` | Parts in hand. Ready to schedule. |
| `Parts In Stock` | Parts were already in inventory. |
| `Needs to be Scheduled` | Parts ready. Job needs a date. |
| `Scheduled` | Job is on the calendar. |
| `Completed` | Repair done. |

---

## Checklist Template Enhancements

The existing Field Form & Checklist Builder needs these additions for quote support:

### Template-Level Fields (service manager configures)

- **`quoteRelevant: boolean`** — Is this checklist tagged for quote generation? (Maps to existing `Quote` tag.)
- **`associatedParts: array`** — Parts that typically accompany this repair type:
  ```
  [
    { description: "Run Capacitor", defaultSpecs: "Match motor FLA", qty: 1, alwaysInclude: true },
    { description: "V-Belt", defaultSpecs: "Measure on site", qty: 1, alwaysInclude: false },
    { description: "Motor Mounting Hardware Kit", defaultSpecs: "", qty: 1, alwaysInclude: true }
  ]
  ```
- **`requiredFields: array`** — Fields the AI must gather (with priority):
  ```
  [
    { field: "laborHours", label: "Labor hours", priority: "required", source: "ask_tech" },
    { field: "driveType", label: "Direct or belt drive", priority: "required", source: "ask_tech" },
    { field: "beltSize", label: "Belt size", priority: "conditional", condition: "driveType === 'belt'", source: "ask_tech" },
    { field: "motorHP", label: "Motor HP", priority: "required", source: "nameplate_ocr" },
    { field: "motorVoltage", label: "Voltage", priority: "required", source: "nameplate_ocr" },
    { field: "motorRPM", label: "RPM", priority: "required", source: "nameplate_ocr" },
    { field: "frameSize", label: "Frame size", priority: "required", source: "nameplate_ocr" }
  ]
  ```
- The `source` field tells the AI where to get the data: `nameplate_ocr` (don't ask, get from photo), `ask_tech` (must ask), `passive` (listen for it in conversation), `dispatcher` (office fills this in).

### Example: Economizer Repair Checklist

```
{
  templateName: "Economizer Repair",
  aiTrigger: "economizer",
  tags: ["Service", "Quote"],
  quoteRelevant: true,
  requiredFields: [
    { field: "laborHours", priority: "required", source: "ask_tech" },
    { field: "actuatorType", label: "Actuator type", priority: "required", source: "ask_tech" },
    { field: "bladeCondition", label: "Blade condition", priority: "required", source: "ask_tech" },
    { field: "linkageCondition", label: "Linkage condition", priority: "required", source: "ask_tech" },
    { field: "controllerType", label: "Controller/board type", priority: "required", source: "ask_tech" },
    { field: "damperSize", label: "Damper size (W×H)", priority: "required", source: "ask_tech" }
  ],
  associatedParts: [
    { description: "Economizer Actuator", defaultSpecs: "Match existing", qty: 1, alwaysInclude: true },
    { description: "Linkage Kit", defaultSpecs: "", qty: 1, alwaysInclude: false },
    { description: "Damper Blade Gasket Set", defaultSpecs: "Match damper size", qty: 1, alwaysInclude: true },
    { description: "Economizer Controller", defaultSpecs: "Match existing", qty: 1, alwaysInclude: false },
    { description: "Enthalpy Sensor", defaultSpecs: "", qty: 1, alwaysInclude: false }
  ]
}
```

Note: the gasket set has `alwaysInclude: true` — a tech might forget to mention gaskets, but you always need them for an economizer repair. This is the institutional knowledge layer.

---

## Vendor Management

### New: Vendor Directory (dispatcher app)

A new section in the dispatcher app sidebar for managing vendor contacts.

**Vendor record:**
```
{
  vendorId: "VND-001",
  name: "Johnstone Supply - Green Bay",
  email: "orders@greenbay.johnstonesupply.com",
  phone: "920-555-1234",
  categories: ["motors", "capacitors", "belts", "general_parts"],
  notes: "Best pricing on motors. Usually responds same day.",
  preferredFor: ["motors", "capacitors"],
  active: true
}
```

**Firestore collection:** `tenants/{tenantId}/vendors`

**UI:** Simple list view with Add/Edit/Delete. Categories are selectable tags so the AI can suggest which vendor(s) to email based on the parts needed.

### AI Vendor Selection

When drafting the vendor email, the AI checks the parts list against vendor categories:
- Motor + capacitor + belt → suggest vendors categorized under `motors`, `general_parts`
- Coil → suggest vendors categorized under `coils`, `refrigeration`
- Multiple part types → suggest sending to the vendor(s) that cover the most items, or splitting across specialists

Dispatcher always has final say on which vendors receive the email.

---

## Gmail API Integration

### Authentication
- Google Workspace (already in use)
- OAuth 2.0 with Gmail API scopes: `gmail.send`, `gmail.readonly`
- Service account or user-delegated credentials (dispatcher's account or shared inbox)

### Sending
- AI drafts email → stored as draft in Firestore
- On dispatcher approval → Gmail API `messages.send`
- Attachments: nameplate photos pulled from Firebase Storage
- Reference number in subject line and body for tracking

### Receiving / Watching
- **Option A:** Gmail push notifications via Google Cloud Pub/Sub → Cloud Function triggered on new messages
- **Option B:** Periodic polling (every 5 minutes) via Cloud Function → Gmail API `messages.list` filtered by reference number pattern
- **Recommended:** Option A (Pub/Sub) for real-time response, with Option B as fallback

### Parsing Vendor Responses
- AI (Gemini) reads the vendor's reply email
- Extracts: part description → price mapping, lead times, availability notes
- Matches to quote line items by reference number + part description similarity
- Confidence scoring: high confidence → auto-fill; low confidence → flag for manual review

---

## Firestore Schema Changes

### New Collections

```
tenants/{tenantId}/office_quotes/{quoteId}
  - quoteNumber: "QT-1017"
  - ticketId: "SC-1002"
  - customerId: "CST-6580"
  - customerName: "Planet Fitness"
  - locationAddress: "3415 Custer St, Manitowoc, WI 54220"
  - locationNumber: "LOC-6901"
  - status: "Draft" | "Awaiting Vendor Pricing" | "Pricing Received" | "Sent to Customer" | "Approved" | "Rejected" | "Requote Requested"
  - jobWorkflow: "N/A" | "To Be Ordered" | "Parts Ordered" | ... | "Completed"
  - customerType: "residential" | "commercial"
  - laborRate: 175.00
  - repairs: [
      {
        repairType: "Supply Fan Motor Replacement",
        equipment: { unitNumber, model, serial, manufacturer },
        laborHours: 2,
        parts: [
          { description, specs, qty, source: "confirmed"|"suggested", vendorCost, markupPercent, retailPrice }
        ],
        nameplatePhotoUrl: "..."
      }
    ]
  - serviceDispatchFee: 507.50
  - showDispatchFeeSeparate: true
  - showItemizedParts: false
  - partsSummaryDescription: "All parts and materials required..."
  - includeSalesTax: true
  - salesTaxRate: 0.055
  - subtotal: 0
  - salesTax: 0
  - grandTotal: 0
  - vendorRequests: [
      { vendorId, vendorName, refNumber: "QT-1017-REQ-A", sentAt, responseReceivedAt, status }
    ]
  - createdAt: serverTimestamp
  - updatedAt: serverTimestamp
  - sentToCustomerAt: null
  - customerResponseAt: null
  - requoteNotes: []

tenants/{tenantId}/vendors/{vendorId}
  - name: "Johnstone Supply - Green Bay"
  - email: "orders@greenbay.johnstonesupply.com"
  - phone: ""
  - categories: ["motors", "capacitors", "belts"]
  - preferredFor: ["motors"]
  - notes: ""
  - active: true
  - createdAt: serverTimestamp
```

### Migration

- Existing `field_quotes` collection unchanged — continues to capture field tech repair submissions.
- Existing localStorage `twinPillarsQuotesDB` quotes: provide an **import** path to migrate saved quotes into `office_quotes` Firestore collection (one-time migration tool in the dispatcher app).
- `quoting.js` updated to read/write Firestore instead of localStorage.

---

## Quoting Tool UI Updates (Dispatcher App)

### Port from Standalone Tool (lgarage.github.io)

These features exist in the standalone tool and need to be in the Vertex Core dispatcher app:

1. **Parts list with full columns:** QTY, Part Description, Part Number, Vendor, Lead Time, Our Cost, Markup %, Retail (auto-calc)
2. **Customer type toggle:** Residential ($125/hr) / Commercial ($175/hr) — auto-sets labor rate
3. **Quote statuses:** Draft, Pending, Approved, Rejected, Requote Requested
4. **Job Workflow tracking:** N/A → To Be Ordered → Parts Ordered → Parts Received → Parts In Stock → Needs to be Scheduled → Scheduled → Completed
5. **Requote flow:** Resubmit with new QT number, preserve original
6. **PDF generation:** Customer-facing format with company branding
7. **Recent Quotes Database:** Searchable list with preview, edit, delete
8. **Export/Import backup**

### New Features (from latest standalone update)

9. **"Show SERVICE & DISPATCH FEE as Separate Line Item"** — toggle per quote
10. **"Show Itemized Parts to Customer"** — toggle; when off, shows parts summary description instead
11. **"Parts Summary Description"** — customizable text shown when itemized parts hidden (default: "All parts and materials required to complete the repair are included in the quoted price. Only OEM-quality or equivalent components will be used.")
12. **"Include Sales Tax"** — toggle for tax-exempt jobs (real property improvements, new construction)

### New Features (AI pipeline)

13. **Auto-populated draft quotes** — pre-filled from AI-extracted field data, no manual entry
14. **Suggested parts badges** — line items marked "confirmed" (tech mentioned) vs "suggested" (AI added from checklist), dispatcher can include/dismiss
15. **Vendor email draft viewer** — see the email AI drafted, select vendors, click Send
16. **Vendor pricing auto-fill** — prices populated from parsed vendor email responses
17. **Vendor comparison view** — when multiple vendors quoted, side-by-side pricing
18. **"Copy Parts List"** — one-click text export for ad-hoc vendor communication
19. **Quote notifications** — badge on ticket when quote data is available, when vendor pricing arrives, when customer responds
20. **Vendor Directory** — new sidebar section to manage vendor contacts

---

## Customer Quote Delivery

- **Format:** PDF (matching current standalone tool layout — company branding, line items, totals, terms)
- **Delivery:** Email to customer contact (from ticket's contact email)
- **Sent via:** Gmail API (same integration as vendor emails)
- **Follow-up:** If no customer response in configurable X days, system reminds dispatcher
- **Customer response tracking:** Approved / Rejected / Requote Requested — updated manually by dispatcher (future: customer approval link in email)

---

## Build Priority / Phasing

### Phase A: Foundation (must happen first)
1. Migrate `quoting.js` from localStorage to Firestore (`office_quotes` collection)
2. Port standalone tool features into dispatcher app (items 1–12 above)
3. Add vendor directory (Firestore collection + basic CRUD UI)
4. localStorage quote import tool (one-time migration)

### Phase B: AI Field Pipeline
5. Enhance checklist templates with `associatedParts` and `requiredFields` with `source` metadata
6. AI passive capture + minimum-question logic in conversational timeline
7. `quote_data` payload generation at compile time
8. Auto-create draft quote on sync (field → office)

### Phase C: Email Automation
9. Gmail API integration (OAuth, send, receive/watch)
10. AI vendor email drafting with nameplate photo attachment
11. Multi-vendor send with reference numbers
12. AI email response parsing + quote auto-fill
13. Vendor comparison view
14. Customer quote PDF email delivery

### Phase D: Intelligence (future)
15. Vendor pricing history + anomaly detection
16. AI vendor recommendation based on part type + pricing history
17. Customer approval link in email (self-service)
18. Quote follow-up automation
19. Parts inventory awareness (skip vendor email if part is in stock)
20. Quote-to-invoice conversion (approved quote → generate invoice with same line items)

---

## What the Tech Experiences

1. Works normally. Talks about what's wrong.
2. Takes photos (nameplate, equipment — already part of the workflow).
3. Gets asked 1–3 quick questions at natural pauses: labor hours, maybe belt size or drive type.
4. Hits Compile Notes. Syncs to office.
5. Never sees the word "quote." Never fills out a form. Never enters pricing.

## What the Dispatcher Experiences

1. Gets a notification: "Quote ready for review."
2. Opens the draft — everything pre-filled: customer, equipment, repairs, parts, labor hours.
3. Reviews suggested parts (include or dismiss).
4. Clicks "Send to Vendor" — AI-drafted email with specs + nameplate photo.
5. Picks one or multiple vendors.
6. Waits for vendor response (system watches inbox).
7. Gets notification: "Pricing received." Opens quote — prices filled in.
8. Reviews totals, toggles display options (itemized vs summary, tax, dispatch fee).
9. Clicks "Send to Customer" — PDF emailed.
10. Tracks approval status.

## What the Service Manager Experiences

1. Builds checklist templates in the Field Form & Checklist Builder.
2. Tags templates with `Quote` when they should trigger quote generation.
3. Defines associated parts per repair type (the institutional knowledge).
4. Manages the vendor directory.
5. Sets company defaults (labor rates, markup percentages, tax rate, terms).

---

## Relationship to Existing Systems

| System | Role in Quote Pipeline |
|--------|----------------------|
| **Field Form & Checklist Builder** | Source of repair checklists with associated parts and required fields |
| **Conversational Timeline** | Where the tech talks; AI passive capture + minimum questions happen here |
| **Compile Notes** | Generates `quote_data` payload alongside compiled service report |
| **Ticket Sync** | Transports `quote_data` from field to office |
| **Quoting Tool (dispatcher)** | Displays draft quote, vendor email tools, pricing, PDF generation |
| **field_quotes (Firestore)** | Field tech repair submissions — input to auto-draft creation |
| **office_quotes (Firestore)** | NEW — office quote records with full lifecycle tracking |
| **vendors (Firestore)** | NEW — vendor directory for email automation |
| **Gmail API** | Send vendor requests, receive pricing, send customer quotes |
| **Gemini Vision OCR** | Nameplate photo → equipment specs (slice 63g) |
| **Site Intelligence** | Equipment history — context for future quote intelligence |

---

## Key Decisions Made

1. **Tech never sees quote UI** — the quote is an office concern, not a field concern.
2. **AI asks minimum questions** — nameplate OCR + passive capture first, ask only for gaps.
3. **Labor hours per repair, not per job** — enables accurate line-item quoting.
4. **AI suggests ancillary parts** — checklist templates define "what usually goes with this repair" (e.g., gaskets for economizer repairs).
5. **Parts marked as confirmed vs suggested** — dispatcher knows which came from the tech vs the AI.
6. **Draft quote auto-created** — no dispatcher click to initiate. System knows a quote is needed.
7. **AI drafts vendor email** — dispatcher just reviews and sends.
8. **Reference numbers for email tracking** — AI matches vendor responses to the right quote.
9. **Nameplate photo in vendor email** — eliminates the "send me a picture" back-and-forth.
10. **Multi-vendor support** — send to multiple vendors for competitive pricing.
11. **AI parses vendor pricing** — auto-fills quote, flags ambiguity for manual review.
12. **Customer gets PDF via email** — matching current standalone tool format.
13. **Quotes in Firestore** — localStorage migration for multi-device access and AI pipeline support.
14. **Quote display toggles** — itemized vs summary parts, separate dispatch fee, tax on/off.
