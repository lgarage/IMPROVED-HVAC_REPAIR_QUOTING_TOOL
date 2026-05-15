# Cursor model dossier (capability & cost heuristic)

> **North star:** This file is the agent's **running notebook** in markdown — **cheap-enough model per kind of work**, grounded in what actually happened. It is **not** a diary of every message: **skip** tiny/no-value tasks (see **§ Skip logging**). **Do** record **task types** (archetype **T0–T4**, domain, risk) whenever substantive work finishes, so future sessions **grep the log**, **infer** patterns, and **recommend smarter models**. **Always aim to improve:** apply **Conf after**, **Tier fit**, and outcomes from past rows; add new rows when you **learn** something that helps the next similar task.
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
| T0 (exact replace, version bump) | **GPT-5.4 Nano** / **GPT-5.4 Mini** | Rotate between to find cheapest safe alternative |
| T1 mechanical (multi-step edits) | **Haiku 4.5** / **Gemini 3 Flash** | Stronger reasoning than Composer 2; skip pure-reasoning tasks |
| T1 nuanced / T2 | **Sonnet 4.6** | Default daily implementation; Kimi K2.5 as experimental alt |
| T3 code-heavy multi-file | **Codex 5.3** | Prefer over Opus for pure-code T3 |
| T3 Vertex Core / T3+ / UNCERTAIN | **Opus 4.6** | Current ceiling — Opus 4.7 disabled 2026-05-07 |
| T4 read-only / tour | **Haiku 4.5** / **Gemini 3 Flash** | Good reasoning; skip if exhaustive deep-dive needed |

_Last verified: 2026-05-15. **IMPORTANT:** Composer 2 reasoning weakness (see outcome log row 2026-05-15 auto-scroll) makes it a net time-waster despite speed. Prefer Haiku 4.5 / Gemini 3 Flash / GPT-5 Mini for all T0–T1. Full table: § Default "switch to" before work._

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
2. Insert the row **directly under the table header** (below the `|---|` line) — **newest first** — so scanners don't read hundreds of lines.
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
5. **Vertex Core safety:** Never recommend **Fast** alone for net-new Firestore writes, lazy-bridge changes, or Office Override consent flows — even if the log says a past task "worked"; those need **Balanced minimum**, **Strong** for HIGH.

### Retention

- Keep **≤ 50 data rows** in the table below. When adding row 51, move the **oldest** rows to **`PROJECT_STATUS/MODEL_DOSSIER_ARCHIVE.md`** (create with a short header + moved rows), and add one line under this subsection: `Older rows: see MODEL_DOSSIER_ARCHIVE.md (append up to YYYY-MM-DD).`
- Older rows: see MODEL_DOSSIER_ARCHIVE.md (archived up to 2026-05-02).

### Outcome log (newest first)

| Date | Task (short) | Class | Arch | Tier used | Conf start % | Conf after % | Tier fit | Outcome | Note |
|------|----------------|-------|------|-----------|--------------|--------------|----------|---------|------|
| 2026-05-15 | Field app: Remove "Which unit?" nudge — `generateResponse` (medium conf, no equipment entity) → "Got it." not "Which unit?"; `checkFollowUpPrompt` no-op (`hideFollowUpPrompt` only); removed `.ct-followup-prompt*` CSS from `technician/index.html`. `VC_BUILD: Phase60-TimelineNoWhichUnit-2026-05-15`, `conversational_timeline.js?v=18`. | LOW | T1 | Fast | 85% | 92% | ok | ok | Cursor: **Composer 2** — cluster (c) small UI removal / behavior kill switch; dead `createFollowUpEl` HTML string still mentions Which unit but is never mounted. |
| 2026-05-15 | Field app: Mobile UI v8 — root-fix auto-scroll. `#screen-workspace.active`: `min-height` → `height` (bounded flex chain so `#ct-message-list` actually scrolls). Removed `scroll-behavior: smooth` from `#ct-message-list` (iOS drops `scrollTop` assignments when smooth is active). Added `scrollIntoView({block:"nearest"})` fallback on last stream child. `VC_BUILD: Phase60-MobileUIv8-2026-05-15`, `conversational_timeline.js?v=17`. | LOW | T1 | Balanced | 95% | 96% | ok | ok | Cursor: **Sonnet 4.6** (user moved after Composer 2 missed root cause). Root cause was CSS not JS — `min-height` allows workspace to grow infinitely; `#ct-message-list` was never bounded; `scrollTop = scrollHeight` was a no-op. Lesson: auto-scroll failures in flex layouts → check `height` vs `min-height` on root flex container first; `scroll-behavior: smooth` also silently drops `scrollTop` on iOS. |
| 2026-05-15 | Field app: Mobile UI v7 — timeline auto-scroll + fix Compile/Sync survival. `#ct-message-stream` inner container; `renderTimeline` sets `innerHTML` on stream only (Compile/Sync siblings preserved). `scrollToBottom`: immediate + double `requestAnimationFrame` + 80ms retry for iOS layout. Hints/draft/save-prompt append to stream. `VC_BUILD: Phase60-MobileUIv7-2026-05-15`, `conversational_timeline.js?v=16`. | LOW | T1 | Balanced | 93% | 94% | could_use_smaller | **failed** | Cursor: **Composer 2** (user proceeded after gate). **COMPOSER 2 FAILURE — auto-scroll did not work after ship.** Composer 2 only patched the JS layer (`scrollToBottom` timing + `rAF` + `#ct-message-stream` target) — it **never inspected the CSS flex chain** and missed that `#screen-workspace.active` used `min-height` (unbounded) instead of `height` (bounded), making `#ct-message-list` unable to scroll at all. `scrollTop = scrollHeight` was a no-op because `scrollHeight === clientHeight` — the container was growing with its content rather than constraining it. **Lesson: Composer 2 treats scroll bugs as JS problems; it does not reason about whether the scrollable container is actually bounded by its CSS ancestors.** Any auto-scroll / sticky-input failure where "the JS looks right" must be escalated to Sonnet 4.6 or higher to audit the full CSS flex chain. Next similar "scroll not working despite correct JS" → **Sonnet 4.6 minimum**. |
| 2026-05-15 | Field app: Mobile UI v6 — scrollable Compile/Sync + fixed util row. Moved `ct-post-chat-actions` inside `#ct-message-list` to scroll with messages. Fixed dock util row: `ct-photo-btn` (orange, `#ct-media-btn`) + `ct-ptt-btn` (green, `#ct-talk-btn`) same pill size as compile/sync. `ct-type-input` + send stays in dock. `conversational_timeline.js`: video stop restores "Take Photo" label. `VC_BUILD: Phase60-MobileUIv6-2026-05-15`. | LOW | T2 | Balanced | 84% | 90% | ok | ok | Cursor: **Sonnet 4.6** (model-switched). HTML/CSS reorder + JS label patch in `conversational_timeline.js`. No Firestore. Lesson: when moving existing buttons to new pill style, always audit `setMediaBtnVideoState`/`setRecordingState` for textContent resets that overwrite new labels. |
| 2026-05-15 | Field app: Mobile UI v5 — fixed composer dock + scroll containment. `#ct-composer-dock` (`position: fixed` bottom); `#screen-workspace.active` flex column + `min-height: calc(100dvh - var(--vc-app-shell-height))`; `#workspaceLockScope` flex child `min-height: 0`; extra `padding-bottom` on `#ct-message-list` for dock clearance. `VC_BUILD: Phase60-MobileUIv5-2026-05-15`. | LOW | T1 | Balanced | 95% | 94% | could_use_smaller | ok | Cursor: **Composer 2** (user switched from recommendation). Pure CSS + HTML wrapper — no Firestore. |
| 2026-05-15 | Field app: Mobile UI v4 — header/footer/chat-action restructure. Removed FIELD APP logo; Schedule pill promoted to header row (beside user chip, flex:1). Removed green Complete & Sync FAB (hidden #generate kept for JS); added inline `[Compile Notes][Sync Ticket]` row between last message and sticky input bar. `VC_BUILD: Phase60-MobileUIv4-2026-05-15`. | LOW | T2 | Balanced | 88% | 92% | ok | ok | Cursor: **Sonnet 4.6** (model-switched). Pure HTML/CSS/JS restructure — no Firestore writes, no auth paths. ct-sync-btn delegates to hidden #generate; historical-mode disable wired to applyWorkspaceHistoricalMode. Lesson: "move nav item into header row" pattern = remove nav wrapper, add flex:1 to button, shrink-wrap meta div. Same T2/Balanced profile as v1–v3. |
| 2026-05-15 | Field app: Mobile UI v3 — ChatGPT-style minimal chat redesign. Removed container chrome (border/gradient/shadow/header); single-row pill input bar (+ / text / voice dot / ↑ send); message bubbles borderless muted; compile button pill-ized; draft bubble toned down. `VC_BUILD: Phase60-MobileUIv3-2026-05-15`. | LOW | T2 | Balanced | 88% | 93% | ok | ok | Cursor: **Sonnet 4.6** (continuation of model-switched session). Pure CSS/HTML restructure — no Firestore, no auth, no logic changes. Lesson: "make it look like ChatGPT" = flatten container chrome + single-row input pill + icon-only buttons + muted palette. T2/Balanced correct; Composer 2 could handle if design decisions are pre-made. |
| 2026-05-15 | Field app: Mobile UI v1+v2 — (v1) remove FIELD APP header, Schedule beside name, RFC tap-to-reveal; (v2) workspace stripped to timeline-only (6 sections removed + code stubs), bottom input bar redesigned (text+Send / orange Photo-Video / green Push-to-Talk with listening dot). `VC_BUILD: Phase60-MobileUIv2-2026-05-15`. *(2 tasks)* | LOW | T2 | Balanced | 83% | 91% | ok | ok | Cursor: **Sonnet 4.6** (model-switched). HTML/CSS/JS only — no Firestore writes, no auth paths. ~540 net lines removed across 20+ StrReplace ops. Stubs replaced tstat block (~200 lines) + applyMode + addendum IIFE. Lesson: large workspace section removal (dictation hub, chronicle, mode forms, addendum) = T2/Balanced; the key risk is not breaking hidden sync fields — keep them as hidden inputs, stub the JS functions at call sites. Next similar "strip a form section and keep data compat" → Sonnet 4.6, stub pattern for functions with many call sites. |
| 2026-05-15 | **HOTFIX** Firestore rules 59b revert — all data paths back to `if true`; field tech app has no Firebase Auth. Grepped entire `technician/` tree to confirm every collection accessed without auth. Deployed `firebase deploy --only firestore:rules`. Admin locks (Slice 1) preserved. | HIGH | T3 | Strong | 92% | 95% | ok | ok | Cursor: **Opus 4.6** (pre-approved). Vertex Core / field-critical-path regression. Root cause: 59b assumed all clients use Firebase Auth, but field techs pick name from localStorage roster — zero auth identity. Affected: live_presence (heartbeat write), service_calls (schedule subscription), site_intelligence, completed_reports, roster, field_quotes, pm_records, field_form_submissions, on_call_state, labor_logs, plus root bridge paths. Lesson: **never gate Firestore paths on `request.auth` until the field tech app has an auth identity** (anonymous auth or custom token). Future slice prerequisite before re-tightening. |
| 2026-05-15 | Build tooling: `reviewChecklist` field on Slice interface — `slices.ts` (interface + backfill 7 review slices), `prompt_builder.ts` (inject checklist into agent prompt), `build_runner.ts` (print checklist box after review-slice pass). No app code, no Firestore writes. | LOW | T2 | Balanced | 90% | 95% | could_use_smaller | ok | Cursor: **Sonnet 4.6** (model-switched). Pure build-tooling enhancement — 3-file interface + display change. Backfilling 7 review slices with specific actionable test steps was the bulk of the work. Lesson: checklist authoring at slice-definition time (static field) is cleaner than parsing agent free-form output; prompt injection ensures the agent knows what will be verified. Composer 2 could handle the mechanical parts but Sonnet 4.6 appropriate for designing the checklist content per slice. |
| 2026-05-14 | Build tooling: Slice 60a — memory hygiene (archive). `slices_archive.ts` (NEW, 27 passed slices 41a–57a); `slices.ts` trimmed to 10 active (58a–60a); `build_runner.ts` auto-archive on `SLICES.length > MAX_ACTIVE_SLICES=20`, `/archive` command, `/status` shows archived count; `MODEL_DOSSIER_ARCHIVE.md` (NEW, 51 oldest outcome rows); `MODEL_DOSSIER.md` trimmed to 30 rows; `VC_BUILD` → Phase60-Slice60a-2026-05-15. | LOW | T2 | Balanced | 92% | 95% | ok | ok | Cursor: **Sonnet 4.6** (pre-approved). Pure governance/tooling hygiene — no app code, no Firestore writes, no field-critical-path changes. Slices extracted from `slices.ts` array and moved to archive file; `loadState()` strips archived IDs from `.build_state.json` on next startup. Lesson: file-size hygiene (archive large TS arrays) belongs in T2 Balanced; the file-text-manipulation for auto-archive routine is the most complex piece — regex brace-depth counting for slice object extraction. |

... (older rows archived) ...

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
| **Ambiguity** | Spec clear vs "figure it out" / conflicting requirements |
| **Domain** | Generic JS vs this repo's tenant bridge / Office Override / offline queues |

---

## Task archetypes → minimum tier

| Archetype | Examples | Minimum tier (see § Registry) | Notes |
|-----------|----------|------------------------------|--------|
| **T0 — Trivial** | Typos, one-line CSS, rename in one file, grep-and-answer | **Fast / Composer-class** | If unsure file is correct, use **T1** instead |
| **T1 — Small scope** | Single-module bugfix, small refactor, update one doc section | **Fast or balanced** | Prefer fast if change is mechanical |
| **T2 — Standard dev** | Multi-file feature, new UI section, tests, moderate refactors | **Balanced / Sonnet-class** | Default "most days" tier |
| **T3 — High risk** | Firestore schema writes, sync/offline, auth rules, money/payroll paths | **Strong / Opus-class or Codex-class** | Matches `.cursorrules` §6 HIGH |
| **T3+ — Uncertain** | Ambiguous product intent, security audit, "why is production broken" | **Strong** + narrow scope first | Matches `.cursorrules` §6 UNCERTAIN |
| **T4 — Exploratory only** | Read-only codebase tour, architecture explanation | **Fast or balanced** | Don't use max tier unless user asks for deepest reasoning |

**Vertex Core repo:** anything touching **`shared/firebase_logic.js`**, **tenant paths**, **field app critical path**, or **Office Override / Shadow** → treat as **≥ T3** unless the change is comment-only or a string literal.

---

## Workspace enabled models (PROJECT-DISPATCHER TOOL)

**Last verified:** 2026-05-15 (Cursor **Settings → Models**).

> **2026-05-15 model expansion:** User enabled **Haiku 4.5**, **GPT-5.4 Mini**, **GPT-5.4 Nano**, **Gemini 3 Flash**, **GPT-5 Mini**, **Kimi K2.5**. Rationale: Composer 2's reasoning weakness (see outcome log 2026-05-15 auto-scroll failure) is a net time-waster. New fast-tier models offer better reasoning for T0–T1. Build outcome log signal by rotating between them on low-risk tasks. Kimi K2.5 is experimental — test at T2 first before adding to regular rotation.
>
> **Composer 2 advisory:** Still in rotation for pure mechanical edits (one-liner, exact string replace, version bump). **Do not** use for bugs, styling decisions, or any task requiring code reasoning or cross-file judgment. When in doubt between Composer 2 and alternatives, **pick Haiku 4.5** or **Gemini 3 Flash**.

### Agent rule

- For **§6B** `Recommended model:` and the **§6B1** gate **(A)** paragraph, pick **one** name from **§ Currently enabled** below (exact picker spelling).
- Recommend the **cheapest enabled model that still meets** the task's minimum tier (see **§ Default "switch to" before work**).
- **Do not** recommend **Premium** as the model — it is a **plan/suite** label in the list, not a replaceable capability pick. Choose **Haiku 4.5**, **Sonnet 4.6**, **Codex 5.3**, **Opus 4.6**, etc.
- **Opus 4.7 is disabled.** Do not recommend it. Use **Opus 4.6** anywhere Opus 4.7 was previously the recommendation.
- **Composer 2 demotion (2026-05-15):** Moved from default T0–T1 to fallback only due to documented reasoning gaps. Use **Haiku 4.5**, **Gemini 3 Flash**, **GPT-5.4 Nano** first.

### Currently enabled

| Picker name | Tier (this workspace) | Notes |
|-------------|----------------------|--------|
| **GPT-5.4 Nano** | Fast | **T0 first choice** — pure mechanical edits; rotate with Mini to find sweet spot |
| **GPT-5.4 Mini** | Fast | **T0–T1 alternate** — slightly stronger reasoning than Nano |
| **Haiku 4.5** | Fast | **T1 first choice** — noticeably better reasoning than Composer 2; stronger at instruction-following |
| **Gemini 3 Flash** | Fast | **T1 alternate** — reliable code edits, strong at following constraints |
| **GPT-5 Mini** | Fast | **Experimental T1 alt** — newer GPT-5 base, likely stronger than Sonnet 4.6 on some tasks; build signal before promoting |
| **Composer 2** | Fast | **Fallback for pure mechanical** — speed advantage offset by reasoning weakness (see auto-scroll outcome row). Use only when task is 100% explicit (exact replace, version bump). |
| **Sonnet 4.6** | Balanced | Default for T2 daily implementation |
| **GPT-5.2** | Strong | Lighter **Strong** GPT line vs 5.4 / 5.5 |
| **GPT-5.4** | Strong | Mid **Strong** GPT |
| **GPT-5.5** | Strong | Flagship **Strong** GPT |
| **Codex 5.3** | Strong | **Prefer** for code-heavy T3 multi-file work |
| **Opus 4.6** | Strong | **Current ceiling** for T3+ / UNCERTAIN / Vertex Core. Replacing Opus 4.7. Tracking performance — see outcome log. |
| **Kimi K2.5** | **Experimental** | Enabled for testing at T2 level. Benchmarks suggest MoE may rival Sonnet on some tasks. **Do not** add to T0–T1 until outcome log has ≥2 rows. |
| ~~**Opus 4.7**~~ | *(disabled)* | Disabled 2026-05-07 — too expensive. Re-enable if outcome log shows Opus 4.6 `needed_bigger` on T3+ tasks. |
| **Premium** | *(not a model)* | Ignore for recommendations — pick a concrete model above |

### Default "switch to" before work (first choice)

Use this table for **§6B1 (A)** ("switch to **X** because …"). Offer **one** primary name; mention alternates only when useful.

| Archetype | Recommended model (switch to this first) | Enabled alternates |
|-----------|------------------------------------------|--------------------|
| **T0** (exact replace, 1-line) | **GPT-5.4 Nano** | GPT-5.4 Mini, Haiku 4.5 |
| **T1** (mechanical, multi-step) | **Haiku 4.5** | Gemini 3 Flash, GPT-5 Mini |
| **T1** (nuanced single file) | **Haiku 4.5** | Sonnet 4.6, GPT-5 Mini |
| **T2** | **Sonnet 4.6** | Kimi K2.5 (experimental) |
| **T4** (read-only / tour) | **Haiku 4.5** | Gemini 3 Flash |
| **T3** (implementation / code-heavy) | **Codex 5.3** | GPT-5.5, Opus 4.6, GPT-5.4, GPT-5.2 |
| **T3 Vertex Core** (tenant, Firestore writes, field critical path, Office Override) | **Opus 4.6** | Codex 5.3, GPT-5.5 |
| **T3+ / UNCERTAIN** | **Opus 4.6** | GPT-5.5, Codex 5.3 |

### Currently disabled

| Model | Reason / re-enable condition |
|-------|------------------------------|
| **Opus 4.7** | Disabled 2026-05-07 (cost). Re-enable if outcome log shows Opus 4.6 `needed_bigger` or `fail` on T3+ Vertex Core tasks. |
| Composer 1.5, Opus 4.5, Gemini 3.1 Pro | Off at last verification; enable only if you want extra rungs beyond current lineup. |

---

## Registry (update when Cursor's model list changes)

> **Agent rule:** Prefer **names exactly as shown in the user's Cursor model picker.** Below are **families** — map them to whatever Cursor exposes today.

| Tier label | Typical Cursor UI families (examples) | Relative cost | Best for | Avoid for |
|------------|----------------------------------------|---------------|----------|-----------|
| **Fast** | Composer Fast, "fast" variants, smaller GPT models | **$** | T0–T1, boilerplate, quick Q&A | T3 data migrations, ambiguous specs |
| **Balanced** | Claude Sonnet–class, GPT x.y "balanced", default agents | **$$** | T1–T2, daily implementation | Deepest novel architecture without review |
| **Strong** | Claude Opus–class, GPT "thinking" / Codex heavy, high-reasoning modes | **$$$–$$$$** | T3, T3+, security-sensitive, multi-step debugging across stack | Pure typo fixes (overkill) |

**Subagents / Task tool:** If the parent chat uses **Task**, optional `model` slug must be one Cursor allows for subagents (see product docs). When delegating, pick the **lowest** slug that meets the subagent's mission.

---

## Conflicts with `.cursorrules` §6

If `.cursorrules` says **HIGH / UNCERTAIN → stop and escalate**, that **overrides** "use Fast." Capability (Strong) wins over cost for **HIGH/UNCERTAIN** until the user confirms.

---

## Changelog

- **2026-05-15:** **Fast-tier expansion & Composer 2 demotion**. Added Haiku 4.5, GPT-5.4 Nano/Mini, Gemini 3 Flash, GPT-5 Mini, Kimi K2.5. Reasoning: Composer 2 failure on 2026-05-15 auto-scroll task (CSS reasoning gap) marked as net time-waster despite speed. New models offer better T0–T1 reasoning for cheaper cost than Sonnet 4.6. Tier quick card updated; "switch to" table rebuilt around rotation strategy. Kimi K2.5 experimental at T2 only until signal builds. Outcome log row added to document Composer 2 weakness.
- **2026-05-07:** **Opus 4.7 disabled** (cost). Opus 4.6 is new Strong ceiling for T3+/UNCERTAIN/Vertex Core. All "switch to" table entries updated. Tracking Opus 4.6 via outcome log.
- **2026-05-02:** **Strict §6B1 flow** in `.cursorrules` §6B1 (steps 0–4, mandatory **(A)(B)(C)**); `.cursor/rules/model-selection.mdc` aligned; dossier cross-refs updated.
- **2026-05-02:** **North star** reframed — agent notebook, **task-type** logging (not every task), **continuous improvement** / apply learned rows; §6H softened to match.
- **2026-05-02:** **§6§ Preamble** (cross-ref): agent checklist step 4 — **no repo changes** until user sends approved proceed line; concrete picker name required.
- **2026-05-02:** **North star** — cheapest-good tracking in MD; **§ Workspace enabled models**; outcome-log framing; `.cursorrules` §6 + `model-selection.mdc`.
- **2026-05-02:** Initial dossier; **§ Task outcome log** (Conf start/after, tier used, **Tier fit**, outcome, grep-based calibration + retention).
