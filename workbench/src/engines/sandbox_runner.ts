/**
 * Sandbox Runner — executes AI tasks inside an isolated sandbox using @cursor/sdk.
 *
 * Flow:
 *   1. Read AI_WORK_PATH.md from the sandbox
 *   2. Build escalation ladder from model_selector
 *   3. Try cheapest model via Agent.prompt(); escalate on failure
 *   4. After edits: run tests via test_runner
 *   5. Generate confidence report
 *   6. Update sandbox meta
 *
 * NEVER touches files outside the sandbox path.
 */

import * as fs from "fs";
import * as path from "path";
import { Agent, CursorAgentError } from "@cursor/sdk";
import { buildEscalationLadder, updateLookupRow } from "./model_selector";
import { runTests, type TestRunResult } from "./test_runner";
import { generateConfidenceReport, type ConfidenceReport } from "./confidence_reporter";
import type { Sandbox, TestResults } from "./sandbox_manager";
import type { RepoAnalysis } from "./repo_analyzer";
import type { ParsedNote } from "./note_parser";

export interface RunTaskOptions {
  sandbox: Sandbox;
  analysis: RepoAnalysis;
  parsedNotes: ParsedNote[];
  lookupPath: string;
  apiKey?: string;
  onStatus?: (msg: string) => void;
}

export interface RunTaskResult {
  success: boolean;
  modelUsed: string;
  escalations: string[];
  testResults: TestResults;
  confidenceReport: ConfidenceReport;
  error?: string;
}

const MODEL_ID_MAP: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-4-5",
  "composer-2": "composer-2",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5.3-codex-spark": "gpt-5.3-codex-spark",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "gpt-5.3-codex": "gpt-5.3-codex",
  "gpt-5.2": "gpt-5.2",
  "gpt-5.4": "gpt-5.4",
  "gpt-5.5": "gpt-5.5",
  "claude-opus-4-6": "claude-opus-4-6",
};

function readWorkPathFromSandbox(sandboxPath: string): string | null {
  const wpPath = path.join(sandboxPath, "AI_WORK_PATH.md");
  if (!fs.existsSync(wpPath)) return null;
  return fs.readFileSync(wpPath, "utf-8");
}

function classifyTaskPatterns(analysis: RepoAnalysis, notes: ParsedNote[]): string[] {
  const patterns: string[] = [];
  const hasBugs = notes.some((n) => n.bugs.length > 0);
  const hasUI = notes.some((n) => n.uiRequests.length > 0);
  const hasLogic = notes.some((n) => n.logicRequests.length > 0);
  const fileCount = notes.reduce((s, n) => s + n.likelyFiles.length, 0);

  if (hasUI && !hasLogic && !hasBugs) {
    patterns.push("UI container / HTML+CSS layout");
  }
  if (hasBugs && fileCount <= 1) {
    patterns.push("Single-file JS bugfix");
  }
  if (hasLogic || (hasBugs && fileCount > 1)) {
    patterns.push("Multi-file feature");
  }
  if (fileCount > 2) {
    patterns.push("Cross-module wiring (3+ files)");
  }

  if (patterns.length === 0) {
    patterns.push("Multi-file feature");
  }
  return patterns;
}

function buildPrompt(workPath: string, analysis: RepoAnalysis): string {
  return [
    "You are an AI code assistant working inside a sandboxed copy of a repository.",
    "Your job is to implement the changes described in the AI_WORK_PATH.md below.",
    "",
    "RULES:",
    "- Only edit files inside this working directory.",
    "- Follow the guardrails listed in the work path.",
    "- Do NOT auto-commit or auto-deploy.",
    "- Preserve existing functionality that is not mentioned in the work items.",
    "- After making changes, summarize what you changed and why.",
    "",
    `Project: ${analysis.projectName} (${analysis.framework})`,
    `Build: ${analysis.buildCommand}`,
    `Test: ${analysis.testCommand}`,
    "",
    "--- AI_WORK_PATH.md ---",
    workPath,
  ].join("\n");
}

function updateSandboxMeta(sandbox: Sandbox): void {
  const metaPath = path.join(sandbox.path, ".sandbox_meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(sandbox, null, 2), "utf-8");
}

export async function runSandboxTask(opts: RunTaskOptions): Promise<RunTaskResult> {
  const { sandbox, analysis, parsedNotes, lookupPath, onStatus } = opts;
  const apiKey = opts.apiKey || process.env.CURSOR_API_KEY;
  const status = onStatus || (() => {});

  const escalations: string[] = [];
  let modelUsed = "";

  sandbox.status = "running";
  updateSandboxMeta(sandbox);

  const workPath = readWorkPathFromSandbox(sandbox.path);
  if (!workPath) {
    sandbox.status = "failed";
    updateSandboxMeta(sandbox);
    return makeFailResult("No AI_WORK_PATH.md found in sandbox. Generate one first.");
  }

  const taskPatterns = classifyTaskPatterns(analysis, parsedNotes);
  const ladder = buildEscalationLadder(lookupPath, taskPatterns);

  status(`Escalation ladder: ${ladder.join(" → ")}`);

  const prompt = buildPrompt(workPath, analysis);
  let agentSuccess = false;

  for (const modelName of ladder) {
    const modelId = MODEL_ID_MAP[modelName] || modelName;
    status(`Trying model: ${modelName}`);
    modelUsed = modelName;

    try {
      if (!apiKey) {
        status("No CURSOR_API_KEY — running in dry-run mode (no AI edits)");
        escalations.push(`Dry run (no API key) — would use ${modelName}`);
        agentSuccess = true;
        break;
      }

      const result = await Agent.prompt(prompt, {
        apiKey,
        model: { id: modelId },
        local: { cwd: sandbox.path },
      });

      if (result.status === "finished") {
        status(`Model ${modelName} succeeded`);
        updateLookupRow(lookupPath, taskPatterns[0], modelName, true);
        agentSuccess = true;
        break;
      } else {
        status(`Model ${modelName} returned status: ${result.status}`);
        escalations.push(`${modelName}: status=${result.status}`);
        updateLookupRow(lookupPath, taskPatterns[0], modelName, false);
      }
    } catch (err: any) {
      const isRetryable = err instanceof CursorAgentError && err.isRetryable;
      status(`Model ${modelName} failed: ${err.message} (retryable=${isRetryable})`);
      escalations.push(`${modelName}: ${err.message}`);
      updateLookupRow(lookupPath, taskPatterns[0], modelName, false);
    }
  }

  if (!agentSuccess) {
    sandbox.status = "failed";
    updateSandboxMeta(sandbox);
    return makeFailResult(
      `All models in escalation ladder failed: ${ladder.join(", ")}`,
      modelUsed,
      escalations
    );
  }

  status("Running tests...");
  const testRunResult = await runTests({
    sandboxPath: sandbox.path,
    analysis,
    onStatus: status,
  });

  const testResults: TestResults = {
    buildPassed: testRunResult.buildPassed,
    testsPassed: testRunResult.testsPassed,
    consoleErrors: testRunResult.consoleErrors,
    screenshotPaths: testRunResult.screenshotPaths,
    filesChanged: testRunResult.filesChanged,
    confidenceScore: 0,
    escalationReason: escalations.length > 0
      ? `Escalated through: ${escalations.join("; ")}`
      : "",
  };

  status("Generating confidence report...");
  const confidenceReport = generateConfidenceReport({
    sandbox,
    testResults,
    parsedNotes,
    modelUsed,
    escalations,
  });

  testResults.confidenceScore = confidenceReport.score;

  sandbox.testResults = testResults;
  sandbox.status = "tested";
  updateSandboxMeta(sandbox);

  status(`Done — confidence: ${confidenceReport.score}%`);

  return {
    success: true,
    modelUsed,
    escalations,
    testResults,
    confidenceReport,
  };
}

function makeFailResult(
  error: string,
  modelUsed = "none",
  escalations: string[] = []
): RunTaskResult {
  return {
    success: false,
    modelUsed,
    escalations,
    testResults: {
      buildPassed: false,
      testsPassed: false,
      consoleErrors: [error],
      screenshotPaths: [],
      filesChanged: [],
      confidenceScore: 0,
      escalationReason: error,
    },
    confidenceReport: {
      score: 0,
      grade: "F",
      summary: error,
      filesChanged: [],
      bugsAddressed: [],
      bugsRemaining: [],
      testSummary: { buildPassed: false, testsPassed: false, totalErrors: 1 },
      screenshotPaths: [],
      escalationReasoning: escalations.join("; ") || error,
      remainingConcerns: [error],
      verificationChecklist: [],
      generatedAt: new Date().toISOString(),
    },
    error,
  };
}
