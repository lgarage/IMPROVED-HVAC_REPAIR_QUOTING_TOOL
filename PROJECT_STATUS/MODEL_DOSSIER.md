# Cursor model dossier (capability & cost heuristic)

> **North star:** This file is the agent’s **running notebook** in markdown — **cheap-enough model per kind of work**, grounded in what actually happened. It is **not** a diary of every message: **skip** tiny/no-value tasks (see **§ Skip logging**). **Do** record **task types** (archetype **T0–T4**, domain, risk) whenever substantive work finishes, so future sessions **grep the log**, **infer** patterns, and **recommend smarter models**. **Always aim to improve:** apply **Conf after**, **Tier fit**, and outcomes from past rows; add new rows when you **learn** something that helps the next similar task.
>
> **Purpose:** Single source of truth so recommendations favor **minimum spend for acceptable quality and safety**, grounded in archetypes, enabled models, and **experience** captured in the outcome log.
>
> **Tier 1 read:** Skim this file when classifying a task; do **not** load it end-to-end every turn. Grep by task keyword or jump to **§ Task archetypes → minimum tier**, then **§ Workspace enabled models** for the exact picker name to recommend **before any implementation** (then execute **§6B** + the **strict §6B1 flow** in `.cursorrules` §6B1 — steps **0–4**, parts **(A)(B)(C)**).
>
> **Maintenance:** Cursor adds, renames, or deprecates models over time. When your Cursor **Settings → Models** toggles change, update **§ Workspace enabled models** (this repo) **and** the generic **§ Registry** if families shift. Pricing is account/plan-dependent — this file uses **relative** cost only (↓ cheaper → ↑ pricier).
>
> **Calibration:** After **substantive** work that is **worth remembering as a task type**, append **§ Task outcome log** (`.cursorrules` §6H). If the user does **not** report failure, assume **Outcome `ok`** and **Tier fit `ok`** — see § *Default success (user silent)*. Trivial work → **do not** log (§ *Skip logging*).

---

## Tier quick card (current defaults)

_Fast lookup before §6B — use § Workspace enabled models for full alternates list._

| Archetype | Recommended model | Notes |
|-----------|------------------|-------|
| T0–T1 mechanical | **Composer 2** | Typos, one-liner CSS, trivial renames |
| T1 nuanced / T2 | **Sonnet 4.6** | Default daily implementation |
| T3 code-heavy multi-file | **Codex 5.3** | Prefer over Opus for pure-code T3 |
| T3 Vertex Core / T3+ / UNCERTAIN | **Opus 4.6** | Current ceiling — Opus 4.7 disabled 2026-05-07 |
| T4 read-only / tour | **Composer 2** | Exploration, Q&A, architecture review |

_Last verified: 2026-05-07. Full table: § Default "switch to" before work._

→ **Outcome log** (calibration data): see § Outcome log (newest first) below.

---

## Task outcome log (calibration)

**Purpose:** **Experience memory** for the agent — by **task type** (archetype, domain, risk), **which tier/model was good enough**, so recommendations get **better over time**. Pair with **§ Workspace enabled models** and **§ Task archetypes** so picks stay tied to **actual picker names**, not vibes.

### When to log (task types, not every keystroke)

- **Log** when work is **substantive** (same idea as § *How to add a row* **and** *Skip logging*) **and** it **adds learning**: new **Arch** / domain / risk pattern, meaningful multi-file or product behavior change, HIGH-touch paths, or **updates** what you believe about tier fit for an existing pattern.
- **Do not** log: one-line answers, pure read-only Q&A, typo-only edits, or repeats that add **no** new signal (see § *Skip logging*).
- **Task (short)** should make **grep** useful — name the **shape** of work (e.g. `Field app: workspace header UI`, `Firebase tenant path`) not only the filename.

### Logging discipline (agents)

1. **When:** Substantive session worth remembering; **same session** as the work when possible.
2. **Where:** Table **§ Outcome log (newest first)** — insert directly under the header row.
3. **Cursor name:** **Note** column **must** include the effective model, e.g. `Cursor: Composer 2` or `Cursor: Opus 4.7` (from gate: recommended, Override, or Pre-approved).
4. **Sync with `.cursorrules`:** Skipping without a valid **skip** when you **should** have captured a new task type is inconsistent with **§6H**.
5. **Grouping rule:** When **≥ 2 tasks** share the **same cluster** (same domain + Arch range + risk level, no new tier lesson), **collapse them into one representative row** — do not log each task separately. Label the row with the **cluster name** (e.g. `Field app: Dictation hub — …`) and append `*(N tasks)*` to the Task cell. Use **averaged** Conf start/after. Only split out a new row when a task **raises the risk tier, changes Arch, or reveals a different tier-fit lesson** for that cluster. Defined clusters: **(a) Field app: Forms panel / hamburger forms**, **(b) Field app: Workspace chrome / nav menus**, **(c) Field app: Small UI removals / copy cleanup**, **(d) Field app: Dictation hub (labels, examples, Improve-with-AI)**, **(e) Governance / dossier / rules**.

### Default success (user silent)

If the user **does not** say the change failed, was wrong, or needs rework:

- **Outcome:** use **`ok`**. Use **`partial`**, **`rework`**, or **`fail`** only when the user said so **or** there is **objective** evidence (revert request, failing tests, follow-up bug tied to this change).
- **Tier fit:** default **`ok`**. Use **`could_use_smaller`** when completion was easy and a lower tier is plausible; **`needed_bigger`** only when you clearly struggled or the user pushed back.
- **Conf after %:** at least **Conf start %** unless you have a concrete reason to lower it.

### How to add a row (agents)

1. Add **one row** per **substantive** piece of work **that should teach future model picks** — multi-file change, HIGH risk, new feature slice, new **task type** for the log, or user explicitly wants it logged. **Not** every small interaction (see § *When to log*).
2. Insert the row **directly under the table header** (below the `|---|` line) — **newest first** — so scanners don’t read hundreds of lines.
3. **Conf start %** = the **first** `Confidence: XX%` from the opening classification block for that task (before implementation). If no block was used, estimate honestly and mark note `estimated`.
4. **Conf after %** = after implementation, your confidence the result matches the **requested scope**; apply **§ Default success (user silent)** when the user gave no negative signal.
5. **Tier used** = Fast | Balanced | Strong | `unknown` (from **§6** gate: map the **exact** Cursor model to the dossier tier).
6. **Tier fit:** `ok` = tier was right for the task; `could_use_smaller` = finished cleanly and a lower tier likely would have sufficed; `needed_bigger` = struggled, gaps, or would have benefited from one tier up. Default per **§ Default success (user silent)**.
7. **Outcome:** `ok` = shipped as intended for scope; `partial` = subset done; `rework` = had to redo approach; `fail` = reverted or blocked. Default **`ok`** per **§ Default success (user silent)** unless you know otherwise.
8. **Note:** include **`Cursor:`** and the exact picker name (e.g. `Cursor: Sonnet 4.6`) plus any short tag (`field app`, `Site Intel`, etc.).
9. **Skip logging** for: one-line answers, pure read-only Q&A, trivial typo-only edits, or **only** updating `MODEL_DOSSIER.md` § outcome log / rules **for logging itself** in a meta turn. **Also skip** when the work is **too small to change** model guidance (no new **Arch**/domain/risk signal). When in doubt on a **real** feature/fix, **log once** to grow coverage for that **task type**.

### Using the log when recommending a model (**apply what you learned**)

1. **Grep** this section for the same **Arch** (T0–T4) or keywords from the new task (e.g. `firebase`, `Site Intel`, `dispatcher`). Treat rows as **prior runs** — update your recommendation when the log **contradicts** a naive tier guess.
2. Weight **Conf after %** and **Tier fit** over raw **Conf start %**: rows where **Conf after** is high and **Tier fit = ok** or **could_use_smaller** support staying at that tier or trying cheaper; **needed_bigger** or low **Conf after** with **rework**/`fail` argue for a tier up.
3. If **≥2** of the last **10** matching rows are **Outcome = ok** with **Tier used = Fast** (or Balanced), **Conf after ≥ 80%**, and **Tier fit** is **ok** or **could_use_smaller**, you may recommend that **lower** tier *if* the new task is not **HIGH/UNCERTAIN** and does not touch **§ Task archetypes** T3 hard rules (Firebase tenant paths, field critical path, Office Override).
4. If past rows show **rework**, **fail**, **needed_bigger**, or weak **Conf after** for a tier on similar tasks, **recommend one tier higher** than the static table minimum.
5. **Vertex Core safety:** Never recommend **Fast** alone for net-new Firestore writes, lazy-bridge changes, or Office Override consent flows — even if the log says a past task “worked”; those need **Balanced minimum**, **Strong** for HIGH.

### Retention

- Keep **≤ 50 data rows** in the table below. When adding row 51, move the **oldest** rows to **`PROJECT_STATUS/MODEL_DOSSIER_ARCHIVE.md`** (create with a short header + moved rows), and add one line under this subsection: `Older rows: see MODEL_DOSSIER_ARCHIVE.md (append up to YYYY-MM-DD).`
- Older rows: see MODEL_DOSSIER_ARCHIVE.md (archived up to 2026-05-02).

### Outcome log (newest first)

| Date | Task (short) | Class | Arch | Tier used | Conf start % | Conf after % | Tier fit | Outcome | Note |
|------|----------------|-------|------|-----------|--------------|--------------|----------|---------|------|
| 2026-05-14 | Build tooling: Slice 60a — memory hygiene (archive). `slices_archive.ts` (NEW, 27 passed slices 41a–57a); `slices.ts` trimmed to 10 active (58a–60a); `build_runner.ts` auto-archive on `SLICES.length > MAX_ACTIVE_SLICES=20`, `/archive` command, `/status` shows archived count; `MODEL_DOSSIER_ARCHIVE.md` (NEW, 51 oldest outcome rows); `MODEL_DOSSIER.md` trimmed to 30 rows; `VC_BUILD` → Phase60-Slice60a-2026-05-15. | LOW | T2 | Balanced | 92% | 95% | ok | ok | Cursor: **Sonnet 4.6** (pre-approved). Pure governance/tooling hygiene — no app code, no Firestore writes, no field-critical-path changes. Slices extracted from `slices.ts` array and moved to archive file; `loadState()` strips archived IDs from `.build_state.json` on next startup. Lesson: file-size hygiene (archive large TS arrays) belongs in T2 Balanced; the file-text-manipulation for auto-archive routine is the most complex piece — regex brace-depth counting for slice object extraction. |
| 2026-05-14 | Dispatcher: KI-002 E4 — Remove redundant `syncSingleServiceCallToCloud` (Slice 58f). `approveAndSave` in `ai_report_reviewer.js` called `syncSingleServiceCallToCloud(localRow)` after `VCFirestore.setServiceCallMerged` — but `syncSingleServiceCallToCloud` internally calls `VCFirestore.setServiceCallMerged` itself (service_call.js line 145), doubling the write. Removed the redundant block (lines 584-587), replaced with explanatory comment. `ai_report_reviewer.js?v=4→v=5`; `VC_BUILD` bumped to Phase58-Slice58f-2026-05-15. | LOW | T1 | Balanced | 95% | 97% | could_use_smaller | ok | Cursor: **Sonnet 4.6** (pre-approved). Pure redundant-call removal — no behavior change to the Firestore write path, no schema change, no UI change. Verification of `setServiceCallMerged` confirmed it writes to tenant path and deletes root copy for bridge tenants; `syncSingleServiceCallToCloud` adds no extra path coverage. Lesson: always grep for what a "sync" helper internally does before deciding if removal is safe — here it was literally a wrapper around the same `setServiceCallMerged` call. Composer 2 could handle the removal mechanically; Sonnet 4.6 appropriate for the verification reasoning step. |
| 2026-05-14 | Dispatcher: KI-002 C2 — field_forms.js form_templates listener lifecycle fix (Slice 58c). Added `stopFormTemplatesListener()` that calls `formTemplatesUnsubscribe()` + resets var + `formTemplatesCache`; exported as `window.vcStopFormTemplatesListener` + `window.vcStartFormTemplatesListener`; `switchScreen` in `technician/index.html` calls stop on leave-workspace, start on enter-workspace; `field_forms.js?v=3→v=4`; `VC_BUILD` bumped to Phase58-Slice58c-2026-05-15. | LOW | T1 | Balanced | 93% | 95% | could_use_smaller | ok | Cursor: **Sonnet 4.6** (pre-approved). Pure lifecycle/memory-leak fix — no behavior change to the onSnapshot callback, no Firestore write path changes. Mirrors the shadow_mode.js pattern from Slice 58b exactly. Note: `formTemplatesUnsubscribe` variable and storage were already present; only `stopFormTemplatesListener()` + switchScreen hooks were missing. |
| 2026-05-14 | Dispatcher: KI-002 C1 — shadow_mode.js live_presence listener lifecycle fix (Slice 58b). Added `_livePresenceIdleUnsub` module var; `subscribeLivePresenceIdle()` now stores unsub returned by `onSnapshot`; new `unsubscribeLivePresenceIdle()` resets var + `.wired` flag; `closeShadowModal()` calls it on close; exported from `VcShadowMode`; `shadow_mode.js?v=7→v=8`; `VC_BUILD` bumped to Phase58-Slice58b-2026-05-15. | LOW | T1 | Balanced | 93% | 95% | could_use_smaller | ok | Cursor: **Sonnet 4.6** (pre-approved). Shadow Mode is Vertex Core-adjacent per dossier, but this is a pure lifecycle/memory-leak fix — no behavior change to listener callback, no Firestore write path changes. Past shadow_mode.js row (consent gate race fix) was `could_use_smaller` at Sonnet 4.6; this is slightly larger (add var + new function + export) but same risk profile. Lesson: shadow_mode.js single-function lifecycle fixes (store unsub, add cleanup, call on modal close) = T1 Balanced / Sonnet 4.6; Composer 2 could handle the mechanical parts if the surrounding architecture is already understood. |
| 2026-05-14 | Dispatcher: KI-002 B5 — report_builder.css duplicate load consolidation (Slice 58a). `reportCssHref()` bumped ?v=1→?v=4; guard added to reuse main document's resolved href (browser cache hit) when CSS already loaded; popup `<link>` falls back to standalone `?v=4` URL. `report_builder.js?v=3→?v=4`; `VC_BUILD` bumped to Phase58-Slice58a-2026-05-15. | LOW | T1 | Balanced | 95% | 96% | could_use_smaller | ok | Cursor: **Sonnet 4.6** (pre-approved). Mechanical single-file bug fix + version bump pattern. Lesson: `document.querySelector('link[href*=...]')` guard to reuse already-cached stylesheet href is correct pattern for popup windows spawned via `window.open("", "_blank")` — completely skipping the `<link>` would leave popup unstyled. Composer 2 could handle this if the guard logic is already known; Sonnet 4.6 was appropriate given the nuanced popup-vs-main-document reasoning. |
| 2026-05-14 | SDK build runner: full automated run — all 28 slices (41a–57a) passed. Runner v2.1 drove `/a` end-to-end: 49a/51a/52a auto-retried after stale-status reset; 50a/53a pending→passed; Phases 54–57 (integration, offline, deploy, rules, auth, KI-004 outbox, SW cache, dispatcher Save) all first-pass or single-escalation. 13 review slices committed, 15 safe slices auto-pushed. Encoding note: SDK agents corrupted MODEL_DOSSIER.md Unicode (em dashes → garbled); reverted before this log entry. | HIGH | T3 | Strong | 72% | 92% | ok | ok | Cursor: **Opus 4.6** (gate + status updates this session; runner itself used mixed models per slice: claude-sonnet-4-6, claude-opus-4-6, gpt-5.3-codex-spark, gpt-5.3-codex, gpt-5.4-mini, composer-2). Lesson: SDK build runner v2.1 is production-ready for batch slice execution; the escalation ladder + auto-retry + stale-status reset worked as designed. Encoding corruption from SDK agents is a known hazard — always revert dossier after automated runs. Next similar "run all pending slices" → just run `vertex` → `/a`; no manual AI session needed beyond status updates. |
| 2026-05-14 | Build runner v2.1 — two bugs: (1) stale "running" status in `.build_state.json` from prior crash not reset on startup, causing "0 slices completed"; (2) `disableStopHotkey` calling `removeAllListeners("data")` which destroyed readline's listener, killing `/q` and all subsequent commands after `/a` | LOW | T1 | Strong | 90% | 95% | could_use_smaller | ok | Cursor: **Opus 4.6**; file: `tools/build_runner.ts`. Fix 1: `loadState` resets any slice with status "running" to "failed" (if attempts>0) or "pending". Fix 2: store hotkey handler ref, use `removeListener` instead of `removeAllListeners`. Lesson: (a) any CLI with state files must handle crash-recovery for in-flight statuses; (b) never `removeAllListeners` on a shared emitter — always remove by reference. Next similar "runner not picking up slices" → check `.build_state.json` for stale statuses first. |
| 2026-05-14 | Build runner v2.0 — model selector fix (SDK model IDs), validator htmlTarget dynamic routing, graceful stop hotkey (S-to-stop), auto-retry failed slices, time remaining ticker, version display, loadState init for new slices, 10 new slices (54a–57a); env var debugging (CURSOR_API_KEY); process cleanup; commit+push | LOW–UNCERTAIN | T2–T3 | Strong | 75% | 90% | ok | ok | Cursor: **Opus 4.6**; files: `tools/build_runner.ts` (major), `tools/slices.ts`, `tools/model_selector.ts`, `tools/validator.ts`, `tools/README.md`, `job_context_engine.js`. Multi-pass session: (1) model selector name fix was T1 mechanical, (2) validator htmlTarget was T1–T2, (3) stop hotkey + ticker + auto-retry was T2 feature work, (4) loadState crash fix was T2 debugging. Opus 4.6 was safe for the combined scope but Sonnet 4.6 could handle individual fixes. Lesson: build-tooling enhancements (CLI UX, state management, process lifecycle) = T2 Balanced unless touching SDK integration patterns; next similar "add runner feature" → **Sonnet 4.6** unless multi-system. |
| 2026-05-14 | Workbench pause + docs — wrote `workbench/PAUSE_NOTES.md` (strategic context, resume instructions, last sandbox state, OpenRouter opportunity, gap priority table); fixed stale README (port 4040→4141, tab UI→conversational flow, PowerShell startup); updated `CURRENT_STATE.md` pause note. Advisory: 30-day Vertex field-readiness discussion (competitive positioning vs ServiceTitan/BuildOps). | LOW | T1 | Balanced | 88% | 90% | ok | ok | Cursor: **Sonnet 4.6**; files: `workbench/PAUSE_NOTES.md` (NEW), `workbench/README.md`, `PROJECT_STATUS/CURRENT_STATE.md`, `PROJECT_STATUS/MODEL_DOSSIER.md`. Lesson: documentation + strategic advisory = T1 Balanced/Sonnet 4.6 correct; Composer 2 could handle pure doc edits but Sonnet 4.6 produces better structured handoff docs. |
| 2026-05-14 | Workbench: server static path fix + port stabilization — (1) `dist/server.js` ENOENT because `tsc` doesn't copy `src/ui/public/`; added `uiPublicDir()` resolver with fallback; (2) default port hardcoded 4040→4141 to prevent drift; (3) diagnosed Composer 2 failure: it started a stale server on wrong port without `CURSOR_API_KEY`, missing `/api/sandbox/:id/run` route entirely → "non-JSON" cascade error. Files: `server.ts` only. | LOW | T1–T2 | Fast→Balanced | 95% | 95% | needed_bigger | rework | Cursor: **Composer 2** (initial attempt, failed) → **Sonnet 4.6** (diagnosis + fix). Composer 2 started the server without the API key env var, on port 4040 instead of 4141, and from code that was missing routes — it didn't understand the multi-process/port/env-var context. Sonnet 4.6 diagnosed the root cause (two stale processes on different ports, route missing on the one the browser was hitting). Lesson: workbench server ops (process management, env vars, port config, route existence debugging) = **T2 minimum / Sonnet 4.6**. Composer 2 cannot reason about which process is serving which port or why a route returns HTML instead of JSON. Next similar "workbench server won't start / wrong response" → **Sonnet 4.6**, not Composer 2. |
| 2026-05-14 | Workbench v1.3 — multi-session feature batch: (1) Review Changes fullscreen overlay with diff list + iframe preview; (2) sandbox static file serving + sandbox dev server spawn/stop/status routes; (3) Merge to Main git add/commit/push + rollback card UI; (4) Mobile LIVE badge toggle (connected/disconnected) with `addEventListener` + `data-live` attr + dramatic visual states; (5) `Cache-Control: no-cache` for HTML; (6) version label in header. Files: `server.ts`, `merge_manager.ts`, `index.html`. | LOW→T2 | T2 | Balanced | 78% | 90% | ok | ok | Cursor: **Sonnet 4.6** (majority of session); **Opus 4.6** used for initial Review Changes + server spawn design. Multi-session continuation on established codebase. Lesson: UI + server feature pairs (overlay + route) fit Sonnet 4.6 well once architecture is clear; the mobile toggle debugging (inline styles vs CSS class, addEventListener vs onclick) was T1/T2 — Sonnet 4.6 correct. Next similar "workbench UI feature + matching API route" → **Sonnet 4.6**. |
| 2026-05-14 | Workbench UI mobile polish — 3 fixes: (1) review overlay loading msg font-size 13→16px + 18px @mobile via CSS; (2) merge result card auto-scroll (150ms setTimeout after overlay close); (3) Start Over link touch target (padding 10px 12px, min-height 44px, font-size 14px). Single file: `index.html`. Build clean. | LOW | T1 | Balanced | 82% | 92% | could_use_smaller | ok | Cursor: **Sonnet 4.6**; file: `src/ui/public/index.html`. Lesson: All 3 were pure CSS/inline-style + 1-line JS timing fix — Composer 2 likely sufficient. The scroll fix (setTimeout 150ms) was the only non-trivial part (overlay-close timing on mobile). Next similar "mobile CSS + 1-line JS tweak" → **Composer 2**. |
| 2026-05-14 | AI Repo Workbench v0.2 (Phase D+E) — sandbox runner (`@cursor/sdk` Agent.prompt + escalation ladder), test runner (build/test/Playwright), confidence reporter (0-100 scoring + verification checklist), merge manager (git checkpoint + file-copy merge, confirmation-gated). Full Results tab UI + merge dialog. 4 new engine files, server.ts rewrite (7 new API routes), index.html full rebuild. `tools/` untouched. | UNCERTAIN | T3 | Strong | 65% | 88% | ok | ok | Cursor: **Opus 4.6**; files: `sandbox_runner.ts` (NEW), `test_runner.ts` (NEW), `confidence_reporter.ts` (NEW), `merge_manager.ts` (NEW), `server.ts` (rewrite), `index.html` (rewrite), `Dockerfile`, `README.md`, `CURRENT_STATE.md`. Lesson: continuation of v0.1 — implementing against defined interfaces was cleaner; `@cursor/sdk` Agent.prompt pattern from SDK skill was essential. Clean compile first pass. Next similar → **Codex 5.3** if interfaces stable; **Opus 4.6** if new SDK or safety-critical merge logic. |
| 2026-05-14 | AI Repo Workbench v0.1 — standalone portable tool: repo analyzer, messy-note parser, AI_WORK_PATH.md generator, sandbox manager (copy/branch), Express web UI (mobile/Tailscale on :4040), CLI, Dockerfile, generalized model_selector. 12 new files in `workbench/`. `tools/` untouched. | UNCERTAIN | T3 | Strong | 68% | 88% | ok | ok | Cursor: **Opus 4.6**; files: 12 new files in `workbench/` + `CURRENT_STATE.md` + `WORKBENCH_CONTINUATION_PROMPT.md`. Lesson: greenfield standalone tool with 20-section spec = T3/Opus 4.6 correct — required understanding the existing `tools/` SDK patterns to generalize without breaking them, plus multi-system architecture (Express + engines + CLI + Docker). Clean compile on first pass. Phases D+E (sandbox runner, test/merge workflows) deferred to next conversation. Next similar "build standalone tool generalizing existing patterns" → **Opus 4.6** for architecture phase, **Codex 5.3** for implementation-against-defined-interfaces phase. |
| 2026-05-13 | Field app: New Field Tech UX program kickoff — mapped 13-phase spec (`new_fieldtech_ux.md`) to Phases 41–53 build plan; cataloged existing overlap (8 spec phases have partial coverage); detailed first 4 slices (41a–41d) with files/models/confidence; created `NEW_FIELDTECH_UX_PLAN.md`, `ARCHIVE/README.md`; updated `CURRENT_STATE.md` + `ROADMAP.md` | UNCERTAIN | T3 | Strong | 74% | 85% | ok | ok | Cursor: **Opus 4.6**; files: `NEW_FIELDTECH_UX_PLAN.md` (NEW), `ARCHIVE/README.md` (NEW), `CURRENT_STATE.md`, `ROADMAP.md`. Lesson: Program-level planning with field-critical-path implications = UNCERTAIN/T3 Strong is correct — the overlap catalog + dependency graph required understanding the full existing codebase. Pure planning (no code changes) could have been done at Sonnet 4.6 if spec phases were smaller and less interconnected; next similar "map a large spec into build phases" → **Opus 4.6** if field/Firestore-touching, **Sonnet 4.6** if docs-only with known scope. |
| 2026-05-13 | Governance: `.cursorrules` audit — consolidate §1B + §6H (defer session-end/collapse checklist to `.cursor/rules/model-selection.mdc`); CURRENT_STATE wording ↔ ROADMAP On Deck aligned; `.cursor/rules/model-selection.mdc` Vertex pick **Opus 4.6** (4.7 disabled); §6C Strong-tier examples synced | LOW | T1 | Fast | 82% | 92% | could_use_smaller | ok | Cursor: **Composer 2**; files: `.cursorrules`, `.cursor/rules/model-selection.mdc`, `CURRENT_STATE.md`. Lesson: Tier 1 `.cursorrules` should not restate dossier/logging mechanics — pointer + one-line §6H keeps hot context smaller; next similar governance dedupe → **Composer 2** likely enough if edits stay doc-only. |
| 2026-05-13 | Dispatcher: Settings view bleeds into Service intake — `#view-settings { display:flex }` beat `.app-view { display:none }` in CSS specificity so Settings content stayed visible when inactive; fix: move `display:flex` to `#view-settings.active` only; `VC_BUILD = "SettingsViewFix-2026-05-13"` | LOW | T2 | Balanced | 88% | 95% | could_use_smaller | ok | Cursor: **Sonnet 4.6**; file: `index.html` (CSS only, 4-line change + VC_BUILD bump). Lesson: `#id { display:flex }` always overrides `.class { display:none }` (ID > class specificity); always scope layout display to `#id.active` when the element participates in `.app-view` show/hide. Next similar "view bleeds into another view" → **Composer 2** is likely sufficient if specificity is the only culprit. |
| 2026-05-13 | Dispatcher: console error cleanup — `shared/firebase_config.js` catch widened to swallow all errors (silences duplicate `enablePersistence` "already-started" FirebaseError that slipped past `failed-precondition` only guard); Maps URL gains `&loading=async`; cache-bust `?v=1→v=2` in 3 HTML files; `VC_BUILD = "ConsoleClean-2026-05-13"` | LOW | T1 | Balanced | 82% | 92% | could_use_smaller | ok | Cursor: **Sonnet 4.6**. Root cause: `shared/firebase_config.js` `.catch()` only silenced `failed-precondition` + `unimplemented`; the "Firestore already started" code slipped through and logged red. Fix = catch-all on a best-effort secondary call. Maps `loading=async` = URL param (not script tag attribute). Lesson: next similar "silence expected SDK error in a safety-net wrapper" → **Composer 2** is enough. |
| 2026-05-13 | Dispatcher: Save Parent Billing for new parents — `saveServiceParentCompanyAddress` + `saveInvoiceParentCompanyAddress` now create `ParentCompanies` doc when `scParentNew`/`invParentNew` has a typed name and dropdown is empty; populate dropdown + select new doc after create; matching fix on both service + invoice tabs. | HIGH | T2 | Strong | 82% | 93% | ok | ok | Cursor: **Opus 4.6**; file: `invoice.js` (both save functions), `index.html` (cache-bust). Lesson: "Save parent billing" button was gated on dropdown-only; typing a new name and clicking Save trapped users in an alert loop. The existing `resolveServiceParentForSave` already had the create-then-select pattern — `saveServiceParentCompanyAddress` just needed the same branch. Next similar "button requires dropdown but user typed a new value" → check both save functions. |
| 2026-05-13 | Hotfix: Dispatcher CRM load + voice search — 3-part fix: (a) 5 missing Firestore allow-rules; (b) Places API migration from deprecated `PlacesService` to `Place.searchByText()` via `importLibrary` pattern; (c) GCP API key restrictions (Console: added Maps JavaScript API + Places API New to allowed APIs). Firestore rules deployed live; service_call.js + invoice.js + index.html changed. | HIGH | T2–T3 | Strong | 70% | 91% | ok | ok | Cursor: **Opus 4.6** (audit) + **Sonnet 4.6** (initial impl, wrong model). Lesson: initial Sonnet 4.6 implementation used `google.maps.places.Place.searchByText` directly — must use `google.maps.importLibrary("places")` pattern for reliable class loading. Also: `ApiTargetBlockedMapError` was the GCP API key restriction list missing Maps JS API + Places API (New), not a code bug. Three-pass fix: (1) rules + naive migration, (2) importLibrary pattern, (3) Console key restrictions. |
| 2026-05-12 | Field Chronicle Phase 1 — experimental chronological note capture beside technician workspace; new `field_chronicle.js` IIFE (localStorage CRUD, append-only notes, deterministic compile, editable preview modal, Copy Summary clipboard); `technician/index.html` (CSS block, HTML panel + compile modal, hamburger entry, script include, openWorkspace hook, VC_BUILD bump); `index.html` (VC_BUILD bump). Zero Firestore writes, zero report-path changes. Feature-flagged via `window.VC_FIELD_CHRONICLE_ENABLED`. | HIGH | T3 | Strong | 70% | 89% | ok | ok | Cursor: **Opus 4.6**; files: `field_chronicle.js` (NEW), `technician/index.html`, `index.html`, `PROJECT_STATUS/CURRENT_STATE.md`, `PROJECT_STATUS/PROJECT_MAP.md`. Lesson: classified HIGH because field workspace is a critical path — but actual implementation was isolated (new IIFE + additive HTML/CSS, one hook line in `openWorkspace`). The deterministic compile approach (no Gemini) kept scope T2-like in practice; next similar "add-on panel beside workspace with localStorage only" could start at **Sonnet 4.6** if no Firestore writes are involved. Gemini-powered compile in future slices should re-gate at **Opus 4.6**. |
| 2026-05-11 | Firebase/GCP project migration — `twin-pillars-app` → `vertex-core-db` (personal account); updated `firebase-config.js` (all 7 web config literals), `.firebaserc`, CI workflow (`projectId` + comment URL), `service_call.js` (fallback project ID); `CURRENT_STATE.md` console links + migration checklist; no Firestore schema/rules/auth changes — config wiring only | HIGH | T3 | Strong | 82% | 90% | ok | ok | Cursor: **Opus 4.6**; files: `firebase-config.js`, `.firebaserc`, `.github/workflows/firebase-hosting-merge.yml`, `service_call.js`, `CURRENT_STATE.md`. Lesson: Firebase project migration = T3/Strong because of risk surface (Auth, Storage, API keys, CI identity, Gemini referrer) even though code changes are mechanically simple (config string replacement); grep inventory is the critical step — `projectId`, `messagingSenderId`, bucket name, `appId`, plus CI workflow. Data migration (Firestore export/import, Storage rsync, Auth export/import) is manual CLI and Console work outside the repo. |
| 2026-05-09 | Equipment Hub photo consistency — blob URL optimistic inject so photos appear immediately on hub cards/detail after save; `_pendingInjects` map preserves optimistic cards across async Firestore fetch race; card-level thumbnails tap-to-expand lightbox; `VC_BUILD = "EHub-PhotoConsistency-2026-05-09"` | LOW | T2 | Balanced | 87% | 91% | ok | ok | Cursor: **Sonnet 4.6**; files: `equipment_manager.js`, `equipment_hub.js`, `unit_work_parser.js`, `technician/index.html`, `index.html`. Lesson: optimistic inject must include blob URLs for photo visibility; async fetch race requires pending-inject merge pattern; card-level lightbox `stopPropagation` coexists with card-click navigation. T2/Sonnet 4.6 correct. |
| 2026-05-09 | Storage rules allowlist gap fix — added `field_evidence/` + `service_call_addendums/` prefixes missing from explicit allowlist; both used in `technician/index.html` (pasted-photo evidence + addendum file uploads); prior grep was `*.js`-only and missed inline HTML uploads; 10 prefix blocks total | LOW | T1 | Balanced | 97% | 97% | could_use_smaller | ok | Cursor: **Sonnet 4.6**; file: `storage.rules` only. Lesson: always grep `*.js AND *.html` for Storage paths — inline HTML files (`technician/index.html`) contain upload logic that `*.js`-only search misses. |
| 2026-05-09 | Storage rules security tightening — replace open catch-all with 8 explicit prefix blocks (equipment_photos, dictation_hub_assets, customer_evidence, field_quote_evidence, field_form_evidence, quote_evidence, site_access_photos, tenants/imported_equipment_photos); default deny all other paths; mirrors firestore.rules enumeration strategy; `VC_BUILD = "StorageRulesScope-2026-05-09"` | LOW | T2 | Balanced | 90% | 93% | ok | ok | Cursor: **Sonnet 4.6**; file: `storage.rules` only. Lesson: always enumerate prefixes explicitly for Storage, same as Firestore — catch-all exposes entire bucket to anonymous write/delete. Prefixes verified by grepping all `firebase.storage().ref().child(` call sites. |
| 2026-05-09 | Equipment Manager photos never uploading — Firebase Storage not provisioned on twin-pillars-app; ALL photo uploads (EM + UWP inline) were silently failing; added `storage.rules` (open read/write) + `storage` section to `firebase.json`; requires Console enable + `firebase deploy --only storage`; `VC_BUILD = "StorageRulesFix-2026-05-09"` | LOW | T2 | Balanced | 88% | 93% | ok | ok | Cursor: **Sonnet 4.6**; files: `storage.rules` (NEW), `firebase.json`, `index.html`, `technician/index.html`. Lesson: Firebase Storage is a separate service from Firestore — must be explicitly enabled in Console before any `storageRef.put()` succeeds. Silent `.catch` swallows the error so tech never sees it. KI-004 (offline photo outbox) will also need Storage to be live. |
| 2026-05-09 | UWP: silent photo upload fix — `uploadInlinePhotos` early-return guard replaced with local `_ensureFirebaseStorage()` (lazy-loads storage-compat SDK so photos save even when Equipment Manager was never opened); matched-card photo prompt path covered automatically; `unit_work_parser.js?v=9`, `VC_BUILD = "UWP-StorageUploadFix-2026-05-09"` | LOW | T1 | Balanced | 92% | 94% | ok | ok | Cursor: **Sonnet 4.6**; files: `unit_work_parser.js`, `technician/index.html`, `index.html`. Lesson: silent Storage SDK miss = T1 single-function fix; local `_ensureFirebaseStorage()` is cleaner than relying on `window.ensureFirebaseStorage` — avoids cross-module dependency on equipment_manager.js. |
| 2026-05-09 | UWP overlay: per-card OK button + matched-unit photo prompt — `[data-uwp-confirm-one]` fires write for single card and removes it; overlay stays open for remaining units; matched cards with no photos show optional dashed photo prompt (plate + overall inputs, local preview, background `uploadInlinePhotos`); CSS `.uwp-btn-confirm-one`, `.uwp-card-photo-prompt`; `unit_work_parser.js?v=7`, `VC_BUILD = "UWP-PerCardOK-PhotoPrompt-2026-05-09"` | LOW | T2 | Balanced | 88% | 91% | ok | ok | Cursor: **Sonnet 4.6**; files: `unit_work_parser.js`, `technician/index.html`, `index.html`. Lesson: per-card confirm = safe because `writeWorkHistory` already handles `[unit]` arrays; calling callback multiple times (once per unit) is identical to confirming all at once. T2/Sonnet 4.6 confirmed correct. |
| 2026-05-09 | Equipment photo previews + full-parity UWP inline form — FileReader/createObjectURL previews in EM modal + UWP inline form; UWP form expanded to all EM fields (Mfg Year, Age, CRV auto-fill, Prior/Proposed Repairs, live Health Score); Equipment Hub detail photos moved below specs; `saveInlineEquipment` writes full canonical field set; `.em-photo-preview` + `.uwp-photo-preview` CSS; `equipment_hub.js?v=14`, `unit_work_parser.js?v=6`, `VC_BUILD = "EHub-FullPhotoForms-2026-05-09"` | LOW | T2 | Balanced | 87% | 91% | ok | ok | Cursor: **Sonnet 4.6**; files: `equipment_manager.js`, `unit_work_parser.js`, `equipment_hub.js`, `technician/index.html`, `index.html`. Lesson: inline form parity = T2 Balanced — formulas inlined (no new Firestore schema), only wiring + CSS. Photo preview via `createObjectURL` is the right pattern for pre-save previews. |
| 2026-05-09 | Equipment Hub: card-level photo thumbnails — list cards show 62×54 thumb (overall→plate→placeholder); detail "No photos" message; `uploadInlinePhotos` calls `refreshEquipmentHubList`; `.ehub-card-thumb` CSS; `equipment_hub.js?v=13`, `unit_work_parser.js?v=5`, `VC_BUILD = "EHub-CardThumbs-2026-05-09"` | LOW | T2 | Balanced | 84% | 89% | ok | ok | Cursor: **Sonnet 4.6**; `equipment_hub.js`, `unit_work_parser.js`, `technician/index.html`, `index.html`. Lesson: detail lightbox was already built; missing piece was card-level thumb + "no photos" fallback + refresh after inline upload. T2/Sonnet correct. |
| 2026-05-09 | UWP inline quick-add: mobile file inputs — remove `capture="environment"` from plate/overall `<input type="file" accept="image/*">` so iOS/Android show native sheet (Take Photo / Photo Library / Browse) instead of camera-only; `unit_work_parser.js?v=4`; `VC_BUILD = "UWP-PhotoPicker-2026-05-09"` | LOW | T1 | Balanced | 90% | 93% | ok | ok | Cursor: **Composer 2**; `unit_work_parser.js`, `technician/index.html`, `index.html`, `CURRENT_STATE.md`. Lesson: `capture` forces direct camera on mobile; omit for gallery + file picker UX. |

---

## Relative cost scale (plan-agnostic)

| Code | Meaning |
|------|---------|
| **$** | Typically lowest cost / fastest — good for tight loops |
| **$$** | Mid — default for most coding |
| **$$$** | High — long reasoning, risky multi-file, novel architecture |
| **$$$$** | Highest — reserve for maximum reasoning depth or repeated failure on $$ |

Exact $ amounts are **not** listed here (they change by plan).

---

## Capability dimensions

When picking a tier, score the task against these (mentally — no spreadsheet required):

| Dimension | Questions |
|-----------|-----------|
| **Reasoning depth** | One-step fix vs multi-step design vs debugging unknown root cause |
| **Codebase span** | Single file vs many files vs cross-cutting (Firebase + field + dispatcher) |
| **Risk** | Cosmetic vs production data / billing / safety |
| **Ambiguity** | Spec clear vs “figure it out” / conflicting requirements |
| **Domain** | Generic JS vs this repo’s tenant bridge / Office Override / offline queues |

---

## Task archetypes → minimum tier

| Archetype | Examples | Minimum tier (see § Registry) | Notes |
|-----------|----------|------------------------------|--------|
| **T0 — Trivial** | Typos, one-line CSS, rename in one file, grep-and-answer | **Fast / Composer-class** | If unsure file is correct, use **T1** instead |
| **T1 — Small scope** | Single-module bugfix, small refactor, update one doc section | **Fast or balanced** | Prefer fast if change is mechanical |
| **T2 — Standard dev** | Multi-file feature, new UI section, tests, moderate refactors | **Balanced / Sonnet-class** | Default “most days” tier |
| **T3 — High risk** | Firestore schema writes, sync/offline, auth rules, money/payroll paths | **Strong / Opus-class or Codex-class** | Matches `.cursorrules` §6 HIGH |
| **T3+ — Uncertain** | Ambiguous product intent, security audit, “why is production broken” | **Strong** + narrow scope first | Matches `.cursorrules` §6 UNCERTAIN |
| **T4 — Exploratory only** | Read-only codebase tour, architecture explanation | **Fast or balanced** | Don’t use max tier unless user asks for deepest reasoning |

**Vertex Core repo:** anything touching **`shared/firebase_logic.js`**, **tenant paths**, **field app critical path**, or **Office Override / Shadow** → treat as **≥ T3** unless the change is comment-only or a string literal.

---

## Workspace enabled models (PROJECT-DISPATCHER TOOL)

**Last verified:** 2026-05-07 (Cursor **Settings → Models**).

> **2026-05-07 model change:** User disabled **Opus 4.7** (cost). **Opus 4.6** is now the Strong-tier ceiling for HIGH/UNCERTAIN/Vertex Core work. Track Opus 4.6 performance carefully in **§ Task outcome log** — note `Cursor: Opus 4.6` and flag **Tier fit** so the log builds real signal on whether it holds up for T3+ tasks. Re-enable Opus 4.7 only if outcome log shows `needed_bigger` / `fail` on T3+ Vertex Core tasks.

### Agent rule

- For **§6B** `Recommended model:` and the **§6B1** gate **(A)** paragraph, pick **one** name from **§ Currently enabled** below (exact picker spelling).
- Recommend the **cheapest enabled model that still meets** the task’s minimum tier (see **§ Default “switch to” before work**).
- **Do not** recommend **Premium** as the model — it is a **plan/suite** label in the list, not a replaceable capability pick. Choose **Composer 2**, **Sonnet 4.6**, **Codex 5.3**, **Opus 4.6**, etc.
- **Opus 4.7 is disabled.** Do not recommend it. Use **Opus 4.6** anywhere Opus 4.7 was previously the recommendation.

### Currently enabled

| Picker name | Tier (this workspace) | Notes |
|-------------|----------------------|--------|
| **Composer 2** | Fast | Default for T0–T1 mechanical / tight loops |
| **Sonnet 4.6** | Balanced | Default for T2 daily implementation |
| **GPT-5.2** | Strong | Lighter **Strong** GPT line vs 5.4 / 5.5 |
| **GPT-5.4** | Strong | Mid **Strong** GPT |
| **GPT-5.5** | Strong | Flagship **Strong** GPT |
| **Codex 5.3** | Strong | **Prefer** for code-heavy T3 multi-file work |
| **Opus 4.6** | Strong | **Current ceiling** for T3+ / UNCERTAIN / Vertex Core. Replacing Opus 4.7. Tracking performance — see outcome log. |
| ~~**Opus 4.7**~~ | *(disabled)* | Disabled 2026-05-07 — too expensive. Re-enable if outcome log shows Opus 4.6 `needed_bigger` on T3+ tasks. |
| **Premium** | *(not a model)* | Ignore for recommendations — pick a concrete model above |

### Default “switch to” before work (first choice)

Use this table for **§6B1 (A)** (“switch to **X** because …”). Offer **one** primary name; mention alternates only when useful.

| Archetype | Recommended model (switch to this first) | Enabled alternates |
|-----------|------------------------------------------|--------------------|
| **T0** | **Composer 2** | — |
| **T1** (mechanical) | **Composer 2** | Sonnet 4.6 |
| **T1** (nuanced single file) | **Sonnet 4.6** | Composer 2 |
| **T2** | **Sonnet 4.6** | — |
| **T4** (read-only / tour) | **Composer 2** | Sonnet 4.6 |
| **T3** (implementation / code-heavy) | **Codex 5.3** | GPT-5.5, Opus 4.6, GPT-5.4, GPT-5.2 |
| **T3 Vertex Core** (tenant, Firestore writes, field critical path, Office Override) | **Opus 4.6** | Codex 5.3, GPT-5.5 |
| **T3+ / UNCERTAIN** | **Opus 4.6** | GPT-5.5, Codex 5.3 |

### Currently disabled

| Model | Reason / re-enable condition |
|-------|------------------------------|
| **Opus 4.7** | Disabled 2026-05-07 (cost). Re-enable if outcome log shows Opus 4.6 `needed_bigger` or `fail` on T3+ Vertex Core tasks. |
| Composer 1.5, Opus 4.5, Gemini 3.1 Pro, GPT-5.4 Mini, GPT-5.4 Nano | Off at last verification; enable only if you want extra rungs. |

---

## Registry (update when Cursor’s model list changes)

> **Agent rule:** Prefer **names exactly as shown in the user’s Cursor model picker.** Below are **families** — map them to whatever Cursor exposes today.

| Tier label | Typical Cursor UI families (examples) | Relative cost | Best for | Avoid for |
|------------|----------------------------------------|---------------|----------|-----------|
| **Fast** | Composer Fast, “fast” variants, smaller GPT models | **$** | T0–T1, boilerplate, quick Q&A | T3 data migrations, ambiguous specs |
| **Balanced** | Claude Sonnet–class, GPT x.y “balanced”, default agents | **$$** | T1–T2, daily implementation | Deepest novel architecture without review |
| **Strong** | Claude Opus–class, GPT “thinking” / Codex heavy, high-reasoning modes | **$$$–$$$$** | T3, T3+, security-sensitive, multi-step debugging across stack | Pure typo fixes (overkill) |

**Subagents / Task tool:** If the parent chat uses **Task**, optional `model` slug must be one Cursor allows for subagents (see product docs). When delegating, pick the **lowest** slug that meets the subagent’s mission.

---

## Conflicts with `.cursorrules` §6

If `.cursorrules` says **HIGH / UNCERTAIN → stop and escalate**, that **overrides** “use Fast.” Capability (Strong) wins over cost for **HIGH/UNCERTAIN** until the user confirms.

---

## Changelog

- **2026-05-07:** **Opus 4.7 disabled** (cost). Opus 4.6 is new Strong ceiling for T3+/UNCERTAIN/Vertex Core. All "switch to" table entries updated. Tracking Opus 4.6 via outcome log.
- **2026-05-02:** **Strict §6B1 flow** in `.cursorrules` §6B1 (steps 0–4, mandatory **(A)(B)(C)**); `.cursor/rules/model-selection.mdc` aligned; dossier cross-refs updated.
- **2026-05-02:** **North star** reframed — agent notebook, **task-type** logging (not every task), **continuous improvement** / apply learned rows; §6H softened to match.
- **2026-05-02:** **§6§ Preamble** (cross-ref): agent checklist step 4 — **no repo changes** until user sends approved proceed line; concrete picker name required.
- **2026-05-02:** **North star** — cheapest-good tracking in MD; **§ Workspace enabled models**; outcome-log framing; `.cursorrules` §6 + `model-selection.mdc`.
- **2026-05-02:** Initial dossier; **§ Task outcome log** (Conf start/after, tier used, **Tier fit**, outcome, grep-based calibration + retention).
