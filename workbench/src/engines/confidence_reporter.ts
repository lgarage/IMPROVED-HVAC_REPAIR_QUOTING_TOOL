/**
 * Confidence Reporter — generates a structured confidence report
 * after AI edits + test runs inside a sandbox.
 *
 * Scoring rubric:
 *   +30  build passed
 *   +25  tests passed
 *   +15  no console errors
 *   +10  bugs addressed (cross-ref with parsed notes)
 *   +10  files changed match expected scope
 *   +10  no escalation needed (used cheapest model)
 *   -5   per escalation step
 *   -10  per unaddressed bug
 *   -5   per console error (max -20)
 *
 * Clamped to [0, 100].
 */

import { execSync } from "child_process";
import type { Sandbox, TestResults } from "./sandbox_manager";
import type { ParsedNote } from "./note_parser";

export interface ConfidenceReport {
  score: number;
  grade: string;
  summary: string;
  filesChanged: string[];
  bugsAddressed: string[];
  bugsRemaining: string[];
  testSummary: {
    buildPassed: boolean;
    testsPassed: boolean;
    totalErrors: number;
  };
  screenshotPaths: string[];
  escalationReasoning: string;
  remainingConcerns: string[];
  verificationChecklist: ChecklistItem[];
  generatedAt: string;
}

export interface ChecklistItem {
  label: string;
  autoChecked: boolean;
  category: "build" | "test" | "visual" | "manual";
}

interface ReportInput {
  sandbox: Sandbox;
  testResults: TestResults;
  parsedNotes: ParsedNote[];
  modelUsed: string;
  escalations: string[];
}

function getDiffSummary(sandboxPath: string): string {
  try {
    return execSync("git diff HEAD --stat", { cwd: sandboxPath, stdio: "pipe" }).toString();
  } catch {
    return "(diff unavailable)";
  }
}

function matchBugsToChanges(
  bugs: string[],
  filesChanged: string[]
): { addressed: string[]; remaining: string[] } {
  const addressed: string[] = [];
  const remaining: string[] = [];

  for (const bug of bugs) {
    const lower = bug.toLowerCase();
    const likelyAddressed = filesChanged.length > 0 || lower.includes("fix");
    if (likelyAddressed) {
      addressed.push(bug);
    } else {
      remaining.push(bug);
    }
  }
  return { addressed, remaining };
}

function computeScore(input: ReportInput, bugsRemaining: string[]): number {
  let score = 0;

  if (input.testResults.buildPassed) score += 30;
  if (input.testResults.testsPassed) score += 25;
  if (input.testResults.consoleErrors.length === 0) score += 15;
  if (input.testResults.filesChanged.length > 0) score += 10;

  const allBugs = input.parsedNotes.flatMap((n) => n.bugs);
  if (allBugs.length > 0 && bugsRemaining.length === 0) {
    score += 10;
  }

  if (input.escalations.length === 0) {
    score += 10;
  } else {
    score -= input.escalations.length * 5;
  }

  score -= bugsRemaining.length * 10;
  score -= Math.min(20, input.testResults.consoleErrors.length * 5);

  return Math.max(0, Math.min(100, score));
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

function buildChecklist(input: ReportInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  items.push({
    label: "Build passes",
    autoChecked: input.testResults.buildPassed,
    category: "build",
  });
  items.push({
    label: "Tests pass",
    autoChecked: input.testResults.testsPassed,
    category: "test",
  });
  items.push({
    label: "No console errors",
    autoChecked: input.testResults.consoleErrors.length === 0,
    category: "test",
  });

  if (input.testResults.screenshotPaths.length > 0) {
    items.push({
      label: "Review screenshots for visual regressions",
      autoChecked: false,
      category: "visual",
    });
  }

  items.push({
    label: "Manually verify the primary user goal is met",
    autoChecked: false,
    category: "manual",
  });
  items.push({
    label: "Check that no unrelated functionality broke",
    autoChecked: false,
    category: "manual",
  });

  for (const note of input.parsedNotes) {
    for (const verify of note.verificationExpectations) {
      items.push({
        label: verify,
        autoChecked: false,
        category: "manual",
      });
    }
  }

  return items;
}

export function generateConfidenceReport(input: ReportInput): ConfidenceReport {
  const allBugs = input.parsedNotes.flatMap((n) => n.bugs);
  const { addressed, remaining } = matchBugsToChanges(allBugs, input.testResults.filesChanged);
  const score = computeScore(input, remaining);
  const diffSummary = getDiffSummary(input.sandbox.path);

  const concerns: string[] = [];
  if (!input.testResults.buildPassed) concerns.push("Build is failing");
  if (!input.testResults.testsPassed) concerns.push("Tests are failing");
  if (input.testResults.consoleErrors.length > 0) {
    concerns.push(`${input.testResults.consoleErrors.length} console error(s) detected`);
  }
  if (remaining.length > 0) {
    concerns.push(`${remaining.length} bug(s) may not be addressed`);
  }
  if (input.escalations.length > 0) {
    concerns.push(`Model escalated ${input.escalations.length} time(s)`);
  }

  const summary = [
    `Score: ${score}% (${scoreToGrade(score)})`,
    `Model: ${input.modelUsed}`,
    `Files changed: ${input.testResults.filesChanged.length}`,
    `Bugs addressed: ${addressed.length}/${allBugs.length}`,
    diffSummary ? `\nDiff summary:\n${diffSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    score,
    grade: scoreToGrade(score),
    summary,
    filesChanged: input.testResults.filesChanged,
    bugsAddressed: addressed,
    bugsRemaining: remaining,
    testSummary: {
      buildPassed: input.testResults.buildPassed,
      testsPassed: input.testResults.testsPassed,
      totalErrors: input.testResults.consoleErrors.length,
    },
    screenshotPaths: input.testResults.screenshotPaths,
    escalationReasoning:
      input.escalations.length > 0
        ? `Escalated through: ${input.escalations.join("; ")}`
        : "No escalation needed — cheapest model succeeded",
    remainingConcerns: concerns,
    verificationChecklist: buildChecklist(input),
    generatedAt: new Date().toISOString(),
  };
}
