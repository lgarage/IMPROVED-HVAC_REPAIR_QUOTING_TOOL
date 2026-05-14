/**
 * Test Runner — post-edit verification inside a sandbox.
 *
 * Runs build commands, test commands, and optional Playwright tests.
 * Captures console errors, changed files, and screenshots.
 * Returns a structured result the confidence reporter can consume.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type { RepoAnalysis } from "./repo_analyzer";

export interface TestRunOptions {
  sandboxPath: string;
  analysis: RepoAnalysis;
  onStatus?: (msg: string) => void;
}

export interface TestRunResult {
  buildPassed: boolean;
  buildOutput: string;
  testsPassed: boolean;
  testOutput: string;
  playwrightRan: boolean;
  playwrightPassed: boolean;
  playwrightOutput: string;
  consoleErrors: string[];
  screenshotPaths: string[];
  filesChanged: string[];
}

function execSafe(cmd: string, cwd: string, timeoutMs = 120_000): { ok: boolean; output: string } {
  try {
    const out = execSync(cmd, {
      cwd,
      stdio: "pipe",
      timeout: timeoutMs,
      env: { ...process.env, CI: "true", NODE_ENV: "test" },
    }).toString();
    return { ok: true, output: out };
  } catch (e: any) {
    const stderr = e.stderr?.toString() || "";
    const stdout = e.stdout?.toString() || "";
    return { ok: false, output: (stdout + "\n" + stderr).trim() };
  }
}

function getChangedFiles(sandboxPath: string): string[] {
  try {
    const diffOutput = execSync("git diff HEAD --name-only", {
      cwd: sandboxPath,
      stdio: "pipe",
    }).toString();
    return diffOutput.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function extractErrors(output: string): string[] {
  const errors: string[] = [];
  const lines = output.split("\n");
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.includes("error") ||
      lower.includes("failed") ||
      lower.includes("exception") ||
      lower.includes("referenceerror") ||
      lower.includes("typeerror") ||
      lower.includes("syntaxerror")
    ) {
      const trimmed = line.trim();
      if (trimmed.length > 5 && trimmed.length < 500) {
        errors.push(trimmed);
      }
    }
  }
  return [...new Set(errors)].slice(0, 50);
}

function findScreenshots(sandboxPath: string): string[] {
  const locations = [
    "test-results",
    "playwright-report",
    "screenshots",
    "e2e/screenshots",
    "tests/screenshots",
  ];
  const shots: string[] = [];

  for (const loc of locations) {
    const dir = path.join(sandboxPath, loc);
    if (!fs.existsSync(dir)) continue;
    try {
      collectImages(dir, shots, 0, 3);
    } catch { /* permission etc */ }
  }
  return shots;
}

function collectImages(dir: string, out: string[], depth: number, maxDepth: number): void {
  if (depth > maxDepth) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      collectImages(full, out, depth + 1, maxDepth);
    } else if (/\.(png|jpg|jpeg|webp|gif)$/i.test(e.name)) {
      out.push(full);
    }
  }
}

export async function runTests(opts: TestRunOptions): Promise<TestRunResult> {
  const { sandboxPath, analysis, onStatus } = opts;
  const status = onStatus || (() => {});

  const result: TestRunResult = {
    buildPassed: true,
    buildOutput: "",
    testsPassed: true,
    testOutput: "",
    playwrightRan: false,
    playwrightPassed: false,
    playwrightOutput: "",
    consoleErrors: [],
    screenshotPaths: [],
    filesChanged: getChangedFiles(sandboxPath),
  };

  // 1. Run build
  if (analysis.buildCommand && analysis.buildCommand !== "(not detected)") {
    status(`Running build: ${analysis.buildCommand}`);
    const build = execSafe(analysis.buildCommand, sandboxPath);
    result.buildPassed = build.ok;
    result.buildOutput = build.output;
    if (!build.ok) {
      result.consoleErrors.push(...extractErrors(build.output));
      status("Build failed");
    } else {
      status("Build passed");
    }
  } else {
    status("No build command detected — skipping");
  }

  // 2. Run tests
  if (analysis.testCommand && analysis.testCommand !== "(not detected)") {
    status(`Running tests: ${analysis.testCommand}`);
    const test = execSafe(analysis.testCommand, sandboxPath, 180_000);
    result.testsPassed = test.ok;
    result.testOutput = test.output;
    if (!test.ok) {
      result.consoleErrors.push(...extractErrors(test.output));
      status("Tests failed");
    } else {
      status("Tests passed");
    }
  } else {
    status("No test command detected — skipping (marking as passed)");
  }

  // 3. Playwright (optional)
  const pwConfig =
    fs.existsSync(path.join(sandboxPath, "playwright.config.ts")) ||
    fs.existsSync(path.join(sandboxPath, "playwright.config.js"));

  if (pwConfig) {
    status("Playwright config detected — running Playwright tests");
    result.playwrightRan = true;
    const pw = execSafe("npx playwright test --reporter=list", sandboxPath, 300_000);
    result.playwrightPassed = pw.ok;
    result.playwrightOutput = pw.output;
    if (!pw.ok) {
      result.consoleErrors.push(...extractErrors(pw.output));
      status("Playwright tests failed");
    } else {
      status("Playwright tests passed");
    }
  }

  // 4. Collect screenshots
  result.screenshotPaths = findScreenshots(sandboxPath);
  if (result.screenshotPaths.length > 0) {
    status(`Found ${result.screenshotPaths.length} screenshot(s)`);
  }

  // Deduplicate errors
  result.consoleErrors = [...new Set(result.consoleErrors)].slice(0, 50);

  return result;
}
