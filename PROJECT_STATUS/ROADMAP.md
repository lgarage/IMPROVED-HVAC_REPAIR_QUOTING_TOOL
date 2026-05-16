# Vertex Core | Idea Board & Roadmap

A place to park ideas, feature requests, and future phases so they do not get lost.

> **Tier 2 (cold) ? pull on demand when picking the next phase or filing a new idea.** Once a phase enters active build, it is tracked in `CURRENT_STATE.md`; once it ships, it moves into `PROJECT_MAP_HISTORY.md`. Read protocol in `.cursorrules` §1A.

## ?? Next Up (Ready to Build)

* ~~**Phase 33 ? Field-Add Equipment (No-Info Capture).**~~ ? Shipped 2026-04-25. See `DECISIONS.md ? ADR-011` + `PROJECT_MAP_HISTORY.md`.
* ~~**Sync hardening backlog (KI-002).**~~ ? Closed 2026-04-25. See `KNOWN_ISSUES_ARCHIVE.md ? KI-002`. Hygiene leftovers migrated to **Minor Tweaks & Polish** below.
* **Phase 33 follow-up ? Offline-resilient photo capture (KI-004).** 8 field-side `ref.put(...)` sites silently drop photos offline. Fix: `shared/offline_storage_outbox.js` (IDB-backed queue, `drain()` on `online` event, `#vcPendingSyncChip` UI signal). Design locked ? `DECISIONS.md ? ADR-012`. Prerequisite: Phase 33 on-device verification. Build stamp: `Phase33-followup-<date>`. Full call-site inventory + workaround: `KNOWN_ISSUES.md ? KI-004`. Re-gate ? **Sonnet 4.6**.
* **Phase 34 candidate ? Live Workspace Mirror (Office Override v2, KI-003).** iframe (Phase 30) shows stale Firestore state, not live screen. Design locked ? extend `live_presence/{payrollKey}` with `uiState` + `liveDraft` maps; read-only v1; 250ms throttle (?$0.20/day/tech). New file: `technician/js/live_mirror.js`. `DECISIONS.md ? ADR-013`. Prerequisite: Phase 33 on-device verification + KI-004. Re-gate ? **Codex 5.3**.
* ~~**Phases 41–57 — Conversational Field Capture (New Field Tech UX).**~~ ? All 28 slices (41a–57a) passed via SDK build runner v2.1 on 2026-05-14. Includes integration smoke test, offline graceful degradation, Firebase deploy, Firestore rules, auth verification, offline photo outbox (KI-004), SW cache hygiene, dispatcher ticket Save button. See `NEW_FIELDTECH_UX_PLAN.md` for slice detail.
* **Phase 63 — Field Intelligence: Contextual Checklists.** 6 slices (63a–63f): multi-trigger words on form_templates, adaptive checklist reminders in conversational timeline, experience-based prompting, photo auto-tie to equipment, post-compile ? equipment history write. Slices authored 2026-05-16; ready for SDK build runner.
* **Firestore rules re-tightening (post-59b revert):** Requires anonymous-auth or custom-token flow for field techs before `request.auth != null` can be applied to data paths. 59b reverted 2026-05-15 — see `firestore.rules` header.
* **Command Map (TV Mode):** Large-scale map and pulse feed for office monitors.
* **Field Inventory (Truck Stock):** Parts and materials ledger for technicians.

## ?? The Icebox (Raw Ideas)

### Dispatcher ticket details modal ? explicit **Save** (scheduling confidence)

**Concept.** Add a **Save** button to Ticket Details (`#ticketDetailsModal`) so dispatchers get visible `showSaveCue("? Saved")` confirmation without closing the modal. Refactor the persist body of `closeTicketDetails()` into `persistTicketDetailsModal({ closeAfter })` so Save and Close share one path. Close semantics unchanged.

**Files:** `index.html` (footer of `#ticketDetailsModal`), `service_call.js` (~1487?1551 `closeTicketDetails`). Pure UX polish, no data-model change. Ship with `service_call.js ?v=` bump.

---

### Field Form Builder & dynamic Field App forms ? **direct drive / belt**, **equipment types**, **photo capture**, **interactive preview**

**Filed 2026-04-28.** Four sub-items:
1. **Dynamic field visibility** ? `renderDynamicForm` needs group metadata + `wireEquipmentFieldVisibility` so belt-group rows gray out on Direct drive (same as static forms, `field_forms.js ~635?664`).
2. **Configurable equipment type list** ? hardcoded in `renderEquipmentFlagsHtml` (~606?621); needs `app_config` key + Settings UI.
3. **Photo fields on iPhone** ? `accept="image/*;capture=camera"` shows "Choose file" on iOS. Camera-first UX = deliberate UX pass; may intersect KI-004/ADR-012.
4. **Interactive Mobile Preview** ? `settings.js#buildFieldFormPreviewHtml` disables all controls; desired: sandboxed `renderDynamicForm` body with `preventDefault` on save.

**Why Icebox.** Multi-surface; needs UX + ADR before equipment-type enum storage change.

---

### Architecture Epic: Unified Contextual Modes (Service vs. Project)

**Concept.** Route the same Vertex Core shell through a `ticketClass: "service" | "project"` flag ? no parallel product forks. Dispatcher sees **Dispatch Board** (service) or **Project Command Center** (Kanban / Gantt / Supply Request). Field sees **Service Workspace** (current intelligent workspace) or **Project Workspace** (Daily Logs, phase checklists, Request Supplies portal).

**Why Icebox.** Architecture-scale change; requires `ticketClass` ADR + phased rollout plan + multi-surface rewrite budget. Do not start without a dedicated planning session.

---

### ~~Consent-Gated Shadow Mode~~ ?

Shipped 2026-05-08. Tech toggle in Profile panel writes `shadowConsent` to `live_presence`; dispatcher iframe gated on that field. See `PROJECT_MAP.md` ? Phase 37.

---

## ?? Minor Tweaks & Polish

* **KI-002 hygiene leftovers (2026-04-25 sync audit).** None are field-impact; pick off opportunistically when surrounding code is open:
  * **B5** ? `dispatcher/js/report_builder.js:138-140` loads `report_builder.css?v=1` while `index.html:20` loads `?v=4`. Consolidate to one source.
  * **B6** ? `sw.js` cache hygiene: bump `CACHE_NAME` on each deploy; add `activate` handler to delete old caches; consider network-first for `index.html`.
  * **B7** ? Document the dispatcher-SW vs tech-no-SW asymmetry inside `sw.js` and under `KNOWN_ISSUES.md ? Environmental Gotchas`.
  * **C1** ? `dispatcher/js/shadow_mode.js:147-167`: refcount + unsubscribe `subscribeLivePresenceIdle` (consumers: shadow modal, take-over button, `syncDispatcherTicketIdToActiveTech`).
  * **C2** ? `field_forms.js:496-510`: store unsub for `form_templates` listener; call on tab leave.
  * **C4** ? postMessage receivers (`workspace_ui.js:301`, `technician/index.html:4163`, `shadow_mode.js:355`): validate `event.origin === window.location.origin`.
  * **E1** ? `dispatcher/js/activity_feed.js:44-55` (`normalizeInternal`): normalize `internal_comms` to a single canonical type on every write.
  * **E3** ? `settings.js:614-617` & `:632-635`: wrap dual roster + on-call writes in a `WriteBatch` so both succeed atomically.
  * **E4** ? `dispatcher/js/ai_report_reviewer.js:563-583`: drop the redundant `syncSingleServiceCallToCloud(localRow)` after `setServiceCallMerged(memo)`.
* *(Small UI adjustments and low-priority bugs to fix later...)*
