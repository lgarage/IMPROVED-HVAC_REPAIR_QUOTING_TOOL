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

- **Active Phase:** **Phase 32a — On-device diagnosability hardening** (shipped to repo 2026-04-25; **needs on-device verification**). Phase 32 (consent gate) shipped earlier today but field-verification reported the consent button **not appearing** on the iPhone and the debug overlay **not visible** (no `?vc_debug=1` flag and likely cached HTML). 32a addresses both root causes so 32 can actually be verified. Phase 31 (Watch + Take Over, Addendum CTA, Debug Overlay) also still pending field verification — all three stack and ship together.
- **Last shipped (this session, Phase 32a — diagnosability):**
  1. **Debug overlay is now always-on by default.** No URL flag required. Opt out with `?vc_debug=0`. The overlay also self-heals: if a stale cached `technician/index.html` doesn't have `<div id="vcDebugOverlay">`, the IIFE injects the div + its CSS into `<body>` so you always see *something* from the new code.
  2. **BUILD stamp.** First line of the overlay reads `BUILD: 32a-2026-04-25` (constant `window.VC_BUILD` near the top of the inline script). If the iPhone is on cached HTML, this line will read `BUILD: ?` (or be missing). That tells you in one glance whether you need to force-reload Safari.
  3. **New diagnostic lines.** The overlay now shows `setRemoteOverrideState: yes/NO (stale workspace_ui.js)`, `consent btn DOM: present/MISSING (stale HTML)`, `consent btn vis: <computed display>`, `hit ticket: <id>`, `hit by: <dispatcher>`. These pin down exactly where the chain is breaking.
  4. **Lazy-inject `#vcOfficeOverrideConsentBtn` from `workspace_ui.js?v=9`.** Single most important change: even if Safari is serving a stale `technician/index.html` with NO consent-button markup or CSS, the new `ensureConsentButtonInDom()` in `workspace_ui.js` creates the `<button>`, injects the CSS (gradient, pulse, fixed-top, body padding, hide-chrome-while-pending rules), AND wires the click → ack-write handler. workspace_ui.js IS cache-busted (`?v=9`) so this guarantees the consent UI works on the next load regardless of cached HTML.
  5. **Files touched (Phase 32a):** `technician/index.html` (debug overlay → always-on, self-healing, BUILD stamp + new diagnostic lines, `?v=8` → `?v=9` workspace_ui cache-bust), `technician/js/workspace_ui.js` (new `ensureConsentButtonInDom()` lazy-inject called from `setConsentButtonForState`).
- **Last shipped (this session, Phase 32 — consent gate):**
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

> **0. Confirm the deploy reached the iPhone *before* doing anything else.** Open `technician/index.html` on the iPhone (just open it normally — no URL params needed; the debug overlay is now always-on as of 32a). Tap the **Copy** button in the bottom-right `VC DEBUG` box and paste the contents somewhere you can read. The first three lines are the deploy diagnostic:
>
> - `BUILD: 32a-2026-04-25` → fresh HTML loaded. If this reads `BUILD: ?` or is missing, Safari is serving cached HTML — close the tab fully, kill Safari, and re-open from the URL (or use the share-sheet **Reload Without Content Blockers** trick). Repeat until `BUILD: 32a-…` appears.
> - `setRemoteOverrideState: yes` → workspace_ui.js?v=9 loaded. If `NO (stale workspace_ui.js)`, hard-reload (Safari sometimes caches `?v=9` if it has `?v=8` already).
> - `consent btn DOM: present` → either the inline HTML loaded OR the `workspace_ui.js` lazy-inject ran. Either path is fine — the consent button will work.
>
> Only proceed to step 1 once `BUILD: 32a-…` AND `setRemoteOverrideState: yes` AND `consent btn DOM: present` are all true.

1. **Field-verify Phase 32 (consent gate) on a real iPhone.** From dispatcher, click **Office Override (Inactive)** to flip ACTIVE on a ticket assigned to the test tech. Expected on the tech's phone:
   - **Pending:** Big pulsing orange consent button at the top of the screen with text *"🟠 Tap to acknowledge — Dispatch is editing this job"* and subtitle naming the dispatcher. Debug overlay should show `body: …vc-override-pending…`, `override frame: none`, `override strip: none`, `consent btn vis: block`, `myTickets: N (override: 1, ack: 0)`, `hit ticket: <SC-id>`, `hit by: <dispatcher>`.
   - **Tap the consent button.** Title flips to *"✓ Acknowledging…"*, button writes Firestore. Within ~1s, debug overlay shows `body: …vc-override-active…`, `override frame: block`, `override strip: flex`, `consent btn vis: none`, `myTickets: N (override: 1, ack: 1)`. The orange frame + top strip from KI-001 appear; the consent button disappears.
   - **Dispatcher clicks Office Override (ACTIVE) → Inactive.** Within ~1s, debug overlay should show `body: …` without `vc-override-active` or `vc-override-pending`, `override frame: none`, `override strip: none`, `consent btn vis: none`, `myTickets: N (override: 0, ack: 0)`. Both the consent button AND chrome should be gone on the tech's phone.
   - **Re-activate.** Tech should see the consent button again (fresh consent required). Confirm pending → active still works after a clear cycle.
2. **Field-verify the Phase 31 additions** on the same session (they share a deploy):
   - From dispatcher, open Shadow Mode on the test tech who is on a job. Confirm **🟠 Take over** enables. Click it — Shadow modal closes, Office Override modal opens on that ticket, and the tech's phone goes into `pending` state. Tap consent on the tech's phone → confirm the dispatcher's Office Override iframe is fully editable while the tech sees the `active` chrome.
   - Open a closed/historical job on the field app. Confirm the historical banner shows the **✏️ Add update to this job** button; tap it; confirm scroll + flash + textarea focus.
3. **Once all verified**, flip Phase 31, 32, AND 32a to `[v]` in `PROJECT_MAP.md → Build History` and pick the next phase from `ROADMAP.md → Next Up`.

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
