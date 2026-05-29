import { readFile } from "node:fs/promises";
import process from "node:process";
import { captureSession } from "./capture/captureSession.js";
import { renderPersonalDevlogToFile } from "./render/personalDevlog.js";
import { renderProjectBrainToFile } from "./render/projectBrain.js";
import { renderRootIndexToFile } from "./render/projectIndex.js";
import { renderTeamReportToFile } from "./render/teamReport.js";
import { validateEventStore } from "./schema/validateEvents.js";
import { loadEventStore } from "./store/eventsStore.js";
import { loadChronicleConfig } from "./utils/config.js";

const HELP = `Chronicle

Usage:
  chronicle capture [--hook-input -|file] [--source-tool claude-code|codex|gemini] [--transcript file] [--render]
  chronicle render brain [--store data/chronicle.json] [--output dist/project-brain.html] [--index _INDEX.md]
  chronicle render team [--store data/chronicle.json] [--output dist/team-report.html]
  chronicle render personal [--store data/chronicle.json] [--output dist/devlog.html]
  chronicle validate [--store data/chronicle.json]

Examples:
  chronicle capture --hook-input - --source-tool claude-code --render --hook-mode
  chronicle render brain --store data/chronicle.json --output dist/project-brain.html
  chronicle render team --store data/chronicle.json --output dist/team-report.html
  chronicle render personal --store data/chronicle.json --output dist/devlog.html
  chronicle validate --store data/chronicle.json
`;

export async function main(argv) {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  if (command === "capture") {
    await runCapture([subcommand, ...rest].filter(Boolean));
    return;
  }

  if (command === "render" && subcommand === "personal") {
    const options = parseOptions(rest);
    const config = await loadChronicleConfig();
    const outputPath = options.output ?? config.personalOutput;
    const result = await renderPersonalDevlogToFile({
      storePath: options.store ?? config.store,
      outputPath,
    });
    console.log(`Rendered ${result.eventCount} event item(s) to ${outputPath}`);
    return;
  }

  if (command === "render" && subcommand === "brain") {
    const options = parseOptions(rest);
    const config = await loadChronicleConfig();
    const storePath = options.store ?? config.store;
    const outputPath = options.output ?? config.brainOutput ?? "dist/project-brain.html";
    const result = await renderProjectBrainToFile({ storePath, outputPath });
    const indexPath = options.index ?? config.rootIndexOutput ?? "_INDEX.md";
    await renderRootIndexToFile({ storePath, outputPath: indexPath });
    console.log(`Rendered ${result.itemCount} item(s) to ${outputPath}`);
    console.log(`Rendered root index to ${indexPath}`);
    return;
  }

  if (command === "render" && subcommand === "team") {
    const options = parseOptions(rest);
    const config = await loadChronicleConfig();
    const storePath = options.store ?? config.store;
    const outputPath = options.output ?? config.teamOutput ?? "dist/team-report.html";
    const result = await renderTeamReportToFile({ storePath, outputPath });
    console.log(`Rendered ${result.visibleCount} team-visible item(s) to ${outputPath}`);
    return;
  }

  if (command === "validate") {
    const options = parseOptions([subcommand, ...rest].filter(Boolean));
    const config = await loadChronicleConfig();
    const storePath = options.store ?? config.store;
    const store = await loadEventStore(storePath);
    const errors = validateEventStore(store);
    if (errors.length > 0) {
      throw new Error(`Chronicle store failed validation:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    }
    console.log(`Validated ${store.items.length} item(s) in ${storePath}.`);
    return;
  }

  throw new Error(`Unknown command.\n\n${HELP}`);
}

async function runCapture(argv) {
  const options = parseOptions(argv);
  const hookMode = Boolean(options["hook-mode"]);
  const config = await loadChronicleConfig();

  try {
    const hookInput = await readHookInput(options["hook-input"]);
    const result = await captureSession({
      cwd: process.cwd(),
      hookInput,
      sourceTool: options["source-tool"],
      transcriptPath: options.transcript,
      storePath: options.store ?? config.store,
      outputPath: options.output ?? config.personalOutput,
      brainOutputPath: options["brain-output"] ?? config.brainOutput,
      teamOutputPath: options["team-output"] ?? config.teamOutput,
      rootIndexOutputPath: options.index ?? config.rootIndexOutput,
      renderAfterCapture: Boolean(options.render),
      summaryOverride: options.summary,
      summarizerCommand: config.capture?.summarizerCommand ?? null,
    });

    if (hookMode) {
      writeHookSuccess(result);
      return;
    }

    console.log(`Captured ${result.appendedCount} new event item(s) from ${result.sourceTool}.`);
    if (result.skippedCount > 0) {
      console.log(`Skipped ${result.skippedCount} duplicate item(s).`);
    }
    if (result.renderedPath) {
      console.log(`Rendered personal devlog to ${result.renderedPath}.`);
    }
    for (const renderedPath of result.renderedPaths.filter((entry) => entry !== result.renderedPath)) {
      console.log(`Rendered ${renderedPath}.`);
    }
  } catch (error) {
    if (hookMode) {
      writeHookWarning(error);
      return;
    }
    throw error;
  }
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const name = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[name] = true;
      continue;
    }

    options[name] = next;
    index += 1;
  }
  return options;
}

async function readHookInput(inputPath) {
  if (!inputPath) {
    return null;
  }

  const raw = inputPath === "-" ? await readStdin() : await readFile(inputPath, "utf8");
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return JSON.parse(trimmed);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeHookSuccess(result) {
  process.stdout.write(JSON.stringify({
    continue: true,
    suppressOutput: true,
    systemMessage: `Chronicle captured ${result.appendedCount} item(s) and refreshed local outputs.`,
  }));
}

function writeHookWarning(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(JSON.stringify({
    continue: true,
    suppressOutput: true,
    systemMessage: `Chronicle could not capture this session: ${message}`,
  }));
}
