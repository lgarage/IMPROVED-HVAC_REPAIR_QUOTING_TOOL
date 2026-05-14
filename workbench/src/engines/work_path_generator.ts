/**
 * AI_WORK_PATH.md Generator — combines repo analysis + parsed notes
 * into a structured instruction file for AI-assisted work.
 */

import * as fs from "fs";
import * as path from "path";
import type { RepoAnalysis } from "./repo_analyzer";
import type { ParsedNote } from "./note_parser";

export interface WorkPathData {
  analysis: RepoAnalysis;
  parsedNotes: ParsedNote[];
  generatedAt: string;
}

export function generateWorkPath(data: WorkPathData): string {
  const { analysis, parsedNotes } = data;
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");

  const allBugs = parsedNotes.flatMap((n) => n.bugs);
  const allUI = parsedNotes.flatMap((n) => n.uiRequests);
  const allLogic = parsedNotes.flatMap((n) => n.logicRequests);
  const allRules = parsedNotes.flatMap((n) => n.businessRules);
  const allVerify = parsedNotes.flatMap((n) => n.verificationExpectations);
  const allRisks = parsedNotes.flatMap((n) => n.risks);
  const allFiles = [...new Set(parsedNotes.flatMap((n) => n.likelyFiles))];
  const allUncertain = parsedNotes.flatMap((n) => n.uncertainties);

  const primaryGoals = parsedNotes.map((n) => n.primaryGoal).filter(Boolean);
  const avgConfidence = parsedNotes.length > 0
    ? Math.round(parsedNotes.reduce((sum, n) => sum + n.confidence, 0) / parsedNotes.length)
    : 0;

  const sections: string[] = [];

  // Header
  sections.push("# AI Work Path");
  sections.push("");
  sections.push(`> Generated: ${ts}`);
  sections.push(`> Parser confidence: ${avgConfidence}%`);
  sections.push("");

  // Project Snapshot
  sections.push("## Project Snapshot");
  sections.push("");
  sections.push(`- **Project:** ${analysis.projectName}`);
  sections.push(`- **Type:** ${analysis.projectType}`);
  sections.push(`- **Framework:** ${analysis.framework}`);
  sections.push(`- **Package manager:** ${analysis.packageManager}`);
  sections.push(`- **Run:** \`${analysis.runCommand}\``);
  sections.push(`- **Build:** \`${analysis.buildCommand}\``);
  sections.push(`- **Test:** \`${analysis.testCommand}\``);
  if (analysis.playwrightSupport) sections.push(`- **Playwright:** Available`);
  sections.push("");

  // User Goal
  sections.push("## User Goal");
  sections.push("");
  if (primaryGoals.length > 0) {
    primaryGoals.forEach((g) => sections.push(`- ${g}`));
  } else {
    sections.push("- (No clear goal extracted — review raw notes)");
  }
  sections.push("");

  // Parsed Work Items
  sections.push("## Parsed Work Items");
  sections.push("");

  if (allBugs.length > 0) {
    sections.push("### Bugs");
    allBugs.forEach((b) => sections.push(`- [ ] ${b}`));
    sections.push("");
  }
  if (allUI.length > 0) {
    sections.push("### UI / Layout Changes");
    allUI.forEach((u) => sections.push(`- [ ] ${u}`));
    sections.push("");
  }
  if (allLogic.length > 0) {
    sections.push("### Business Logic Changes");
    allLogic.forEach((l) => sections.push(`- [ ] ${l}`));
    sections.push("");
  }
  if (allUncertain.length > 0) {
    sections.push("### Config / Documentation / Other");
    allUncertain.forEach((u) => sections.push(`- [ ] ${u}`));
    sections.push("");
  }

  // Business Rules
  if (allRules.length > 0) {
    sections.push("## Business Rules");
    sections.push("");
    allRules.forEach((r) => sections.push(`- ${r}`));
    sections.push("");
  }

  // Likely Files
  sections.push("## Likely Files To Inspect");
  sections.push("");
  if (allFiles.length > 0) {
    allFiles.forEach((f) => sections.push(`- \`${f}\``));
  }
  if (analysis.uiFolders.length > 0) {
    sections.push(`- UI folders: ${analysis.uiFolders.join(", ")}`);
  }
  if (analysis.logicFolders.length > 0) {
    sections.push(`- Logic folders: ${analysis.logicFolders.join(", ")}`);
  }
  sections.push("");

  // Guardrails
  sections.push("## Guardrails");
  sections.push("");
  sections.push("- Preserve existing functionality");
  sections.push("- Avoid unrelated edits");
  sections.push("- Ask before risky changes");
  sections.push("- Do not auto-deploy");
  sections.push("- Do not auto-commit");
  if (allRisks.length > 0) {
    allRisks.forEach((r) => sections.push(`- ⚠️ ${r}`));
  }
  sections.push("");

  // Verification Plan
  sections.push("## Verification Plan");
  sections.push("");
  if (analysis.buildCommand && analysis.buildCommand !== "(not detected)") {
    sections.push(`- [ ] Run build: \`${analysis.buildCommand}\``);
  }
  if (analysis.testCommand && analysis.testCommand !== "(not detected)") {
    sections.push(`- [ ] Run tests: \`${analysis.testCommand}\``);
  }
  if (analysis.playwrightSupport) {
    sections.push("- [ ] Run Playwright checks");
  }
  if (analysis.runCommand && analysis.runCommand !== "(not detected)") {
    sections.push(`- [ ] Start app: \`${analysis.runCommand}\``);
  }
  sections.push("- [ ] Check browser console for errors");
  if (allVerify.length > 0) {
    allVerify.forEach((v) => sections.push(`- [ ] ${v}`));
  }
  sections.push("");

  // Confidence Reporting
  sections.push("## Confidence Reporting");
  sections.push("");
  sections.push("After AI work completes, report:");
  sections.push("- Files changed");
  sections.push("- Tests run and results");
  sections.push("- Console errors found");
  sections.push("- Screenshots captured (if applicable)");
  sections.push("- Confidence score (0-100%)");
  sections.push("- Escalation reasoning (if confidence < 80%)");
  sections.push("");

  return sections.join("\n");
}

export function writeWorkPath(repoPath: string, content: string): string {
  const filePath = path.join(repoPath, "AI_WORK_PATH.md");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function readWorkPath(repoPath: string): string | null {
  const filePath = path.join(repoPath, "AI_WORK_PATH.md");
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}
