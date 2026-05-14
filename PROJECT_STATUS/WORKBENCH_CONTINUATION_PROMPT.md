# AI Repo Workbench — Continuation Prompt

> **Copy-paste this entire file** as the first message in a new Cursor conversation to continue the workbench build.

---

## Context

You are continuing work on the **AI Repo Workbench** — a standalone portable tool in `workbench/` inside the `PROJECT-DISPATCHER TOOL` repo. This is a completely separate project from the Vertex Build Runner in `tools/` and from the Vertex Core dispatcher/field app.

**DO NOT TOUCH** anything outside `workbench/`. The `tools/` directory is a separate working program. **DO NOT** update any files in `PROJECT_STATUS/` — those are Vertex-owned. The workbench's own docs live in `workbench/README.md`.

### What is built and working

The full end-to-end pipeline is functional and tested. `npx tsc --noEmit` passes clean.

```
workbench/
├── bin/repo-workbench.js          # CLI entry point (production)
├── src/
│   ├── server.ts                  # Express web server (port 4040, env WORKBENCH_PORT)
│   │                              # 14 API routes: status, repo, analyze, parse-notes,
│   │                              # generate-work-path, work-path, sandbox CRUD,
│   │                              # sandbox run/status/results/test, merge,
│   │                              # browse-native, browse-dirs
│   │                              # Status includes `platform` field for OS detection
│   ├── cli.ts                     # CLI interface (analyze, parse, generate, sandbox, serve)
│   └── engines/
│       ├── model_selector.ts      # Cheapest-safe-model picker + escalation ladder
│       ├── repo_analyzer.ts       # Framework/structure/command detection for any repo
│       ├── note_parser.ts         # Messy natural-language → structured work items (rule-based)
│       ├── work_path_generator.ts # AI_WORK_PATH.md builder (combines analysis + parsed notes)
│       ├── sandbox_manager.ts     # Sandbox copy/branch/list + interfaces
│       ├── sandbox_runner.ts      # AI task execution via @cursor/sdk Agent.prompt()
│       │                          # Dry-run mode if no CURSOR_API_KEY
│       ├── test_runner.ts         # Post-edit verification: build, test, Playwright
│       ├── confidence_reporter.ts # Confidence scoring (0-100) + verification checklist
│       └── merge_manager.ts       # Safe merge: git checkpoint → file copy → require confirmation
├── src/ui/public/index.html       # Mobile-friendly SPA — CONVERSATIONAL FLOW (no tabs)
│                                  # Single scrolling page: pick repo → analyze → paste notes →
│                                  # parse → confirm → auto-cascade (work path, sandbox, AI task)
│                                  # → results. Completed steps collapse to one-line summaries.
│                                  # Folder picker: native Windows Explorer + in-browser navigator.
│                                  # Review Changes + Merge to Main as overlay dialogs (not auto).
│                                  # Start Over link in header resets conversation.
├── Dockerfile                     # Docker build (node:20-slim + git, mounts /workspace)
├── .dockerignore
├── .gitignore
├── package.json                   # deps: express, @cursor/sdk, typescript, ts-node, @types/*
├── package-lock.json
├── tsconfig.json
└── README.md                      # Full docs: local/Docker/Tailscale/CLI, API reference
```

### UI architecture (conversational flow — NOT tabs)

The UI was recently rewritten from a 5-tab layout to a **single scrolling conversation**. Do NOT reintroduce tabs.

**Flow (each step appears below the previous, auto-scrolls):**

1. **Pick repo** — path display, "Open Explorer" (native Windows dialog via PowerShell), "Browse Folders" (in-browser navigator modal), collapsible manual path entry. "Analyze Repo" button.
2. **Analysis** — auto-collapses to summary line after analyzing, reveals notes step.
3. **Paste Messy Notes** — textarea, "Parse Notes" button.
4. **Parsed output** — shows parsed notes with "Edit Notes" and "Looks Good — Proceed" buttons.
5. **Auto-cascade** — clicking Proceed fires automatically in sequence with inline status messages:
   - Generate AI work path (checkmark when done)
   - Create sandbox copy (checkmark when done)
   - Run AI task (live log viewer, polls every 2s)
6. **Results** — confidence report (score gauge, files changed, bugs, checklist, escalation, concerns). "Review Changes" and "Merge to Main" buttons at bottom (open overlay dialogs, NOT auto-triggered).

**Completed steps collapse** to a one-line summary (click to expand). **"Start Over"** in the header resets everything.

**Key JS functions:** `revealStep(id)`, `collapseStep(id, summaryText)`, `toggleStep(id)`, `addCascadeMsg(text, cls)`, `proceedFromNotes()` (the cascade), `hideStepsFrom(startId)`, `startOver()`.

### Server routes (14 total)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/status` | GET | Repo path, analysis, notes count, platform |
| `/api/repo` | POST | Set repo path, clear analysis |
| `/api/analyze` | POST | Run repo analysis |
| `/api/parse-notes` | POST | Parse messy notes |
| `/api/parsed-notes` | GET/DELETE | List/clear parsed notes |
| `/api/generate-work-path` | POST | Generate AI_WORK_PATH.md |
| `/api/work-path` | GET | Read existing work path |
| `/api/sandbox/create` | POST | Create sandbox copy |
| `/api/sandboxes` | GET | List all sandboxes |
| `/api/sandbox/:id/run` | POST | Start AI task in sandbox |
| `/api/sandbox/:id/status` | GET | Poll task status + logs |
| `/api/sandbox/:id/results` | GET | Get confidence report |
| `/api/sandbox/:id/test` | POST | Re-run tests |
| `/api/sandbox/:id/merge-preview` | GET | Preview merge diff |
| `/api/sandbox/:id/merge` | POST | Execute merge (requires `confirmed: true`) |
| `/api/browse-native` | POST | Windows folder dialog (PowerShell, 501 on non-Windows) |
| `/api/browse-dirs` | GET | List subdirectories at path (hasGit detection) |

### Server startup

```powershell
cd workbench
$env:CURSOR_API_KEY="<your-key>"
$env:WORKBENCH_PORT="4141"    # optional, default 4040
npx ts-node src/server.ts
```

### Key constraints

- **Standalone:** This is NOT part of Vertex. Do not import from or reference `tools/`, `shared/`, `dispatcher/`, `technician/`, or root-level `.js` files.
- **Vertex docs isolation:** Do NOT update `PROJECT_STATUS/CURRENT_STATE.md`, `ROADMAP.md`, `PROJECT_MAP.md`, or any other Vertex-owned files.
- **Lightweight:** Express + vanilla HTML. No React, no framework.
- **Local-first:** Everything runs on the user's machine. No cloud dependencies except optional Cursor SDK.
- **Safe:** Never auto-merge, never auto-deploy, never auto-commit to the original repo.
- **Mobile-friendly:** Large touch targets, responsive layout, works over Tailscale from phone.
- **PowerShell on Windows:** This workspace uses PowerShell. Do NOT use heredocs (`<<'EOF'`), `&&` chaining, or bash subshells. Use `;` or separate shell calls. Multi-line commits: multiple `-m` flags.

### Known gaps / future work ideas

These are NOT blockers — the tool is functional. Pick any of these if the user asks to continue:

1. **CLI commands for `run` and `merge`** — currently web-only; CLI only supports analyze/parse/generate/sandbox/serve
2. **Screenshot serving** — screenshots are captured to disk but not served via a web route
3. **Playwright install in Docker** — container needs `npx playwright install` if target repo uses Playwright
4. **Sandbox deletion** — no UI button or API route to delete old sandboxes
5. **Multiple sandbox comparison** — can only view one result at a time; no side-by-side
6. **WebSocket for live logs** — currently polling every 2s; WebSocket would be smoother
7. **AI-powered note parsing** — note_parser.ts is rule-based; could add optional Gemini/Cursor SDK refinement
8. **Persistent state** — server state (analysis, parsed notes) is in-memory; lost on restart
9. **Dark/light theme toggle** — currently dark-only
10. **GitHub repo picker** — integrate GitHub API to list user's repos and clone/pull
11. **Recent repos** — save last 3-5 repos for quick-pick on the repo step
12. **Folder browser loading indicator** — tapping a folder has no visual feedback during load
13. **Breadcrumb tap targets** — segments too close together on phone, need more spacing
14. **Log viewer mobile height** — live logs section too small on mobile; increase to ~60% screen
15. **Copy logs to clipboard** — button to copy AI task logs

### Suggested model for continuation

- **UI polish / single-file changes:** Composer 2 or Sonnet 4.6
- **New engine file or multi-file feature:** Codex 5.3
- **New SDK integration or safety-critical logic:** Opus 4.6

---

**The tool is live and tested. Continue from wherever the user directs.**
