/**
 * Repo Workbench — Lightweight local web server.
 * Binds to 0.0.0.0 for Tailscale/LAN access.
 * Mobile-friendly UI for repo analysis, note parsing, sandbox management.
 */

import express from "express";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { execFile, spawn, ChildProcess } from "child_process";
import * as net from "net";
import { analyzeRepo, formatAnalysisSummary, type RepoAnalysis } from "./engines/repo_analyzer";
import { parseNotes, formatParsedNote, type ParsedNote } from "./engines/note_parser";
import { generateWorkPath, writeWorkPath, readWorkPath } from "./engines/work_path_generator";
import { createSandbox, listSandboxes, getMergePreview, type Sandbox } from "./engines/sandbox_manager";
import { runSandboxTask, type RunTaskResult } from "./engines/sandbox_runner";
import { runTests } from "./engines/test_runner";
import { type ConfidenceReport } from "./engines/confidence_reporter";
import { executeMerge, getMergePreviewDetailed } from "./engines/merge_manager";

const app = express();
const PORT = parseInt(process.env.WORKBENCH_PORT || "4141", 10);

/** Compiled output is under dist/ only; UI assets stay in src/ui/public */
function uiPublicDir(): string {
  const besideRunner = path.join(__dirname, "ui", "public");
  if (fs.existsSync(path.join(besideRunner, "index.html"))) return besideRunner;
  return path.join(__dirname, "..", "src", "ui", "public");
}

const UI_PUBLIC = uiPublicDir();

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Never cache the HTML shell — ensures mobile always gets fresh UI after updates
app.use(express.static(UI_PUBLIC, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  },
}));

// --- State ---
let currentRepoPath: string = process.argv[2] || process.cwd();
let currentAnalysis: RepoAnalysis | null = null;
let parsedNotes: ParsedNote[] = [];

// In-memory store for sandbox run results (keyed by sandbox id)
const sandboxResults: Map<string, RunTaskResult> = new Map();
const sandboxStatusLogs: Map<string, string[]> = new Map();
const activeSandboxRuns: Set<string> = new Set();

// Sandbox dev-server processes (for live preview)
interface SandboxServer { process: ChildProcess; port: number; }
const sandboxServers: Map<string, SandboxServer> = new Map();

function findFreePort(start = 4100): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(start, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", () => findFreePort(start + 1).then(resolve).catch(reject));
  });
}

process.on("exit", () => {
  for (const [, s] of sandboxServers) {
    try { s.process.kill(); } catch { /* best effort cleanup */ }
  }
});

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
    platform: process.platform,
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

// --- Folder browsing ---

app.post("/api/browse-native", (_req, res) => {
  if (process.platform !== "win32") {
    return res.status(501).json({ error: "Native folder dialog only supported on Windows" });
  }

  const ps = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$d.Description = 'Select repository folder'",
    "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath } else { '' }",
  ].join("; ");

  execFile("powershell.exe", ["-NoProfile", "-Command", ps], { timeout: 120_000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, selectedPath: (stdout || "").trim() });
  });
});

app.get("/api/browse-dirs", (req, res) => {
  const raw = (req.query.path as string) || "";
  const dirPath = raw || (process.platform === "win32" ? "C:\\" : "/");

  try {
    const resolved = path.resolve(dirPath);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const dirs = entries
      .filter((e) => {
        if (!e.isDirectory()) return false;
        if (e.name === "node_modules" || e.name === ".git") return false;
        if (e.name.startsWith("$")) return false; // Windows system dirs
        return true;
      })
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const hasGit = fs.existsSync(path.join(resolved, ".git"));
    res.json({ ok: true, currentPath: resolved, dirs, hasGit });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// --- Active run discovery (for mobile page-load resume) ---

app.get("/api/active-run", (_req, res) => {
  const runningIds = Array.from(activeSandboxRuns);
  if (runningIds.length > 0) {
    const id = runningIds[0];
    const logs = sandboxStatusLogs.get(id) || [];
    return res.json({ running: true, sandboxId: id, logs, hasResult: false });
  }

  // No active run — find the most recently started sandbox that has results or logs
  const sandboxes = listSandboxes(getWorkbenchDir()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  for (const sb of sandboxes) {
    if (sandboxResults.has(sb.id)) {
      return res.json({ running: false, sandboxId: sb.id, logs: sandboxStatusLogs.get(sb.id) || [], hasResult: true });
    }
  }

  res.json({ running: false, sandboxId: null, logs: [], hasResult: false });
});

// --- Sandbox dev-server launcher (for non-static projects) ---

app.post("/api/sandbox/:id/start-server", async (req, res) => {
  const sandbox = findSandbox(req.params.id);
  if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });

  if (sandboxServers.has(sandbox.id)) {
    const s = sandboxServers.get(sandbox.id)!;
    return res.json({ ok: true, port: s.port, alreadyRunning: true });
  }

  let analysis: RepoAnalysis;
  try {
    analysis = analyzeRepo(sandbox.path);
  } catch (e: any) {
    return res.status(500).json({ error: "Could not analyze sandbox: " + e.message });
  }

  if (!analysis.runCommand) {
    return res.status(400).json({ error: "No run command detected for this project type" });
  }

  let port: number;
  try {
    port = await findFreePort(4100);
  } catch (e: any) {
    return res.status(500).json({ error: "Could not find free port: " + e.message });
  }

  const env = {
    ...process.env,
    PORT: String(port),
    WORKBENCH_PORT: String(port),
    SERVER_PORT: String(port),
  };

  // shell:true handles npx/.cmd wrappers on Windows and npm scripts on all platforms
  const child = spawn(analysis.runCommand, [], {
    cwd: sandbox.path,
    env,
    shell: true,
    stdio: "pipe",
  });

  sandboxServers.set(sandbox.id, { process: child, port });
  child.on("exit", () => { sandboxServers.delete(sandbox.id); });
  child.on("error", () => { sandboxServers.delete(sandbox.id); });

  res.json({ ok: true, port, runCommand: analysis.runCommand });
});

app.post("/api/sandbox/:id/stop-server", (req, res) => {
  const s = sandboxServers.get(req.params.id);
  if (!s) return res.json({ ok: true, message: "No server running" });
  try { s.process.kill(); } catch { /* best effort */ }
  sandboxServers.delete(req.params.id);
  res.json({ ok: true });
});

app.get("/api/sandbox/:id/server-status", (req, res) => {
  const s = sandboxServers.get(req.params.id);
  if (!s) return res.json({ running: false });
  res.json({ running: true, port: s.port });
});

// --- Sandbox static file preview ---

app.get("/api/sandbox/:id/entry-point", (req, res) => {
  const sandbox = findSandbox(req.params.id);
  if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });

  const candidates = [
    "index.html",
    "public/index.html",
    "dist/index.html",
    "src/index.html",
    "www/index.html",
    "src/ui/public/index.html", // workbench itself
    "build/index.html",         // Create React App
    "out/index.html",           // Next.js static export
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(sandbox.path, candidate))) {
      return res.json({
        entryPoint: candidate,
        previewUrl: `/sandbox-preview/${sandbox.id}/${candidate}`,
      });
    }
  }
  res.json({ entryPoint: null, previewUrl: null });
});

app.get("/sandbox-preview/:id/*", (req, res) => {
  const sandbox = findSandbox(req.params.id);
  if (!sandbox) return res.status(404).send("Sandbox not found");

  const prefix = `/sandbox-preview/${req.params.id}/`;
  const subPath = req.path.startsWith(prefix) ? req.path.slice(prefix.length) : "index.html";
  const fullPath = path.resolve(sandbox.path, subPath || "index.html");
  const sandboxResolved = path.resolve(sandbox.path);

  if (!fullPath.startsWith(sandboxResolved)) {
    return res.status(403).send("Access denied");
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send(`File not found in sandbox: ${subPath}`);
  }
  res.sendFile(fullPath);
});

// --- SPA fallback ---
app.get("*", (_req, res) => {
  res.sendFile(path.join(UI_PUBLIC, "index.html"));
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
