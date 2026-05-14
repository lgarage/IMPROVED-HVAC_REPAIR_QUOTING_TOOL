/**
 * Sandbox Manager — creates isolated copies of repos for safe AI editing.
 *
 * Sandbox lifecycle:
 *   1. Copy repo to /sandboxes/sandbox_<timestamp>/
 *   2. Create working branch
 *   3. Install dependencies
 *   4. Apply AI edits (only inside sandbox)
 *   5. Run tests/build
 *   6. Generate confidence report
 *   7. Wait for user merge approval
 *
 * STUB: Core copy/branch/test wired in Phase D (next conversation).
 * This file defines the interfaces and basic fs operations now.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export interface SandboxConfig {
  sourceRepo: string;
  sandboxRoot: string;
  branchName?: string;
  installDeps?: boolean;
}

export interface Sandbox {
  id: string;
  path: string;
  sourceRepo: string;
  branch: string;
  createdAt: string;
  status: "creating" | "ready" | "running" | "tested" | "merged" | "failed";
  testResults?: TestResults;
}

export interface TestResults {
  buildPassed: boolean;
  testsPassed: boolean;
  consoleErrors: string[];
  screenshotPaths: string[];
  filesChanged: string[];
  confidenceScore: number;
  escalationReason: string;
}

export interface MergePreview {
  sandboxId: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  canMerge: boolean;
  blockReasons: string[];
}

const SANDBOX_DIR_NAME = "sandboxes";

function getSandboxRoot(workbenchDir: string): string {
  return path.join(workbenchDir, SANDBOX_DIR_NAME);
}

export function listSandboxes(workbenchDir: string): Sandbox[] {
  const root = getSandboxRoot(workbenchDir);
  if (!fs.existsSync(root)) return [];

  const sandboxes: Sandbox[] = [];
  try {
    const dirs = fs.readdirSync(root, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory() || !d.name.startsWith("sandbox_")) continue;
      const metaPath = path.join(root, d.name, ".sandbox_meta.json");
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          sandboxes.push(meta);
        } catch { /* corrupt meta */ }
      }
    }
  } catch { /* no sandbox dir */ }

  return sandboxes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createSandbox(config: SandboxConfig): Sandbox {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const id = `sandbox_${ts}`;
  const root = getSandboxRoot(path.dirname(config.sandboxRoot || config.sourceRepo));
  const sandboxPath = path.join(config.sandboxRoot || root, id);

  fs.mkdirSync(sandboxPath, { recursive: true });

  // Copy repo (excluding node_modules, .git objects, sandboxes)
  copyDirSync(config.sourceRepo, sandboxPath, [
    "node_modules", ".git", "sandboxes", "dist", ".next", ".nuxt", "__pycache__",
  ]);

  // Init git in sandbox
  try {
    execSync("git init", { cwd: sandboxPath, stdio: "pipe" });
    execSync("git add -A", { cwd: sandboxPath, stdio: "pipe" });
    execSync('git commit -m "Sandbox baseline"', { cwd: sandboxPath, stdio: "pipe" });
    const branch = config.branchName || `workbench/${ts}`;
    execSync(`git checkout -b "${branch}"`, { cwd: sandboxPath, stdio: "pipe" });
  } catch (e: any) {
    // git init is best-effort
  }

  const sandbox: Sandbox = {
    id,
    path: sandboxPath,
    sourceRepo: config.sourceRepo,
    branch: config.branchName || `workbench/${ts}`,
    createdAt: new Date().toISOString(),
    status: "ready",
  };

  fs.writeFileSync(
    path.join(sandboxPath, ".sandbox_meta.json"),
    JSON.stringify(sandbox, null, 2),
    "utf-8"
  );

  return sandbox;
}

export function getSandboxDiff(sandboxPath: string): string {
  try {
    return execSync("git diff HEAD", { cwd: sandboxPath, stdio: "pipe" }).toString();
  } catch {
    return "(could not generate diff)";
  }
}

export function getMergePreview(sandbox: Sandbox): MergePreview {
  const blockReasons: string[] = [];
  let filesChanged: string[] = [];
  let additions = 0;
  let deletions = 0;

  try {
    const diffStat = execSync("git diff HEAD --stat", { cwd: sandbox.path, stdio: "pipe" }).toString();
    filesChanged = diffStat.split("\n")
      .filter((l) => l.includes("|"))
      .map((l) => l.split("|")[0].trim());

    const numstat = execSync("git diff HEAD --numstat", { cwd: sandbox.path, stdio: "pipe" }).toString();
    for (const line of numstat.split("\n")) {
      const parts = line.split("\t");
      if (parts.length >= 2) {
        additions += parseInt(parts[0]) || 0;
        deletions += parseInt(parts[1]) || 0;
      }
    }
  } catch { /* */ }

  if (sandbox.status !== "tested" && sandbox.status !== "ready") {
    blockReasons.push("Sandbox is not in a testable state");
  }
  if (sandbox.testResults && !sandbox.testResults.buildPassed) {
    blockReasons.push("Build did not pass");
  }
  if (sandbox.testResults && !sandbox.testResults.testsPassed) {
    blockReasons.push("Tests did not pass");
  }
  if (sandbox.testResults && sandbox.testResults.consoleErrors.length > 0) {
    blockReasons.push(`${sandbox.testResults.consoleErrors.length} console error(s)`);
  }
  if (sandbox.testResults && sandbox.testResults.confidenceScore < 70) {
    blockReasons.push(`Confidence score too low: ${sandbox.testResults.confidenceScore}%`);
  }

  return {
    sandboxId: sandbox.id,
    filesChanged,
    additions,
    deletions,
    canMerge: blockReasons.length === 0,
    blockReasons,
  };
}

function copyDirSync(src: string, dest: string, exclude: string[]): void {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".cursorrules" && entry.name !== ".env.example") continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
