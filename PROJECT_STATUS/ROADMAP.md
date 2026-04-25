# Vertex Core | Idea Board & Roadmap

A place to park ideas, feature requests, and future phases so they do not get lost.

> **This file is for unbuilt ideas only.** Once a phase enters active build, it is tracked in `CURRENT_STATE.md`; once it ships, it moves into `PROJECT_MAP.md → Build History`.

## 🚀 Next Up (Ready to Build)

* ~~**Phase 33 — Field-Add Equipment (No-Info Capture).**~~ ✓ Shipped 2026-04-25 in 5 commits per the locked build order (`dc6e8df` config + bridge helper, `43a1831` Action Tray bridged read, `bc642bd` field-add + field-edit Vision Hub flow, `9b42a5f` CSV importer per-field merge guard, plus the `VC_BUILD = "Phase33-2026-04-25"` + docs sync commit). Awaiting on-device verification (smoke-tests a/b/c in `CURRENT_STATE.md → Immediate Next Step`). Implementation matches the locked ADR-011 spec exactly: single canonical store at `tenants/{tenantId}/imported_equipment`, bridge helpers `getEquipmentForSiteBridged` + `subscribeEquipmentForSiteBridged` in `shared/firebase_logic.js?v=2` (`FIREBASE_LOGIC_VERSION = 2`), per-field `fieldEdits` provenance map with field-as-truth conflict policy, unit identity = `unitType + unitNumber` driven by the new `VC_EQUIPMENT_TYPE_PREFIXES` seed in `shared/config.js?v=4`, edit-existing + add-new only (no relocate/retire/merge/delete), and KI-002 Plan A failure surfacing on every write. See `PROJECT_MAP.md → Build History → Phase 33` for the full commit-level inventory.
* ~~**Sync hardening backlog (KI-002 in `KNOWN_ISSUES.md`).**~~ ✓ Closed 2026-04-25 — Plan A + Plan B subset (B1+B2+B3+B4) + C3 + E2 all shipped. Hygiene leftovers migrated to **Minor Tweaks & Polish** below.
* **Phase 34 candidate — Live Workspace Mirror (Office Override v2).** Filed 2026-04-25 against `KNOWN_ISSUES.md → KI-003`. Today the Office Override iframe (Phase 30) shows what the tech *would* see if they reopened the field app from Firestore — not what's on their physical screen. Two parity gaps: (1) accordion/menu/overlay open-state is local DOM only, never written anywhere, so the iframe's UI shape never matches the tech's; (2) inline form values only sync on save/blur, not on `input`, so the dispatcher can't watch the tech type. Defeats the primary "office coaches struggling tech in real time" use case that motivated Phases 30–32c. Needs a dedicated ADR before code (transport choice — Firestore vs. RTDB vs. WebRTC data channel; consent model — does this piggyback on the existing override-acknowledged flag or get its own gate; scope — which accordions, which fields, throttle budget, disconnect behavior; direction — read-only mirror vs. bi-directional). See KI-003 for the full investigation checklist + candidate transports + grep pointers.
* **Command Map (TV Mode):** Large-scale map and pulse feed for office monitors.
* **Field Inventory (Truck Stock):** Parts and materials ledger for technicians.

## 🧊 The Icebox (Raw Ideas)

### Architecture Epic: Unified Contextual Modes (Service vs. Project)

**Concept.** Keep Vertex Core as **one** application for Office and Field—not four separate codebases. Route experience through **contextual UI** driven by work-order type: the same shell, different dashboards and tools depending on whether the ticket is operational service work or a multi-phase project.

**Technical strategy & data model**

* Add **`ticketClass`**: `"service" | "project"` on tickets / work orders (single source of truth).
* That **one flag** drives layout, navigation, and which tools are available for a given job—no parallel product forks.

**Office app — contextual dashboards**

| Mode | Purpose |
|------|---------|
| **Service** | Today’s **Dispatch Board**: fast calendar routing for short-cycle work (e.g. 2-hour repairs, maintenance). |
| **Project** | **Project Command Center** (dedicated sidebar hub): multi-week installs with **Kanban / Gantt**, **phase tracking**, and a **Supply & Vendor Request** approval surface for the Ops Manager. |

**Field app — smart routing**

| `ticketClass` | Workspace |
|---------------|-----------|
| **`service`** | **Service Workspace** — current **Intelligent Workspace** (Dictation Hub, quick invoicing, unit nameplates, existing service flows). |
| **`project`** | **Project Workspace** — Dictation Hub is **replaced** by **Daily Logs**, **phase checklists**, and a **Request Supplies** portal tied to vendor item lists, oriented to the Field PM. |

*Other raw notes:* *(Google Keep dumps, shower thoughts, and smaller ideas can still land below as bullets.)*

## 🐛 Minor Tweaks & Polish

* **KI-002 hygiene leftovers (2026-04-25 sync audit).** Closed because none are field-impact, but worth picking off opportunistically when the surrounding code is open:
  * **B5** — `dispatcher/js/report_builder.js:138-140` loads `report_builder.css?v=1` while `index.html:20` loads `?v=4`. Consolidate to one source.
  * **B6** — `sw.js` cache hygiene: bump `CACHE_NAME` on each deploy; add `activate` handler to delete old caches; consider network-first for `index.html`.
  * **B7** — Document the dispatcher-SW vs tech-no-SW asymmetry inside `sw.js` and under `KNOWN_ISSUES.md → Environmental Gotchas`.
  * **C1** — `dispatcher/js/shadow_mode.js:147-167`: refcount + unsubscribe `subscribeLivePresenceIdle` (consumers: shadow modal, take-over button, `syncDispatcherTicketIdToActiveTech`).
  * **C2** — `field_forms.js:496-510`: store unsub for `form_templates` listener; call on tab leave.
  * **C4** — postMessage receivers (`workspace_ui.js:301`, `technician/index.html:4163`, `shadow_mode.js:355`): validate `event.origin === window.location.origin`.
  * **E1** — `dispatcher/js/activity_feed.js:44-55` (`normalizeInternal`): normalize `internal_comms` to a single canonical type on every write (string, per "last writer wins").
  * **E3** — `settings.js:614-617` & `:632-635`: wrap dual roster + on-call writes in a `WriteBatch` so both succeed atomically (or neither).
  * **E4** — `dispatcher/js/ai_report_reviewer.js:563-583`: drop the redundant `syncSingleServiceCallToCloud(localRow)` after `setServiceCallMerged(memo)` (or refresh `localRow` from server first).
* *(Small UI adjustments and low-priority bugs to fix later...)*
