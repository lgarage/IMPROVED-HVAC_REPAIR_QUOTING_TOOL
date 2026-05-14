# AI Repo Workbench — Continuation Prompt (Post Phase D+E)

> **Copy-paste this entire file** as the first message in a new Cursor conversation to continue the workbench build.

---

## Context

You are continuing work on the **AI Repo Workbench** — a standalone portable tool in `workbench/` inside the `PROJECT-DISPATCHER TOOL` repo. This is a completely separate project from the Vertex Build Runner in `tools/` and from the Vertex Core dispatcher/field app.

**DO NOT TOUCH** anything outside `workbench/`. The `tools/` directory is a separate working program. **DO NOT** update any files in `PROJECT_STATUS/` — those are Vertex-owned. The workbench's own docs live in `workbench/README.md`.

### What is built and working (Phases A–E complete)

The full end-to-end pipeline is functional and tested. `npx tsc --noEmit` passes clean.

```
workbench/
├── bin/repo-workbench.js          # CLI entry point (production)
├── src/
│   ├── server.ts                  # Express web server (port 4040, env WORKBENCH_PORT)
│   │                              # 12 API routes: status, repo, analyze, parse-notes,
│   │                              # generate-work-path, work-path, sandbox CRUD,
│   │                              # sandbox run/status/results/test, merge
│   ├── cli.ts                     # CLI interface (analyze, parse, generate, sandbox, serve)
│   └── engines/
│       ├── model_selector.ts      # Cheapest-safe-model picker + escalation ladder
│       │                          # Exports: selectModel(), buildEscalationLadder(), updateLookupRow()
│       ├── repo_analyzer.ts       # Framework/structure/command detection for any repo
│       │                          # Exports: analyzeRepo(), formatAnalysisSummary(), RepoAnalysis
│       ├── note_parser.ts         # Messy natural-language → structured work items (rule-based)
│       │                          # Exports: parseNotes(), formatParsedNote(), ParsedNote
│       ├── work_path_generator.ts # AI_WORK_PATH.md builder (combines analysis + parsed notes)
│       │                          # Exports: generateWorkPath(), writeWorkPath(), readWorkPath()
│       ├── sandbox_manager.ts     # Sandbox copy/branch/list + interfaces
│       │                          # Exports: createSandbox(), listSandboxes(), getMergePreview()
│       │                          # Interfaces: Sandbox, TestResults, MergePreview, SandboxConfig
│       ├── sandbox_runner.ts      # AI task execution via @cursor/sdk Agent.prompt()
│       │                          # Uses escalation ladder: try cheapest model, escalate on failure
│       │                          # Dry-run mode if no CURSOR_API_KEY
│       │                          # Exports: runSandboxTask(), RunTaskOptions, RunTaskResult
│       ├── test_runner.ts         # Post-edit verification: build, test, Playwright
│       │                          # Exports: runTests(), TestRunOptions, TestRunResult
│       ├── confidence_reporter.ts # Confidence scoring (0-100) + verification checklist
│       │                          # Exports: generateConfidenceReport(), ConfidenceReport, ChecklistItem
│       └── merge_manager.ts       # Safe merge: git checkpoint → file copy → require confirmation
│                                  # NEVER auto-merge, NEVER auto-deploy
│                                  # Exports: executeMerge(), getDetailedDiff(), getMergePreviewDetailed()
├── src/ui/public/index.html       # Mobile-friendly SPA (dark theme, 5 tabs)
│                                  # Tabs: Repo, Notes, Work Path, Sandbox, Results
│                                  # Features: live AI task logs, score gauge, diff viewer,
│                                  # screenshot grid, verification checklist, Review Changes dialog,
│                                  # Merge to Main confirmation dialog (red warning + backup branch)
├── Dockerfile                     # Docker build (node:20-slim + git, mounts /workspace)
├── .dockerignore
├── .gitignore
├── package.json                   # deps: express, @cursor/sdk, typescript, ts-node, @types/*
├── package-lock.json
├── tsconfig.json
└── README.md                      # Full docs: local/Docker/Tailscale/CLI, API reference,
                                   # confidence scoring rubric, project structure
```

### What was verified in live testing (2026-05-14)

1. **Repo analysis** — pointed at `workbench/` itself, correctly detected Express, npm, build/test commands, 18 files
2. **Note parsing** — pasted messy notes, extracted UI requests + primary goal, 70% confidence
3. **Work path generation** — created AI_WORK_PATH.md with project snapshot, parsed items, verification plan
4. **Sandbox creation** — isolated copy created with git init + branch, status "ready"
5. **AI task execution** — `composer-2` (cheapest model) succeeded, no escalation, edited README.md + index.html
6. **Confidence report** — 90% score, Grade A, 2 files changed, 90 insertions
7. **Review Changes dialog** — shows diff with expandable file sections + sandbox path
8. **Merge to Main** — separate button with red warning, requires explicit confirmation

### Server startup

```powershell
cd workbench
$env:CURSOR_API_KEY="<your-key>"
$env:WORKBENCH_PORT="4141"    # optional, default 4040
npx ts-node src/server.ts
```

Can run simultaneously with the Vertex Build Runner (different ports).

### Key interfaces (already defined and stable)

```typescript
// sandbox_manager.ts
interface TestResults {
  buildPassed: boolean;
  testsPassed: boolean;
  consoleErrors: string[];
  screenshotPaths: string[];
  filesChanged: string[];
  confidenceScore: number;
  escalationReason: string;
}

interface MergePreview {
  sandboxId: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  canMerge: boolean;
  blockReasons: string[];
}

// confidence_reporter.ts
interface ConfidenceReport {
  score: number;
  grade: string;
  summary: string;
  filesChanged: string[];
  bugsAddressed: string[];
  bugsRemaining: string[];
  testSummary: { buildPassed: boolean; testsPassed: boolean; totalErrors: number };
  screenshotPaths: string[];
  escalationReasoning: string;
  remainingConcerns: string[];
  verificationChecklist: ChecklistItem[];
  generatedAt: string;
}

// sandbox_runner.ts
interface RunTaskResult {
  success: boolean;
  modelUsed: string;
  escalations: string[];
  testResults: TestResults;
  confidenceReport: ConfidenceReport;
  error?: string;
}
```

### Key constraints

- **Standalone:** This is NOT part of Vertex. Do not import from or reference `tools/`, `shared/`, `dispatcher/`, `technician/`, or root-level `.js` files.
- **Vertex docs isolation:** Do NOT update `PROJECT_STATUS/CURRENT_STATE.md`, `ROADMAP.md`, `PROJECT_MAP.md`, or any other Vertex-owned files. The workbench docs are `workbench/README.md` only.
- **Lightweight:** Express + vanilla HTML. No React, no framework.
- **Local-first:** Everything runs on the user's machine. No cloud dependencies except optional Cursor SDK.
- **Safe:** Never auto-merge, never auto-deploy, never auto-commit to the original repo.
- **Mobile-friendly:** Large touch targets, responsive layout, works over Tailscale from phone.

### Known gaps / future work ideas

These are NOT blockers — the tool is functional. Pick any of these if the user asks to continue:

1. **CLI commands for `run` and `merge`** — currently web-only; CLI only supports analyze/parse/generate/sandbox/serve
2. **Screenshot serving** — screenshots are captured to disk but not served via a web route; need a `/screenshots/*` static route
3. **Playwright install in Docker** — container needs `npx playwright install` if target repo uses Playwright
4. **Sandbox deletion** — no UI button or API route to delete old sandboxes
5. **Multiple sandbox comparison** — can only view one result at a time; no side-by-side
6. **WebSocket for live logs** — currently polling every 2s; WebSocket would be smoother
7. **AI-powered note parsing** — note_parser.ts is rule-based; could add optional Gemini/Cursor SDK refinement
8. **Persistent state** — server state (analysis, parsed notes) is in-memory; lost on restart
9. **Dark/light theme toggle** — currently dark-only
10. **Mobile repo switching** — no way to change the target repo from the phone UI; need a repo selector in the web interface
11. **GitHub repo picker** — integrate GitHub API (via `gh` CLI or octokit) to list user's repos and clone/pull one to work on; would pair with #10

### Suggested model for continuation

- **UI polish / single-file changes:** Composer 2 or Sonnet 4.6
- **New engine file or multi-file feature:** Codex 5.3
- **New SDK integration or safety-critical logic:** Opus 4.6

---

**The tool is live and tested. Continue from wherever the user directs.**
