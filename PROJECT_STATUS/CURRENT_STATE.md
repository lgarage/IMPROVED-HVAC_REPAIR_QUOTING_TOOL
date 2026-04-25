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

- **Active Phase:** 30 — Interactive Field App View (Office Override iframe)
- **Phase status:** Functionally complete on the data path. **Visual chrome on physical mobile devices is broken** (active blocker — see below).
- **Last shipped:** Cross-device override flag (`officeOverrideActive` / `officeOverrideBy` / `officeOverrideAt`) writes from `service_call.js#toggleOfficeOverride` and the technician schedule listener (`runScheduleMergeAndRender` → `applyOfficeOverrideFromTickets`) reflects it on every snapshot.
- **Live two-way notes:** `dictation_hub.js#subscribeInternalCommsForTicket` mirrors `internal_comms` in real time; verified working on real devices.
- **Default tenant:** `USA_HEATING_COOLING` (legacy `TWIN_PILLARS` still bridged via lazy migration).

## Active Blocker

**Phase 30 — Office Override visual indicators do not appear on physical mobile devices.**

Data sync works end-to-end, but the orange screen frame and top warning strip do not render on the technician's real phone when the dispatcher toggles ACTIVE.

Full reproduction steps, suspected causes, and the agreed-on fix direction live in `KNOWN_ISSUES.md` under **KI-001**. Do not start a new phase until KI-001 is resolved or explicitly deferred.

## Immediate Next Step

1. Resolve **KI-001** (see `KNOWN_ISSUES.md`) — the directive fix is to replace the `<body>` `outline` with a dedicated fixed-position `<div id="vcOfficeOverrideFrame">` injected as a direct child of `<body>`, and bump `#vcOfficeOverrideGlobalStrip` to `z-index: 100001`.
2. Bump cache-busting `?v=N` on any modified JS/CSS (per `.cursorrules` §5).
3. Field-test on iOS Safari **and** Android Chrome via remote DevTools before closing.

## On Deck (After Blocker Clears)

Pick the next phase from `ROADMAP.md → Next Up`:
- **Command Map (TV Mode)** — large-scale map + Pulse feed for office monitors.
- **Field Inventory (Truck Stock)** — parts and materials ledger for technicians.

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
