# Vertex Core | Known Issues

Open bugs, environmental gotchas, and debug notes. Resolved items move to the **Resolved (Reference)** section at the bottom so we keep institutional memory without cluttering the open list.

> Cross-reference: `CURRENT_STATE.md` always names the **single highest-priority blocker** by ID. This file holds full reproduction and investigation notes.

---

## Open

*(None.)*

---

## Environmental Gotchas (Standing)

These are not bugs but recurring traps — keep them in mind whenever editing the relevant area.

- **Mobile `<body>` `outline` clipping.** Never rely on `outline` set on `<body>` for full-viewport visual indicators on mobile. Use a fixed-position `<div>` overlay as a direct child of `<body>` (see KI-001 directive fix).
- **`position: fixed` and CSS transforms.** A `position: fixed` element loses its viewport anchoring if any ancestor has `transform`, `filter`, `perspective`, or `will-change` set. Always mount global overlays as direct children of `<body>`.
- **PWA / service-worker cache on mobile.** A soft refresh is often not enough. After deploying JS/CSS changes, force a full reload (close tab/PWA and reopen) on iOS Safari and Android Chrome before declaring a fix verified.
- **Firestore persistence + multi-tab.** `db.enablePersistence({ synchronizeTabs: true })` is enabled; some browsers (older Safari) can still throw on second-tab init. Catch and continue.
- **Gemini `responseMimeType: "application/json"` is not universal.** Some prompt/model combos reject it. Always include a fallback path that re-issues the request without `responseMimeType` (see `ai_report_reviewer.js`).
- **Tenant id pinning.** Existing deployments may need `vc_active_tenant_id` in `localStorage` to stay on `TWIN_PILLARS` after the Phase 27 default-tenant change to `USA_HEATING_COOLING`.
- **iOS-only testing without a Mac (no remote DevTools).** The dev box is Windows; we cannot attach Safari Web Inspector to a real iPhone. Use the **`?vc_debug=1`** in-app debug overlay on the field app instead — append `?vc_debug=1` to the technician URL and a small fixed bottom-right box renders live values for `body.className`, override-frame display, override-strip display, ticket counts (with `(override: N, ack: M)` since Phase 32), active ticket id, current screen, and URL params (updated every 1s). Tap **Copy** to paste the snapshot into a chat. Shipped Phase 31; lives in `technician/index.html` (`#vcDebugOverlay`, `vcDebugOverlayBoot` IIFE).
- **Office Override is consent-gated on the tech device (Phase 32).** Setting `officeOverrideActive: true` on a ticket no longer immediately flips the orange chrome on the tech's real phone — the tech first sees a pulsing orange consent button. The chrome only lights up after the tech taps and the field app writes `officeOverrideAcknowledged: true`. Dispatcher iframes are NOT consent-gated (they are the dispatcher). When writing programmatic flags from any new feature, set both `officeOverrideActive: true` AND `officeOverrideAcknowledged: true` together if you want to skip the consent gate. See `DECISIONS.md → ADR-010`.

---

## Resolved (Reference)

### KI-001 — Office Override visual chrome missing on physical mobile devices (Phase 30)

- **Resolved:** 2026-04-25 — Phase 30 close-out. Replaced the `<body>` `outline` (clipped by mobile Safari / Android Chrome on scroll) with a dedicated fixed-position overlay div `#vcOfficeOverrideFrame` injected as a direct child of `<body>`. Bumped `#vcOfficeOverrideGlobalStrip` to `z-index: 100001` (was `280`, well below modal layers at 50000/30000/20050) and added a fixed `min-height: 56px` fallback before the `calc(... env(safe-area-inset-top))` rule for older iOS Safari. The frame's visibility is CSS-driven from `body.vc-office-override` / `body.vc-override-active`, so both the URL-init code path and the postMessage / Firestore-flag JS path light it up automatically.
- **Files touched:** `technician/index.html` (inline `<style>` block + new `<div id="vcOfficeOverrideFrame">` directly under `<body>`).
- **Files NOT touched (intentional):** `technician/js/workspace_ui.js` — `handleOfficeOverride` and `applyOfficeOverrideFromTickets` already toggle the body class correctly; the bug was purely in the CSS rendering layer, not the JS wiring. No `?v=N` cache-bust needed because no external JS/CSS files were modified; the service worker does not precache `technician/index.html` (`sw.js` only precaches the root dispatcher shell).
- **Verification protocol when deploying:** force-reload on iOS Safari and Android Chrome (close the tab/PWA and reopen) so the device picks up the new HTML. Confirm via remote DevTools that (a) `document.body.className` includes `vc-override-active` or `vc-office-override` while the dispatcher toggle is ACTIVE, (b) `#vcOfficeOverrideFrame` is a direct child of `<body>` with `display: block`, and (c) `#vcOfficeOverrideGlobalStrip` renders above every modal.
- **Related decision:** see `DECISIONS.md → ADR-008`.

---

## Filing Protocol

- New issue → add a `KI-NNN` entry under **Open** with: severity, affected files, what works, what's broken, investigation checklist, and (when known) directive fix.
- Resolved issue → move the entire entry into **Resolved (Reference)** with a `**Resolved:** YYYY-MM-DD — <one-line summary of the fix and the commit/phase it shipped in>` line at the top.
- Standing environmental traps that are not bugs but recurring footguns belong under **Environmental Gotchas (Standing)**, not under Open.
