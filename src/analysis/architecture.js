import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const MODULE_CANDIDATES = [
  ["Hooks", ["hooks/claude/hooks.json", "hooks/codex/hooks.json", "hooks/hooks.json"], "Tool lifecycle hooks call Chronicle after a coding turn."],
  ["CLI", ["bin/chronicle.js", "src/cli.js"], "Command entrypoint for capture, render, validation, and release tasks."],
  ["Capture", ["src/capture/captureSession.js", "src/capture/summarize.js"], "Turns hook input and transcript facts into private Chronicle items."],
  ["Markdown Source", ["src/source/markdownSource.js"], "Writes and reads sharded Markdown source files."],
  ["Store Cache", ["src/store/eventsStore.js"], "Keeps the generated JSON cache normalized for renderers."],
  ["Safety", ["src/safety/redaction.js", "src/schema/validateEvents.js"], "Scans for secrets and validates public-safety rules."],
  ["Renderers", ["src/render/projectBrain.js", "src/render/projectIndex.js", "src/render/teamReport.js", "src/render/publicBuildPage.js"], "Builds self-contained HTML and private index maps."],
  ["Integrations", ["src/integrations/superpowers.js", "src/actions/applyActions.js", "src/public/workflow.js"], "Imports external artifacts, applies approved intents, and handles public release flow."],
];

export async function collectArchitectureFacts({ rootDir = process.cwd() } = {}) {
  const [packageInfo, packageManager, modules] = await Promise.all([
    readPackageInfo(rootDir),
    detectPackageManager(rootDir),
    detectModules(rootDir),
  ]);

  return {
    packageName: packageInfo?.name ?? path.basename(rootDir),
    packageVersion: packageInfo?.version ?? "unknown",
    packageManager,
    modules,
    flow: [
      ["Claude Code or Codex Stop hook", "chronicle capture"],
      ["chronicle capture", "Markdown source files"],
      ["Markdown source files", "JSON cache"],
      ["JSON cache", "Project brain HTML"],
      ["JSON cache", "Folder maps"],
      ["Public approval", "Public build page"],
    ],
  };
}

async function readPackageInfo(rootDir) {
  try {
    return JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

async function detectPackageManager(rootDir) {
  const candidates = [
    ["pnpm", "pnpm-lock.yaml"],
    ["npm", "package-lock.json"],
    ["yarn", "yarn.lock"],
    ["bun", "bun.lockb"],
  ];

  for (const [manager, fileName] of candidates) {
    if (await exists(path.join(rootDir, fileName))) return manager;
  }
  return await exists(path.join(rootDir, "package.json")) ? "npm-compatible" : "unknown";
}

async function detectModules(rootDir) {
  const modules = [];
  for (const [name, paths, role] of MODULE_CANDIDATES) {
    const existing = [];
    for (const relativePath of paths) {
      if (await exists(path.join(rootDir, relativePath))) {
        existing.push(relativePath);
      }
    }
    if (existing.length > 0) {
      modules.push({ name, role, paths: existing });
    }
  }

  if (!modules.length) {
    const topLevel = await listTopLevel(rootDir);
    return topLevel.slice(0, 8).map((entry) => ({ name: entry, role: "Top-level project area detected from the file tree.", paths: [entry] }));
  }

  return modules;
}

async function listTopLevel(rootDir) {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    return entries
      .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist")
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
