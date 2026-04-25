# Vertex Core | Idea Board & Roadmap

A place to park ideas, feature requests, and future phases so they do not get lost.

> **This file is for unbuilt ideas only.** Once a phase enters active build, it is tracked in `CURRENT_STATE.md`; once it ships, it moves into `PROJECT_MAP.md → Build History`.

## 🚀 Next Up (Ready to Build)

* **Phase 33 — Field-Add Equipment (No-Info Capture).** Three-path equipment data going forward: (1) **CSV import** in dispatcher (existing), (2) **legacy `customers/.../sites/.../assets`** tree (existing), and (3) **on-site field-add** by the tech when arriving at a site with zero asset records. The Dynamic Action Tray's existing **+ Add Equipment** entry point gets first-class treatment: tech can capture make/model/serial/install-date/nameplate-photo and file it under the correct hierarchy — *parent company → customer name → customer location → unit number*. Decide before build: should field-adds write only to `imported_equipment` (single forward path) or be mirrored to the legacy assets tree so existing dispatcher reports see them immediately. Spec, dispatcher visibility surface, and conflict semantics with CSV import all need to be locked before code. (Logged in response to user 2026-04-25 sync audit conversation.)
* **Sync hardening backlog (KI-002 in `KNOWN_ISSUES.md`).** Plans A/B/C/E from the 2026-04-25 audit. Knock these out **before** new feature work — they prevent silent data-loss in the field. ~2 days total.
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

* *(Small UI adjustments and low-priority bugs to fix later...)*
