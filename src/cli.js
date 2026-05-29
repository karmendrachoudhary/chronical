import { readFile } from "node:fs/promises";
import process from "node:process";
import { applyActionIntents } from "./actions/applyActions.js";
import { captureSession } from "./capture/captureSession.js";
import { importSuperpowersArtifacts } from "./integrations/superpowers.js";
import { renderPersonalDevlogToFile } from "./render/personalDevlog.js";
import { renderProjectBrainToFile } from "./render/projectBrain.js";
import { renderProjectIndexesToFiles } from "./render/projectIndex.js";
import { renderTeamReportToFile } from "./render/teamReport.js";
import { draftPublicBuildPage, shipPublicBuildPage } from "./public/workflow.js";
import { validateEventStore } from "./schema/validateEvents.js";
import { loadEventStore } from "./store/eventsStore.js";
import { loadChronicleConfig } from "./utils/config.js";

const HELP = `Chronicle

Usage:
  chronicle capture [--hook-input -|file] [--source-tool claude-code|codex|gemini] [--transcript file] [--render]
  chronicle render brain [--store data/chronicle.json] [--output dist/project-brain.html] [--index _INDEX.md]
  chronicle render indexes [--store data/chronicle.json] [--root .]
  chronicle render team [--store data/chronicle.json] [--output dist/team-report.html]
  chronicle render personal [--store data/chronicle.json] [--output dist/devlog.html]
  chronicle import superpowers [--store data/chronicle.json] [--root .] [--render]
  chronicle actions apply [--actions chronicle-actions.json] [--store data/chronicle.json] [--render]
  chronicle public draft [--version v0.1.0] [--store data/chronicle.json] [--output dist/public-draft.html]
  chronicle public ship --version v0.1.0 --approve [--store data/chronicle.json] [--output dist/public/index.html] [--github-pages] [--dry-run]
  chronicle validate [--store data/chronicle.json]

Examples:
  chronicle capture --hook-input - --source-tool claude-code --render --hook-mode
  chronicle render brain --store data/chronicle.json --output dist/project-brain.html
  chronicle render indexes --store data/chronicle.json --root .
  chronicle render team --store data/chronicle.json --output dist/team-report.html
  chronicle render personal --store data/chronicle.json --output dist/devlog.html
  chronicle import superpowers --store data/chronicle.json --render
  chronicle actions apply --actions chronicle-actions.json --store data/chronicle.json --render
  chronicle public draft --version v0.1.0 --store data/chronicle.json --output dist/public-draft.html
  chronicle public ship --version v0.1.0 --approve --store data/chronicle.json --output dist/public/index.html
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
    const indexResult = await renderProjectIndexesToFiles(projectIndexOptions({ config, storePath, rootIndexOutput: indexPath }));
    console.log(`Rendered ${result.itemCount} item(s) to ${outputPath}`);
    console.log(`Rendered root index to ${indexResult.root}`);
    console.log(`Rendered ${indexResult.folders.length} folder index(es).`);
    return;
  }

  if (command === "render" && subcommand === "indexes") {
    const options = parseOptions(rest);
    const config = await loadChronicleConfig();
    const storePath = options.store ?? config.store;
    const result = await renderProjectIndexesToFiles(projectIndexOptions({
      config,
      storePath,
      rootDir: options.root,
      rootIndexOutput: options.index ?? config.rootIndexOutput ?? "_INDEX.md",
      minFiles: options["min-files"],
      minItems: options["min-items"],
    }));
    console.log(`Rendered root index to ${result.root}`);
    console.log(`Rendered ${result.folders.length} folder index(es).`);
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

  if (command === "public" && subcommand === "draft") {
    const options = parseOptions(rest);
    const config = await loadChronicleConfig();
    const storePath = options.store ?? config.store;
    const outputPath = options.output ?? config.publicDraftOutput ?? "dist/public-draft.html";
    const version = options.version ?? "draft";
    const result = await draftPublicBuildPage({ storePath, outputPath, version });
    console.log(`Drafted ${result.updates.length} public update(s) to ${outputPath}`);
    if (result.skippedCount > 0) {
      console.log(`Skipped ${result.skippedCount} public item(s) with missing summaries or safety flags.`);
    }
    return;
  }

  if (command === "public" && subcommand === "ship") {
    const options = parseOptions(rest);
    const config = await loadChronicleConfig();
    const storePath = options.store ?? config.store;
    const outputPath = options.output ?? config.publicOutput ?? "dist/public/index.html";
    const result = await shipPublicBuildPage({
      storePath,
      outputPath,
      version: options.version,
      approve: Boolean(options.approve),
      dryRun: Boolean(options["dry-run"]),
      githubPages: Boolean(options["github-pages"]),
      pagesBranch: options["pages-branch"] ?? "gh-pages",
      pagesPath: options["pages-path"] ?? "index.html",
    });
    console.log(`Shipped ${result.updates.length} public update(s) to ${outputPath}${result.dryRun ? " (dry run)" : ""}`);
    if (!result.dryRun) {
      console.log(`Recorded ${result.release.appendedCount} public release marker(s).`);
    }
    if (result.publish) {
      console.log(result.publish.published ? `Published to ${result.publish.branch}.` : `GitHub Pages dry run for ${result.publish.branch}.`);
    }
    return;
  }

  if (command === "import" && subcommand === "superpowers") {
    const options = parseOptions(rest);
    const config = await loadChronicleConfig();
    const storePath = options.store ?? config.store;
    const result = await importSuperpowersArtifacts({
      storePath,
      rootDir: options.root ?? process.cwd(),
      specsDir: options.specs ?? config.superpowers?.specsDir ?? "docs/superpowers/specs",
      plansDir: options.plans ?? config.superpowers?.plansDir ?? "docs/superpowers/plans",
    });
    console.log(`Imported ${result.itemCount} Superpowers item(s) from ${result.specCount} spec(s) and ${result.planCount} plan(s).`);
    console.log(`Inserted ${result.insertedCount}, updated ${result.updatedCount}.`);
    if (options.render) {
      await renderAfterDataChange({ config, storePath });
    }
    return;
  }

  if (command === "actions" && subcommand === "apply") {
    const options = parseOptions(rest);
    const config = await loadChronicleConfig();
    const storePath = options.store ?? config.store;
    const actionsPath = options.actions ?? config.actionIntentsPath ?? "chronicle-actions.json";
    const result = await applyActionIntents({ storePath, actionsPath });
    console.log(`Applied ${result.appliedCount} action intent(s) from ${actionsPath}.`);
    if (result.skippedCount > 0) {
      console.log(`Skipped ${result.skippedCount} action intent(s).`);
    }
    if (options.render) {
      await renderAfterDataChange({ config, storePath });
    }
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

async function renderAfterDataChange({ config, storePath }) {
  const brainOutputPath = config.brainOutput ?? "dist/project-brain.html";
  await renderProjectBrainToFile({ storePath, outputPath: brainOutputPath });
  await renderProjectIndexesToFiles(projectIndexOptions({ config, storePath, rootIndexOutput: config.rootIndexOutput ?? "_INDEX.md" }));
  console.log(`Rendered project brain to ${brainOutputPath}.`);
}

function projectIndexOptions({ config, storePath, rootDir, rootIndexOutput, minFiles, minItems }) {
  const folderIndexes = config.folderIndexes ?? {};
  return {
    storePath,
    rootDir: rootDir ?? process.cwd(),
    rootIndexOutput,
    fileName: folderIndexes.fileName ?? "_INDEX.md",
    minFiles: Number(minFiles ?? folderIndexes.minFiles ?? 3),
    minItems: Number(minItems ?? folderIndexes.minItems ?? 2),
    cleanStale: folderIndexes.cleanStale !== false,
    exclude: folderIndexes.exclude ?? [],
  };
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
      folderIndexOptions: projectIndexOptions({ config, storePath: options.store ?? config.store, rootIndexOutput: options.index ?? config.rootIndexOutput }),
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
