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

- **Active Phase:** **Phase 31 — Watch + Take Over, Addendum CTA, Debug Overlay** (shipped to repo 2026-04-25; **needs on-device verification** before declaring done).
- **Last shipped (this session):**
  1. **Shadow Mode → Take Over.** New `🟠 Take over (edit this job)` button in the Shadow modal toolbar. Reads the shadowed tech's `live_presence.activeTicketId`, closes Shadow, opens the Office Override modal (`#vcFieldAppOfficeModal`) targeting that ticket, and writes the cross-device `officeOverrideActive` flag so the tech's real phone shows the orange chrome from KI-001. Disabled with a tooltip when no tech is shadowed or the tech isn't on a workspace. Files: `index.html` (`.vc-shadow-takeover-btn` styles + `#vcShadowTakeOverBtn` button + `?v=4` cache-bust), `dispatcher/js/shadow_mode.js` (`takeOverActiveTicket`, `updateTakeOverButtonState`, integration with `closeShadowModal` / `subscribeLivePresenceIdle`).
  2. **Historical-job Addendum CTA.** New `✏️ Add update to this job` button injected into `#workspaceHistoricalBanner`. Smooth-scrolls to `#workspaceAddendumSection`, runs a 2-cycle `vc-addendum-flash` keyframe pulse, and focuses `#addendumSupplementalNotes`. Hidden in Office Override mode (dispatcher already has full inline editing). Files: `technician/index.html` only (CSS + banner markup + `applyWorkspaceHistoricalMode` rewrite to set text via a child span).
  3. **`?vc_debug=1` in-app debug overlay.** New `#vcDebugOverlay` injected as a direct child of `<body>` (same fixed-position discipline as KI-001). Renders a tiny fixed bottom-right monospace box updated every 1s with: `body.className`, `#vcOfficeOverrideFrame` computed `display`, `#vcOfficeOverrideGlobalStrip` computed `display`, `myTickets.length` + count of tickets with `officeOverrideActive: true`, current `activeTicket.id`, current screen id, URL params, time. Tap "Copy" to clipboard for sharing diagnostics. Standing aid for **iOS-only testing without remote DevTools** (no Mac available). Files: `technician/index.html` only.
- **Live two-way notes:** `dictation_hub.js#subscribeInternalCommsForTicket` mirrors `internal_comms` in real time; verified working on real devices.
- **Default tenant:** `USA_HEATING_COOLING` (legacy `TWIN_PILLARS` still bridged via lazy migration).

## Active Blocker

*(None.)*

## Immediate Next Step

1. **Field-verify the three Phase 31 additions** on a real iPhone before flipping Phase 31 to `[v]`:
   - Open the field app with `technician/index.html?vc_debug=1` and confirm the dark debug box renders bottom-right with live values updating each second. Tap **Copy** to confirm clipboard works.
   - From dispatcher, open Shadow Mode on a tech who is currently on a job. Confirm the **🟠 Take over** button enables. Click it — Shadow modal closes, Office Override modal opens on that ticket, and (via the debug overlay) confirm the tech's phone shows `body: …vc-override-active…`, `override frame: block`, `override strip: flex`.
   - Open a closed/historical job on the field app. Confirm the historical banner shows the **✏️ Add update to this job** button, that tapping it scrolls to and pulses the Addendum section, and the supplemental-notes textarea takes focus.
   - Also re-confirm KI-001 still passes: `body.className` includes the override class while ACTIVE; `#vcOfficeOverrideFrame` is a direct child of `<body>` with `display: block`; `#vcOfficeOverrideGlobalStrip` renders above every modal.
2. **Once verified**, flip Phase 31 to `[v]` in `PROJECT_MAP.md → Build History` and pick the next phase from `ROADMAP.md → Next Up` (see On Deck below).

## On Deck (Pick the Next Phase After 31)

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
