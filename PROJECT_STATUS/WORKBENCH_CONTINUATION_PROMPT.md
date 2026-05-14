# AI Repo Workbench — Continuation Prompt (Phase D + E)

> **Copy-paste this entire file** as the first message in a new Cursor conversation to continue the workbench build.

---

## Context

You are continuing work on the **AI Repo Workbench** — a standalone portable tool in `workbench/` inside the `PROJECT-DISPATCHER TOOL` repo. This is a completely separate project from the Vertex Build Runner in `tools/` and from the Vertex Core dispatcher/field app.

**DO NOT TOUCH** anything outside `workbench/`. The `tools/` directory is a separate working program.

### What was completed (Phase A + B + C)

The `workbench/` directory already exists with these working files:

```
workbench/
├── bin/repo-workbench.js       # CLI entry point (production)
├── src/
│   ├── server.ts               # Express web server (port 4040, binds 0.0.0.0)
│   ├── cli.ts                  # CLI interface (analyze, parse, generate, sandbox, serve)
│   └── engines/
│       ├── model_selector.ts   # Cheapest-safe-model picker + escalation ladder (generalized from tools/)
│       ├── repo_analyzer.ts    # Framework/structure/command detection for any repo
│       ├── note_parser.ts      # Messy natural-language → structured work items (rule-based)
│       ├── work_path_generator.ts  # AI_WORK_PATH.md builder (combines analysis + parsed notes)
│       └── sandbox_manager.ts  # Sandbox copy/branch/list (creates isolated repo copies)
├── src/ui/public/index.html    # Mobile-friendly SPA (dark theme, tabs: Repo/Notes/WorkPath/Sandbox/Results)
├── src/sandbox/                # Empty — for sandbox-related utilities
├── Dockerfile                  # Docker build (mounts repo at /workspace)
├── .dockerignore
├── .gitignore
├── package.json                # deps: express, @cursor/sdk, typescript, ts-node, @types/*
├── tsconfig.json
└── README.md                   # Full docs: local/Docker/Tailscale/CLI usage + examples
```

**All of the above compiles cleanly** (`npx tsc --noEmit` passes). The server starts on port 4040, the CLI works, the repo analyzer correctly detects frameworks, the note parser extracts bugs/UI/logic/rules, and the AI_WORK_PATH.md generator produces structured output. The `sandbox_manager.ts` creates isolated copies with git init + branch.

### What needs to be built (Phase D + E)

**Phase D — Sandbox System (full implementation)**

1. **`src/engines/sandbox_runner.ts`** (NEW) — Execute AI tasks inside a sandbox:
   - Read AI_WORK_PATH.md from the sandbox
   - Use `@cursor/sdk` Agent.prompt to execute work items
   - Use the escalation ladder from `model_selector.ts` (try cheap model first, escalate on failure)
   - Run only inside the sandbox path (never touch original repo)
   - After edits: run build command, run test command
   - Generate confidence report

2. **`src/engines/test_runner.ts`** (NEW) — Post-edit verification:
   - Run build commands (from repo analysis)
   - Run test commands
   - Launch app if applicable
   - Playwright integration: if `playwright.config.ts` exists, run `npx playwright test`
   - Capture: console errors, page errors, failed requests, screenshots
   - Generate test results object (matches `TestResults` interface in `sandbox_manager.ts`)

3. **`src/engines/confidence_reporter.ts`** (NEW) — Generate confidence report:
   - Files changed (git diff)
   - Bugs addressed (cross-reference with parsed notes)
   - Tests run and results
   - Console errors found
   - Screenshots captured
   - Confidence score (0-100)
   - Escalation reasoning
   - Remaining concerns
   - User verification checklist

4. **Wire into server.ts** — Add API routes:
   - `POST /api/sandbox/:id/run` — Execute AI task in sandbox
   - `GET /api/sandbox/:id/results` — Get test/confidence results
   - `POST /api/sandbox/:id/test` — Re-run tests

5. **Wire into UI** — The Results tab needs:
   - Live status updates during AI task execution
   - Confidence report display
   - Verification checklist with checkboxes
   - Screenshot viewer (if Playwright captured any)

**Phase E — Merge Workflow + Polish**

1. **`src/engines/merge_manager.ts`** (NEW) — Safe merge from sandbox to original:
   - Show exact files changing (diff preview)
   - Create git checkpoint/backup in original repo before merge
   - Apply changes via file copy (not git merge — sandbox has its own .git)
   - NEVER auto-merge, NEVER auto-deploy, NEVER delete files automatically
   - Require explicit user confirmation

2. **Wire merge into server.ts**:
   - `POST /api/sandbox/:id/merge` — Execute merge (after confirmation)
   - Body must include `{ confirmed: true }` or reject

3. **Wire merge into UI** — The Sandbox tab's merge card:
   - Show diff preview before merge
   - Enable merge button only when conditions met (build passes, tests pass, no critical errors, confidence >= 70%)
   - Confirmation dialog before executing

4. **Dockerfile refinement** — Verify Docker build works end-to-end:
   - `docker build -t repo-workbench .`
   - `docker run --rm -it -p 4040:4040 -v "$PWD:/workspace" repo-workbench`

5. **README updates** — Add sections for:
   - Sandbox workflow with screenshots/examples
   - Merge workflow details
   - AI task execution via Cursor SDK
   - Environment variable for CURSOR_API_KEY

### Interfaces to implement against (already defined)

In `sandbox_manager.ts`, these interfaces exist:

```typescript
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
```

The `model_selector.ts` exports:
- `selectModel(lookupPath, taskPatterns)` — returns cheapest safe model
- `buildEscalationLadder(lookupPath, taskPatterns)` — returns [cheap, mid, expensive]
- `updateLookupRow(lookupPath, pattern, model, succeeded)` — learns from results

### Key constraints

- **Standalone:** This is NOT part of Vertex. Do not import from or reference `tools/`, `shared/`, `dispatcher/`, `technician/`, or root-level `.js` files.
- **Lightweight:** Express + vanilla HTML. No React, no framework.
- **Local-first:** Everything runs on the user's machine. No cloud dependencies except optional Cursor SDK.
- **Safe:** Never auto-merge, never auto-deploy, never auto-commit to the original repo.
- **Mobile-friendly:** Large touch targets, responsive layout, works over Tailscale from phone.

### Suggested model for this continuation

**Opus 4.6** — this is still T3/UNCERTAIN scope (new @cursor/sdk integration, sandbox execution, merge safety). Alternative: **Codex 5.3** if the work is purely implementation against the defined interfaces.

---

**Start with Phase D — the sandbox runner + test runner + confidence reporter. Then Phase E — merge workflow. Update the README when done.**
