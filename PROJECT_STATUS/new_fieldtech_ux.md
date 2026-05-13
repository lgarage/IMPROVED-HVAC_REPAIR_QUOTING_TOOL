# Vertex — Conversational Field Capture System

## Master Architecture & Build Specification

---

# Core Philosophy

Vertex should NOT behave like traditional HVAC software.

Technicians do not naturally think in:

- forms
- tabs
- dropdowns
- rigid workflows
- required fields

Technicians think in:

- observations
- measurements
- troubleshooting
- movement between equipment
- reminders
- photos
- follow-up thoughts

The technician experience should feel like:

> talking naturally to a smart field assistant.

The system should:

- capture information conversationally
- structure it automatically
- provide lightweight reminders
- maintain operational continuity
- preserve company knowledge
- compile structured outputs afterward

---

# Primary System Goals

## Technician Experience

- extremely fast
- minimal taps
- voice-first
- photo/video-first
- conversational
- glove-friendly
- ladder-friendly
- low cognitive load

## Operational Goals

- better field documentation
- preserve tribal knowledge
- improve quote accuracy
- reduce forgotten information
- improve PM consistency
- improve technician onboarding
- preserve unresolved issue continuity
- improve office efficiency

---

# Critical Architectural Philosophy

Vertex is NOT:

- a chatbot
- a form system
- a rigid checklist app

Vertex IS:

- a conversational operational capture system

The technician should:

- speak naturally
- move naturally
- work naturally

Vertex should:

- structure information underneath
- track workflow state silently
- provide reminders only when useful
- organize information afterward

---

# High-Level Architecture

## Edge Device Responsibilities

- speech-to-text
- local intent parsing
- local workflow state
- equipment context tracking
- local checklist state
- reminders
- media capture
- active job timeline
- local operational memory
- offline operation

## Cloud Responsibilities

- low-confidence AI escalation
- historical retrieval
- compile/report generation
- company knowledge sync
- learning updates
- dispatcher review workflows
- knowledge indexing

---

# Phase 1 — Conversational Timeline UI

## Goal

Replace form-driven technician workflow with a conversational timeline.

---

# Main Screen

Single scrollable timeline similar to ChatGPT.

Timeline contains:

- technician voice entries
- Vertex responses
- follow-up prompts
- photos
- videos
- reminders
- confirmations
- corrections
- unresolved notes

Technician should be able to:

- scroll conversation
- edit entries
- correct entries
- continue naturally

---

# Bottom Action Bar

## Left Button — Media Capture

Large button beside talk button.

### Tap

- capture photo

### Hold

- capture video

Media automatically attaches to:

- active job
- active equipment context
- technician
- timestamp

Media immediately appears in timeline.

---

## Right Button — Hold To Talk

### Behavior

- hold to dictate
- live speech-to-text appears while talking
- release to process

Vertex then:

- confirms
  OR
- asks short follow-up

---

# Follow-Up Prompt Rules

Prompts must stay extremely short.

### GOOD

- RTU6?
- Capacitor?
- Temp split?
- Belt size?
- Same issue?

### BAD

- Please confirm which rooftop unit this issue belongs to.

---

# Phase 2 — Local Job Context Engine

## Goal

Maintain active job state locally.

---

# At Job Check-In

Preload locally:

- site notes
- equipment list
- unresolved issues
- open quotes
- recurring problems
- previous PM reminders
- previous technician notes
- active workflows/checklists
- last 12 months of operational history

Goal:
Most work should function without cloud dependency.

---

# Local Context Tracking

Track:

- active equipment
- previous equipment
- workflow completion state
- unresolved reminders
- missing items
- active technician reminders
- current conversational context

---

# Conversational Context Persistence

Example:

Technician:

> working on RTU4

Vertex internally sets:

```json
{
  "activeEquipment": "RTU4"
}

Next note:

belt size needs updated on this unit to AX49

Vertex should understand:

“this unit” = RTU4

WITHOUT asking follow-up.

Context must persist naturally.

Phase 3 — Edge Intent Engine
Goal

Use local parsing first.
Avoid unnecessary cloud AI usage.

Edge Intent Engine Responsibilities

Detect:

equipment references
temperatures
amp draws
deficiencies
parts
customer/internal notes
unresolved issues
reminders
quote items
workflow completion
HVAC Vocabulary Correction Layer

Support local correction mappings.

Example:

{
  "cat pastor": "capacitor",
  "mc ferry": "microfarad",
  "colonizer": "economizer",
  "connector fan": "condenser fan",
  "shiv": "sheave",
  "RT seven": "RTU7"
}
Confidence-Based Escalation
High Confidence
store result
“Got it.”
Medium Confidence
short clarification
Low Confidence
silent cloud AI escalation
If Still Uncertain
ask shortest possible follow-up
Important Rule

Do NOT constantly ask technicians to confirm obvious things.

The system should quietly learn.

Phase 4 — Voice + Text Follow-Ups
Goal

Technician can answer ALL prompts verbally.

Example

Technician:

changed belt AX48

Vertex:

RTU4?

Technician:

yes

Vertex:

got it

Supported Voice Responses
yes
no
skip
corrected
update
resolved
still bad
not checked
same issue
Input Flexibility

Technician may:

speak
OR
tap buttons
Settings
Voice + Text

Spoken prompts + text.

Text Only

Text + ding/vibration.

Silent

Visual only.

Phase 5 — Dynamic Checklist Reminder Engine
Goal

Prevent forgotten items without rigid forms.

IMPORTANT

DO NOT hardcode PM checklists inside technician app.

The technician app must dynamically load workflows/checklists from the existing dispatcher/management checklist system.

Cursor MUST NOT:

create static PM arrays
hardcode PM logic into technician app

The dispatcher app already contains checklist tooling and should remain the source of truth.

Management Workflow Ownership

Management defines:

PM workflows
service workflows
required items
reminder priorities
escalation logic
quote triggers

Vertex references these dynamically during live work.

Example Workflow Logic

Management defines:
Major Cool PM:

filters
belts
capacitor
temp split
economizer
amp draws

Technician says:

moving onto RTU7

Vertex checks RTU6 workflow state.

Missing:

capacitor

Vertex:

RTU6 capacitor?

Reminder Philosophy

Vertex:

assists
reminds
organizes

Vertex does NOT:

aggressively police
hard-block workflow
force forms
Phase 6 — Corrections + Editable Timeline
Goal

Allow natural corrections.

Examples

Technician:

correction, that was RTU6

OR technician edits timeline entry directly.

Editable Fields
equipment
values
note text
customer/internal visibility
category
Preserve

Store:

original transcript
corrected structured version

Use corrections for learning.

Phase 7 — Media + Context Tagging
Goal

Media becomes part of operational timeline.

Media Behavior

Photos/videos automatically attach to:

job
equipment
timestamp
technician
Office View

Office sees:

all media
grouped by equipment
Customer View

Customer only sees:

approved media
Phase 8 — Compile Notes Workflow
Goal

Convert conversational field capture into structured outputs.

Compile Notes Button

At end of work:

Compile Notes

This creates:

structured office package
equipment history updates
quote recommendations
unresolved issue updates
dispatcher review package
IMPORTANT

Customer-facing reports are NOT generated live during field work.

During active work:

raw notes
troubleshooting
reminders
temporary thoughts
uncertain observations
remain internal only.
Phase 9 — Dispatcher Review + Customer Report System
Goal

Customer-facing communication belongs in dispatcher/office software.

Technician App Responsibilities

Technician app:

captures field data
captures media
completes workflows
flags quote items
submits structured job package

Technician does NOT:

polish customer reports
finalize wording
approve customer communication
Dispatcher App Responsibilities

Dispatcher/office app:

generates customer-facing report
reviews AI-generated wording
edits findings
approves customer communication
controls visible photos
manages quotes
updates customer history
Human Review Requirement

Customer-facing reports MUST require human review before release.

Reviewer should be able to:

edit wording
remove findings
mark internal-only notes
adjust recommendation tone
approve final release
AI Learning From Review

If dispatcher edits AI-generated wording:
Vertex should remember those edits.

Example:
AI says:

Evaporator coils dirty.

Manager removes it.

Vertex logs:

removed
why removed if provided
future weighting adjustment
Phase 10 — Post-Job Learning Sync
Goal

Improve system quietly over time.

Upload After Checkout

Upload:

transcripts
corrections
confidence scores
parse failures
cloud escalations
vocabulary corrections
workflow completion patterns
Learning Rule

Technicians should NOT manually train Vertex.

System learns quietly from:

corrections
reviews
repeated patterns
dispatcher edits
Phase 11 — Site Notes + Operational Memory
Goal

Preserve company/site knowledge.

Site Notes Examples
ladder access
roof hatch
parking
thermostat locations
areas served
safety concerns
access codes
customer preferences
Operational Memory

Load locally:

unresolved issues
recurring failures
previous quotes
recurring PM notes
historical deficiencies

Goal:
Maintain operational continuity across years.

Phase 12 — Technician Teaching Layer
Goal

Preserve senior technician knowledge.

Teaching Notes

Senior techs can save:

photos
videos
voice explanations
diagrams
procedures
examples
Example Teaching Topics
pillow block bearings
economizer testing
belt tension
thermostat setup
P-trap setup
Carrier economizer identification
blower bearing replacement
Knowledge Scope Levels
Site-Specific
ladder access
thermostat location
Equipment-Specific
RTU6 black-box economizer
Model-Specific
Honeywell 8000 setup
Company-Wide
PM best practices
rooftop cleanup
bearing identification
Phase 13 — Knowledge Lookup Ladder
Goal

Technicians should not repeatedly search for the same information.

Lookup Order

When technician asks for help:

current job notes
site notes
equipment history
company-wide knowledge
uploaded manuals
internet/cloud lookup
Cloud Lookup Learning

If internet lookup succeeds:
Vertex stores:

Company-Wide Knowledge

Example:

Honeywell 8000 installer setup
Site Knowledge

Example:

this site uses Honeywell 8000 thermostat

Goal:
Future technicians benefit automatically.

Critical UX Rules
Technician should rarely navigate forms.
Technician should rarely type.
Technician should work naturally.
Vertex structures information afterward.
Follow-ups must stay short.
Workflow should remain fast.
Edge-first architecture preferred.
Cloud AI only when useful.
Operational continuity is critical.
Customer communication belongs to dispatcher review workflow.
Desired End State

Technician:

moving onto RTU6

Vertex:

got it

Technician:

compressor disconnected at contactor, reconnected and running okay

Vertex:

got it

Technician takes photo.

Photo automatically attaches to RTU6.

Technician:

return 59 supply 40 compressor 14 amps

Vertex:

got it

Technician:

moving onto RTU7

Vertex notices capacitor missing on RTU6.

Vertex:

RTU6 capacitor?

Technician:

4.91 microfarads

Vertex:

got it

Technician:

compile notes

Vertex creates:

office package
equipment history updates
unresolved issue tracking
dispatcher review package
quote recommendations
knowledge updates
```
