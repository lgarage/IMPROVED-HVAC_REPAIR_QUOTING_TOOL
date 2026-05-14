/**
 * Repo Analyzer — inspects any mounted/target repo and detects:
 * framework, package manager, run/build/test commands, folder structure,
 * monorepo layout, AI instruction files, Playwright support, env files.
 *
 * Pure read-only — never modifies the target repo.
 */

import * as fs from "fs";
import * as path from "path";

export interface RepoAnalysis {
  repoPath: string;
  projectName: string;
  projectType: string;
  framework: string;
  packageManager: string;
  runCommand: string;
  buildCommand: string;
  testCommand: string;
  uiFolders: string[];
  logicFolders: string[];
  configFiles: string[];
  envFiles: string[];
  aiInstructionFiles: string[];
  playwrightSupport: boolean;
  monorepo: boolean;
  monorepoPackages: string[];
  importantFiles: string[];
  totalFiles: number;
  warnings: string[];
}

const FRAMEWORK_SIGNALS: Record<string, { files: string[]; dirs: string[] }> = {
  "Next.js":      { files: ["next.config.js", "next.config.mjs", "next.config.ts"], dirs: [".next"] },
  "Nuxt":         { files: ["nuxt.config.js", "nuxt.config.ts"], dirs: [".nuxt"] },
  "React (CRA)":  { files: [], dirs: ["src/App.tsx", "src/App.js", "src/App.jsx"] },
  "Vue":          { files: ["vue.config.js", "vite.config.ts", "vite.config.js"], dirs: [] },
  "Angular":      { files: ["angular.json"], dirs: [] },
  "Svelte":       { files: ["svelte.config.js"], dirs: [] },
  "Express":      { files: [], dirs: [] },
  "Django":       { files: ["manage.py"], dirs: [] },
  "Flask":        { files: [], dirs: [] },
  "Rails":        { files: ["Gemfile", "config/routes.rb"], dirs: ["app/controllers"] },
  "Firebase Hosting": { files: ["firebase.json"], dirs: [".firebase"] },
  "Vanilla HTML/JS":  { files: [], dirs: [] },
};

const PKG_MANAGERS: { file: string; name: string; install: string }[] = [
  { file: "pnpm-lock.yaml", name: "pnpm", install: "pnpm install" },
  { file: "yarn.lock",      name: "yarn", install: "yarn install" },
  { file: "bun.lockb",      name: "bun",  install: "bun install" },
  { file: "package-lock.json", name: "npm", install: "npm install" },
  { file: "package.json",   name: "npm",  install: "npm install" },
  { file: "requirements.txt", name: "pip", install: "pip install -r requirements.txt" },
  { file: "Pipfile",        name: "pipenv", install: "pipenv install" },
  { file: "pyproject.toml", name: "pip/poetry", install: "pip install -e ." },
  { file: "Gemfile",        name: "bundler", install: "bundle install" },
  { file: "go.mod",         name: "go modules", install: "go mod download" },
  { file: "Cargo.toml",     name: "cargo", install: "cargo build" },
];

const UI_FOLDER_NAMES = [
  "src/components", "src/pages", "src/views", "src/screens",
  "components", "pages", "views", "app", "client", "frontend",
  "public", "static", "assets", "styles", "css",
];

const LOGIC_FOLDER_NAMES = [
  "src/lib", "src/utils", "src/services", "src/api", "src/hooks",
  "lib", "utils", "services", "api", "server", "backend",
  "shared", "functions", "controllers", "models",
];

const AI_INSTRUCTION_PATTERNS = [
  ".cursorrules", ".cursor/rules", "AGENTS.md",
  "AI_WORK_PATH.md", "CLAUDE.md", ".github/copilot-instructions.md",
  "AI_CONTEXT", "INSTRUCTIONS.md",
];

const ENV_PATTERNS = [
  ".env", ".env.local", ".env.development", ".env.production",
  ".env.example", ".env.sample",
];

const CONFIG_PATTERNS = [
  "tsconfig.json", "jsconfig.json", "babel.config.js", ".babelrc",
  "webpack.config.js", "vite.config.ts", "vite.config.js",
  "rollup.config.js", "esbuild.config.js",
  "tailwind.config.js", "tailwind.config.ts", "postcss.config.js",
  ".eslintrc", ".eslintrc.js", ".eslintrc.json", "eslint.config.js",
  ".prettierrc", "prettier.config.js",
  "jest.config.js", "jest.config.ts", "vitest.config.ts",
  "playwright.config.ts", "playwright.config.js",
  "docker-compose.yml", "docker-compose.yaml", "Dockerfile",
  "firebase.json", ".firebaserc",
  "vercel.json", "netlify.toml",
];

function existsIn(repoPath: string, relPath: string): boolean {
  return fs.existsSync(path.join(repoPath, relPath));
}

function safeReadJSON(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function countFiles(dir: string, depth = 0, max = 3): number {
  if (depth > max) return 0;
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === ".git") continue;
      if (e.isFile()) count++;
      else if (e.isDirectory()) count += countFiles(path.join(dir, e.name), depth + 1, max);
    }
  } catch { /* permission denied etc */ }
  return count;
}

function listDirsShallow(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => e.name);
  } catch {
    return [];
  }
}

export function analyzeRepo(repoPath: string): RepoAnalysis {
  const absPath = path.resolve(repoPath);
  const warnings: string[] = [];

  if (!fs.existsSync(absPath)) {
    return emptyAnalysis(absPath, [`Repo path does not exist: ${absPath}`]);
  }

  // --- Project name ---
  const projectName = path.basename(absPath);

  // --- Package manager ---
  let packageManager = "unknown";
  let installCmd = "";
  for (const pm of PKG_MANAGERS) {
    if (existsIn(absPath, pm.file)) {
      packageManager = pm.name;
      installCmd = pm.install;
      break;
    }
  }

  // --- Read package.json scripts ---
  let runCommand = "";
  let buildCommand = "";
  let testCommand = "";
  const pkgJsonPath = path.join(absPath, "package.json");
  const pkgJson = safeReadJSON(pkgJsonPath);
  if (pkgJson?.scripts) {
    const s = pkgJson.scripts;
    runCommand = s.dev || s.start || s.serve || "";
    buildCommand = s.build || "";
    testCommand = s.test || "";
    if (runCommand && packageManager.startsWith("npm")) {
      const scriptKey = s.dev ? "dev" : s.start ? "start" : "serve";
      runCommand = `npm run ${scriptKey}`;
    }
    if (buildCommand && packageManager.startsWith("npm")) buildCommand = "npm run build";
    if (testCommand && packageManager.startsWith("npm")) testCommand = "npm test";
  }

  // Python fallback
  if (!runCommand && existsIn(absPath, "manage.py")) {
    runCommand = "python manage.py runserver";
    buildCommand = "";
    testCommand = "python manage.py test";
  }

  // --- Framework detection ---
  let framework = "Unknown";
  let projectType = "Unknown";
  for (const [name, signals] of Object.entries(FRAMEWORK_SIGNALS)) {
    const fileMatch = signals.files.some((f) => existsIn(absPath, f));
    const dirMatch = signals.dirs.some((d) => existsIn(absPath, d));
    if (fileMatch || dirMatch) {
      framework = name;
      break;
    }
  }

  if (framework === "Unknown" && pkgJson?.dependencies) {
    const deps = Object.keys(pkgJson.dependencies);
    if (deps.includes("next")) framework = "Next.js";
    else if (deps.includes("nuxt")) framework = "Nuxt";
    else if (deps.includes("react")) framework = "React";
    else if (deps.includes("vue")) framework = "Vue";
    else if (deps.includes("@angular/core")) framework = "Angular";
    else if (deps.includes("svelte")) framework = "Svelte";
    else if (deps.includes("express")) framework = "Express";
    else if (deps.includes("fastify")) framework = "Fastify";
  }

  if (framework === "Unknown" && existsIn(absPath, "index.html")) {
    framework = "Vanilla HTML/JS";
  }

  // Project type heuristic
  if (["Next.js", "Nuxt", "React", "React (CRA)", "Vue", "Angular", "Svelte"].includes(framework)) {
    projectType = "Web App (Frontend)";
  } else if (["Express", "Fastify", "Django", "Flask", "Rails"].includes(framework)) {
    projectType = "Web App (Backend)";
  } else if (framework === "Firebase Hosting" || framework === "Vanilla HTML/JS") {
    projectType = "Static / Vanilla Web App";
  } else if (existsIn(absPath, "Cargo.toml")) {
    projectType = "Rust Project";
  } else if (existsIn(absPath, "go.mod")) {
    projectType = "Go Project";
  } else {
    projectType = "Unknown";
  }

  // --- Folder detection ---
  const uiFolders = UI_FOLDER_NAMES.filter((f) => existsIn(absPath, f));
  const logicFolders = LOGIC_FOLDER_NAMES.filter((f) => existsIn(absPath, f));

  // --- Config files ---
  const configFiles = CONFIG_PATTERNS.filter((f) => existsIn(absPath, f));

  // --- Env files ---
  const envFiles = ENV_PATTERNS.filter((f) => existsIn(absPath, f));

  // --- AI instruction files ---
  const aiInstructionFiles = AI_INSTRUCTION_PATTERNS.filter((f) => existsIn(absPath, f));

  // --- Playwright ---
  const playwrightSupport =
    existsIn(absPath, "playwright.config.ts") ||
    existsIn(absPath, "playwright.config.js") ||
    (pkgJson?.devDependencies && "@playwright/test" in pkgJson.devDependencies) ||
    (pkgJson?.dependencies && "@playwright/test" in pkgJson.dependencies) ||
    false;

  // --- Monorepo ---
  let monorepo = false;
  let monorepoPackages: string[] = [];
  if (existsIn(absPath, "pnpm-workspace.yaml") || existsIn(absPath, "lerna.json")) {
    monorepo = true;
  }
  if (pkgJson?.workspaces) {
    monorepo = true;
  }
  if (existsIn(absPath, "packages")) {
    const pkgs = listDirsShallow(path.join(absPath, "packages"));
    if (pkgs.length > 1) {
      monorepo = true;
      monorepoPackages = pkgs.map((p) => `packages/${p}`);
    }
  }
  if (existsIn(absPath, "apps")) {
    const apps = listDirsShallow(path.join(absPath, "apps"));
    if (apps.length > 0) {
      monorepo = true;
      monorepoPackages = [...monorepoPackages, ...apps.map((a) => `apps/${a}`)];
    }
  }

  // --- Important files (top-level scan) ---
  const importantFiles: string[] = [];
  try {
    const topLevel = fs.readdirSync(absPath, { withFileTypes: true });
    for (const e of topLevel) {
      if (e.name.startsWith(".") && e.name !== ".cursorrules") continue;
      if (e.name === "node_modules" || e.name === ".git") continue;
      if (e.isFile()) importantFiles.push(e.name);
    }
  } catch { /* */ }

  const totalFiles = countFiles(absPath);

  return {
    repoPath: absPath,
    projectName,
    projectType,
    framework,
    packageManager,
    runCommand: runCommand || "(not detected)",
    buildCommand: buildCommand || "(not detected)",
    testCommand: testCommand || "(not detected)",
    uiFolders,
    logicFolders,
    configFiles,
    envFiles,
    aiInstructionFiles,
    playwrightSupport,
    monorepo,
    monorepoPackages,
    importantFiles,
    totalFiles,
    warnings,
  };
}

function emptyAnalysis(repoPath: string, warnings: string[]): RepoAnalysis {
  return {
    repoPath,
    projectName: path.basename(repoPath),
    projectType: "Unknown",
    framework: "Unknown",
    packageManager: "unknown",
    runCommand: "(not detected)",
    buildCommand: "(not detected)",
    testCommand: "(not detected)",
    uiFolders: [],
    logicFolders: [],
    configFiles: [],
    envFiles: [],
    aiInstructionFiles: [],
    playwrightSupport: false,
    monorepo: false,
    monorepoPackages: [],
    importantFiles: [],
    totalFiles: 0,
    warnings,
  };
}

export function formatAnalysisSummary(a: RepoAnalysis): string {
  const lines: string[] = [
    `## Repo Analysis: ${a.projectName}`,
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| Path | \`${a.repoPath}\` |`,
    `| Project type | ${a.projectType} |`,
    `| Framework | ${a.framework} |`,
    `| Package manager | ${a.packageManager} |`,
    `| Run command | \`${a.runCommand}\` |`,
    `| Build command | \`${a.buildCommand}\` |`,
    `| Test command | \`${a.testCommand}\` |`,
    `| Playwright | ${a.playwrightSupport ? "Yes" : "No"} |`,
    `| Monorepo | ${a.monorepo ? "Yes" : "No"} |`,
    `| Total files | ~${a.totalFiles} |`,
    "",
  ];

  if (a.uiFolders.length > 0)
    lines.push(`**UI folders:** ${a.uiFolders.join(", ")}`);
  if (a.logicFolders.length > 0)
    lines.push(`**Logic folders:** ${a.logicFolders.join(", ")}`);
  if (a.configFiles.length > 0)
    lines.push(`**Config files:** ${a.configFiles.join(", ")}`);
  if (a.envFiles.length > 0)
    lines.push(`**Env files:** ${a.envFiles.join(", ")}`);
  if (a.aiInstructionFiles.length > 0)
    lines.push(`**AI instruction files:** ${a.aiInstructionFiles.join(", ")}`);
  if (a.monorepoPackages.length > 0)
    lines.push(`**Monorepo packages:** ${a.monorepoPackages.join(", ")}`);
  if (a.warnings.length > 0)
    lines.push(`\n**Warnings:** ${a.warnings.join("; ")}`);

  return lines.join("\n");
}
