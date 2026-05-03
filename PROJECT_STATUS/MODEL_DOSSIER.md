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

### Outcome log (newest first)

| Date | Task (short) | Class | Arch | Tier used | Conf start % | Conf after % | Tier fit | Outcome | Note |
|------|----------------|-------|------|-----------|--------------|--------------|----------|---------|------|
| 2026-05-02 | Field app: Gate Complete & Sync until status updated from default "Dispatched" — `validateJobStatusUpdated()` in both `#generate` + `#reportPreviewSyncBtn` handlers; scrolls inline status selector into view | LOW | T2 | Balanced | 80% | 92% | ok | ok | Cursor: **Sonnet 4.6**; `Phase34l-status-gate-2026-05-02`; single-file change; mirrors existing validate-pattern (`validateNeedsRepairQuote`, `validateRecommendedRepairLabor`); T2 Balanced was right — T1/Fast would have been enough for the check itself but the handler-wiring context makes Balanced the safer pick. |
| 2026-05-02 | Field app + simulator: Surface previously submitted reports on workspace open — read-only "Previously submitted report" panel (`#workspacePreviousSubmission`) above the dictation hub displaying `activeTicket.techNotes` (same content the dispatcher's "Technician report (Field app):" cyan box renders); + dictation hub seed from `activeTicket.internal_comms` → `techNotes` (in-memory + bridged cloud fallback); + iPhone-visible debug overlay diagnostic | UNCERTAIN→LOW | T2 | Strong | 72% | 86% | ok | ok | Cursor: **Opus 4.7**; pass 1 `dictation_hub.js?v=14→15` `loadNotesFromStorageForNewTicket` in-memory fallback + don't-clobber-empty guards on `fetchInternalCommsFromCloud` + live `onSnapshot`; pass 2 `?v=15→16` extends `fetchInternalCommsFromCloud` to fall back to `data.techNotes` (bridge-aware); pass 3 final fix — overlay revealed `actT.tn.len=1095` AND `dh.notes.len=120` already on device, so dictation hub WAS hydrated with `internal_comms`, but user expected to see the previous tech's *formatted submission* (the `techNotes` field rendered by dispatcher modal), which the new-visit input fields (`#diagnosis`, `#recommendations`) never populate. Fix: new read-only panel `#workspacePreviousSubmission` + `renderWorkspacePreviousSubmission(ticket)` injected between `#successCard` and the dictation hub `<section>` in `technician/index.html`; collapsible header with **Hide / Show** toggle; styled with cyan-on-obsidian theme to match Phase 27 palette; rendered from `openWorkspace(ticketId)` after `renderWorkspaceFieldEvidence`. Input fields stay empty so a follow-up visit can be entered fresh; addendum CTA still applies on historical (read-only) tickets. `vcDebugOverlay` adds `actT.ic.len` / `actT.tn.len` / `dh.notes.len` lines (kept — useful for future triage). `window.VC_BUILD = "Phase34k-prev-submission-panel-2026-05-02"`. **Lesson:** "previously submitted notes not showing" had two distinct failure modes (dictation hub hydration AND missing read-only display of formatted report) that look identical to a user; both must be addressed. iPhone-visible debug overlay was the unblocker — without `actT.tn.len` / `dh.notes.len` lines, would have continued chasing the wrong bug. Future similar tasks: ship the diagnostic in pass 1, not pass 3. No tenant/Firestore-write changes. |
| 2026-05-02 | Field app + simulator: Recommendations → auto-fill quoteParts/quoteLabor in Parts & Quote Info; labor-missing prompt + accordion open | LOW | T2 | Balanced | 79% | 85% | ok | ok | Cursor: **Sonnet 4.6**; `dictation_hub.js` `SYSTEM_INSTRUCTION_DIAGNOSTICS` + `processVisitNotes` diagnostics branch; `_laborPromptNeeded` flag + `setProcessStatus` |
| 2026-05-02 | Field app + simulator: Combined Findings/diagnosis & Repairs into single hub field + SERVICE report + dictation/improve-ai + invoice parse | LOW | T0–T2 | Fast | ~92% | ~93% | ok | ok | Cursor: **Composer 2**; `technician/index.html` `#diagnosis`/`#repairsMade` hidden placeholder; draft merge legacy `repairsMade`; `dictation_hub.js` + `invoice.js` |
| 2026-05-02 | Field app: #acc-svc-repair collapsed by default (strip initial accordion open) | LOW | T0 | Fast | ~96% | ~97% | ok | ok | Cursor: **Composer 2**; `technician/index.html` `#acc-svc-repair`; simulator uses same shell |
| 2026-05-02 | Field app: Remove smart-select scan row + Equipment Hub blurb under linked equipment | LOW | T0–T1 | Fast | ~91% | ~93% | ok | ok | Cursor: **Composer 2**; `equipment_smart_select.js` drops scan option + change handler; `#acc-status` `<p>` removed; `SCAN_NEW_EQUIPMENT_VALUE` kept for field_forms |
| 2026-05-02 | Field app: Default job status Dispatched (in progress) on inline + hidden selects | LOW | T0 | Fast | ~94% | ~95% | ok | ok | Cursor: **Composer 2**; `selected` on `value="Dispatched"` in `#wsJobStatusInline` + `#finalJobStatus` |
| 2026-05-02 | Field app: Remove Job Status accordion; ticket row nowrap + SR helper scroll to inline status | LOW | T0–T1 | Fast | ~92% | ~93% | ok | ok | Cursor: **Composer 2**; `#acc-status` → linked-equipment-only block; `#finalJobStatus` visually-hidden; sync unchanged |
| 2026-05-02 | Field app: Job status inline beside job pill + revert shadow-tech selector to header | LOW | T2 | Balanced | 78% | 88% | ok | ok | Cursor: **Sonnet 4.6**; `wsJobStatusInline` ↔ `finalJobStatus` bidirectional sync; `vcRelocateShadowTechSelector` always uses `headerShadowTechAnchor`; `openWorkspace()` calls `syncJobStatusInline()` |
| 2026-05-02 | Dispatch tool: shadow viewer simulator — overlay panels + hamburger forms wiring | HIGH | T2 | Strong | 50% | 85% | ok | ok | Cursor: **GPT-5.2**; HIGH — keep as standalone; `technician/index.html` `wireFormsPanel()` |
| 2026-05-02 | Field app: Forms panel / hamburger forms — overlay wiring, sheet style, AI-scan launcher removal *(3 tasks)* | LOW | T1–T2 | Fast/Balanced | ~81% | ~92% | ok | ok | Cursor: **Composer 2** + **Sonnet 4.6**; recurring cluster — do not log each tweak separately |
| 2026-05-02 | Field app: Workspace chrome — hamburger menu, Site Intel/History layout, nav + profile panel, shadow tech beside job pill *(4 tasks)* | LOW–UNCERTAIN | T2 | Balanced | ~76% | ~87% | ok | ok | Cursor: **Composer 2** (selector relocate); **Sonnet 4.6** on prior slices; VC_SHADOW_VIEWER: `vcRelocateShadowTechSelector()` moves `#vcShadowTechSelector` into `#wsShadowTechAnchor` on workspace screen, back to `#headerShadowTechAnchor` on schedule/lite |
| 2026-05-02 | Field app: Small UI removals / copy cleanup — blurbs, labels, accordions, pills *(4 tasks)* | LOW | T0–T1 | Fast | ~93% | ~94% | ok | ok | Cursor: **Composer 2**; highly mechanical; Fast / Composer 2 reliable for this cluster |
| 2026-05-02 | Field app: Dictation hub — SERVICE/Inter-office labels, hint examples, Improve-with-AI scope *(6 tasks)* | LOW | T1–T2 | Fast/Balanced | ~87% | ~88% | ok | ok | Cursor: **Composer 2** (labels/hints = Fast); Balanced for Improve-with-AI scope changes (T2) |
| 2026-05-02 | Field app: Workspace reason-for-call banner under ws-ticket | LOW | T1 | Balanced | 85% | 88% | ok | ok | Cursor: not recorded; VC_BUILD Phase34e-ws-reason-banner |
| 2026-05-02 | Governance: dossier / rules / logging-policy updates *(2 tasks)* | LOW | T1 | Balanced | ~92% | ~93% | ok | ok | Cursor: not recorded; `.cursor/rules` + dossier; no app code |

---

## How to use (agent checklist)

1. Classify the user’s request (scope, risk, ambiguity, domain: dispatcher vs field vs docs vs Firebase). **Search § Task outcome log** for similar past tasks.
2. Find the **minimum tier** in **§ Task archetypes → minimum tier** that fits.
3. Map that tier to **one concrete model name** using **§ Workspace enabled models** first (this repo’s toggled-on list). If missing or stale, fall back to **§ Registry** families.
4. **Before any file or command changes the repo:** output **§6B**, then the **strict §6B1 flow** from `.cursorrules` §6B1 — dossier skim **before** composing §6B, §6C if **HIGH/UNCERTAIN**, then gate parts **(A)(B)(C)** and **stop**. Concrete **Cursor picker name**, not a tier label alone. **No** edits to code, HTML, markdown, or config until the user sends `Model switched — proceed`, `Override: … — proceed`, or `Pre-approved model: … — proceed` (**same message** as the task clears the gate per §6B1 narrow exception). A user “repo protocol” recap **without** one of those lines **does not** clear the gate.  
   - If they’re **already on a stronger** model: *“You can use a cheaper model for this if you want.”*  
   - If they’re **on a weaker** model than the minimum: *“Switch up to **[name]** before we implement — [reason].”*
5. **When substantive, type-worth-remembering work completes:** append **§ Task outcome log** unless § *Skip logging* / *When to log* says otherwise. If the user gave **no** negative signal → **Outcome `ok`**, **Tier fit `ok`**; **Note** includes **`Cursor:`** + exact model. See `.cursorrules` §6H.

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

**Last verified:** 2026-05-02 (Cursor **Settings → Models**).

### Agent rule

- For **§6B** `Recommended model:` and the **§6B1** gate **(A)** paragraph, pick **one** name from **§ Currently enabled** below (exact picker spelling).
- Recommend the **cheapest enabled model that still meets** the task’s minimum tier (see **§ Default “switch to” before work**).
- **Do not** recommend **Premium** as the model — it is a **plan/suite** label in the list, not a replaceable capability pick. Choose **Composer 2**, **Sonnet 4.6**, **Codex 5.3**, **Opus 4.7**, etc.

### Currently enabled

| Picker name | Tier (this workspace) | Notes |
|-------------|----------------------|--------|
| **Composer 2** | Fast | Default for T0–T1 mechanical / tight loops |
| **Sonnet 4.6** | Balanced | Default for T2 daily implementation |
| **GPT-5.2** | Strong | Lighter **Strong** GPT line vs 5.4 / 5.5 |
| **GPT-5.4** | Strong | Mid **Strong** GPT |
| **GPT-5.5** | Strong | Flagship **Strong** GPT |
| **Codex 5.3** | Strong | **Prefer** for code-heavy T3 multi-file work |
| **Opus 4.6** | Strong | Deep reasoning; use if you standardize on this Opus line |
| **Opus 4.7** | Strong | **Prefer** for T3+ / UNCERTAIN / maximum reasoning |
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
| **T3** (implementation / code-heavy) | **Codex 5.3** | GPT-5.5, Opus 4.7, GPT-5.4, GPT-5.2 |
| **T3 Vertex Core** (tenant, Firestore writes, field critical path, Office Override) | **Opus 4.7** | Codex 5.3, GPT-5.5 |
| **T3+ / UNCERTAIN** | **Opus 4.7** | GPT-5.5, Codex 5.3 |

### Currently disabled (optional — not required)

These were **off** at last verification; enable only if you want extra rungs (e.g. **GPT-5.4 Mini/Nano** for lighter GPT): Composer 1.5, Opus 4.5, Gemini 3.1 Pro, GPT-5.4 Mini, GPT-5.4 Nano.

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

- **2026-05-02:** **Strict §6B1 flow** in `.cursorrules` §6B1 (steps 0–4, mandatory **(A)(B)(C)**); `.cursor/rules/model-selection.mdc` aligned; dossier cross-refs updated.
- **2026-05-02:** **North star** reframed — agent notebook, **task-type** logging (not every task), **continuous improvement** / apply learned rows; §6H softened to match.
- **2026-05-02:** **§6§ Preamble** (cross-ref): agent checklist step 4 — **no repo changes** until user sends approved proceed line; concrete picker name required.
- **2026-05-02:** **North star** — cheapest-good tracking in MD; **§ Workspace enabled models**; outcome-log framing; `.cursorrules` §6 + `model-selection.mdc`.
- **2026-05-02:** Initial dossier; **§ Task outcome log** (Conf start/after, tier used, **Tier fit**, outcome, grep-based calibration + retention).
