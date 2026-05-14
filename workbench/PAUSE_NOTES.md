# AI Repo Workbench — Pause Notes

> **Status as of 2026-05-14:** Development paused to focus on Vertex Core field-readiness (30-day goal). The tool is fully functional at v1.3. Resume when Vertex Core reaches stable field deployment or whenever the workbench becomes useful for a specific consulting engagement.

---

## Why This Exists

The AI Repo Workbench was built as a **portable AI coding assistant** that can be dropped alongside any repo. The core idea: instead of manually explaining a codebase to an AI in chat, the workbench does the grunt work — analyzes the repo structure, parses messy voice/text notes into structured work items, creates an isolated sandbox copy, runs an AI agent against it, scores the result, and presents a merge-gated review flow.

**Strategic value:** This could be sold or licensed as a consulting tool. Small-to-mid shops that can't afford a $50K/yr developer retainer but have a code-savvy contractor could use this to hand off tasks to AI without needing to understand prompting. The "paste your complaint → AI fixes it → human reviews" loop is the whole pitch.

---

## What Is Built and Working (v1.3)

**Full pipeline is functional and tested. `npx tsc --noEmit` passes clean.**

| Component | Status |
|-----------|--------|
| Repo analyzer — detects framework, commands, structure | ✓ Working |
| Note parser — messy text → structured work items (rule-based) | ✓ Working |
| Work path generator — builds `AI_WORK_PATH.md` from analysis + notes | ✓ Working |
| Sandbox manager — isolated git-branched repo copy | ✓ Working |
| AI task runner — `@cursor/sdk` Agent.prompt() + escalation ladder | ✓ Working (dry-run without API key) |
| Test runner — build, test, Playwright verification | ✓ Working |
| Confidence reporter — 0-100 score, graded A–F, checklist | ✓ Working |
| Merge manager — checkpoint branch → file copy → git add/commit/push | ✓ Working |
| Web UI — mobile-friendly conversational flow on port 4141 | ✓ Working |
| Tailscale access — http://172.16.30.216:4141 | ✓ Working |
| Docker image | ✓ Built |

---

## State at Pause

### Last sandbox (2026-05-14)

- **Sandbox:** `sandbox_2026-05-14T17-02-52`
- **Source repo:** `C:\Projects\DISPATCHER TOOL` (the invoice/quoting tool)
- **Task:** Invoice bugs — TRUCK/DISPATCH CHARGE not removable when set to 0; tax toggle; description field layout; multiline Enter key support
- **Files changed:** `index.html`, `invoice.js`
- **Confidence score:** 100 (A)
- **Status:** `tested` — ready to Review Changes and optionally Merge
- **Not yet merged** — the user paused before reviewing this sandbox. It's safe to resume, open the workbench, and click "Review Changes" on this sandbox to pick up exactly where we left off.

### How to resume the workbench server

```powershell
cd "C:\Projects\PROJECT-DISPATCHER TOOL\workbench"
$env:CURSOR_API_KEY="<your-cursor-api-key>"
npx ts-node src/server.ts
# Open http://localhost:4141 or http://172.16.30.216:4141 from phone
```

**Important:** Kill any existing Node processes on 4141 first (Task Manager or `Stop-Process -Name node`). The server must be started with `CURSOR_API_KEY` set or AI task execution falls back to dry-run mode.

---

## Biggest Opportunity Not Yet Built

### OpenRouter backend (free/near-zero AI costs)

The sandbox runner currently calls `@cursor/sdk Agent.prompt()` which bills against Cursor API tokens. Swapping this to [OpenRouter](https://openrouter.ai) would bring per-task AI costs to near zero:

- Single API key, OpenAI-compatible endpoint
- 200+ models including free/cheap open-source (Llama 3.1 8B ~$0.02/M tokens, DeepSeek V3, Mistral 7B)
- The existing `model_selector.ts` escalation ladder maps cleanly to OpenRouter model IDs
- Cursor IDE stays for your own coding; workbench tasks use cheap open-source models
- Set via `OPENROUTER_API_KEY` env var; fall back to Cursor SDK if absent

**This is the change that would make the workbench viable as a consulting tool** — you could run unlimited AI fix tasks on client repos without worrying about token costs.

---

## Known Gaps / Future Work

These are NOT blockers — the tool is fully functional. In priority order for consulting viability:

| # | Gap | Effort | Priority |
|---|-----|--------|----------|
| 1 | **OpenRouter backend** — replace Cursor SDK with open-source models | Medium | HIGH — enables low-cost consulting use |
| 2 | **Sandbox deletion** — no UI or API to delete old sandboxes | Small | Medium — they pile up on disk |
| 3 | **Recent repos** — save last 3–5 repos for quick-pick | Small | Medium — UX |
| 4 | **Persistent state** — analysis + notes lost on server restart | Medium | Medium — annoying for multi-session work |
| 5 | **CLI run/merge** — currently web-only; CLI supports analyze/parse/generate/sandbox/serve | Small | Low |
| 6 | **AI-powered note parsing** — `note_parser.ts` is rule-based; Gemini/OpenRouter refinement | Medium | Low |
| 7 | **WebSocket for live logs** — currently polling every 2s | Small | Low |
| 8 | **Screenshot serving** — screenshots captured to disk but no web route | Tiny | Low |
| 9 | **Multiple sandbox comparison** — no side-by-side | Large | Low |
| 10 | **GitHub repo picker** — clone from GitHub API | Large | Low |
| 11 | **Dark/light theme toggle** | Tiny | Low |
| 12 | **Breadcrumb tap targets** — segments too close on phone | Tiny | Low |
| 13 | **Folder browser loading indicator** | Tiny | Low |
| 14 | **Copy logs to clipboard** button | Tiny | Low |
| 15 | **Playwright in Docker** — needs `npx playwright install` | Small | Low |

---

## Architecture Summary

```
workbench/
├── bin/repo-workbench.js          CLI entry (production)
├── src/
│   ├── server.ts                  Express server — port 4141 (HARDCODED — do not change)
│   ├── cli.ts                     CLI interface
│   └── engines/
│       ├── model_selector.ts      Cheapest-safe-model picker + escalation ladder
│       ├── repo_analyzer.ts       Framework/structure/command detection
│       ├── note_parser.ts         Messy text → structured work items (rule-based)
│       ├── work_path_generator.ts AI_WORK_PATH.md builder
│       ├── sandbox_manager.ts     Sandbox copy + git branch management
│       ├── sandbox_runner.ts      @cursor/sdk Agent.prompt() + escalation
│       ├── test_runner.ts         Build/test/Playwright verification
│       ├── confidence_reporter.ts 0-100 score + A-F grade + checklist
│       └── merge_manager.ts       Checkpoint branch + file copy + git push
├── src/ui/public/index.html       Mobile-first SPA — conversational flow (NOT tabs)
├── sandboxes/                     Isolated repo copies live here
├── Dockerfile
└── README.md
```

**Critical constraints to remember:**
- Port is **hardcoded to 4141** — do not change; bookmarked on PC + phone
- `tsc` does NOT copy `src/ui/public/` to `dist/` — `uiPublicDir()` resolver handles this
- UI is a **single scrolling conversation** — do NOT reintroduce tabs
- This is **completely standalone** — no imports from Vertex, tools/, shared/, etc.
- PowerShell on Windows — no heredocs, no `&&`, use `;`

---

## For Cursor Agents Resuming This

1. Read `WORKBENCH_CONTINUATION_PROMPT.md` in `PROJECT_STATUS/` first — it is the full technical handoff with all route details, UI architecture, and lessons from prior bugs.
2. The workbench has its own git history (separate from Vertex Core commits).
3. Model guidance: UI polish → Sonnet 4.6; new engine file → Codex 5.3; new SDK integration → Opus 4.6.
4. Do NOT touch anything outside `workbench/`. Do NOT update Vertex Core `PROJECT_STATUS/` files from within a workbench session.

---

## Relationship to Vertex Core

The workbench is **completely independent** from Vertex Core. It lives in `workbench/` inside the same repo purely for convenience (shared git, shared Tailscale machine). The two projects share:
- The Windows machine
- Tailscale network access
- The `CURSOR_API_KEY` env var

They do NOT share code, Firestore, Firebase, or any runtime dependencies.

---

*Paused: 2026-05-14. Reason: Vertex Core 30-day field-readiness push.*
