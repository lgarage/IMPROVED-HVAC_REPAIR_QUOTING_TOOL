#!/usr/bin/env node
/**
 * Repo Workbench — entry point.
 * Usage: node ./bin/repo-workbench.js [serve|analyze|parse|generate|sandbox] [args]
 *
 * For development: npx ts-node src/cli.ts <command>
 * For production:  npm run build && node ./bin/repo-workbench.js <command>
 */

const path = require("path");

// When built, dist/ has the compiled JS
const distCli = path.join(__dirname, "..", "dist", "cli.js");
const fs = require("fs");

if (fs.existsSync(distCli)) {
  require(distCli);
} else {
  console.log("Run 'npm run build' first, or use 'npx ts-node src/cli.ts' for development.");
  process.exit(1);
}
