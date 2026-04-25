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

- **Active Phase:** **None — ready to pick the next phase.** Phases 31, 32, 32a, 32b, and 32c all verified end-to-end on a real iPhone 2026-04-25 (full pending → tap-ack → active chrome → dispatcher-deactivate clear cycle confirmed; cyan synced-ticket badge in simulator toolbar confirmed; debug overlay always-on with BUILD stamp confirmed). All five `[v]`-flipped in `PROJECT_MAP.md → Build History`. Pick the next phase from **On Deck** below.
- **Last shipped this session (verified 2026-04-25):** Phases 31 + 32 + 32a + 32b + 32c — full Office Override consent gate end-to-end, with the on-device diagnosability tooling that made it possible to verify on a real iPhone with no Mac available for remote DevTools. See `PROJECT_MAP.md → Build History` Phases 31–32c for the full file inventory and `DECISIONS.md → ADR-008 / ADR-009 / ADR-010` for the architecture choices.
- **Standing dev tools shipped in this batch (keep in mind for future work):**
  - **Always-on iPhone debug overlay** at `technician/index.html` (no URL flag required; opt out with `?vc_debug=0`). Bottom-right `VC DEBUG` box with a Copy button. First line is `BUILD: <stamp>` — bump `window.VC_BUILD` in `technician/index.html` whenever you change inline content of that file so cached-HTML diagnosis is one glance.
  - **Cross-device write-skip alarm** in `service_call.js#toggleOfficeOverride` (red outline + alert + console warn when `#scCurrentId.value` is empty on activate).
  - **Cyan synced-ticket badge** `#vcSimulatorTicketBadge` in the phone-simulator toolbar — driven by `dispatcher/js/shadow_mode.js#syncDispatcherTicketIdToActiveTech()` (exposed as `window.vcSyncDispatcherTicketIdToActiveTech`). Auto-loads the shadow-target tech's `live_presence.activeTicketId` into `#scCurrentId` so Office Override always targets the ticket the tech is viewing, with a `lastSyncedTicketId` watermark so manual ticket loads in Service Call Intake always win.
  - **Lazy-inject pattern** for any UI element that needs to ship in the inline `technician/index.html` HTML — `workspace_ui.js#ensureConsentButtonInDom()` is the reference implementation. Use this for any future tech-side UI element so a stale cached entry-point HTML can never break new features.
- **Live two-way notes:** `dictation_hub.js#subscribeInternalCommsForTicket` mirrors `internal_comms` in real time; verified working on real devices. **Conflict resolution: last writer wins** (per user 2026-04-25); do not add merge logic.
- **Default tenant:** `USA_HEATING_COOLING`. **TWIN_PILLARS branding is dead** (per user 2026-04-25) — purge any remaining `"TWIN_PILLARS"` defaults during the next sweep (see KI-002 Plan E2). Lazy-migration bridge in `shared/firebase_logic.js` can stay quiet for now (no live consumers needing it).

## Active Blocker

*(None.)*

## Immediate Next Step — Sync Hardening Backlog (KI-002), then Phase 33

The Office Override workstream is fully shipped. **Before adding new features, the user explicitly asked for a sync repair pass** — done as a 2026-04-25 audit, captured in `KNOWN_ISSUES.md → KI-002` with four prioritized plans (A/B/C/E). The order to ship:

1. **Plan A — Stop the silent failures** (~1 day, single commit batch). Highest field impact: `uploadReportToCloud`, `writeLivePresence`, dictation autosave, override consent ack, and other writes currently swallow errors. Standardize on two new helpers in `shared/firebase_logic.js`: `VCRequireTicketId(tid, label)` and `VCSurfaceWriteFailure(ctx, err)`. Then convert the listed sites in KI-002 to use them. Bump `service_call.js` and `technician/index.html` `VC_BUILD` once for the whole batch.
2. **Plan B (subset: B1+B2+B3+B4)** — version `shared/firebase_logic.js`, version unversioned tech bundle scripts, unify `equipment_manager.js` to `?v=8`, add a dispatcher BUILD chip mirroring the iPhone overlay. ~2 hours.
3. **Plan C3** — fix the Shadow-mirror 40×350ms polling stall by falling back to `getServiceCallOnceBridged(tid)` after exhaustion. ~30 min.
4. **Plan E2** — TWIN_PILLARS branding purge across the codebase (start with `client_notifications.js#getTenantIdSafe`, then grep). ~30 min.
5. Verify on iPhone using the always-on debug overlay + new dispatcher BUILD chip. Mark the relevant KI-002 checklist items, flip KI-002 itself if all of A is done.
6. **Then Phase 33 — Field-Add Equipment** (see `ROADMAP.md → Next Up`). Lock the data-path decision (write to `imported_equipment` only vs. mirror to legacy `customers/.../assets`) before code. Hierarchy: parent company → customer name → customer location → unit number.

**Also queued (small, do whenever):** move `dispatcher/index.html` (30-line redirect stub, no codebase references) to `ARCHIVE_SYSTEM_FILES/dispatcher/index.html` per user 2026-04-25. Only consequence is anyone with a stale `/dispatcher/` bookmark gets a 404. Confirm with user before doing if uncertain.

## On Deck

From `ROADMAP.md → Next Up`:
- **Phase 33 — Field-Add Equipment (No-Info Capture)** — three-path equipment data: CSV import + legacy + on-site field-add by tech.
- **Sync hardening backlog (KI-002)** — Plans A/B/C/E from 2026-04-25 audit, *do this first*.
- **Command Map (TV Mode)** — large-scale map + Pulse feed for office monitors.
- **Field Inventory (Truck Stock)** — parts and materials ledger for technicians.

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
