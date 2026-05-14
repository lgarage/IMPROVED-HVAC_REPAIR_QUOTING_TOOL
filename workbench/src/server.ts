/**
 * Repo Workbench — Lightweight local web server.
 * Binds to 0.0.0.0 for Tailscale/LAN access.
 * Mobile-friendly UI for repo analysis, note parsing, sandbox management.
 */

import express from "express";
import * as path from "path";
import * as os from "os";
import { analyzeRepo, formatAnalysisSummary, type RepoAnalysis } from "./engines/repo_analyzer";
import { parseNotes, formatParsedNote, type ParsedNote } from "./engines/note_parser";
import { generateWorkPath, writeWorkPath, readWorkPath } from "./engines/work_path_generator";
import { createSandbox, listSandboxes, getMergePreview, type Sandbox } from "./engines/sandbox_manager";
import { runSandboxTask, type RunTaskResult } from "./engines/sandbox_runner";
import { runTests } from "./engines/test_runner";
import { type ConfidenceReport } from "./engines/confidence_reporter";
import { executeMerge, getMergePreviewDetailed } from "./engines/merge_manager";

const app = express();
const PORT = parseInt(process.env.WORKBENCH_PORT || "4040", 10);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "ui", "public")));

// --- State ---
let currentRepoPath: string = process.argv[2] || process.cwd();
let currentAnalysis: RepoAnalysis | null = null;
let parsedNotes: ParsedNote[] = [];

// In-memory store for sandbox run results (keyed by sandbox id)
const sandboxResults: Map<string, RunTaskResult> = new Map();
const sandboxStatusLogs: Map<string, string[]> = new Map();
const activeSandboxRuns: Set<string> = new Set();

function getWorkbenchDir(): string {
  return path.resolve(__dirname, "..");
}

function getLookupPath(): string {
  return path.join(getWorkbenchDir(), "data", "MODEL_LOOKUP.md");
}

function findSandbox(id: string): Sandbox | undefined {
  return listSandboxes(getWorkbenchDir()).find((s) => s.id === id);
}

// --- API Routes ---

app.get("/api/status", (_req, res) => {
  res.json({
    repoPath: currentRepoPath,
    analyzed: !!currentAnalysis,
    analysis: currentAnalysis,
    notesCount: parsedNotes.length,
    hasWorkPath: !!readWorkPath(currentRepoPath),
  });
});

app.post("/api/repo", (req, res) => {
  const { repoPath } = req.body;
  if (!repoPath) return res.status(400).json({ error: "repoPath required" });
  currentRepoPath = repoPath;
  currentAnalysis = null;
  parsedNotes = [];
  res.json({ ok: true, repoPath: currentRepoPath });
});

app.post("/api/analyze", (_req, res) => {
  try {
    currentAnalysis = analyzeRepo(currentRepoPath);
    res.json({ ok: true, analysis: currentAnalysis, summary: formatAnalysisSummary(currentAnalysis) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/parse-notes", (req, res) => {
  const { notes } = req.body;
  if (!notes) return res.status(400).json({ error: "notes required" });
  try {
    const parsed = parseNotes(notes);
    parsedNotes.push(parsed);
    res.json({ ok: true, parsed, formatted: formatParsedNote(parsed) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/parsed-notes", (_req, res) => {
  res.json({ notes: parsedNotes });
});

app.delete("/api/parsed-notes", (_req, res) => {
  parsedNotes = [];
  res.json({ ok: true });
});

app.post("/api/generate-work-path", (_req, res) => {
  if (!currentAnalysis) return res.status(400).json({ error: "Run analysis first" });
  if (parsedNotes.length === 0) return res.status(400).json({ error: "Parse at least one note first" });
  try {
    const content = generateWorkPath({
      analysis: currentAnalysis,
      parsedNotes,
      generatedAt: new Date().toISOString(),
    });
    const filePath = writeWorkPath(currentRepoPath, content);
    res.json({ ok: true, filePath, content });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/work-path", (_req, res) => {
  const content = readWorkPath(currentRepoPath);
  res.json({ exists: !!content, content });
});

// --- Sandbox CRUD ---

app.post("/api/sandbox/create", (_req, res) => {
  if (!currentAnalysis) return res.status(400).json({ error: "Analyze repo first" });
  try {
    const sandbox = createSandbox({
      sourceRepo: currentRepoPath,
      sandboxRoot: path.join(getWorkbenchDir(), "sandboxes"),
    });
    res.json({ ok: true, sandbox });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sandboxes", (_req, res) => {
  res.json({ sandboxes: listSandboxes(getWorkbenchDir()) });
});

app.get("/api/sandbox/:id/merge-preview", (req, res) => {
  const sandbox = findSandbox(req.params.id);
  if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });
  try {
    const preview = getMergePreviewDetailed(sandbox);
    res.json(preview);
  } catch (e: any) {
    res.json(getMergePreview(sandbox));
  }
});

// --- Sandbox AI Execution (Phase D) ---

app.post("/api/sandbox/:id/run", (req, res) => {
  const sandbox = findSandbox(req.params.id);
  if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });
  if (!currentAnalysis) return res.status(400).json({ error: "Analyze repo first" });
  if (activeSandboxRuns.has(sandbox.id)) {
    return res.status(409).json({ error: "A task is already running in this sandbox" });
  }

  const statusLog: string[] = [];
  sandboxStatusLogs.set(sandbox.id, statusLog);
  activeSandboxRuns.add(sandbox.id);

  res.json({ ok: true, message: "Task started", sandboxId: sandbox.id });

  runSandboxTask({
    sandbox,
    analysis: currentAnalysis,
    parsedNotes,
    lookupPath: getLookupPath(),
    apiKey: req.body.apiKey || process.env.CURSOR_API_KEY,
    onStatus: (msg) => {
      statusLog.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
    },
  })
    .then((result) => {
      sandboxResults.set(sandbox.id, result);
      activeSandboxRuns.delete(sandbox.id);
      statusLog.push(`[${new Date().toISOString().slice(11, 19)}] Task complete`);
    })
    .catch((err) => {
      sandboxResults.set(sandbox.id, {
        success: false,
        modelUsed: "unknown",
        escalations: [],
        testResults: {
          buildPassed: false,
          testsPassed: false,
          consoleErrors: [err.message],
          screenshotPaths: [],
          filesChanged: [],
          confidenceScore: 0,
          escalationReason: err.message,
        },
        confidenceReport: {
          score: 0,
          grade: "F",
          summary: err.message,
          filesChanged: [],
          bugsAddressed: [],
          bugsRemaining: [],
          testSummary: { buildPassed: false, testsPassed: false, totalErrors: 1 },
          screenshotPaths: [],
          escalationReasoning: err.message,
          remainingConcerns: [err.message],
          verificationChecklist: [],
          generatedAt: new Date().toISOString(),
        },
        error: err.message,
      });
      activeSandboxRuns.delete(sandbox.id);
      statusLog.push(`[${new Date().toISOString().slice(11, 19)}] Task failed: ${err.message}`);
    });
});

app.get("/api/sandbox/:id/status", (req, res) => {
  const id = req.params.id;
  const running = activeSandboxRuns.has(id);
  const logs = sandboxStatusLogs.get(id) || [];
  const result = sandboxResults.get(id) || null;
  res.json({ running, logs, hasResult: !!result });
});

app.get("/api/sandbox/:id/results", (req, res) => {
  const result = sandboxResults.get(req.params.id);
  if (!result) return res.status(404).json({ error: "No results yet" });
  res.json(result);
});

app.post("/api/sandbox/:id/test", (req, res) => {
  const sandbox = findSandbox(req.params.id);
  if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });
  if (!currentAnalysis) return res.status(400).json({ error: "Analyze repo first" });

  runTests({
    sandboxPath: sandbox.path,
    analysis: currentAnalysis,
    onStatus: (msg) => {
      const logs = sandboxStatusLogs.get(sandbox.id) || [];
      logs.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
      sandboxStatusLogs.set(sandbox.id, logs);
    },
  })
    .then((testResult) => {
      res.json({ ok: true, testResult });
    })
    .catch((e) => {
      res.status(500).json({ error: e.message });
    });
});

// --- Merge (Phase E) ---

app.post("/api/sandbox/:id/merge", (req, res) => {
  const sandbox = findSandbox(req.params.id);
  if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });

  if (!req.body.confirmed) {
    return res.status(400).json({
      error: "Merge requires explicit confirmation. Send { confirmed: true } in request body.",
    });
  }

  try {
    const result = executeMerge({ sandbox, confirmed: true });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- SPA fallback ---
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "ui", "public", "index.html"));
});

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push(info.address);
      }
    }
  }

  console.log("");
  console.log("  ┌──────────────────────────────────────────────┐");
  console.log("  │   AI Repo Workbench                          │");
  console.log("  └──────────────────────────────────────────────┘");
  console.log("");
  console.log(`  Local:      http://localhost:${PORT}`);
  if (addresses.length > 0) {
    for (const addr of addresses) {
      console.log(`  Network:    http://${addr}:${PORT}`);
    }
  }
  console.log("");
  console.log(`  Repo:       ${currentRepoPath}`);
  console.log(`  Tailscale:  Access from phone via your Tailscale IP:${PORT}`);
  console.log("");
});
