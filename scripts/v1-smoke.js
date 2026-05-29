#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chronicleBin = path.join(repoRoot, "bin/chronicle.js");

const scenarios = [
  {
    name: "node-cli-claude",
    tool: "claude-code",
    files: {
      "package.json": JSON.stringify({ name: "node-cli-sample", type: "module", bin: { sample: "./src/cli.js" } }, null, 2),
      "src/cli.js": "export function main() { return 'hello from cli'; }\n",
      "README.md": "# Node CLI Sample\n\nSmall command-line project.\n",
    },
    prompt: "Add a command-line greeting helper.",
    outcome: "Implemented the CLI greeting helper and updated the README handoff note.",
    touched: ["src/cli.js", "README.md"],
  },
  {
    name: "frontend-codex",
    tool: "codex",
    files: {
      "package.json": JSON.stringify({ name: "frontend-sample", type: "module", scripts: { dev: "vite" }, dependencies: { "@vitejs/plugin-react": "latest" } }, null, 2),
      "src/App.jsx": "export default function App() { return <main>Dashboard</main>; }\n",
      "src/styles.css": "main { font-family: system-ui; }\n",
    },
    prompt: "Build a dashboard shell for onboarding.",
    outcome: "Added a React dashboard shell and base styles for the onboarding screen.",
    touched: ["src/App.jsx", "src/styles.css"],
  },
  {
    name: "mixed-claude-codex",
    tool: "mixed",
    files: {
      "package.json": JSON.stringify({ name: "mixed-agent-sample", type: "module" }, null, 2),
      "src/auth.js": "export const authMode = 'passwordless';\n",
      "docs/decisions.md": "# Decisions\n\n- Use passwordless auth first.\n",
    },
    captures: [
      {
        tool: "claude-code",
        prompt: "Plan passwordless auth.",
        outcome: "Captured the decision to use passwordless auth first.",
        touched: ["docs/decisions.md"],
      },
      {
        tool: "codex",
        prompt: "Implement auth mode constant.",
        outcome: "Added the passwordless auth mode constant.",
        touched: ["src/auth.js"],
      },
    ],
  },
];

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "chronicle-v1-smoke-"));
  const results = [];

  try {
    for (const scenario of scenarios) {
      results.push(await runScenario(tempRoot, scenario));
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }

  for (const result of results) {
    console.log(`ok ${result.name}: ${result.itemCount} item(s), ${result.sourceCount} Markdown source file(s)`);
  }
}

async function runScenario(tempRoot, scenario) {
  const cwd = path.join(tempRoot, scenario.name);
  await mkdir(cwd, { recursive: true });

  for (const [relativePath, content] of Object.entries(scenario.files)) {
    await writeProjectFile(cwd, relativePath, content);
  }
  await initGitRepo(cwd);

  const captures = scenario.captures ?? [{ tool: scenario.tool, prompt: scenario.prompt, outcome: scenario.outcome, touched: scenario.touched }];
  for (let index = 0; index < captures.length; index += 1) {
    await capture(cwd, scenario.name, captures[index], index + 1);
  }

  await runChronicle(cwd, ["validate", "--store", "data/chronicle.json"]);
  await runChronicle(cwd, ["render", "brain", "--store", "data/chronicle.json", "--output", "dist/project-brain.html", "--root", cwd]);
  await runChronicle(cwd, ["render", "indexes", "--store", "data/chronicle.json", "--root", cwd]);

  const store = JSON.parse(await readFile(path.join(cwd, "data/chronicle.json"), "utf8"));
  const html = await readFile(path.join(cwd, "dist/project-brain.html"), "utf8");
  const sourceFiles = await listMarkdownSource(path.join(cwd, "chronicle"));

  assert(store.items.length >= captures.length, `${scenario.name} did not capture expected items`);
  assert(sourceFiles.length >= captures.length, `${scenario.name} did not write Markdown source files`);
  assert(html.includes("Project Brain"), `${scenario.name} project brain did not render`);
  assert(html.includes("Architecture Snapshot"), `${scenario.name} architecture snapshot is missing`);
  for (const captureItem of captures) {
    assert(store.items.some((item) => item.source_tool === captureItem.tool), `${scenario.name} missing ${captureItem.tool} item`);
  }

  return { name: scenario.name, itemCount: store.items.length, sourceCount: sourceFiles.length };
}

async function capture(cwd, scenarioName, captureItem, index) {
  const transcriptPath = path.join(cwd, `transcript-${index}.jsonl`);
  const hookPath = path.join(cwd, `hook-${index}.json`);
  const sessionId = `${scenarioName}-${captureItem.tool}-${index}`;

  await writeFile(transcriptPath, transcriptJsonl({ sessionId, captureItem }), "utf8");
  await writeFile(hookPath, JSON.stringify({
    session_id: sessionId,
    transcript_path: transcriptPath,
    hook_event_name: "Stop",
    turn_id: `turn-${index}`,
  }, null, 2), "utf8");

  await runChronicle(cwd, [
    "capture",
    "--hook-input",
    hookPath,
    "--source-tool",
    captureItem.tool,
    "--transcript",
    transcriptPath,
    "--store",
    "data/chronicle.json",
    "--output",
    "dist/devlog.html",
    "--brain-output",
    "dist/project-brain.html",
    "--team-output",
    "dist/team-report.html",
    "--index",
    "_INDEX.md",
    "--render",
  ]);
}

function transcriptJsonl({ sessionId, captureItem }) {
  const records = [
    { type: "user", session_id: sessionId, message: { role: "user", content: [{ type: "text", text: captureItem.prompt }] } },
    { type: "assistant", session_id: sessionId, message: { role: "assistant", content: [{ type: "text", text: `${captureItem.outcome} Files: ${captureItem.touched.join(", ")}` }] } },
    { type: "tool", session_id: sessionId, name: "Write", file_path: captureItem.touched[0] },
    { type: "tool", session_id: sessionId, name: "Bash", command: "npm test" },
  ];
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

async function initGitRepo(cwd) {
  await execFileAsync("git", ["init"], { cwd });
  await execFileAsync("git", ["config", "user.email", "chronicle@example.test"], { cwd });
  await execFileAsync("git", ["config", "user.name", "Chronicle Smoke"], { cwd });
  await execFileAsync("git", ["add", "."], { cwd });
  await execFileAsync("git", ["commit", "-m", "Initial smoke fixture"], { cwd });
}

async function runChronicle(cwd, args) {
  await execFileAsync(process.execPath, [chronicleBin, ...args], { cwd, maxBuffer: 1024 * 1024 * 8 });
}

async function writeProjectFile(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function listMarkdownSource(root) {
  const files = [];
  async function walk(directory) {
    let entries = [];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(entryPath);
      if (entry.isFile() && entry.name.endsWith(".md")) files.push(entryPath);
    }
  }
  await walk(root);
  return files;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
