# Cursor model dossier

> **North star:** Cheapest model that delivers acceptable quality for the task type, grounded in real logged outcomes. **Tier 1 read:** Skim Pick-a-model → Scorecard; grep Gotchas by domain. **Gate:** run §6B + §6B1 (steps 0–4, parts A/B/C) before any repo change. **Maintain:** after substantive work — append row, refresh `model-scorecard.canvas.tsx` recent rows, and let `.cursor/hooks/sync-scorecard.js` auto-sync the scorecard. Archive when row 11 added (auto via `dossier_logger.ts`).

---

## Pick-a-model

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
| **Opus 4.6** | Strong | Current ceiling — T3+ / UNCERTAIN / Vertex Core |
| **Kimi K2.5** | Experimental | T2 only until ≥2 outcome rows |
| **Opus 4.7** | Last resort | Escalate from Opus 4.6 only after 2+ fails. Never a first choice. |
| ~~Haiku 4.5~~ | Disabled | Removed after dossier rewrite truncation incident. |

---

## Logging reference card

**Log when:** substantive work (multi-file, HIGH risk, new task type, new tier lesson). **Skip:** Q&A, typo fixes, pure dossier-meta turns, no-signal repeats.

**Row:** `Date | Task ≤100 chars | Class | Arch | Tier | Conf start% | Conf after% | Tier fit | Outcome | Model + 1 sentence ≤80 chars`

**Defaults when user silent:** Outcome = `ok`, Tier fit = `ok`, Conf after ≥ Conf start.

**Cluster rule:** ≥2 tasks same domain + Arch + risk → collapse to 1 row with `*(N tasks)*`.

**End-of-session writes (NEVER SKIP):** append row → refresh `model-scorecard.canvas.tsx` `RECENT_ROWS` inline → `git add -A && git commit && git push`. (Scorecard table auto-syncs via hook — no manual cell update needed.)

---

## Outcome log (newest first ↓ older rows in MODEL_DOSSIER_ARCHIVE.md)

| Date | Task (short) | Class | Arch | Tier used | Conf start % | Conf after % | Tier fit | Outcome | Note |
|------|----------------|-------|------|-----------|--------------|--------------|----------|---------|------|
| 2026-05-20 | KNOWN_ISSUES sync cadences doc update for 65e | LOW | T0 | GPT-5.4 Mini | 95% | 97% | ok | ok | Cursor: **GPT-5.4 Mini**. Docs-only table; exact values from slices. |
| 2026-05-20 | SDK ghost-pass fix: pre-run HEAD hash in validator + /verify command | LOW | T2 | Balanced | 92% | 96% | ok | ok | Cursor: **Sonnet 4.6**. Build runner / SDK archetype; hard-fail on no-change agent runs. |
| 2026-05-19 | SDK cleanup: reset 3 ghost passes, aligned model_selector + MODEL_LOOKUP, no-SDK rule | LOW-MED | T2 | Strong | 90% | 95% | could_use_smaller | ok | Cursor: **Opus 4.6** (user-escalated). Governance + tooling — Sonnet sufficient. |
| 2026-05-19 | Field app: issues-found #13 composer overlap — syncComposerClearance() | LOW | T2 | Balanced | 88% | 93% | ok | ok | Cursor: **Sonnet 4.6**. Dynamic dock measurement eliminates device variance. |
| 2026-05-19 | Dossier efficiency overhaul: scorecard rebuilt, gotchas extracted, 10-row cap. | LOW | T2 | Balanced | 88% | 95% | ok | ok | Sonnet 4.6. Full restructure; scorecard aggregated from ~180 rows. |
| 2026-05-19 | KI-007 screen glitch: `closeCompileModal` missing from `onWorkspaceClose`. | LOW | T2 | Balanced | 86% | 94% | ok | ok | Sonnet 4.6. Modal leaked onto schedule; gen-id cancel guard. |
| 2026-05-19 | compile-notes-first bug: `saveCompileCache` on compile + `submitted` flag. | LOW | T2 | Balanced | 88% | 93% | ok | ok | Sonnet 4.6. Cache-on-compile pattern — survives ticket switch. |
| 2026-05-19 | KI-006 past-day job UX: historical tap → compile modal → addendum. | LOW | T2 | Balanced | 88% | 94% | ok | ok | Sonnet 4.6. Tracker #5 closed; user device verify open. |
| 2026-05-19 | Governance: issues-found reconciliation — 7 closed, 4 pending. | LOW | T4 | Fast | 90% | 96% | ok | ok | Gemini 3 Flash. Status audit across Slack/git/build_state; no app code. |
| 2026-05-19 | SDK slice 64d — Vendor directory: Firestore CRUD UI. *(SDK automated)* | HIGH | T2-T3 | Fast | 82% | 90% | ok | ok | Composer 2.5 (SDK). Ladder: c2.5 → codex → sonnet → kimi. |

- Older rows: see MODEL_DOSSIER_ARCHIVE.md (archived up to 2026-05-20).

---

## Changelog

- **2026-05-19 (Sonnet 4.6):** Efficiency overhaul — scorecard rebuilt from all ~180 rows, gotchas extracted by domain, active log capped to 10 rows, `dossier_logger.ts` updated (MAX_ACTIVE_ROWS=10, truncation, `updateScorecardCell`, `JOB_SHAPE_MAP`), `model-scorecard.canvas.tsx` created, `model-selection.mdc` updated with scorecard + canvas writes.
- **2026-05-19 (GPT-5.4 Mini):** Cost-tuning update — C2.5 moved to first choice for low-risk T2 standard dev; north-star now points to hook-based scorecard sync.
- **2026-05-19 (Sonnet 4.6):** C2.5 audit — SDK-automated rows excluded from scorecard; Firestore/Vertex corrected to ⚠️ unproven; voice search row flagged unverified.
- **2026-05-18:** SDK runner cheapest-first ladders; Composer 2.5 T2 promotion; outcome log failures policy; enabled-models expansion (Mini, Flash, GPT-5 Mini, Kimi, C2.5).
