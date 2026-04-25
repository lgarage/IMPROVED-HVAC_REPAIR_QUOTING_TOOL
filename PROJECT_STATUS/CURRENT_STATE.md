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
- **Live two-way notes:** `dictation_hub.js#subscribeInternalCommsForTicket` mirrors `internal_comms` in real time; verified working on real devices.
- **Default tenant:** `USA_HEATING_COOLING` (legacy `TWIN_PILLARS` still bridged via lazy migration).

## Active Blocker

*(None.)*

## Immediate Next Step

**Pick the next phase from the On Deck list below**, or surface a new request. The Office Override workstream (Phases 30 → 31 → 32 → 32a → 32b → 32c) is fully shipped and verified end-to-end on real hardware. Suggested decision tree:

- If office staff want **at-a-glance situational awareness across all techs at once** → start **Command Map (TV Mode)**. Visible win, builds on the live-presence infrastructure already in place.
- If technicians have asked **"how much of part X is on my truck"** or you keep getting parts surprises → start **Field Inventory (Truck Stock)**.
- If you want a planning pass before either Next Up phase → consider scoping the **Unified Contextual Modes (Service vs. Project / `ticketClass`)** epic from `ROADMAP.md → Icebox`. That one is architectural and will touch multiple existing surfaces; worth a dedicated planning session before code.

## On Deck

From `ROADMAP.md → Next Up`:
- **Command Map (TV Mode)** — large-scale map + Pulse feed for office monitors.
- **Field Inventory (Truck Stock)** — parts and materials ledger for technicians.

There is also the larger architectural epic in `ROADMAP.md → Icebox` (**Unified Contextual Modes — Service vs. Project / `ticketClass`**) that may warrant a planning pass before either of the Next Up phases.

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
