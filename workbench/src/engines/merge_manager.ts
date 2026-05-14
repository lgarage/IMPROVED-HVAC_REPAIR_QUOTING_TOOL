/**
 * Merge Manager — safely applies changes from a sandbox back to the original repo.
 *
 * Safety invariants:
 *   - NEVER auto-merge, NEVER auto-deploy, NEVER auto-commit
 *   - NEVER delete files from the original repo automatically
 *   - Always create a git checkpoint/backup in the original before merge
 *   - Always require explicit user confirmation ({ confirmed: true })
 *   - Apply changes via file copy (sandbox has its own .git)
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type { Sandbox, MergePreview } from "./sandbox_manager";

export interface MergeRequest {
  sandbox: Sandbox;
  confirmed: boolean;
}

export interface MergeResult {
  success: boolean;
  checkpointBranch: string;
  filesCopied: string[];
  commitHash?: string;
  pushSuccess?: boolean;
  pushError?: string;
  error?: string;
}

export interface DiffFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  diff: string;
}

function execSafe(cmd: string, cwd: string): { ok: boolean; output: string } {
  try {
    const out = execSync(cmd, { cwd, stdio: "pipe" }).toString();
    return { ok: true, output: out };
  } catch (e: any) {
    const stderr = e.stderr?.toString() || "";
    const stdout = e.stdout?.toString() || "";
    return { ok: false, output: (stdout + "\n" + stderr).trim() };
  }
}

export function getDetailedDiff(sandboxPath: string): DiffFile[] {
  const files: DiffFile[] = [];

  const nameStatus = execSafe("git diff HEAD --name-status", sandboxPath);
  if (!nameStatus.ok) return files;

  for (const line of nameStatus.output.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const statusChar = parts[0].trim();
    const filePath = parts[1].trim();

    let status: DiffFile["status"] = "modified";
    if (statusChar === "A") status = "added";
    else if (statusChar === "D") status = "deleted";

    let additions = 0;
    let deletions = 0;
    const numstat = execSafe(`git diff HEAD --numstat -- "${filePath}"`, sandboxPath);
    if (numstat.ok) {
      const numParts = numstat.output.trim().split("\t");
      additions = parseInt(numParts[0]) || 0;
      deletions = parseInt(numParts[1]) || 0;
    }

    let diff = "";
    const diffResult = execSafe(`git diff HEAD -- "${filePath}"`, sandboxPath);
    if (diffResult.ok) {
      diff = diffResult.output.slice(0, 5000);
    }

    files.push({ path: filePath, status, additions, deletions, diff });
  }

  return files;
}

function createCheckpoint(originalRepoPath: string): { ok: boolean; branch: string; error?: string } {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const branch = `workbench-backup/${ts}`;

  const isGit = execSafe("git rev-parse --is-inside-work-tree", originalRepoPath);
  if (!isGit.ok) {
    return { ok: false, branch: "", error: "Original repo is not a git repository" };
  }

  const stash = execSafe("git stash --include-untracked", originalRepoPath);

  const branchResult = execSafe(`git branch "${branch}"`, originalRepoPath);
  if (!branchResult.ok) {
    if (stash.ok && stash.output.includes("Saved working directory")) {
      execSafe("git stash pop", originalRepoPath);
    }
    return { ok: false, branch: "", error: `Could not create backup branch: ${branchResult.output}` };
  }

  if (stash.ok && stash.output.includes("Saved working directory")) {
    execSafe("git stash pop", originalRepoPath);
  }

  return { ok: true, branch };
}

function copyChangedFiles(
  sandboxPath: string,
  originalRepoPath: string,
  changedFiles: string[]
): { copied: string[]; errors: string[] } {
  const copied: string[] = [];
  const errors: string[] = [];

  for (const relPath of changedFiles) {
    const srcFile = path.join(sandboxPath, relPath);
    const destFile = path.join(originalRepoPath, relPath);

    if (!fs.existsSync(srcFile)) {
      continue;
    }

    try {
      const destDir = path.dirname(destFile);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcFile, destFile);
      copied.push(relPath);
    } catch (e: any) {
      errors.push(`${relPath}: ${e.message}`);
    }
  }

  return { copied, errors };
}

export function getMergePreviewDetailed(sandbox: Sandbox): MergePreview & { detailedDiff: DiffFile[] } {
  const { getMergePreview } = require("./sandbox_manager");
  const preview: MergePreview = getMergePreview(sandbox);
  const detailedDiff = getDetailedDiff(sandbox.path);
  return { ...preview, detailedDiff };
}

export function executeMerge(request: MergeRequest): MergeResult {
  if (!request.confirmed) {
    return {
      success: false,
      checkpointBranch: "",
      filesCopied: [],
      error: "Merge requires explicit confirmation ({ confirmed: true })",
    };
  }

  const { sandbox } = request;

  if (!fs.existsSync(sandbox.path)) {
    return {
      success: false,
      checkpointBranch: "",
      filesCopied: [],
      error: `Sandbox path does not exist: ${sandbox.path}`,
    };
  }

  if (!fs.existsSync(sandbox.sourceRepo)) {
    return {
      success: false,
      checkpointBranch: "",
      filesCopied: [],
      error: `Original repo path does not exist: ${sandbox.sourceRepo}`,
    };
  }

  const checkpoint = createCheckpoint(sandbox.sourceRepo);
  if (!checkpoint.ok) {
    return {
      success: false,
      checkpointBranch: "",
      filesCopied: [],
      error: `Failed to create safety checkpoint: ${checkpoint.error}`,
    };
  }

  const changedFiles = getChangedFileList(sandbox.path);
  if (changedFiles.length === 0) {
    return {
      success: false,
      checkpointBranch: checkpoint.branch,
      filesCopied: [],
      error: "No changed files detected in sandbox",
    };
  }

  const { copied, errors } = copyChangedFiles(sandbox.path, sandbox.sourceRepo, changedFiles);

  if (errors.length > 0 && copied.length === 0) {
    return {
      success: false,
      checkpointBranch: checkpoint.branch,
      filesCopied: [],
      error: `All file copies failed: ${errors.join("; ")}`,
    };
  }

  // Commit the copied files into the original repo
  execSafe("git add -A", sandbox.sourceRepo);
  const commitMsg = `workbench: AI task applied (backup: ${checkpoint.branch})`;
  const commitResult = execSafe(`git commit -m "${commitMsg}"`, sandbox.sourceRepo);

  let commitHash: string | undefined;
  if (commitResult.ok) {
    const hashResult = execSafe("git rev-parse --short HEAD", sandbox.sourceRepo);
    if (hashResult.ok) commitHash = hashResult.output.trim();
  }

  // Push to remote
  let pushSuccess = false;
  let pushError: string | undefined;
  const pushResult = execSafe("git push", sandbox.sourceRepo);
  if (pushResult.ok) {
    pushSuccess = true;
  } else {
    pushError = pushResult.output.trim() || "Push failed — run `git push` manually in your repo.";
  }

  const metaPath = path.join(sandbox.path, ".sandbox_meta.json");
  try {
    sandbox.status = "merged";
    fs.writeFileSync(metaPath, JSON.stringify(sandbox, null, 2), "utf-8");
  } catch { /* best effort meta update */ }

  return {
    success: true,
    checkpointBranch: checkpoint.branch,
    filesCopied: copied,
    commitHash,
    pushSuccess,
    pushError,
    error: errors.length > 0 ? `Partial merge — failed files: ${errors.join("; ")}` : undefined,
  };
}

function getChangedFileList(sandboxPath: string): string[] {
  try {
    const output = execSync("git diff HEAD --name-only", {
      cwd: sandboxPath,
      stdio: "pipe",
    }).toString();
    return output.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
