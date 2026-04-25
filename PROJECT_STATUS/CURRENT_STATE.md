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

- **Active Phase:** None — between phases. **Phase 30 (Interactive Field App View / Office Override) is fully closed** as of 2026-04-25.
- **Last shipped:** **KI-001 fix** — replaced the `<body>` `outline` with a dedicated fixed-position overlay div `#vcOfficeOverrideFrame` injected as a direct child of `<body>`; bumped `#vcOfficeOverrideGlobalStrip` to `z-index: 100001`; added a fixed `min-height: 56px` fallback before the safe-area `calc()` for older iOS Safari. Frame visibility is CSS-driven from `body.vc-office-override` / `body.vc-override-active`, so both the URL-init code path and the postMessage / Firestore-flag JS path light it up automatically. Files touched: `technician/index.html` only. See `KNOWN_ISSUES.md → Resolved → KI-001` and `DECISIONS.md → ADR-008`.
- **Live two-way notes:** `dictation_hub.js#subscribeInternalCommsForTicket` mirrors `internal_comms` in real time; verified working on real devices.
- **Default tenant:** `USA_HEATING_COOLING` (legacy `TWIN_PILLARS` still bridged via lazy migration).

## Active Blocker

*(None.)*

## Immediate Next Step

1. **Field-verify the KI-001 fix** before declaring it shipped to production users:
   - Force-reload the field app on a real iOS Safari device and a real Android Chrome device (close PWA / tab, reopen).
   - Confirm via remote DevTools that `document.body.className` includes `vc-override-active` or `vc-office-override` while a dispatcher has Office Override ACTIVE.
   - Confirm `#vcOfficeOverrideFrame` is a direct child of `<body>` with `display: block` and that `#vcOfficeOverrideGlobalStrip` renders above every modal.
2. **Pick the next phase** from `ROADMAP.md → Next Up` (see On Deck below) and seed a new "Active Phase" snapshot.

## On Deck (Pick the Next Phase)

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
