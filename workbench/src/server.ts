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
import { createSandbox, listSandboxes, getMergePreview } from "./engines/sandbox_manager";

const app = express();
const PORT = parseInt(process.env.WORKBENCH_PORT || "4040", 10);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "ui", "public")));

// --- State ---
let currentRepoPath: string = process.argv[2] || process.cwd();
let currentAnalysis: RepoAnalysis | null = null;
let parsedNotes: ParsedNote[] = [];

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

app.post("/api/sandbox/create", (_req, res) => {
  if (!currentAnalysis) return res.status(400).json({ error: "Analyze repo first" });
  try {
    const workbenchDir = path.resolve(__dirname, "..");
    const sandbox = createSandbox({
      sourceRepo: currentRepoPath,
      sandboxRoot: path.join(workbenchDir, "sandboxes"),
    });
    res.json({ ok: true, sandbox });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/sandboxes", (_req, res) => {
  const workbenchDir = path.resolve(__dirname, "..");
  res.json({ sandboxes: listSandboxes(workbenchDir) });
});

app.get("/api/sandbox/:id/merge-preview", (req, res) => {
  const workbenchDir = path.resolve(__dirname, "..");
  const sandboxes = listSandboxes(workbenchDir);
  const sandbox = sandboxes.find((s) => s.id === req.params.id);
  if (!sandbox) return res.status(404).json({ error: "Sandbox not found" });
  res.json(getMergePreview(sandbox));
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
