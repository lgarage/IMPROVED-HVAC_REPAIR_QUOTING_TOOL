# Vertex Core | Known Issues

Open bugs, environmental gotchas, and debug notes. Resolved items move to the **Resolved (Reference)** section at the bottom so we keep institutional memory without cluttering the open list.

> Cross-reference: `CURRENT_STATE.md` always names the **single highest-priority blocker** by ID. This file holds full reproduction and investigation notes.

---

## Open

### KI-001 — Office Override visual chrome missing on physical mobile devices (Phase 30)

- **Severity:** Blocker (gates Phase 30 completion).
- **Affected files:** `technician/index.html` (inline `<style>`, `#vcOfficeOverrideGlobalStrip`), `technician/js/workspace_ui.js` (`handleOfficeOverride`, `applyOfficeOverrideFromTickets`), `dictation_hub.js` (`subscribeInternalCommsForTicket`).
- **What works:** Real-time data sync is solid. Dispatcher edits appear instantly on the actual phone via `dictation_hub.js#subscribeInternalCommsForTicket`. The dispatcher toggle correctly writes `{ officeOverrideActive, officeOverrideBy, officeOverrideAt }` to the ticket doc via `service_call.js#toggleOfficeOverride` → `VCFirestore.setServiceCallMerged`, and clears them on toggle-off / preview close / `beforeunload`.
- **What is broken:** When the dispatcher's button reads **Office Override (ACTIVE)**, the technician's actual phone is **not** showing either the **8px orange screen outline** (`body.vc-override-active` / `body.vc-office-override`, defined in `technician/index.html` inline `<style>`) or the **fixed orange top warning strip** (`#vcOfficeOverrideGlobalStrip`). The override chrome must turn on the moment the flag flips, including immediately on first page load if the dispatcher already has it active, and turn off the moment the flag clears.

#### Investigation Checklist

- [ ] **Verify the listener fires on the device.** Add a temporary `console.log("[OfficeOverride] tickets snapshot", ...)` inside `applyOfficeOverrideFromTickets` (`technician/js/workspace_ui.js`) and `runScheduleMergeAndRender` (`technician/index.html`). Inspect via remote DevTools (`chrome://inspect` for Android Chrome; Safari → Develop → iPhone for iOS) to confirm the snapshot reaches the device with `officeOverrideActive: true` on the right ticket.
- [ ] **Verify the body class is actually applied.** From the same remote-debug session, run `document.body.className` while the dispatcher is ACTIVE and confirm `vc-override-active` (or `vc-office-override`) is present. If missing → the listener isn't firing or the ticket isn't in `myTickets` (e.g. filtered out by `applyScheduleFilters` because of `releasedToTech: false`, archived, or out-of-window date).
- [ ] **Verify the flag is reaching the tech's snapshot.** In the remote console, run `myTickets.find(t => t.officeOverrideActive)` while the dispatcher is ACTIVE. If it returns `undefined`, the ticket is being filtered out (most likely `releasedToTech === false` or off the schedule window) — in that case the flag must be wired to a separate listener that bypasses `applyScheduleFilters`.
- [ ] **Cache.** Confirm the device actually loaded `workspace_ui.js?v=7` and `dictation_hub.js?v=8` (Network tab). PWA service workers / HTTP cache on mobile sometimes serve stale JS even after a soft refresh — force-reload by closing the tab/PWA and reopening.

#### Directive Fix (Not Investigation)

1. **Move away from `<body>` outlines.** Mobile Safari and Android Chrome notoriously **clip `outline` set on `<body>`** as soon as the page scrolls or the viewport is shorter than the document — which is always true for the field app workspace. Implement the orange frame as a **dedicated fixed-position DOM element** instead:

   ```html
   <div id="vcOfficeOverrideFrame" style="position: fixed; inset: 0; border: 8px solid #f39c12; pointer-events: none; z-index: 100000;"></div>
   ```

   Inject it once into `<body>` on app boot and toggle a `display: none / block` (or `.hidden`) class from inside `handleOfficeOverride(active)` in `technician/js/workspace_ui.js` alongside the existing `vc-override-active` class. Remove the `outline` rules on `body.vc-override-active` / `body.vc-office-override` once the overlay div is in place (keep the body class only for unlocking inputs).

2. **Top strip stacking / fixed positioning.** Bump `#vcOfficeOverrideGlobalStrip` to `z-index: 100001` so it sits above every existing layer in the technician app (this codebase already uses `z-index: 50000`, `30000`, `20050`, `10050`, so the previous `280` was ineffective for any real modal). Verify the strip remains a **direct child of `<body>`** so it isn't trapped inside a transformed / translated / `filter`-ed ancestor (any of which break `position: fixed` on iOS). Same applies to `#vcOfficeOverrideFrame` — it must be a direct child of `<body>`.

3. **iOS safe-area + viewport units.** The strip uses `min-height: calc(40px + env(safe-area-inset-top, 0px))` and `body` uses `100dvh`; on older iOS Safari these resolve oddly. Test with a fixed `min-height: 56px` and a fallback `100vh` to rule out collapse-to-zero.

4. After fix: bump cache-busting `?v=N` on `workspace_ui.js` / `dictation_hub.js` / inline asset references in `technician/index.html` (`.cursorrules` §5).

---

## Environmental Gotchas (Standing)

These are not bugs but recurring traps — keep them in mind whenever editing the relevant area.

- **Mobile `<body>` `outline` clipping.** Never rely on `outline` set on `<body>` for full-viewport visual indicators on mobile. Use a fixed-position `<div>` overlay as a direct child of `<body>` (see KI-001 directive fix).
- **`position: fixed` and CSS transforms.** A `position: fixed` element loses its viewport anchoring if any ancestor has `transform`, `filter`, `perspective`, or `will-change` set. Always mount global overlays as direct children of `<body>`.
- **PWA / service-worker cache on mobile.** A soft refresh is often not enough. After deploying JS/CSS changes, force a full reload (close tab/PWA and reopen) on iOS Safari and Android Chrome before declaring a fix verified.
- **Firestore persistence + multi-tab.** `db.enablePersistence({ synchronizeTabs: true })` is enabled; some browsers (older Safari) can still throw on second-tab init. Catch and continue.
- **Gemini `responseMimeType: "application/json"` is not universal.** Some prompt/model combos reject it. Always include a fallback path that re-issues the request without `responseMimeType` (see `ai_report_reviewer.js`).
- **Tenant id pinning.** Existing deployments may need `vc_active_tenant_id` in `localStorage` to stay on `TWIN_PILLARS` after the Phase 27 default-tenant change to `USA_HEATING_COOLING`.

---

## Resolved (Reference)

*(Empty — first entry will be KI-001 once the directive fix above ships and is field-tested on both iOS Safari and Android Chrome.)*

---

## Filing Protocol

- New issue → add a `KI-NNN` entry under **Open** with: severity, affected files, what works, what's broken, investigation checklist, and (when known) directive fix.
- Resolved issue → move the entire entry into **Resolved (Reference)** with a `**Resolved:** YYYY-MM-DD — <one-line summary of the fix and the commit/phase it shipped in>` line at the top.
- Standing environmental traps that are not bugs but recurring footguns belong under **Environmental Gotchas (Standing)**, not under Open.
