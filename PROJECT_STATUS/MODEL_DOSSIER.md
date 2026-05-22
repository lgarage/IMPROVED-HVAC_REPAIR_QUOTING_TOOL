# Cursor model dossier

> **North star:** Cheapest model that delivers acceptable quality for the task type, grounded in real logged outcomes. **Tier 1 read:** Skim Pick-a-model → Scorecard; grep Gotchas by domain. **Gate:** run §6B + §6B1 (steps 0–4, parts A/B/C) before any repo change. **Maintain:** after substantive work — append row, refresh `model-scorecard.canvas.tsx` recent rows, and let `.cursor/hooks/sync-scorecard.js` auto-sync the scorecard. Archive when row 11 added (auto via `dossier_logger.ts`).

---

## Pick-a-model

> **Sonnet-default (2026-05-21):** Run sessions on Sonnet 4.6. Sonnet handles single tasks directly, dispatches cheap parallel workers (Mini/Flash/C2.5) for batches, and spawns Opus as a subagent only for T3 Vertex Core / field-critical / UNCERTAIN. See `model-selection.mdc § Sonnet-Default Execution Model`.

| Archetype | Recommended model | Alternates | Hard rules |
|-----------|------------------|------------|------------|
| T0 (exact replace, 1-line) | **GPT-5.4 Mini** | Gemini 3 Flash | — |
| T1 mechanical multi-step | **GPT-5.4 Mini** | Gemini 3 Flash, GPT-5 Mini, Composer 2.5 | — |
| T1 nuanced / traced patch | **Gemini 3 Flash** | Sonnet 4.6, Composer 2.5 | — |
| T2 standard dev | **C2.5** | Sonnet 4.6, Kimi K2.5, Composer 2.5 (low-risk) | Start here for low-risk single-/few-file work |
| T4 read-only / tour | **Gemini 3 Flash** | GPT-5 Mini, Composer 2.5 | — |
| T3 code-heavy multi-file | **Codex 5.3** | GPT-5.5, Opus 4.6 | — |
| T3 Vertex Core (tenant / Firestore writes / field critical / Office Override) | **Opus 4.6** | Codex 5.3 | Never Fast |
| T3+ / UNCERTAIN | **Opus 4.6** | GPT-5.5, Codex 5.3 | Never Fast; Opus 4.7 last resort after 2+ Opus 4.6 fails |

_Opus 4.7 disabled (2026-05-07). Composer 2 demoted to fallback-only (2026-05-15) — CSS reasoning gap. GPT-5.4 Nano demoted (2026-05-17) — overcomplicated + slow._

---

## Scorecard

_Avg Conf after % from all logged rows (active + archive, May 2026). **(n)** = row count. C2.5 excludes SDK-automated rows (fixed 82→90% not real signal). **Auto-synced** by `.cursor/hooks/sync-scorecard.js` on every dossier edit — do not edit cells manually._

| Job shape | GPT-5.4 Mini | Gemini 3 Flash | GPT-5 Mini | Composer 2 | C2.5 | Sonnet 4.6 | Codex 5.3 | Opus 4.6 | Default pick |
|-----------|---|---|---|---|---|---|---|---|---|
| **All logged** | 96% (9) | 95% (10) | — | 91% (7) | 95% (7) | 93% (100) | 87% (4) | 93% (15) | — |
| Field app bugfix | 98% (3) | 95% (4) | — | 89% (3) | 96% (1) | 93% (58) | 86% (3) | 92% (9) | Sonnet |
| Admin / Phase 66 | — | — | — | — | 93% (3) | 93% (5) | — | 95% (1) | Sonnet; Opus for Firestore writes |
| UI / CSS layout | 95% (4) | 93% (2) | — | 91% (3) | — | 91% (13) | 90% (1) | — | Sonnet (rework risk) |
| Firestore / Vertex | — | — | — | — | ⚠️ unproven (0 real) | 90% (4) | — | 93% (2) | Opus first write; never C2.5 |
| Build runner / SDK | — | 96% (1) | — | — | 96% (1) | 96% (10) | — | 95% (3) | Sonnet |
| Governance / triage | 97% (2) | 96% (3) | — | 92% (1) | 96% (2) | 91% (5) | — | — | Gemini or Sonnet |
| Slice authoring | — | — | — | — | — | 94% (5) | — | — | Sonnet |

---

## Gotchas

### Composer / Composer 2
- **Auto-scroll bugs**: Composer 2 treats scroll failures as JS problems — never inspects CSS flex chain. `scrollTop` being a no-op usually means `min-height` (unbounded) not `height`. Escalate to **Sonnet 4.6 minimum**.
- **Server / process ops**: Multi-process, port config, env-var reasoning requires **Sonnet 4.6**. Composer 2 starts the wrong process and doesn't notice.
- **Scope**: Composer 2 for pure exact-replace / version bump / label copy only. Anything requiring code judgment → use Gemini 3 Flash or GPT-5.4 Mini instead.

### Firestore / Vertex
- **Field-app auth precondition**: Never gate `firestore.rules` on `request.auth` until field techs have Firebase Auth identity. Field techs use localStorage roster — zero auth identity. All paths (`live_presence`, `service_calls`, `site_intelligence`, bridge paths) must stay open until anonymous/custom-token auth lands.
- **Rules before UI polish**: Verify `firestore.rules` allows the write before polishing the save UX. Silent "Saving…" spinner = rules blocked the write.
- **`window.*` async functions**: Must be called with `.then()`. Silent `try/catch` around sync `.filter()` on a Promise swallows the error. Check all `window.getXxx = async function` call sites.
- **Build runner re-queue**: Restoring slices from archive needs both an active `SLICES` entry AND a `loadState` guard. Queue repair alone (re-adding to `slices.ts`) is insufficient if `.build_state.json` retains the old status.

### UI / CSS layout
- **`position: sticky` reserves space**: Even transparent, it holds height and the body background fills it. Fix: `position: fixed` + `height: 100dvh` + `padding-top` on message list.
- **`el.style.right = ""`**: Does NOT override a CSS class rule. Use `"auto"` to clear; `""` removes the inline value and lets the class rule take over.
- **Auto-scroll in flex**: `scrollTop = scrollHeight` is a no-op when `min-height` allows the container to grow unbounded. Fix with `height`. Also: `scroll-behavior: smooth` silently drops `scrollTop` on iOS.
- **Visual iteration plateau**: When 2+ passes produce no visible change, switch to **Plan Mode** — read the full CSS for all related selectors together; the bug is systemic.
- **`capture="environment"`**: Forces camera-only on mobile. Omit for the native gallery+camera sheet.

### SDK / Build runner
- **Validator vs. agent**: Repeated slice failures with the same validator error across escalating models = bug is in the validator (e.g. `expectedIds` scanning HTML but not JS). Fix the validator.
- **SDK automated confidence**: Fixed `82%→90%` from `dossier_logger.ts` is not real capability signal. Exclude from scorecard. Build-stamp commits (3–12 line diffs) are not evidence.
- **riskLevel floor**: Fast/T0 models must never run `riskLevel: "review"` slices. Gate the model ladder by `riskLevel`.
- **CLI crash recovery**: Reset in-flight statuses on startup. Never `removeAllListeners` on a shared emitter — remove by handler reference.
- **Ghost passes**: Validator only checks `expectedIds` + `expectedExports`. CSS-only or docs-only slices can "pass" without the actual code changes being applied. Always verify `.build_state.json` against real file diffs after an SDK run.
- **Agents must never run the SDK**: See `.cursor/rules/no-sdk-build-runner.mdc`. The SDK spawns sub-agents that commit without human gates, can ghost-pass, and burn cost on escalation ladders.

### GCP / Firebase
- **Gemini 403**: Valid key + 403 = model restriction, not auth failure. `gemini-2.5-*` require special access — use `gemini-2.0-flash`.
- **Storage ≠ Firestore**: Storage must be enabled in Console separately. Silent `.catch` on `storageRef.put()` = uploads appear to succeed but never persist.
- **Places API**: Use `google.maps.importLibrary("places")` before `Place.searchByText()`. Direct class access fails with unreliable loading.
- **Config cache-bust**: When fixing a Gemini model fallback, always bump the `?v=N` on `firebase-config.js` or mobile keeps the cached old model.

---

## Enabled models

| Picker name | Tier | Status / notes |
|-------------|------|----------------|
| **GPT-5.4 Mini** | Fast | T0 first choice |
| **Gemini 3 Flash** | Fast | T1 alternate — reliable, constraint-following |
| **GPT-5 Mini** | Fast | Experimental T1 alt — build signal before promoting |
| **Composer 2** | Fast | Fallback only: pure exact-replace / version bump |
| **Composer 2.5** | Fast | T1–T2 alternate — proven on traced patches + T4 triage; use after C2.5 for low-risk work, unproven on net-new Firestore |
| **GPT-5.4 Nano** | Fast | **DEMOTED 2026-05-17** — skip; use Mini or Flash |
| **Sonnet 4.6** | Balanced | Default T2 daily implementation |
| **GPT-5.2 / GPT-5.4 / GPT-5.5** | Strong | GPT Strong alternatives; 5.5 = flagship |
| **Codex 5.3** | Strong | Prefer for code-heavy T3 multi-file |
| **Opus 4.6** | Strong | Escalation ceiling — T3+ / UNCERTAIN / Vertex Core; **subagent-only** (spawned by Sonnet when stuck; never the default session model for routine work) |
| **Kimi K2.5** | Experimental | T2 only until ≥2 outcome rows |
| **Opus 4.7** | Last resort | Escalate from Opus 4.6 only after 2+ fails. Never a first choice. |
| ~~Haiku 4.5~~ | Disabled | Removed after dossier rewrite truncation incident. |

---

## Logging reference card

**Log when:** substantive work (multi-file, HIGH risk, new task type, new tier lesson). **Skip:** Q&A, typo fixes, pure dossier-meta turns, no-signal repeats.

**Row:** `Date | Task ≤100 chars | Class | Arch | Tier | Conf start% | Conf after% | Tier fit | Outcome | Model + 1 sentence ≤80 chars`

**OWV rows:** Use format: `OWV: Worker=<name>, V=<pass/fail/escalate>. <≤60 chars>.` `Tier used` = worker's tier. Skip logging T0 first-try passes.

**Defaults when user silent:** Outcome = `ok`, Tier fit = `ok`, Conf after ≥ Conf start.

**Cluster rule:** ≥2 tasks same domain + Arch + risk → collapse to 1 row with `*(N tasks)*`.

**End-of-session writes (NEVER SKIP):** append row → refresh `model-scorecard.canvas.tsx` `RECENT_ROWS` inline → `git add -A && git commit && git push`. (Scorecard table auto-syncs via hook — no manual cell update needed.)

---

## Outcome log (newest first ↓ older rows in MODEL_DOSSIER_ARCHIVE.md)

| Date | Task (short) | Class | Arch | Tier used | Conf start % | Conf after % | Tier fit | Outcome | Note |
|------|----------------|-------|------|-----------|--------------|--------------|----------|---------|------|
| 2026-05-21 | AI Checklist Intent Agent: Gemini-powered checklist suggestion from tech chat | MED | T3 | Strong | 88% | 95% | ok | ok | Cursor: **Opus 4.6**. New agent module + processEntry hook + CSS chip; Vertex Core + Gemini API + field-critical path. |
| 2026-05-21 | Bug batch #29-#35: field modal z-index, context bubble, gantt CSS, compact cards, date filter, invoice AI | LOW-MED | T2 | Balanced | 90% | 94% | ok | ok | Cursor: **Sonnet 4.6**. 7 T2 fixes; CSS+JS across field+dispatcher. Background subagent (GPT-5.4 Mini) handled T0 batch in parallel. |
| 2026-05-21 | Rename fix tracker to Bug Report Tracker; update refs in rules/docs/runner | LOW | T1 | Gemini 3 Flash | 92% | 95% | ok | ok | Cursor: Gemini 3 Flash. Renamed canvas + updated 4 files. |
| 2026-05-21 | 4-issue field bugfix: PWA splash, header bleed, chat overflow, addendum scroll | LOW-MED | T3 | Strong | 88% | 94% | ok | ok | Cursor: **Opus 4.6**. Multi-file; CSS + DOM restructure + PWA manifest. |
| 2026-05-21 | Frontier delegation rule: offload cheap background subtasks in frontier chats | LOW | T1 | GPT-5.4 Mini | 92% | 95% | ok | ok | Cursor: GPT-5.4 Mini. Frontier chats now offload cheap background work. |
| 2026-05-21 | Compile modal X → Schedule double-prompt: nav guard bypass after "Not yet" | LOW | T2 | Strong | 90% | 95% | could_use_smaller | ok | Cursor: **Opus 4.6** (user override). Sonnet would suffice for traced single-line fix. |
| 2026-05-21 | Trust hardening sprint: 15 items, 13 files — alerts to toasts, crash guards, splash, logos | LOW-MED | T3 | Strong | 88% | 94% | ok | ok | Cursor: **Opus 4.6**. Parallel subagents (3); field + dispatcher + branding. |
| 2026-05-20 | KI-004: contextHook outbox callbacks + B6 SW cache — 8 files, 7 call sites, deploy | LOW-MED | T2 | Balanced | 90% | 95% | ok | ok | Cursor: **Sonnet 4.6**. Multi-file feature; hook registry + IDB schema + Firestore patches across 5 modules. |
| 2026-05-20 | Issues-found #22: compile modal schedule btn removed; header/nav-guard z-index cascade fix | LOW | T2 | Balanced | 90% | 94% | ok | ok | Cursor: **Sonnet 4.6**. Field app UI; header→z:10000, nav guard→z:100001, bypass guard when modal visible. |
| 2026-05-20 | Kit System analysis + MVP readiness audit + overnight build plan | LOW | T4 | Strong | 95% | 97% | could_use_smaller | ok | Cursor: **Opus 4.6**. Read-only analysis; Gemini Flash sufficient. |
| 2026-05-20 | Customer Appointment Confirmation: form, save/load, dispatcher+tech badges | LOW-MED | T2 | Strong | 92% | 96% | ok | ok | Cursor: **Opus 4.6**. 3-file feature; form+Firestore+card rendering. |
| 2026-05-20 | SDK post-run verification: 65b+65d real diffs confirmed; canvas+state updated | LOW | T4 | Balanced | 96% | 97% | ok | ok | Cursor: **Sonnet 4.6**. Build runner / SDK archetype; ghost-pass detector worked on 65b. |
| 2026-05-20 | SDK hardening: build-stamp-only error, anti-ghost prompt, 65b/65d reset | LOW | T2 | Balanced | 93% | 97% | ok | ok | Cursor: **Sonnet 4.6**. Build runner / SDK archetype; validator + prompt fix. |
| 2026-05-20 | KNOWN_ISSUES sync cadences doc update for 65e | LOW | T0 | GPT-5.4 Mini | 95% | 97% | ok | ok | Cursor: **GPT-5.4 Mini**. Docs-only table; exact values from slices. |

- Older rows: see MODEL_DOSSIER_ARCHIVE.md (archived up to 2026-05-20).

---

## Changelog

- **2026-05-19 (Sonnet 4.6):** Efficiency overhaul — scorecard rebuilt from all ~180 rows, gotchas extracted by domain, active log capped to 10 rows, `dossier_logger.ts` updated (MAX_ACTIVE_ROWS=10, truncation, `updateScorecardCell`, `JOB_SHAPE_MAP`), `model-scorecard.canvas.tsx` created, `model-selection.mdc` updated with scorecard + canvas writes.
- **2026-05-19 (GPT-5.4 Mini):** Cost-tuning update — C2.5 moved to first choice for low-risk T2 standard dev; north-star now points to hook-based scorecard sync.
- **2026-05-19 (Sonnet 4.6):** C2.5 audit — SDK-automated rows excluded from scorecard; Firestore/Vertex corrected to ⚠️ unproven; voice search row flagged unverified.
- **2026-05-18:** SDK runner cheapest-first ladders; Composer 2.5 T2 promotion; outcome log failures policy; enabled-models expansion (Mini, Flash, GPT-5 Mini, Kimi, C2.5).
