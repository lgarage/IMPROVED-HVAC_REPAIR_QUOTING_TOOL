/**
 * Repo Workbench CLI — command-line interface for headless use.
 * Usage: npx ts-node src/cli.ts <command> [options]
 */

import * as path from "path";
import { analyzeRepo, formatAnalysisSummary } from "./engines/repo_analyzer";
import { parseNotes, formatParsedNote } from "./engines/note_parser";
import { generateWorkPath, writeWorkPath } from "./engines/work_path_generator";
import { createSandbox } from "./engines/sandbox_manager";

const args = process.argv.slice(2);
const command = args[0];
const repoPath = args[1] || process.cwd();

function usage(): void {
  console.log(`
  AI Repo Workbench — CLI

  Usage:
    npx ts-node src/cli.ts <command> [repo-path]

  Commands:
    analyze <path>       Analyze a repo and print summary
    parse "<notes>"      Parse messy notes into structured output
    generate <path>      Generate AI_WORK_PATH.md (needs analysis + notes)
    sandbox <path>       Create a sandbox copy of the repo
    serve [port]         Start the web UI (default: 4040)

  Examples:
    npx ts-node src/cli.ts analyze C:\\Projects\\my-app
    npx ts-node src/cli.ts parse "button is broken on mobile, tax calc wrong"
    npx ts-node src/cli.ts serve 4040
  `);
}

async function main(): Promise<void> {
  switch (command) {
    case "analyze": {
      console.log(`\nAnalyzing: ${repoPath}\n`);
      const analysis = analyzeRepo(repoPath);
      console.log(formatAnalysisSummary(analysis));
      break;
    }
    case "parse": {
      const notes = args[1] || "";
      if (!notes) {
        console.log("Usage: cli.ts parse \"your messy notes here\"");
        break;
      }
      const parsed = parseNotes(notes);
      console.log(formatParsedNote(parsed));
      break;
    }
    case "generate": {
      console.log(`\nAnalyzing: ${repoPath}`);
      const analysis = analyzeRepo(repoPath);
      const noteText = args[2] || "";
      if (!noteText) {
        console.log("Usage: cli.ts generate <path> \"your notes\"");
        break;
      }
      const parsed = parseNotes(noteText);
      const content = generateWorkPath({
        analysis,
        parsedNotes: [parsed],
        generatedAt: new Date().toISOString(),
      });
      const outPath = writeWorkPath(repoPath, content);
      console.log(`\nAI_WORK_PATH.md written to: ${outPath}\n`);
      console.log(content);
      break;
    }
    case "sandbox": {
      console.log(`\nCreating sandbox for: ${repoPath}`);
      const workbenchDir = path.resolve(__dirname, "..");
      const sandbox = createSandbox({
        sourceRepo: repoPath,
        sandboxRoot: path.join(workbenchDir, "sandboxes"),
      });
      console.log(`\nSandbox created:`);
      console.log(`  ID:     ${sandbox.id}`);
      console.log(`  Path:   ${sandbox.path}`);
      console.log(`  Branch: ${sandbox.branch}`);
      console.log(`  Status: ${sandbox.status}\n`);
      break;
    }
    case "serve": {
      const port = args[1] || "4040";
      process.env.WORKBENCH_PORT = port;
      require("./server");
      break;
    }
    default:
      usage();
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
