# Vertex Core — Known Issues Archive

> **Cold archive — do not read proactively.** Pull on demand when investigating a specific resolved issue. Active issues and resolved summaries live in `KNOWN_ISSUES.md`.

---

## KI-002 — Sync Risk Audit (2026-04-25): silent-failure & cache-versioning repair backlog [RESOLVED 2026-04-25]

A comprehensive audit of dispatcher ↔ field sync surfaces (Firestore reads/writes, real-time listeners, postMessage contracts, silent error handling, cache versioning) was completed 2026-04-25 immediately after Phase 32c shipped. It surfaced ~25 actionable repair items grouped into four plans. **None of these were blocking the Office Override workstream that had just shipped** — they were pre-existing risks accepted for speed.

**User decisions made during audit (locks scope):**
- TWIN_PILLARS branding is gone — all paths are Vertex Core / `USA_HEATING_COOLING`. Bridge cleanup (originally Plan D) drops to nice-to-have; bridge-aware listeners are not required for live consumers.
- `internal_comms` conflict resolution: **last writer wins** (no merge logic). Document this in code comments anywhere two paths can write the same field.
- Equipment data path going forward: **CSV import + legacy + new field-add capture** (see Phase 33 in `ROADMAP.md`).

**Plan A — Stop the silent failures (highest user impact, ~1 day): SHIPPED 2026-04-25.** Single commit batch; bumped `service_call.js?v=68` and `VC_BUILD = "KI002-A-2026-04-25"` once at the end.
- [v] A1: `technician/index.html` (`uploadReportToCloud`) — both writes routed through `Promise.all`; offline still happy-path; online rejection renders red `⚠ Sync Failed` card on `#successCard` instead of false-green; `VCSurfaceWriteFailure` called for both writes.
- [v] A2: `technician/index.html` (`writeLivePresence`) — one retry after 2.5s; on second failure sets `window.__vcPresenceOffline = true` and shows lazy-injected `#vcPresenceOfflineChip` (top-right red chip). Both attempts call `VCSurfaceWriteFailure`.
- [v] A3: `dictation_hub.js` (`scheduleInternalCloudSave`) — extracted to new `runInternalCloudSave(tid, payload, isRetry)`; on failure shows lazy-injected `#dictationHubNotesError` "⚠ note not synced — tap to retry" sibling under `#dictationHubNotes`; tap re-runs the save with the stored payload.
- [v] A4: `service_call.js` (`toggleOfficeOverride`) — Phase 32b empty-tid alarm pattern (red 3px outline + alert + warn) now also fires on actual Firestore write rejection. `VCSurfaceWriteFailure` first.
- [v] A5: `technician/index.html` consent IIFE + `workspace_ui.js` lazy-inject path — both now show `⚠ Sync failed — tap to retry acknowledgement` instead of silently resetting to the original prompt; `VCSurfaceWriteFailure("OfficeOverride:ackWrite[(lazy)]", e)` first.
- [v] A6: `technician/index.html` (coach-field delete) — one retry after 2s; both attempts call `VCSurfaceWriteFailure("coachField.delete:tryN", err)`.
- [v] A7: `customer_directory.js` (`syncSingleCustomerToCloud`) — `showSaveCue("⚠ Customer saved locally only — cloud sync FAILED for <name>. Check connection.")` on cloud rejection; `VCSurfaceWriteFailure` first.
- [v] A8: `shared/firebase_logic.js` (`setServiceCallMerged`) — now calls `VCRequireTicketId(ticketId, "setServiceCallMerged")`; returns `Promise.reject(new Error("setServiceCallMerged: empty ticket id"))` instead of writing to doc id `""`.
- [v] A9: `dispatcher/js/shadow_mode.js` (`sendCoachPrompt` + `forceRemoteSync`) — `showSaveCue("⚠ Coach prompt FAILED to send …")` / `showSaveCue("⚠ Force-sync FAILED to send …")` on rejection; `VCSurfaceWriteFailure` first.
- [v] **Standardize:** `VCRequireTicketId(tid, label)` and `VCSurfaceWriteFailure(ctx, err)` shipped in `shared/firebase_logic.js` (also published as bare globals `window.VCRequireTicketId` / `window.VCSurfaceWriteFailure`). Failures push onto a 10-deep `window.__vcWriteFailures` ring buffer that the iPhone debug overlay now renders (last 3 records, age in seconds, ctx, msg). Future call sites should use these helpers instead of `if (tid)` skips and `.catch(console.warn)`.

**Plan B — Cache & version hygiene (~2 hours): subset B1+B2+B3+B4 SHIPPED 2026-04-25.** Single commit batch on top of Plan A.
- [v] B1: `shared/firebase_logic.js?v=1` on all three callers (`index.html`, `technician/index.html`, `proof_of_service.html`). Added `FIREBASE_LOGIC_VERSION = 1` constant inside the IIFE that emits `[VC] firebase_logic v=1 loaded` on load and is exposed as `window.__VC_FIREBASE_LOGIC_VERSION` so the dispatcher BUILD chip can render the loaded version. Bump-in-lockstep procedure documented in the file header comment.
- [v] B2: Added `?v=1` to all five unversioned tech bundle scripts in `technician/index.html`: `equipment_smart_select.js`, `ufx_adapter.js`, `location_manager.js`, `equipment_hub.js`, `field_forms.js`.
- [v] B3: Unified `equipment_manager.js?v=8` on the dispatcher (`index.html`); tech was already `?v=8`.
- [v] B4: `window.VC_BUILD = "KI002-B-2026-04-25"` set near the top of dispatcher inline `<script>`; new `#vcBuildChip` rendered inside `.sidebar-footer` (hidden when sidebar is collapsed); populated with `BUILD <stamp> · fb v<N>`. Click the chip to copy.
- [ ] B5: `dispatcher/js/report_builder.js:138-140` loads `report_builder.css?v=1` while `index.html:20` loads `?v=4` — consolidate to one source. *(Deferred to ROADMAP)*
- [ ] B6: `sw.js` cache hygiene — bump `CACHE_NAME` on each deploy; add activate handler to delete old caches; consider network-first for `index.html`. *(Deferred to ROADMAP)*
- [ ] B7: Document the dispatcher-SW vs tech-no-SW asymmetry in `sw.js` and under `KNOWN_ISSUES.md → Environmental Gotchas`. *(Deferred to ROADMAP)*

**Plan C — Listener hygiene & polling fixes (~half day):**
- [ ] C1: `dispatcher/js/shadow_mode.js:147-167` — refcount + unsubscribe `subscribeLivePresenceIdle`. *(Deferred to ROADMAP)*
- [ ] C2: `field_forms.js:496-510` — store unsub for `form_templates` listener; call on tab leave. *(Deferred to ROADMAP)*
- [v] C3: `technician/index.html:7768-7789` — Shadow mirror polling fallback. **SHIPPED 2026-04-25 (commit f4fe37a):** added `shadowMirrorOpenViaBridgedFetch(tid)` fallback; every failure path routes through `VCSurfaceWriteFailure`.
- [ ] C4: postMessage receivers (`workspace_ui.js:301`, `technician/index.html:4163`, `shadow_mode.js:355`) — validate `event.origin === window.location.origin`. *(Deferred to ROADMAP)*

**Plan E — Schema/typing cleanups (trivial):**
- [ ] E1: `dispatcher/js/activity_feed.js:44-55` — normalize `internal_comms` to single canonical type. *(Deferred to ROADMAP)*
- [v] E2: `dispatcher/js/client_notifications.js:16-20` — remove `"TWIN_PILLARS"` fallback default. **SHIPPED 2026-04-25 (commit 79eb281).**
- [ ] E3: `settings.js:614-617` & `:632-635` — wrap dual roster + on-call writes in `WriteBatch`. *(Deferred to ROADMAP)*
- [ ] E4: `dispatcher/js/ai_report_reviewer.js:563-583` — drop redundant `syncSingleServiceCallToCloud`. *(Deferred to ROADMAP)*

**Closeout commits:**
- `e8f5cab` — Plan A (silent-failure repair)
- `b49eb23` — Plan B subset B1+B2+B3+B4 (cache & version hygiene)
- `f4fe37a` — Plan C3 (Shadow mirror polling fallback)
- `79eb281` — Plan E2 (TWIN_PILLARS branding purge)

**Standing dev tools shipped during this issue:** `VCRequireTicketId` / `VCSurfaceWriteFailure` standardized failure surfacing, 10-deep `__vcWriteFailures` ring buffer rendered live by the iPhone debug overlay, dispatcher `#vcBuildChip`, `?v=1` on `shared/firebase_logic.js`, lazy-injected sync-failure UI (`#vcPresenceOfflineChip`, `#dictationHubNotesError`, red `⚠ Sync Failed` card on `#successCard`).
