# Invoice paste parser — expected labels & mapping

Technician notes are pasted into **Invoice Generator → “1. Paste Tech Notes Here”**. On **blur** (tab out / click away), the app runs the rule-based parser in `invoice.js`, then may call **Gemini** if the text looks unstructured or too many fields stayed empty.

---

## Format rules (rule-based parser)

1. **Labeled blocks** use a **label**, optional spaces, a **colon**, then the value until the **next recognized section header** (or end of text).
2. A line may start with or follow a newline; headers are matched case-insensitively for the patterns below.
3. Leading banners are removed before parsing: **`QUOTED REPAIR`**, **`SERVICE CALL`**, a line that is only **`PM`**, or a **`PREVENTATIVE MAINTENANCE`** / **`PREVENTIVE MAINTENANCE`** header line.
4. **Multi-line values** are allowed; the parser stops at the next header whose name starts with one of the “boundary” keywords (see below).

---

## Boundary keywords (next section detection)

The value after a label ends when the next line looks like a new section. Recognized leading words for those sections include:

`Location`, `Date`, `Equipment`, `Notes`, `Work`, `Parts`, `Cost`, `Pictures`, `Reason`, `Findings`, `Repairs`, `Original`, `System`, `Further`, `Labor`, `Diagnosis`, plus optional characters like `/`, `&`, digits, etc., ending with `:`.

So labels such as **`System Testing & Verification:`** work because the next section is detected correctly.

---

## Label → invoice form field

| Paste label(s) | Form / field | Notes |
|----------------|----------------|--------|
| **`Location:`** | Customer name + site address | Passed through **Google Places** (`smartProcessLocation`) when possible; otherwise heuristic split. |
| **`Date:`** or **`Date logged:`** | **Service date** | Accepts `YYYY-MM-DD` or `M/D/YYYY` (and similar); first match in the scanned blob wins. |
| **`Equipment on Site:`** | **Equipment on Site** | |
| **`Equipment worked on:`** | **Equipment on Site** | Alternative to “on Site”. |
| **`Equipment Repaired:`** | **Equipment on Site** | Same field (quoted-repair style). |
| **`Original Issue Resolved:`** | **Reason for call** | Plain text only (no extra “Original Issue:” prefix in storage). |
| **`Reason for call:`** | **Reason for call** | Combined with quote/PM lines if multiple exist, separated by blank lines. |
| **`Notes` / `repairs`** (regex `Notes\s*[/\\]\s*repairs`) | **Reason for call** | PM-style block. |
| **`Findings` / `Diagnosis`** | **Diagnosis** | Service-style; combined “findings / diagnosis” line. |
| **`Diagnosis:`** | **Diagnosis** | Overrides findings/diagnosis if both exist. `N/A` clears the field. |
| **`Repairs Completed:`** | **Notes / Repairs** | First part of work narrative. |
| **`Repairs made:`** | **Notes / Repairs** | Service-style. If the value is only **`None.`**, it is **skipped** (same idea as further recommendations). |
| **`Parts needed for repair quote:`** | **Notes / Repairs** | Appended after repairs / system testing with a short label. |
| **`Labor for repair quote:`** | **Notes / Repairs** | Appended as `Labor for repair quote (hrs): …`. |
| **`Cost of parts (if known):`** | *(not mapped)* | Ignored by the rule-based parser (often `Unknown`). |
| **`Work done:`** | **Notes / Repairs** | PM-style. |
| **`System Testing & Verification:`** | **Notes / Repairs** | Appended as `System testing: …` on its own line (after repairs/work). |
| **`Further Recommendations:`** | **Notes / Repairs** | Appended; if the value is only **`None.`** (case-insensitive), it is **skipped**. |
| **`Pictures:`** / **`Repair photos attached.`** / **`Nameplate photos attached.`** | *(omitted on invoice print)* | Not shown on PDF/preview; standalone photo lines stripped when rendering **Notes / Repairs**. |
| **`Parts used:`** | **Parts list** (invoice lines) | Split on commas/newlines; noise lines (`NONE`, `N/A`, etc.) filtered. |

**Order in the form’s Notes / Repairs text:** repairs completed → repairs made → work done → `System testing: …` line → parts needed for repair quote → labor for repair quote → further recommendations (if not None). **System testing** is printed in **bold** on the invoice, matching other tech-note labels.

---

## Parts list

- **`Parts used:`** fills the editable parts grid.
- Optional quantity: lines like **`3 - Filter description`** set qty + description.
- If no usable parts lines and the paste **looks like PM** (standalone **`PM`** line, **`PM`** then **`Location:`**, or both **`Notes / repairs:`** and **`Work done:`**), a default **Preventative Maintenance parts** row is added; otherwise a placeholder **Parts Used** row.

---

## Gemini (automatic, optional)

Runs only when:

- `firebase-config.js` exposes a Web API key, **and**
- pasted text length ≥ **50**, **and**
- heuristics say the note is **unstructured** or **too few** of these are filled after local parse: equipment, reason, work, street, customer, diagnosis — **unless** the template already looks structured and enough fields parsed.

When it runs, it uses **Gemini 1.5 Flash** and returns JSON with:

| JSON key | Typical form target |
|----------|---------------------|
| `equipmentOnSite` | Equipment on Site |
| `reasonForCall` | Reason for call |
| `diagnosis` | Diagnosis |
| `repairsCompleted` | Notes / Repairs |
| `systemTesting` | Notes / Repairs (as `System testing: …`) |
| `locationLine` | Location processing (same as `Location:`) |
| `serviceDateIso` | Service date (`YYYY-MM-DD`) |

Merge mode only **fills empty** fields where applicable. Photo lines are not written into the form.

---

## Standard technician completion output (QUOTED REPAIR)

This is the typical block produced when a technician completes a repair. Paste it into **section 1** and **tab out** to parse.

### Sample output (verbatim structure)

```text
QUOTED REPAIR

Location:
PLANET FILTNESS - MILWAUKEE - MAIN ST.

Date:
2026-04-04

Equipment Repaired:
RTU1 (Rooftop Unit)

Original Issue Resolved:
Supply fan motor failed

Repairs Completed:
Replaced supply fan motor

System Testing & Verification:
Tested and verified operations.

Further Recommendations:
None.

Pictures:
Repair photos attached.
```

### Where each section goes on the invoice form

| Block in paste | Invoice Generator field (section 2 + parts) |
|----------------|-----------------------------------------------|
| **`Location:`** | **Customer name** + **location street / city / state / zip** (from Google Places when available, else parsed from the line) |
| **`Date:`** | **Service date** (job date) |
| **`Equipment Repaired:`** | **Equipment on Site** |
| **`Original Issue Resolved:`** | **Reason for call** only (issue the tech was addressing) |
| **`Repairs Completed:`** | Start of **Notes / Repairs** |
| **`System Testing & Verification:`** | **Notes / Repairs** — added on the next line as `System testing: …` |
| **`Further Recommendations:`** | **Notes / Repairs** — only if **not** `None.`; `None.` is ignored |
| **`Pictures:`** | *(not printed on invoice)* — omitted from PDF/preview |
| *(no `Diagnosis:` in this template)* | **Diagnosis** stays empty unless you add that label |

**Notes / Repairs** on the **printed invoice** shows repairs, then a **bold** “**System testing:**” line with the testing text. Photo lines are not shown.

**Reason for call** is only: `Supply fan motor failed`.

---

## Service call output (`SERVICE CALL`)

Use the same paste flow. The leading **`SERVICE CALL`** line is stripped before parsing.

### Sample output (verbatim structure)

```text
SERVICE CALL

Location:
PLANET FILTNESS - MILWAUKEE - MAIN ST.

Date:
2026-04-04

Equipment worked on:
RTU1 (Rooftop Unit)
RTU2 (Rooftop Unit)

Reason for call:
too cold

Findings / Diagnosis:
Found on RTU-1 that gas valve was closed. Opened gas valve and verified operations. RTU2 has an igniter and flame rod that needed to be replaced

Repairs made:
None.

Parts used:
NONE

Cost of parts (if known):
Unknown

Parts needed for repair quote:
RTU-2 NEEDS AN IGNITER
FLAME ROD

Labor for repair quote:
3

Further Recommendations:
Replace igniter and flame rod on RTU-2

Pictures:
Nameplate photos attached.
```

### Where each section goes

| Block in paste | Invoice Generator field |
|----------------|-------------------------|
| **`Location:`** | Customer + address (Places when possible) |
| **`Date:`** | Service date |
| **`Equipment worked on:`** | **Equipment on Site** (multiple lines joined with commas) |
| **`Reason for call:`** | **Reason for call** |
| **`Findings / Diagnosis:`** | **Diagnosis** |
| **`Repairs made:`** | **Notes / Repairs** only if not only **`None.`** |
| **`Parts used:`** | Parts grid (`NONE` → placeholder row, no part lines) |
| **`Parts needed for repair quote:`** | **Notes / Repairs** (quoted follow-up context) |
| **`Labor for repair quote:`** | **Notes / Repairs** as estimated labor hours line |
| **`Further Recommendations:`** | **Notes / Repairs** (skipped if only `None.`) |
| **`Pictures:`** | Not printed; nameplate/repair photo lines stripped from print |

---

## Preventative maintenance (PM)

PM visits use the same **`Location:`**, **`Date:`**, **`Equipment on Site:`** (or equivalent) labels as other jobs, plus PM-specific blocks:

| Paste label | Form field |
|-------------|------------|
| **`Notes / repairs:`** | **Reason for call** (with other reason lines if present) |
| **`Work done:`** | **Notes / Repairs** |
| **`Parts used:`** | Parts grid (or **Preventative Maintenance parts** placeholder if empty / noise only) |

A line containing only **`PM`**, or a **`PREVENTATIVE MAINTENANCE`** header, is stripped before parsing. **`Equipment on Site:`** is the usual equipment label for PM; **`Equipment worked on`** / **`Equipment Repaired`** still map to the same field if your workflow uses them.

### Sample PM-shaped paste

```text
PM

Location:
PLANET FITNESS - MILWAUKEE - MAIN ST.

Date:
2026-04-04

Equipment on Site:
RTU1, RTU2

Notes / repairs:
Spring PM per contract.

Work done:
Checked belts, changed filters, verified controls.

Parts used:
NONE
```

---

## Older example (alternate wording)

```text
QUOTED REPAIR

Location:
PLANET FITNESS - OCONOMOWOC - OLYMPIA FIELDS DR.

Date:
2026-04-02

Equipment Repaired:
Thermostat

Original Issue Resolved:
Completed replacing bad thermostat

Repairs Completed:
Removed faulty thermostat and installed new one programmed properly

System Testing & Verification:
After installation, RTU started cooling.

Further Recommendations:
None.

Pictures:
Repair photos attached.
```

Same mapping as the table above.

---

## File reference

Implementation: **`invoice.js`** — `parsePastedNotes`, `hasRecognizableInvoiceTemplate`, `shouldAutoRunGeminiInvoice`, `parseInvoicePasteWithGemini`.
