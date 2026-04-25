# Vertex Core | Current State

> **READ THIS FILE FIRST** at the start of every session. It is the single source of truth for *where we are right now*.
>
> - For the full implemented-feature catalog, see `PROJECT_MAP.md`.
> - For active bugs and environmental gotchas, see `KNOWN_ISSUES.md`.
> - For why we made a given architectural choice, see `DECISIONS.md`.
> - For unbuilt ideas, see `ROADMAP.md`.
> - For deep architecture handoff, see `AI_CONTEXT_PROJECT_OVERVIEW.md`.

---

## Snapshot

- **Active Phase:** **None — Phase 33 (Field-Add Equipment) shipped 2026-04-25, awaiting on-device verification.** Phases 31–32c verified end-to-end on a real iPhone 2026-04-25; **KI-002 closed 2026-04-25**; **Phase 33 shipped 2026-04-25** (5 logical commits per the locked build order: `dc6e8df` config + bridge helper, `43a1831` Action Tray bridged read, `bc642bd` field-add + field-edit Vision Hub flow, `9b42a5f` CSV importer per-field merge guard, plus this commit for `VC_BUILD = "Phase33-2026-04-25"` + docs sync). **Recommended next phase (pick after Phase 33 verification clears):** **Command Map (TV Mode)** or **Field Inventory (Truck Stock)** per `ROADMAP.md → Next Up`.
- **Last shipped this session (2026-04-25):** Phases 31 + 32 + 32a + 32b + 32c (Office Override consent gate end-to-end + on-device diagnosability) **+ KI-002 Plan A** (silent-failure repair: new `VCRequireTicketId` + `VCSurfaceWriteFailure` helpers in `shared/firebase_logic.js`, ring-buffered into `window.__vcWriteFailures` and surfaced live in the iPhone debug overlay; A1–A9 call sites converted; `service_call.js?v=68`; `VC_BUILD = "KI002-A-2026-04-25"`; commit `e8f5cab`) **+ KI-002 Plan B subset B1+B2+B3+B4** (cache & version hygiene: `shared/firebase_logic.js?v=1` on all 3 callers + load-time `[VC] firebase_logic v=1 loaded` console.info + `window.__VC_FIREBASE_LOGIC_VERSION` global; `?v=1` on the 5 unversioned tech bundle scripts; `equipment_manager.js?v=8` unified across dispatcher + tech; new dispatcher `window.VC_BUILD = "KI002-B-2026-04-25"` + `#vcBuildChip` in sidebar-footer that renders `BUILD <stamp> · fb v<N>` and is click-to-copy; commit `b49eb23`) **+ KI-002 Plan C3** (Shadow mirror polling fallback: `applyShadowPresenceFromDoc` now calls new `shadowMirrorOpenViaBridgedFetch(tid)` after the 40×350ms poll exhausts — one-shot `VCFirestore.getServiceCallOnceBridged(db, tid)`, push into `myTickets`, `openWorkspace(tid)`; every failure path routes through `VCSurfaceWriteFailure` so the iPhone debug overlay surfaces the stall instead of swallowing it; commit `f4fe37a`) **+ KI-002 Plan E2** (TWIN_PILLARS branding purge: `dispatcher/js/client_notifications.js#getTenantIdSafe` now defers to `VCFirestore.getTenantId()` instead of pinning the legacy `"TWIN_PILLARS"` literal; codebase grep verified this was the **only** caller-side default outside the lazy-migration bridge in `shared/firebase_logic.js` (intentionally left quiet because no live consumers need it); `client_notifications.js?v=2` bumped, both `window.VC_BUILD` stamps bumped to `"KI002-CE-2026-04-25"`; commit `79eb281`). See `PROJECT_MAP.md → Build History` and `KNOWN_ISSUES.md → Resolved → KI-002` for the full inventory.
- **Standing dev tools shipped in this batch (keep in mind for future work):**
  - **Always-on iPhone debug overlay** at `technician/index.html` (no URL flag required; opt out with `?vc_debug=0`). Bottom-right `VC DEBUG` box with a Copy button. First line is `BUILD: <stamp>` — bump `window.VC_BUILD` in `technician/index.html` whenever you change inline content of that file so cached-HTML diagnosis is one glance.
  - **Dispatcher BUILD chip (KI-002 B4)** mirrors the same idea on the office side: `#vcBuildChip` lives in `.sidebar-footer` of `index.html` and renders `BUILD <window.VC_BUILD> · fb v<N>` (where `N` comes from `window.__VC_FIREBASE_LOGIC_VERSION`, set by `shared/firebase_logic.js`). Click to copy. Bump `window.VC_BUILD` in `index.html` whenever you change inline content of that file.
  - **Cross-device write-skip alarm** in `service_call.js#toggleOfficeOverride` (red outline + alert + console warn when `#scCurrentId.value` is empty on activate).
  - **Cyan synced-ticket badge** `#vcSimulatorTicketBadge` in the phone-simulator toolbar — driven by `dispatcher/js/shadow_mode.js#syncDispatcherTicketIdToActiveTech()` (exposed as `window.vcSyncDispatcherTicketIdToActiveTech`). Auto-loads the shadow-target tech's `live_presence.activeTicketId` into `#scCurrentId` so Office Override always targets the ticket the tech is viewing, with a `lastSyncedTicketId` watermark so manual ticket loads in Service Call Intake always win.
  - **Lazy-inject pattern** for any UI element that needs to ship in the inline `technician/index.html` HTML — `workspace_ui.js#ensureConsentButtonInDom()` is the reference implementation. Use this for any future tech-side UI element so a stale cached entry-point HTML can never break new features. **KI-002 Plan A added two more reference instances:** `ensureVcPresenceChipInDom()` (top-right "presence offline" chip) in `technician/index.html` and `ensureNotesErrorBannerInDom()` ("⚠ note not synced — tap to retry") in `dictation_hub.js`.
  - **Standardized failure surfacing** — *new this batch:* `VCRequireTicketId(tid, label)` + `VCSurfaceWriteFailure(ctx, err)` helpers in `shared/firebase_logic.js` (also bare globals). Use these instead of `if (tid)` skips and `.catch(console.warn)` everywhere. Failures land in a 10-deep `window.__vcWriteFailures` ring buffer that the iPhone debug overlay renders (last 3 records with age in seconds, ctx, and message). Pair every `VCSurfaceWriteFailure` call with a user-visible affordance at the call site — never let a write die silently.
- **Live two-way notes:** `dictation_hub.js#subscribeInternalCommsForTicket` mirrors `internal_comms` in real time; verified working on real devices. **Conflict resolution: last writer wins** (per user 2026-04-25); do not add merge logic.
- **Default tenant:** `USA_HEATING_COOLING`. **TWIN_PILLARS branding is dead** (per user 2026-04-25) — purge any remaining `"TWIN_PILLARS"` defaults during the next sweep (see KI-002 Plan E2). Lazy-migration bridge in `shared/firebase_logic.js` can stay quiet for now (no live consumers needing it).

## Active Blocker

*(None — but two **non-blocking** follow-ups are filed against Phase 33 and tracked in `KNOWN_ISSUES.md → Open`. Neither blocks Phase 33 verification or any next-phase pick.)*

- **`KI-003` — Office Override iframe parity gap.** Tracked as a candidate "Phase 34 — Live Workspace Mirror" under `ROADMAP.md → Next Up`.
- **`KI-004` — Field-app photo uploads are silently dropped offline (Phase 33 follow-up).** Filed 2026-04-25 from the post-Phase 33 audit triggered by user spec "if a tech does not have signal when servicing equipment, the info should be stored on the phone and synced when signal returns." **Audit-only treatment per user 2026-04-25** — KI-004 + `DECISIONS.md → ADR-012` + `ROADMAP.md → Next Up` filed; no code yet. Confirmed: text-field equipment edits already survive offline via Firestore `enablePersistence` (`firebase-config.js` line 34); the gap is the 8 `ref.put(...)` photo upload sites in field code (Vision Hub nameplate, Equipment Manager overall + watermarked, 3 custom-form attachments, addendum photos, pasted evidence). Design locked in ADR-012: shared `shared/offline_storage_outbox.js` modeled on the existing `equipment_manager.js#ocrQueue` reference pattern, same `TwinPillarsOfflineDB` (`IDB_VERSION` → 2, new `storageOutbox` object store), dual UI signal (`#vcFieldOfflineBadge` for connectivity stays, new `#vcPendingSyncChip` for queue depth). **Treat as a KI-002-style follow-up patch on Phase 33** (not a new phase) per user 2026-04-25 — shipping `VC_BUILD = "Phase33-followup-<date>"`, verification piggybacks on the Phase 33 a/b/c smoke-tests with added smoke-tests (d) and (e) for the photo outbox.

## Immediate Next Step — Phase 33 on-device verification

Phase 33 ships in 5 commits (build order locked in `DECISIONS.md → ADR-011`):
1. `dc6e8df` — `VC_EQUIPMENT_TYPE_PREFIXES` in `shared/config.js` (`?v=4`) + `getEquipmentForSiteBridged` / `subscribeEquipmentForSiteBridged` in `shared/firebase_logic.js` (`FIREBASE_LOGIC_VERSION = 2` + `shared/firebase_logic.js?v=2` on `index.html`, `technician/index.html`, `proof_of_service.html`).
2. `43a1831` — `dictation_hub.js` Action Tray now uses `VCFirestore.subscribeEquipmentForSiteBridged` (`dictation_hub.js?v=9`). `equipment_hub.js` + `dispatcher/js/report_builder.js` examined and intentionally **not** migrated — `equipment_hub.js` reads from a different (capitalized `Customers/Locations/Equipment`) collection and `report_builder.js` only renders an `equip` field already on the ticket doc; neither hits `customers/.../sites/.../assets` directly.
3. `bc642bd` — Vision Hub overlay rewrite. Identity row = `unitType` dropdown (seeded from `VC_EQUIPMENT_TYPE_PREFIXES` + `Other → freeform`) + `unitNumber`. `visionHubSaveEquipment` writes to `tenants/{tenantId}/imported_equipment` only (canonical store), uploads nameplate photos directly to `tenants/{tenantId}/imported_equipment_photos/...` instead of routing through the legacy `dictationPromoteAssetPhoto` path. Pre-loads existing slot values via the bridge → diffs at save → stamps `fieldEdits[<fieldName>] = { by, at }` only for fields the tech actually changed (per ADR-011 §3). New slots get `source: "field"`, `addedBy`, `addedAt`. Inline red error banner + `VCSurfaceWriteFailure` on rejection (`dictation_hub.js?v=10`).
4. `9b42a5f` — `dispatcher/js/import_hub.js#processEquipmentImport` per-field merge guard. Pre-fetches existing `imported_equipment` docs by `normalizedLocationKey` (concurrent chunks of 8), matches each CSV row to an existing doc by `unitTag` → `serialNumber` → legacy doc id, and **strips any field present in the existing doc's `fieldEdits` map** before writing. Brand-new rows seed `source: "csv"` + `fieldEdits: {}`; existing field-added rows preserve `source: "field"` (`dispatcher/js/import_hub.js?v=2`).
5. *(this commit)* — `window.VC_BUILD = "Phase33-2026-04-25"` in both `index.html` and `technician/index.html` + PROJECT_STATUS docs sync.

**Verification protocol — do this on next iPhone + dispatcher touch:**
- *Tech (force-reload field app on iPhone):* debug overlay top line should read `BUILD: Phase33-2026-04-25`. Open the Vision Hub from any ticket → confirm the new dropdown + unit-number row + tag-preview line. Pick `RTU` + `4` → confirm preview shows `Slot: RTU4 [New slot]`.
- *Dispatcher (force-reload):* sidebar-footer chip should read `BUILD Phase33-2026-04-25 · fb v2`.
- *Smoke-test (a) — single-field tech correction stays sticky:* on a site with at least one CSV-imported unit, tech edits **only the model** on Unit X via Vision Hub → reload → confirm the model stayed corrected.
- *Smoke-test (b) — re-import doesn't clobber field edits:* on a different unit Y, tech edits **only the install date**. Then re-run a CSV import that has different values for both `model` AND `install date` on X **and** Y. After the import completes: Unit X model and Unit Y install date should both stay field-edited; every other CSV field should reflect the latest CSV values.
- *Smoke-test (c) — net-new field-added unit appears in dispatcher Equipment Hub via the bridge:* tech adds a brand-new `RTU4` in the field that's not on the CSV → confirm dispatcher Equipment Hub bridged read surfaces it.

After all three smoke-tests pass, flip Phase 33's entry in `PROJECT_MAP.md → Build History` from `[ ]` to `[v]` and pick the next phase from `ROADMAP.md → Next Up` (Command Map TV Mode or Field Inventory Truck Stock).

**Also queued (small, do whenever):** move `dispatcher/index.html` (30-line redirect stub, no codebase references) to `ARCHIVE_SYSTEM_FILES/dispatcher/index.html` per user 2026-04-25. Only consequence is anyone with a stale `/dispatcher/` bookmark gets a 404. Confirm with user before doing if uncertain.

## On Deck

From `ROADMAP.md → Next Up`:
- **Command Map (TV Mode)** — large-scale map + Pulse feed for office monitors.
- **Field Inventory (Truck Stock)** — parts and materials ledger for technicians.

KI-002 sync hygiene leftovers (B5/B6/B7, C1, C2, C4, E1, E3, E4) live in `ROADMAP.md → Minor Tweaks & Polish` — pick off opportunistically when the surrounding code is open.

Larger epic in `ROADMAP.md → Icebox`: **Unified Contextual Modes — Service vs. Project / `ticketClass`** — architectural, touches multiple surfaces, plan before code.

## Ongoing Maintenance Threads

These are not blockers but should be touched when the surrounding code is opened:

- Production Firestore rules for `portal_tokens` (public read + controlled approval write) and `labor_logs`.
- Optional short URL / custom domain for `proof_of_service.html`.
- Optional composite Firestore index if `labor_logs` range queries get slow at scale.
- Validate print/PDF chart timing across browsers (Custom Report Studio).
- Confirm any deployments still pinned to `TWIN_PILLARS` have `vc_active_tenant_id` set after the Phase 27 default-tenant change.

---

## Update Protocol

- Update **Snapshot**, **Active Blocker**, and **Immediate Next Step** at the end of every working session, even if the only change is "no progress, blocker still open."
- When a phase fully ships: move it from here into `PROJECT_MAP.md → Build History` (flip `[ ]` to `[v]`) and pick the next phase here.
- When a blocker is resolved: move its entry from `KNOWN_ISSUES.md → Open` to `KNOWN_ISSUES.md → Resolved`, and clear the **Active Blocker** section here.
