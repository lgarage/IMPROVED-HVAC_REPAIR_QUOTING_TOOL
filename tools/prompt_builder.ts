/**
 * Builds the detailed prompt sent to each SDK agent for a given slice.
 * Includes slice scope, invariants, existing code context, and commit instructions.
 */

import * as fs from "fs";
import * as path from "path";
import type { Slice } from "./slices";

const PROJECT_ROOT = path.resolve(__dirname, "..");

export function buildPrompt(slice: Slice, model: string): string {
  const invariants = `
INVARIANTS (must not break):
- Existing workspace flow (openWorkspace, switchScreen, schedule) must keep working.
- Existing Firestore write paths (Complete & Sync, field_forms, equipment_manager) remain functional.
- Offline behavior must not regress.
- No React, no Node backend, no build tools — vanilla HTML/JS/CSS only.
- Dynamic checklists load from form_templates — never hardcode PM items in tech app.
- IIFE pattern for all new JS modules (match existing style like field_chronicle.js, equipment_hub.js).
`.trim();

  const commitInstructions = `
AFTER IMPLEMENTATION:
1. Bump VC_BUILD in technician/index.html to "${getVcBuild(slice)}".
2. Update cache-bust versions: ${slice.cacheBusts.join(", ")}.
3. Git add all changed files.
4. Git commit with message: "Phase ${slice.phase}: ${slice.title} (Slice ${slice.id})"
5. ${slice.riskLevel === "safe" ? "Git push to origin main." : "Do NOT git push — commit only (risky slice, needs human review)."}
6. Do NOT update PROJECT_STATUS files — the build runner handles that.
`.trim();

  const existingFileContext = getExistingFileContext(slice);

  return `
Pre-approved model: ${model} — proceed

You are implementing Slice ${slice.id} of the Vertex Conversational Field Capture system.

## Task: ${slice.title}

## Scope
${slice.scope}

## Out of Scope
${slice.outOfScope}

## Files to Create
${slice.filesToCreate.length > 0 ? slice.filesToCreate.map((f) => `- ${f} (NEW)`).join("\n") : "None"}

## Files to Modify
${slice.filesToModify.map((f) => `- ${f}`).join("\n")}

## Cache-bust versions to set
${slice.cacheBusts.map((c) => `- ${c}`).join("\n")}

## Expected HTML element IDs (validation will check these)
${slice.expectedIds.length > 0 ? slice.expectedIds.map((id) => `- #${id}`).join("\n") : "None"}

## Expected function exports (validation will check these)
${Object.entries(slice.expectedExports)
  .map(([file, fns]) => `- ${file}: ${fns.join(", ")}`)
  .join("\n") || "None"}

${invariants}

## Existing Code Context
${existingFileContext}

## Tech Stack Reminders
- Vanilla HTML/JS/CSS — no frameworks, no build tools.
- Firebase Firestore (firebase-firestore-compat.js 10.8.1), Firebase Storage (firebase-storage-compat.js 10.8.1).
- IIFE module pattern: (function() { ... window.ModuleName = { exports }; })();
- Theme: obsidian background (#1a1a2e), cyan accents (#00d4ff), white text.
- Mobile-first: glove-friendly tap targets (min 44px), works on iOS Safari + Chrome Android.
- Existing Gemini API pattern: fetch to generativelanguage.googleapis.com with key from getGeminiApiKey().

${commitInstructions}
`.trim();
}

function getVcBuild(slice: Slice): string {
  const date = new Date().toISOString().slice(0, 10);
  return `Phase${slice.phase}-Slice${slice.id}-${date}`;
}

function getExistingFileContext(slice: Slice): string {
  const sections: string[] = [];

  for (const f of slice.filesToModify) {
    const full = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(full)) continue;

    const content = fs.readFileSync(full, "utf-8");
    const lines = content.split("\n");

    if (f.endsWith(".html") && lines.length > 500) {
      // For large HTML files, provide structural summary instead of full content
      sections.push(`### ${f} (${lines.length} lines — structural summary)`);
      sections.push(getHtmlStructuralSummary(content, f));
    } else if (lines.length > 300) {
      sections.push(`### ${f} (${lines.length} lines — first 50 + last 50 lines)`);
      sections.push("```");
      sections.push(lines.slice(0, 50).join("\n"));
      sections.push("\n// ... middle omitted ...\n");
      sections.push(lines.slice(-50).join("\n"));
      sections.push("```");
    } else {
      sections.push(`### ${f} (${lines.length} lines — full content)`);
      sections.push("```");
      sections.push(content);
      sections.push("```");
    }
  }

  // Also include any files this slice depends on conceptually
  const contextFiles = [
    "field_chronicle.js",  // pattern reference for IIFE style
  ];
  for (const f of contextFiles) {
    const full = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(full)) continue;
    if (slice.filesToModify.includes(f) || slice.filesToCreate.includes(f)) continue;
    const content = fs.readFileSync(full, "utf-8");
    const lines = content.split("\n");
    sections.push(`### ${f} (pattern reference — first 80 lines)`);
    sections.push("```");
    sections.push(lines.slice(0, 80).join("\n"));
    sections.push("```");
  }

  return sections.join("\n");
}

function getHtmlStructuralSummary(html: string, file: string): string {
  const lines = html.split("\n");
  const summary: string[] = [];

  // Extract script tags
  summary.push("**Script tags:**");
  for (const line of lines) {
    if (line.includes("<script src=")) {
      summary.push(`  ${line.trim()}`);
    }
  }

  // Extract key section IDs
  summary.push("\n**Key element IDs:**");
  const idPattern = /id=["']([^"']+)["']/g;
  const ids = new Set<string>();
  let match;
  while ((match = idPattern.exec(html)) !== null) {
    ids.add(match[1]);
  }
  const relevantIds = Array.from(ids).filter(
    (id) =>
      id.startsWith("screen-") ||
      id.startsWith("ct-") ||
      id.startsWith("workspace") ||
      id.includes("timeline") ||
      id.includes("chronicle") ||
      id.includes("dictation")
  );
  for (const id of relevantIds) {
    summary.push(`  #${id}`);
  }

  // Extract VC_BUILD
  for (const line of lines) {
    if (line.includes("VC_BUILD")) {
      summary.push(`\n**Current VC_BUILD:** ${line.trim()}`);
      break;
    }
  }

  // Show the area around #screen-workspace for insertion point context
  summary.push("\n**#screen-workspace region (±20 lines):**");
  summary.push("```");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('id="screen-workspace"') || lines[i].includes("id='screen-workspace'")) {
      const start = Math.max(0, i - 5);
      const end = Math.min(lines.length, i + 20);
      summary.push(lines.slice(start, end).join("\n"));
      break;
    }
  }
  summary.push("```");

  return summary.join("\n");
}
