# AI Repo Workbench

A portable, local-first AI workbench that can be dropped into any repo to analyze it, parse messy notes into structured work instructions, create sandboxed environments for safe AI editing, and present confidence/testing results — all from a mobile-friendly web UI accessible via Tailscale.

**This is NOT part of Vertex Core or any production system.** It is a standalone tool.

---

## Quick Start

### Local (development)

```bash
cd workbench
npm install
npx ts-node src/server.ts
# Open http://localhost:4040
```

### Local (built)

```bash
cd workbench
npm install
npm run build
node bin/repo-workbench.js serve
```

### Docker

```bash
cd workbench
docker build -t repo-workbench .
docker run --rm -it -p 4040:4040 -v "C:\Projects\my-repo:/workspace" repo-workbench
```

---

## CLI Usage

```bash
# Analyze any repo
npx ts-node src/cli.ts analyze "C:\Projects\my-repo"

# Parse messy notes
npx ts-node src/cli.ts parse "the button doesn't work and tax calc is wrong"

# Generate AI_WORK_PATH.md (analyze + parse in one shot)
npx ts-node src/cli.ts generate "C:\Projects\my-repo" "fix the login bug"

# Create a sandbox copy
npx ts-node src/cli.ts sandbox "C:\Projects\my-repo"

# Start web UI
npx ts-node src/cli.ts serve 4040
```

---

## Mobile Access via Tailscale

The primary remote-access method is **Tailscale** — no public ports, no internet exposure.

### Setup

1. Install [Tailscale](https://tailscale.com) on your workstation and phone
2. Both devices join the same Tailnet
3. Start the workbench on your workstation:
   ```bash
   cd workbench && npx ts-node src/server.ts
   ```
4. The terminal shows your network IP. On your phone, open:
   ```
   http://<your-tailscale-ip>:4040
   ```

### Expected workflow

1. Your workstation stays powered on (lid closed is fine)
2. From your phone via Tailscale:
   - Paste messy notes
   - Review parsed tasks
   - Create sandbox
   - Run AI tasks
   - Review screenshots/results
   - Approve merge

---

## Web UI Features

| Tab | What it does |
|-----|-------------|
| **Repo** | Set target repo path, run analysis |
| **Notes** | Paste messy notes, see parsed output |
| **Work Path** | Generate/preview AI_WORK_PATH.md |
| **Sandbox** | Create isolated repo copies for safe AI edits |
| **Results** | View confidence reports and verification checklists |

The UI is mobile-first with large touch targets — designed for phone use over Tailscale.

---

## Sandbox Workflow

1. **Analyze** the target repo (detects framework, commands, structure)
2. **Paste notes** describing what needs to change
3. **Generate** AI_WORK_PATH.md (structured instructions)
4. **Create sandbox** (isolated repo copy with its own git branch)
5. **Run AI task** inside the sandbox (edits only affect the copy)
6. **Review results** (build output, test results, confidence score)
7. **Merge** sandbox changes into the real repo (manual approval required)

### Safety rules

- AI edits ONLY happen inside the sandbox
- Original repo is NEVER modified automatically
- Merge requires explicit user approval
- No auto-commit, no auto-deploy, no auto-delete

---

## Merge Workflow

The "Merge Sandbox Into Main" button only enables when:
- Build passes
- Tests pass
- No critical console errors
- Confidence threshold met
- User reviewed checklist

Before merge, the UI shows exact files changing and requires confirmation.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKBENCH_PORT` | `4040` | Web UI port |
| `CURSOR_API_KEY` | — | Required for AI task execution via Cursor SDK |

---

## AI Task Execution via Cursor SDK

The workbench uses `@cursor/sdk` to run AI agents inside sandboxes.

### How it works

1. The sandbox runner reads `AI_WORK_PATH.md` from the sandbox
2. It builds an **escalation ladder** from the model lookup table (cheapest → mid → expensive)
3. Tries the cheapest model first via `Agent.prompt()`
4. If the model fails, escalates to the next tier automatically
5. After AI edits: runs build, tests, and optional Playwright checks
6. Generates a confidence report with score, checklist, and concerns

### API Key setup

```bash
export CURSOR_API_KEY="cursor_..."
```

Get your key from [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents). Without an API key, the runner operates in dry-run mode (no AI edits, but tests and reporting still work).

### Dry-run mode

If no `CURSOR_API_KEY` is set, the sandbox runner skips AI execution but still runs the full test + confidence pipeline. Useful for testing the workbench itself.

---

## Sandbox Execution API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sandbox/create` | POST | Create isolated sandbox copy |
| `/api/sandbox/:id/run` | POST | Start AI task (async, returns immediately) |
| `/api/sandbox/:id/status` | GET | Poll running status + logs |
| `/api/sandbox/:id/results` | GET | Get test results + confidence report |
| `/api/sandbox/:id/test` | POST | Re-run tests only |
| `/api/sandbox/:id/merge-preview` | GET | Diff preview before merge |
| `/api/sandbox/:id/merge` | POST | Execute merge (requires `{ confirmed: true }`) |

---

## Confidence Scoring

The confidence report scores AI work on a 0–100 scale:

| Points | Criterion |
|--------|-----------|
| +30 | Build passed |
| +25 | Tests passed |
| +15 | No console errors |
| +10 | Bugs addressed match parsed notes |
| +10 | Files changed match expected scope |
| +10 | No escalation needed |
| -5 | Per escalation step |
| -10 | Per unaddressed bug |
| -5 | Per console error (max -20) |

**Grades:** A (90+), B (80+), C (70+), D (50+), F (<50)

Merge is only enabled when score >= 70% and build passes.

---

## Project Structure

```
workbench/
├── bin/repo-workbench.js          CLI entry point (production)
├── src/
│   ├── server.ts                  Express web server (port 4040)
│   ├── cli.ts                     CLI interface
│   └── engines/
│       ├── model_selector.ts      Cheapest-safe-model picker + escalation ladder
│       ├── repo_analyzer.ts       Framework/structure detection
│       ├── note_parser.ts         Messy note → structured work items
│       ├── work_path_generator.ts AI_WORK_PATH.md builder
│       ├── sandbox_manager.ts     Isolated repo copy + git branch
│       ├── sandbox_runner.ts      AI task execution via @cursor/sdk
│       ├── test_runner.ts         Post-edit build/test/Playwright verification
│       ├── confidence_reporter.ts Confidence scoring + verification checklist
│       └── merge_manager.ts       Safe merge with checkpoint + file copy
├── src/ui/public/index.html       Mobile-friendly SPA
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Example: Messy Notes → Parsed Output

**Input:**
> I'm trying the quoting tool again but I still cannot remove the TRUCK/DISPATCH CHARGE when set to 0. Also the multiline descriptions are cutting off after the first line. The tax should only show when it is greater than zero. invoice.js needs fixing.

**Parsed output:**
- **Primary Goal:** Remove TRUCK/DISPATCH CHARGE when set to 0
- **Bugs:** Cannot remove charge when set to 0
- **UI Requests:** Tax visibility, multiline description cutoff
- **Business Logic:** Charge removal logic, tax display threshold
- **Risks:** Business-critical financial logic involved
- **Likely Files:** `invoice.js`
- **Confidence:** 90%
