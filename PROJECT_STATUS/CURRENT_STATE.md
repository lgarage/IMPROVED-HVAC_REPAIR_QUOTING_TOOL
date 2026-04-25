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

- **Active Phase:** **Phase 32 — Office Override consent gate** (shipped to repo 2026-04-25; **needs on-device verification**). Phase 31 (Watch + Take Over, Addendum CTA, Debug Overlay) also still pending field verification — both stack and ship together.
- **Last shipped (this session, Phase 32):**
  1. **Cross-device consent button.** Dispatcher activating Office Override no longer immediately frames the tech's phone in orange. Instead the tech sees a **large pulsing orange button at the top of every screen**: *"🟠 Tap to acknowledge — Dispatch is editing this job"* / *"Office Override active — <dispatcher> may be editing. Tap to confirm you see this."* The button is a direct child of `<body>` (same fixed-position discipline as KI-001) and shows only when `body.vc-override-pending`.
  2. **Tap to acknowledge.** Tech taps → field app writes `{ officeOverrideAcknowledged: true, officeOverrideAcknowledgedAt: serverTimestamp(), officeOverrideAcknowledgedBy: <techName> }` to the ticket via `VCFirestore.setServiceCallMerged`. Next snapshot from `runScheduleMergeAndRender` transitions `body.vc-override-pending` → `body.vc-override-active` and the existing KI-001 chrome (orange frame + top strip) lights up.
  3. **Cross-device clear-on-deactivate.** Dispatcher toggling Office Override OFF now also `FieldValue.delete()`s `officeOverrideAcknowledged*` fields (in addition to the existing `officeOverrideActive/By/At` clear). The tech's phone clears the consent button **and** the chrome on the next snapshot. Re-activating later starts in `pending` again — fresh consent required.
  4. **3-state cross-device path.** `workspace_ui.js#applyOfficeOverrideFromTickets` refactored from boolean `(on)` to 3-state `'off' | 'pending' | 'active'`, dispatched through new `setRemoteOverrideState(state, ticketId, byName)`. The local **postMessage** path (`handleOfficeOverride`) is unchanged — the dispatcher's own iframes (`?office_override=1` URL or live preview) still skip the consent gate because they ARE the dispatcher.
  5. **Debug overlay updated.** `myTickets` line now shows `(override: N, ack: M)` counts so we can verify the pending → active transition on a real iPhone in seconds.
- **Files touched (Phase 32):** `technician/index.html` (CSS + `#vcOfficeOverrideConsentBtn` markup + `vcOfficeOverrideConsentBoot` IIFE + `?v=8` workspace_ui cache-bust), `technician/js/workspace_ui.js` (3-state refactor, `setRemoteOverrideState`, `setConsentButtonForState`), `service_call.js` (ack-field reset / delete + `?v=66` cache-bust), `index.html` (cache-bust for `service_call.js`).
- **Last shipped (Phase 31 — still in this same commit batch):** Shadow → Take Over button (`dispatcher/js/shadow_mode.js?v=4`), Historical-job Addendum CTA (`technician/index.html`), `?vc_debug=1` in-app debug overlay (`technician/index.html`). See `PROJECT_MAP.md` Phase 31 / 32 sections and `DECISIONS.md → ADR-009 / ADR-010`.
- **Live two-way notes:** `dictation_hub.js#subscribeInternalCommsForTicket` mirrors `internal_comms` in real time; verified working on real devices.
- **Default tenant:** `USA_HEATING_COOLING` (legacy `TWIN_PILLARS` still bridged via lazy migration).

## Active Blocker

*(None.)*

## Immediate Next Step

1. **Field-verify Phase 32 (consent gate) on a real iPhone.** Open the tech app with `technician/index.html?vc_debug=1` so the debug overlay is visible. From dispatcher, click **Office Override (Inactive)** to flip ACTIVE on a ticket assigned to the test tech. Expected on the tech's phone:
   - **Pending:** Big pulsing orange consent button at the top of the screen with text *"🟠 Tap to acknowledge — Dispatch is editing this job"* and subtitle naming the dispatcher. Debug overlay should show `body: …vc-override-pending…`, `override frame: none`, `override strip: none`, `myTickets: N (override: 1, ack: 0)`.
   - **Tap the consent button.** Title flips to *"✓ Acknowledging…"*, button writes Firestore. Within ~1s, debug overlay shows `body: …vc-override-active…`, `override frame: block`, `override strip: flex`, `myTickets: N (override: 1, ack: 1)`. The orange frame + top strip from KI-001 appear; the consent button disappears.
   - **Dispatcher clicks Office Override (ACTIVE) → Inactive.** Within ~1s, debug overlay should show `body: …` without `vc-override-active` or `vc-override-pending`, `override frame: none`, `override strip: none`, `myTickets: N (override: 0, ack: 0)`. Both the consent button AND chrome should be gone on the tech's phone.
   - **Re-activate.** Tech should see the consent button again (fresh consent required). Confirm pending → active still works after a clear cycle.
2. **Field-verify the Phase 31 additions** on the same session (they share a deploy):
   - From dispatcher, open Shadow Mode on the test tech who is on a job. Confirm **🟠 Take over** enables. Click it — Shadow modal closes, Office Override modal opens on that ticket, and the tech's phone goes into `pending` state. Tap consent on the tech's phone → confirm the dispatcher's Office Override iframe is fully editable while the tech sees the `active` chrome.
   - Open a closed/historical job on the field app. Confirm the historical banner shows the **✏️ Add update to this job** button; tap it; confirm scroll + flash + textarea focus.
3. **Once all verified**, flip Phase 31 AND Phase 32 to `[v]` in `PROJECT_MAP.md → Build History` and pick the next phase from `ROADMAP.md → Next Up`.

## On Deck (Pick the Next Phase After 32)

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
