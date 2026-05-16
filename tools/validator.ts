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

export function validateSlice(slice: Slice): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

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

  // 3. Check expected HTML element IDs exist in target HTML file
  if (slice.expectedIds.length > 0) {
    const htmlPath = path.join(PROJECT_ROOT, slice.htmlTarget || path.join("technician", "index.html"));
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, "utf-8");
      for (const id of slice.expectedIds) {
        if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
          errors.push(`Expected HTML element #${id} not found in ${slice.htmlTarget || "technician/index.html"}`);
        }
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

  // 7. Check git status is clean (everything committed)
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

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}
