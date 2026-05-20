# Vertex Build Runner — Quick Start

## What is this?

An automated build tool that builds the New Field Tech UX in phases using the Cursor SDK. It picks the cheapest AI model for each task, auto-escalates to a stronger model if it fails, validates the output, and deploys previews.

## How to run it

### First time setup (one-time)

1. **Get your API key:**
   - Go to https://cursor.com/dashboard/integrations
   - Generate a key and copy it

2. **Set it permanently (so you never have to paste it again):**
   - Search "Environment Variables" in Windows Start menu
   - Under **User variables**, click **New**
   - Name: `CURSOR_API_KEY`
   - Value: paste your key
   - Click OK
   - Restart Cursor (so it picks up the new variable)

### Every time you want to run it

1. Open a terminal in Cursor: **Ctrl + `** (backtick)
2. Run:
   ```
   cd tools
   npx ts-node build_runner.ts
   ```
3. Type `/` to see all commands

### Commands

| Command | What it does |
|---------|-------------|
| `/` or `/help` | Show all commands |
| `/status` | Show status of all 18 slices |
| `/next` | Build the next pending slice |
| `/all` | Build ALL pending slices (fire and forget) |
| `/run 41a` | Build a specific slice |
| `/plan` | Preview what would run next (no actual build) |
| `/inspect 41a` | See full details for a slice |
| `/preview` | Show all Firebase preview URLs |
| `/errors` | Show what went wrong on failed slices |
| `/log` | Show recent build log |
| `/cost` | Estimate remaining cost |
| `/models` | Show the model cost table |
| `/reset 41a` | Reset a failed slice so it can retry |
| `/reset all` | Reset everything to start over |
| `/push` | Git push review slices you've checked |
| `/stop` | Finish current slice then pause (so you can edit in Cursor safely) |
| `/quit` | Exit |

### If something goes wrong

- **Slice failed?** Type `/errors` to see why, then `/reset 41a` and `/run 41a` to retry.
- **Want to start over?** Type `/reset all`.
- **Want to use Cursor while it's running?** Press **S** on your keyboard — it will finish the current slice then pause. Type `/a` to resume later.
- **Terminal closed?** Just re-run step 2 above. The tool remembers where it left off.
- **API key error?** Make sure `CURSOR_API_KEY` is set. Type `echo %CURSOR_API_KEY%` in terminal to check.

### How model selection works

The tool picks the **cheapest model** that can do each task. If it fails, it tries the next one up:

```
Cheapest for pattern (Mini / Flash / Composer 2) → … → Composer 2.5 → Sonnet 4.6 → Opus 4.6
```

Each slice **starts with the cheapest model** that fits its task pattern (`MODEL_LOOKUP.md`). On failure it steps up the cost ladder. **Composer 2.5 runs before Sonnet/Opus**, never before Mini/Flash.

The tool learns: if a cheap model works, it remembers. If it fails, it bumps up. Over time it gets better at picking the right model.

**`riskLevel: review` slices** never start below **Composer 2.5** (Mini, Flash, GPT-5 Mini, and Composer 2 are blocked).

**Dossier outcome log:** each slice appends a row to `MODEL_DOSSIER.md` marked `*(SDK automated)*`. Those rows are **excluded** from the § Scorecard averages (see `.cursor/hooks/sync-scorecard.js`); fixed 82→90% confidence is calibration metadata only.

### Files in this folder

| File | What it is |
|------|-----------|
| `build_runner.ts` | The main tool (this is what you run) |
| `slices.ts` | All 18 slice definitions (what to build, in what order) |
| `model_selector.ts` | Picks the cheapest model, builds escalation ladder |
| `dossier_logger.ts` | After each slice, appends § Task outcome log row to `MODEL_DOSSIER.md` |
| `validator.ts` | Checks if the build worked (syntax, HTML, exports) |
| `prompt_builder.ts` | Generates the prompt each AI agent receives |
| `package.json` | Dependencies (Cursor SDK, TypeScript) |
| `.build_state.json` | Remembers which slices passed/failed (auto-generated) |
| `build_log.txt` | Full log of everything the tool did (auto-generated) |

### Related files outside this folder

| File | What it is |
|------|-----------|
| `PROJECT_STATUS/NEW_FIELDTECH_UX_PLAN.md` | Full build plan (phases, scope, dependencies) |
| `PROJECT_STATUS/MODEL_LOOKUP.md` | Model-per-task-pattern table (the tool reads + updates this) |
| `PROJECT_STATUS/MODEL_DOSSIER.md` | Live-session calibration log — SDK appends one row per slice pass/fail |
| `PROJECT_STATUS/new_fieldtech_ux.md` | The original spec (moves to ARCHIVE when done) |
