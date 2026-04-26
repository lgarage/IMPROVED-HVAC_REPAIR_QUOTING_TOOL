# Vertex Core | Idea Board & Roadmap

A place to park ideas, feature requests, and future phases so they do not get lost.

> **Tier 2 (cold) — pull on demand when picking the next phase or filing a new idea.** Once a phase enters active build, it is tracked in `CURRENT_STATE.md`; once it ships, it moves into `PROJECT_MAP.md → Build History`. Read protocol in `.cursorrules` §1A.

## 🚀 Next Up (Ready to Build)

* ~~**Phase 33 — Field-Add Equipment (No-Info Capture).**~~ ✓ Shipped 2026-04-25 in 5 commits per the locked build order (`dc6e8df` config + bridge helper, `43a1831` Action Tray bridged read, `bc642bd` field-add + field-edit Vision Hub flow, `9b42a5f` CSV importer per-field merge guard, plus the `VC_BUILD = "Phase33-2026-04-25"` + docs sync commit). Awaiting on-device verification (smoke-tests a/b/c in `CURRENT_STATE.md → Immediate Next Step`). Implementation matches the locked ADR-011 spec exactly: single canonical store at `tenants/{tenantId}/imported_equipment`, bridge helpers `getEquipmentForSiteBridged` + `subscribeEquipmentForSiteBridged` in `shared/firebase_logic.js?v=2` (`FIREBASE_LOGIC_VERSION = 2`), per-field `fieldEdits` provenance map with field-as-truth conflict policy, unit identity = `unitType + unitNumber` driven by the new `VC_EQUIPMENT_TYPE_PREFIXES` seed in `shared/config.js?v=4`, edit-existing + add-new only (no relocate/retire/merge/delete), and KI-002 Plan A failure surfacing on every write. See `PROJECT_MAP.md → Build History → Phase 33` for the full commit-level inventory.
* ~~**Sync hardening backlog (KI-002 in `KNOWN_ISSUES.md`).**~~ ✓ Closed 2026-04-25 — Plan A + Plan B subset (B1+B2+B3+B4) + C3 + E2 all shipped. Hygiene leftovers migrated to **Minor Tweaks & Polish** below.
* **Phase 33 follow-up — Offline-resilient photo capture (KI-004 in `KNOWN_ISSUES.md`, design locked in `DECISIONS.md → ADR-012`).** Audit-only filing 2026-04-25 (user-chosen treatment): document the gap, design the fix, defer code until Phase 33 on-device verification clears. Phase 33 already covers offline text-field equipment edits via Firestore persistence (`firebase-config.js` line 34), but **8 field-side `ref.put(...)` photo uploads silently drop their files when offline** — Vision Hub nameplate, Equipment Manager overall photo, watermarked file, 3 custom-form attachments, addendum photos, pasted evidence (full inventory in KI-004). The fix is a single shared `shared/offline_storage_outbox.js` module modeled on the existing `equipment_manager.js#ocrQueue` (`TwinPillarsOfflineDB → ocrQueue` reference pattern at lines 63–146 + line 288 + the `online` event hook at line 1352): same `TwinPillarsOfflineDB` with `IDB_VERSION` bumped to `2` and a new `storageOutbox` object store; public API `OfflineStorageOutbox.enqueueUpload({ storagePath, blob, contentType, contextHook, label })` + named `contextHook` handlers per call site + a `drain()` on `online` event + boot. Dual UI signal per user 2026-04-25: keep `#vcFieldOfflineBadge` for connectivity state, add a separate persistent `#vcPendingSyncChip` for queue depth (independent signals — the queue can have items after signal returns while it drains). Treat as a **KI-002-style follow-up patch on Phase 33** (not a new phase) — shipping `VC_BUILD = "Phase33-followup-<date>"`, verification piggybacks on the Phase 33 a/b/c smoke-tests with two added smoke-tests (d) "tech edits Vision Hub photo in airplane mode → re-enables signal → photo arrives on dispatcher within ~5s" and (e) "queue depth chip drains to zero". See KI-004 for the full call-site inventory + investigation checklist + workaround, and ADR-012 for the locked design + rejected alternatives.
* **Phase 34 candidate — Live Workspace Mirror (Office Override v2).** Filed 2026-04-25 against `KNOWN_ISSUES.md → KI-003`. Today the Office Override iframe (Phase 30) shows what the tech *would* see if they reopened the field app from Firestore — not what's on their physical screen. Two parity gaps: (1) accordion/menu/overlay open-state is local DOM only, never written anywhere, so the iframe's UI shape never matches the tech's; (2) inline form values only sync on save/blur, not on `input`, so the dispatcher can't watch the tech type. Defeats the primary "office coaches struggling tech in real time" use case that motivated Phases 30–32c. **Design locked 2026-04-25 in `DECISIONS.md → ADR-013`** — transport = extend existing `live_presence/{payrollKey}` doc with `uiState` + `liveDraft` maps (no new infra, no RTDB, no WebRTC); direction = read-only v1 (office WATCHES); consent = piggyback ADR-010 with new `liveMirrorAcknowledged` flag in the same merge write; scope = 11 named accordions + delegated `input` listener on `#workspaceScreen` for text/textarea/select; throttle = 250ms debounce + 100ms per-field rate cap (≈$0.20/day/tech); ships as `Phase34-<date>` build stamp. Sequenced **behind Phase 33 on-device verification + the KI-004 follow-up patch** — do not start Phase 34 until both clear. Implementation file = new `technician/js/live_mirror.js`; touches `dispatcher/js/shadow_mode.js#subscribeLivePresenceIdle` for the iframe-forwarding branch (which also resolves KI-002 C4 for the new postMessage receiver). Smoke-tests (a)/(b)/(c)/(d)/(e) defined in ADR-013 → Consequences.
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

### Consent-Gated Shadow Mode (read-only viewing also requires tech tap)

**Concept.** Today the dispatcher's **Shadow Mode** (Phases 19–20) lets office staff watch a tech's screen position / active ticket *without* the tech having to opt in — the orange consent gate from Phase 32 only kicks in when the dispatcher activates **Office Override** (edit mode). Tighten the supervisory primitive so **read-only viewing also requires explicit tap-to-consent on the tech's phone**: if the tech doesn't tap, the dispatcher's Shadow modal shows nothing about what's on the tech's screen, what buttons they're pressing, or which ticket they're in.

**Why icebox, not Next Up.** This flips a default that has been stable since Phase 19 ("supervisor can peek silently"). It is ADR territory — needs a `DECISIONS.md` ADR before code, including a coaching/training carve-out (Lite-seat apprentices may want supervised default-on for safety), and an offline-tech fallback (no consent reachable → degrade to "tech name + last-seen timestamp only", never a stale screen).

**Reuse existing infrastructure (do NOT rebuild).**

* **Consent button + chrome:** `#vcOfficeOverrideConsentBtn` from Phase 32 (`technician/index.html`) already handles tap-to-acknowledge with a Firestore write — extend it with a second mode (`shadow` vs. `override`) instead of building a parallel button.
* **Cross-device flag pattern:** the `officeOverride*` field family on `service_calls` (ADR-010) is the model. Mirror it as `shadowViewActive` / `shadowViewBy` / `shadowViewAcknowledged` / `shadowViewAcknowledgedAt` on **`live_presence`** (not on the ticket — Shadow is a presence concept, not a ticket concept).
* **Three-state path:** `applyOfficeOverrideFromTickets` → `setRemoteOverrideState('off' | 'pending' | 'active')` in `technician/js/workspace_ui.js` is the exact shape needed; clone the state machine for shadow viewing keyed off `live_presence` instead of ticket fields.
* **Dispatcher iframe self-exception:** Phase 32 already skips the consent gate for the dispatcher's own iframes (`?office_override=1`). Same exception needed for the dispatcher's Shadow iframe so the dispatcher viewing themselves isn't gated.

**Behavior outline.**

1. Dispatcher opens Shadow modal → writes `{ shadowViewActive: true, shadowViewBy }` to the tech's `live_presence` doc; iframe loads but **`#vcShadowMirrorBody` stays blacked out** with a "Waiting for tech to allow viewing…" placeholder.
2. Tech's phone shows the existing pulsing orange consent button, copy adjusted: *"🟠 Tap to allow — Dispatch wants to view this screen"* (subtitle naming the dispatcher).
3. Tech taps → field app writes `{ shadowViewAcknowledged: true, shadowViewAcknowledgedAt }` → dispatcher's iframe unblacks and presence mirroring kicks in (existing `applyShadowPresenceFromDoc` path).
4. Dispatcher closes Shadow modal → `shadowViewActive: FieldValue.delete()` → tech's chrome clears within 1 snapshot.
5. Re-opening later starts in `pending` again — **fresh consent every time**, same as Office Override.

**Edge cases to think through in the ADR.**

* **Auto-shadow during Office Override take-over** (Phase 31): the "Take over (edit this job)" button currently swaps Shadow → Office Override seamlessly. After this change, the existing Office Override consent tap should **also** satisfy the shadow-view consent in the same gesture — don't make the tech tap twice.
* **Lite-seat apprentices:** training accounts (`isTrainingAccount === true`) may want consent default-on, or a per-tenant policy flag, so trainers don't lose situational awareness. Confirm with stakeholder before deciding.
* **Force app refresh** (Phase 20 "Force app refresh" via `forceSyncAt`): keep this **outside** the consent gate — it's a recovery primitive, not surveillance, and the tech sees the reload itself.
* **Coach prompt toasts** (Phase 19 `coachPrompt`): debate-worthy — these are 1-way write-only and don't reveal the tech's screen, so they could be allowed without consent. Default is to gate them too (matches user intent of "dispatcher can't see what the tech is doing").

**Touch list (when promoted from Icebox).**

* `dispatcher/js/shadow_mode.js` — gate iframe content + activation toast on `shadowViewAcknowledged`.
* `technician/js/workspace_ui.js` — extend three-state machine to also drive shadow consent from `live_presence`.
* `technician/index.html` — extend consent button to handle both modes (or duplicate with shared CSS).
* `live_presence` schema additions: `shadowViewActive` / `shadowViewBy` / `shadowViewAcknowledged` / `shadowViewAcknowledgedAt`.
* New `DECISIONS.md` ADR describing the supervisory-default flip + Lite-seat carve-out + force-sync exception.

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
