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

- **Active Phase:** **None — ready to pick the next phase.** Phases 31–32c verified end-to-end on a real iPhone 2026-04-25; KI-002 **Plan A — Stop the silent failures** shipped immediately after as a single batch. Pick the next phase from **On Deck** below (recommend continuing KI-002 with Plan B subset B1+B2+B3+B4 next).
- **Last shipped this session (2026-04-25):** Phases 31 + 32 + 32a + 32b + 32c (Office Override consent gate end-to-end + on-device diagnosability) **+ KI-002 Plan A** (silent-failure repair: new `VCRequireTicketId` + `VCSurfaceWriteFailure` helpers in `shared/firebase_logic.js`, ring-buffered into `window.__vcWriteFailures` and surfaced live in the iPhone debug overlay; A1–A9 call sites converted; `service_call.js?v=68`; `VC_BUILD = "KI002-A-2026-04-25"`). See `PROJECT_MAP.md → Build History` for the full file inventory; `KNOWN_ISSUES.md → KI-002` Plan A checklist all flipped.
- **Standing dev tools shipped in this batch (keep in mind for future work):**
  - **Always-on iPhone debug overlay** at `technician/index.html` (no URL flag required; opt out with `?vc_debug=0`). Bottom-right `VC DEBUG` box with a Copy button. First line is `BUILD: <stamp>` — bump `window.VC_BUILD` in `technician/index.html` whenever you change inline content of that file so cached-HTML diagnosis is one glance.
  - **Cross-device write-skip alarm** in `service_call.js#toggleOfficeOverride` (red outline + alert + console warn when `#scCurrentId.value` is empty on activate).
  - **Cyan synced-ticket badge** `#vcSimulatorTicketBadge` in the phone-simulator toolbar — driven by `dispatcher/js/shadow_mode.js#syncDispatcherTicketIdToActiveTech()` (exposed as `window.vcSyncDispatcherTicketIdToActiveTech`). Auto-loads the shadow-target tech's `live_presence.activeTicketId` into `#scCurrentId` so Office Override always targets the ticket the tech is viewing, with a `lastSyncedTicketId` watermark so manual ticket loads in Service Call Intake always win.
  - **Lazy-inject pattern** for any UI element that needs to ship in the inline `technician/index.html` HTML — `workspace_ui.js#ensureConsentButtonInDom()` is the reference implementation. Use this for any future tech-side UI element so a stale cached entry-point HTML can never break new features. **KI-002 Plan A added two more reference instances:** `ensureVcPresenceChipInDom()` (top-right "presence offline" chip) in `technician/index.html` and `ensureNotesErrorBannerInDom()` ("⚠ note not synced — tap to retry") in `dictation_hub.js`.
  - **Standardized failure surfacing** — *new this batch:* `VCRequireTicketId(tid, label)` + `VCSurfaceWriteFailure(ctx, err)` helpers in `shared/firebase_logic.js` (also bare globals). Use these instead of `if (tid)` skips and `.catch(console.warn)` everywhere. Failures land in a 10-deep `window.__vcWriteFailures` ring buffer that the iPhone debug overlay renders (last 3 records with age in seconds, ctx, and message). Pair every `VCSurfaceWriteFailure` call with a user-visible affordance at the call site — never let a write die silently.
- **Live two-way notes:** `dictation_hub.js#subscribeInternalCommsForTicket` mirrors `internal_comms` in real time; verified working on real devices. **Conflict resolution: last writer wins** (per user 2026-04-25); do not add merge logic.
- **Default tenant:** `USA_HEATING_COOLING`. **TWIN_PILLARS branding is dead** (per user 2026-04-25) — purge any remaining `"TWIN_PILLARS"` defaults during the next sweep (see KI-002 Plan E2). Lazy-migration bridge in `shared/firebase_logic.js` can stay quiet for now (no live consumers needing it).

## Active Blocker

*(None.)*

## Immediate Next Step — Sync Hardening Backlog (KI-002 continued), then Phase 33

The Office Override workstream is fully shipped, and **KI-002 Plan A shipped this session** as a single commit batch — silent-failure surfaces converted across A1–A9, helpers landed in `shared/firebase_logic.js`, ring buffer wired into the iPhone debug overlay, `service_call.js?v=68`, `VC_BUILD = "KI002-A-2026-04-25"`. KI-002 itself is still **Open** because Plans B/C/E remain. Order to ship next:

1. **Plan B (subset: B1+B2+B3+B4)** — version `shared/firebase_logic.js`, version unversioned tech bundle scripts, unify `equipment_manager.js` to `?v=8`, add a dispatcher BUILD chip mirroring the iPhone overlay. ~2 hours.
2. **Plan C3** — fix the Shadow-mirror 40×350ms polling stall by falling back to `getServiceCallOnceBridged(tid)` after exhaustion. ~30 min.
3. **Plan E2** — TWIN_PILLARS branding purge across the codebase (start with `client_notifications.js#getTenantIdSafe`, then grep). ~30 min.
4. Verify on iPhone using the always-on debug overlay (now also surfaces `__vcWriteFailures` ring) + new dispatcher BUILD chip. Mark the relevant KI-002 checklist items, flip KI-002 itself if all of B/C/E that we want for this pass is done.
5. **Then Phase 33 — Field-Add Equipment** (see `ROADMAP.md → Next Up`). Lock the data-path decision (write to `imported_equipment` only vs. mirror to legacy `customers/.../assets`) before code. Hierarchy: parent company → customer name → customer location → unit number.

**Verification protocol for the Plan A batch:** force-reload field app on iPhone; debug overlay top line should read `BUILD: KI002-A-2026-04-25`. To smoke-test the surface, temporarily kill connectivity and (a) edit dictation notes (expect inline `⚠ note not synced — tap to retry` banner under `#dictationHubNotes`), (b) navigate screens (expect top-right `⚠ presence offline` chip after the retry exhausts), (c) attempt a report upload (expect red `⚠ Sync Failed` card on `#successCard` instead of false-green). Restore connectivity and verify all three clear themselves and the chip / banner / card resolve to green.

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
