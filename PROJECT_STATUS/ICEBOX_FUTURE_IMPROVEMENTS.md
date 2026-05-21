# Icebox — Future Improvements Registry

> **Do not delete or gut these features.** Code for each item below remains in the repo. Product decision (2026-05-21): **hide from the pilot UI** and treat as **future improvements** — not abandoned work. Re-enable when promoted from icebox.

**Canonical cross-refs:** `IDEA_TRACKER.md` (status `parked`) · `ROADMAP.md` § The Icebox · Idea Vault canvas · Bug Report Tracker **#37–#39** (implementation to hide UI) · Slack `#icebox` (`C0B543CE4QG`).

---

## Pilot: shipped features turned off (future improvements)

These were built and deployed; they are **intentionally deferred** for the current pilot scope. Implementation still lives in tree until #37–#39 ship (hide nav / guards).

| ID | Future improvement | Shipped as | Key code (preserve) | Tracker | Re-enable |
|----|-------------------|------------|---------------------|---------|-----------|
| F1 | **Live Inter-Office Feed (Pulse)** | Phase 35a | `#view-pulse`, `dispatcher/js/activity_feed.js`, `interOfficeFeed` | #37 | Restore `#sidebar-nav-pulse`, `PulseActivityFeed`, entitlement |
| F2 | **Executive Insights & Revenue** | Phase 15 + 17 | `#view-insights`, `dispatcher/js/insights_manager.js`, `executiveInsights` | #38 | Restore `#nav-insights` in Reports flyout, `switchTab('insights')` |
| F3 | **Field App phone simulator (Preview Field App)** | Shadow / preview | `#fieldAppSimulatorModal`, `openTechnicianAppPreview()`, sidebar + intake **Field app** btn | #39 | Restore Preview Field App nav + `openTechnicianAppPreview()` |

**Not part of F1–F3 (stay active):** ticket `internal_comms`, AI Report Reviewer, Custom Report Studio, **Edit in Field App UI** modal, Shadow viewer (`#vcShadowModal`) unless scope expands later.

---

## Other icebox items (future / deferred)

| Idea | Status | Notes |
|------|--------|-------|
| Historical Job Editability | `parked` | Post-pilot polish — re-compile / re-submit on past-day jobs |
| Parallel Slice Execution | `parked` | SDK infra — revisit when batch sizes grow |
| VC Admin Voice Layer | `tracked` | ROADMAP icebox — ~3 slices when ready |
| Repair & Install Kit System | `discussed` | ROADMAP icebox — Kit entity abstraction |
| E-Ink Parts Staging, On-Call/PTO, etc. | `fresh` / `tracked` | See `IDEA_TRACKER.md` full table |
| **Vendor Directory — pick & email for parts quotes** | `parked` | **F4** below — directory tab stays; quote-email workflow is future build. |

---

## F4 — Vendor Directory (future improvement)

**Today (shipped, stays on):** Sidebar **Vendor Directory** — add/edit/delete suppliers (name, email, phone, category chips, notes). Phase 64d — `vendor_directory.js`, `#view-vendors`. No pick-to-email yet.

**What Dan wants (user intent — do not lose):**

1. **Pick vendors from the directory** — select one or more suppliers from the list (e.g. Johnstone, Wesco), optionally narrowed by category (Motors, Capacitors, Belts, etc.).
2. **Email them inside Vertex** — compose and send a **parts quote request** from the app (no copy/paste of `orders@…` into Outlook).
3. **Purpose** — request pricing/availability from distributors for parts needed on a job (feeds the quote pipeline; not general marketing email).
4. **Nice-to-have later** — pre-fill the email body from ticket/quote “Parts needed for repair quote”; AI-drafted text; Gmail API send + parse replies (`ai_quote_pipeline_spec.md` Phase 5–6).

**Planned build (when promoted from icebox):**

| Phase | Scope |
|-------|--------|
| **v1** | Multi-select on vendor cards; **Request quote** action; in-app compose modal (subject, body, parts list); send via Gmail web compose or `mailto:` to selected `vendor.email` (same pattern as VMI restock in `settings.js`). |
| **v2** | Tie to open Quoting Tool / Service ticket; quote reference in subject (`QT-####-REQ`); AI draft + Gmail API inbox parse. |

**Files:** `vendor_directory.js`, `index.html` (`#view-vendors`, `#vendorListTarget`), later `quoting.js` + Phase 64C.

**Not in scope for F4:** Removing the Vendor Directory tab (it remains active for CRUD).

---

## Agent / session rules

1. **Never remove** Pulse, Insights, or simulator **source files** when hiding UI — only gate nav and entry points (#37–#39).
2. When user asks about icebox or “future improvements,” read **this file** + `IDEA_TRACKER.md` before suggesting new work.
3. Promoting an item: update status `parked` → `tracked` or `in-progress` here and in `IDEA_TRACKER.md`, add to `ROADMAP.md` **Next Up** if scheduled, then implement re-enable (reverse #37–#39 guards).
4. Slack raw ideas still land in `#icebox`; curated entries must be mirrored here or in `IDEA_TRACKER.md` so nothing is lost.

**Last updated:** 2026-05-21 (F4 vendor directory — user requirements recorded)
