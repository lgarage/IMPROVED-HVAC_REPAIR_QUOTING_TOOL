/**
 * Post-slice validation — syntax checks, HTML verification, cache-bust checks.
 * Returns { passed: boolean, errors: string[] }.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type { Slice } from "./slices";

const PROJECT_ROOT = path.resolve(__dirname, "..");

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Context captured before the SDK agent runs.
 * Used to detect ghost passes — slices that "passed" validation
 * without the agent actually changing anything.
 */
export interface ValidationContext {
  /** git HEAD hash captured immediately before Agent.prompt was called */
  preRunHeadHash?: string;
}

export function validateSlice(slice: Slice, context?: ValidationContext): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Check 0: Ghost-pass detection ─────────────────────────────────────────
  // Verify the SDK agent actually changed something. Without a pre-run baseline
  // all other checks are string-presence scans against the current file state,
  // meaning a slice can "pass" even if the agent did nothing (expectedIds and
  // expectedExports were already present from a prior pass or unrelated code).
  if (context?.preRunHeadHash) {
    try {
      const currentHash = execSync("git rev-parse HEAD", {
        cwd: PROJECT_ROOT,
        stdio: "pipe",
      }).toString().trim();

      const gitStatus = execSync("git status --porcelain", {
        cwd: PROJECT_ROOT,
        stdio: "pipe",
      }).toString().trim();

      if (currentHash === context.preRunHeadHash) {
        if (!gitStatus) {
          // Definitive ghost pass: HEAD unchanged, working tree clean.
          // The agent ran and did absolutely nothing.
          errors.push(
            `Ghost pass: agent made no changes to the repository ` +
            `(HEAD ${currentHash.slice(0, 7)} unchanged, working tree clean)`
          );
        } else {
          // Agent modified files but did not commit — unusual, flag it.
          const fileCount = gitStatus.split("\n").filter(Boolean).length;
          warnings.push(
            `Agent modified ${fileCount} file(s) but did not commit ` +
            `— the slice instructions require a git commit`
          );
        }
      } else {
        // HEAD changed — agent made at least one commit. Now verify:
        //   a) The files listed in filesToModify actually appear in the diff.
        //   b) The total diff isn't suspiciously tiny (build-stamp-only commits).

        let changedFiles = new Set<string>();
        let totalInsertions = 0;
        let totalDeletions = 0;

        try {
          // --numstat: "<insertions>\t<deletions>\t<filename>" per line
          const numstat = execSync(
            `git diff ${context.preRunHeadHash}..HEAD --numstat`,
            { cwd: PROJECT_ROOT, stdio: "pipe" }
          ).toString().trim();

          for (const line of numstat.split("\n").filter(Boolean)) {
            const parts = line.split("\t");
            if (parts.length >= 3) {
              const ins = parseInt(parts[0], 10);
              const del = parseInt(parts[1], 10);
              const file = parts[2].trim();
              changedFiles.add(file);
              if (!isNaN(ins)) totalInsertions += ins;
              if (!isNaN(del)) totalDeletions += del;
            }
          }
        } catch {
          warnings.push("Could not read git diff for coverage check");
        }

        // a) Files that were declared modified but never touched
        for (const f of slice.filesToModify) {
          if (changedFiles.size > 0 && !changedFiles.has(f)) {
            warnings.push(`File declared in filesToModify was not changed: ${f}`);
          }
        }

        // b) Suspiciously small diff — likely a build-stamp-only commit
        const totalLines = totalInsertions + totalDeletions;
        const nonStatusFiles = [...changedFiles].filter(
          (f) => !f.includes("CURRENT_STATE") && !f.includes("build_state")
        );
        const looksLikeBuildStampOnly =
          nonStatusFiles.length <= 1 &&
          nonStatusFiles.every((f) => f.includes("index.html"));

        if (totalLines > 0 && totalLines < 5 && !looksLikeBuildStampOnly && slice.filesToModify.length > 0) {
          warnings.push(
            `Very small diff (${totalLines} line(s) changed across ${changedFiles.size} file(s)) ` +
            `— verify the full slice scope was applied`
          );
        }
      }
    } catch (e: any) {
      warnings.push(`Ghost-pass check error: ${e.message?.slice(0, 200)}`);
    }
  }

  // 1. Check created files exist
  for (const f of slice.filesToCreate) {
    const full = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(full)) {
      errors.push(`Expected new file not found: ${f}`);
    }
  }

  // 2. Syntax-check all JS files that were created or modified
  const jsFiles = [...slice.filesToCreate, ...slice.filesToModify].filter(
    (f) => f.endsWith(".js")
  );
  for (const f of jsFiles) {
    const full = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(full)) continue;
    try {
      execSync(`node --check "${full}"`, { stdio: "pipe" });
    } catch (e: any) {
      errors.push(`Syntax error in ${f}: ${e.stderr?.toString().trim() || "unknown"}`);
    }
  }

  // 3. Check expected HTML element IDs exist in target HTML file OR in JS files
  //    (elements created dynamically in JS use string literals like id="foo")
  if (slice.expectedIds.length > 0) {
    const htmlPath = path.join(PROJECT_ROOT, slice.htmlTarget || path.join("technician", "index.html"));
    const htmlContent = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf-8") : "";

    const jsContents = [...slice.filesToCreate, ...slice.filesToModify]
      .filter((f) => f.endsWith(".js"))
      .map((f) => {
        const full = path.join(PROJECT_ROOT, f);
        return fs.existsSync(full) ? fs.readFileSync(full, "utf-8") : "";
      })
      .join("\n");

    const allContent = htmlContent + "\n" + jsContents;

    for (const id of slice.expectedIds) {
      if (!allContent.includes(`id="${id}"`) && !allContent.includes(`id='${id}'`)) {
        errors.push(`Expected HTML element #${id} not found in HTML or JS files`);
      }
    }
  }

  // 4. Check script tags wired in at least one HTML file.
  // Some slices touch both dispatcher (index.html) and field-app (technician/index.html) files,
  // so we check both and pass if the script tag appears in either one.
  const bothHtmlPaths = [
    path.join(PROJECT_ROOT, "index.html"),
    path.join(PROJECT_ROOT, "technician", "index.html"),
  ];
  for (const bust of slice.cacheBusts) {
    const fileName = bust.split("?")[0];
    const primaryPath = path.join(PROJECT_ROOT, slice.htmlTarget || path.join("technician", "index.html"));
    const foundInPrimary = fs.existsSync(primaryPath) && fs.readFileSync(primaryPath, "utf-8").includes(fileName);
    const foundInAny = foundInPrimary || bothHtmlPaths.some(
      (p) => fs.existsSync(p) && fs.readFileSync(p, "utf-8").includes(fileName)
    );
    if (!foundInAny) {
      errors.push(`Script tag for ${fileName} not found in index.html or technician/index.html`);
    }
  }

  // 5. Check VC_BUILD was bumped (look for window.VC_BUILD in technician/index.html)
  const htmlPath = path.join(PROJECT_ROOT, "technician", "index.html");
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, "utf-8");
    if (!html.includes("VC_BUILD")) {
      warnings.push("No VC_BUILD stamp found in technician/index.html");
    }
  }

  // 6. Check exported functions exist in created JS files
  for (const [file, fns] of Object.entries(slice.expectedExports)) {
    const full = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf-8");
    for (const fn of fns) {
      const patterns = [
        `${fn}:`,         // IIFE export: functionName: function
        `${fn} =`,        // assignment
        `function ${fn}`, // function declaration
        `"${fn}"`,        // string key in export object
        `'${fn}'`,        // string key
      ];
      const found = patterns.some((p) => content.includes(p));
      if (!found) {
        errors.push(`Expected export '${fn}' not found in ${file}`);
      }
    }
  }

  // 7. Check git status is clean (everything committed).
  //    When a pre-run hash was provided the ghost-pass check (step 0) already
  //    handles the "agent modified but didn't commit" case with a cleaner message.
  //    Still run this check when no context is provided (manual /run calls, etc.)
  if (!context?.preRunHeadHash) {
    try {
      const status = execSync("git status --porcelain", {
        cwd: PROJECT_ROOT,
        stdio: "pipe",
      }).toString().trim();
      if (status) {
        warnings.push(`Uncommitted changes detected:\n${status}`);
      }
    } catch {
      warnings.push("Could not check git status");
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}
