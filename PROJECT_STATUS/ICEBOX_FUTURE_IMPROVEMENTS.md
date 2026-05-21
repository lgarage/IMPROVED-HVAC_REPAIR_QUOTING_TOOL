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
| **Vendor Directory — pick vendors & email parts quotes in-app** | `tracked` | Extends Phase 64d CRUD; Phase 64C / `ai_quote_pipeline_spec.md` Phase 5. Multi-select + compose + send from `#view-vendors` (v1 `mailto:`/Gmail compose; v2 Gmail API). |

---

## Agent / session rules

1. **Never remove** Pulse, Insights, or simulator **source files** when hiding UI — only gate nav and entry points (#37–#39).
2. When user asks about icebox or “future improvements,” read **this file** + `IDEA_TRACKER.md` before suggesting new work.
3. Promoting an item: update status `parked` → `tracked` or `in-progress` here and in `IDEA_TRACKER.md`, add to `ROADMAP.md` **Next Up** if scheduled, then implement re-enable (reverse #37–#39 guards).
4. Slack raw ideas still land in `#icebox`; curated entries must be mirrored here or in `IDEA_TRACKER.md` so nothing is lost.

**Last updated:** 2026-05-21 (vendor quote email tracked)
