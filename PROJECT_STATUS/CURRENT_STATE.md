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

- **Active Phase:** **None — ready to pick the next phase.** Phases 31–32c verified end-to-end on a real iPhone 2026-04-25; **KI-002 closed 2026-04-25** (Plans A, B-subset (B1+B2+B3+B4), C3, and E2 all shipped today; remaining hygiene items B5/B6/B7 + C1/C2/C4 + E1/E3/E4 migrated to `ROADMAP.md → Minor Tweaks & Polish` because none are field-impact). **Recommended next phase:** **Phase 33 — Field-Add Equipment** (see `ROADMAP.md → Next Up`); requires user decision on the data-path option (write to `imported_equipment` only vs. mirror to legacy `customers/.../assets`) before any code.
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

*(None.)*

## Immediate Next Step — Phase 33 (Field-Add Equipment) — NEEDS USER DECISION FIRST

KI-002 closed 2026-04-25 (all field-impact plans landed; hygiene leftovers parked in `ROADMAP.md → Minor Tweaks & Polish`). Next phase candidate from `ROADMAP.md → Next Up` is **Phase 33 — Field-Add Equipment (No-Info Capture)** — three-path equipment data: CSV import + legacy `customers/.../sites/.../assets` + on-site field-add by tech.

**Blocker before code:** lock the data-path decision. Two options on the table:

1. **Single forward path** — field-adds write **only** to `tenants/{tenantId}/imported_equipment`. Cleanest tenant-isolated path; existing dispatcher reports that read the legacy `customers/.../sites/.../assets` tree won't see field-added units until they're migrated to read from `imported_equipment`.
2. **Mirror to legacy** — field-adds write to `imported_equipment` **and** to the legacy `customers/.../sites/.../assets` tree under the same hierarchy (parent company → customer name → customer location → unit number). Existing dispatcher reports immediately see field-added units; downside is dual-write surface area and conflict semantics with CSV import re-runs.

**User must pick option 1 vs option 2 before we spec the entry point, dispatcher visibility surface, or write logic.** Surfacing this as a question in chat — do not start coding Phase 33 in this session.

**Verification protocol for the C3 + E2 batch (do this on next iPhone touch):**
- *Tech (force-reload field app on iPhone):* debug overlay top line should read `BUILD: KI002-CE-2026-04-25`. Smoke-test C3: from a shadowed dispatcher viewer, have the tech open a **historical or future-dated** job (one that sits outside the schedule listener's date window) — the dispatcher's shadow viewer should follow into that workspace within ~14s of the polling exhausting (was previously stuck on the schedule). Failure path is also observable: kill connectivity on the dispatcher side, then trigger the same scenario — the iPhone debug overlay's `write fails` line should show `shadowMirrorFetch:fetchFailed[<tid>]`.
- *Dispatcher (force-reload):* sidebar-footer chip should read `BUILD KI002-CE-2026-04-25 · fb v1`. E2 smoke-test: load a ticket → click **Send verification to client** → inspect the resulting `tenants/{tenantId}/portal_tokens/{token}` doc in Firestore → `tenantId` field should match the live tenant (`USA_HEATING_COOLING`) and never `TWIN_PILLARS`.

**Also queued (small, do whenever):** move `dispatcher/index.html` (30-line redirect stub, no codebase references) to `ARCHIVE_SYSTEM_FILES/dispatcher/index.html` per user 2026-04-25. Only consequence is anyone with a stale `/dispatcher/` bookmark gets a 404. Confirm with user before doing if uncertain.

## On Deck

From `ROADMAP.md → Next Up`:
- **Phase 33 — Field-Add Equipment (No-Info Capture)** — three-path equipment data: CSV import + legacy + on-site field-add by tech. **Blocked on user data-path decision (see Immediate Next Step above).**
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
