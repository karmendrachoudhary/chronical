import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { captureSession } from "../src/capture/captureSession.js";
import { main } from "../src/cli.js";
import { renderProjectBrain, renderProjectBrainToFile } from "../src/render/projectBrain.js";
import { renderRootIndexToFile } from "../src/render/projectIndex.js";
import { renderPublicBuildPage } from "../src/render/publicBuildPage.js";
import { renderTeamReport, renderTeamReportToFile } from "../src/render/teamReport.js";
import { detectSecrets } from "../src/safety/redaction.js";
import { validateEvent } from "../src/schema/validateEvents.js";

test("captureSession appends a private event and renders HTML", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "chronicle-"));
  try {
    const storePath = path.join(tempDir, "chronicle.json");
    const outputPath = path.join(tempDir, "devlog.html");
    const transcriptPath = path.resolve("tests/fixtures/claude-session.jsonl");

    const result = await captureSession({
      cwd: tempDir,
      hookInput: {
        session_id: "sample-session-001",
        transcript_path: transcriptPath,
        hook_event_name: "Stop",
        turn_id: "turn-001",
      },
      sourceTool: "claude-code",
      storePath,
      outputPath,
      brainOutputPath: path.join(tempDir, "project-brain.html"),
      teamOutputPath: path.join(tempDir, "team-report.html"),
      rootIndexOutputPath: path.join(tempDir, "_INDEX.md"),
      renderAfterCapture: true,
    });

    assert.equal(result.appendedCount, 1);
    const store = JSON.parse(await readFile(storePath, "utf8"));
    assert.equal(store.schema_version, 2);
    assert.equal(store.items.length, 1);
    assert.equal(store.items[0].kind, "event");
    assert.equal(store.items[0].visibility, "private");
    assert.equal(store.items[0].source_tool, "claude-code");
    assert.equal(store.items[0].status, "completed");
    assert.ok(store.items[0].title.length > 0);
    assert.deepEqual(store.items[0].files, ["src/render/personalDevlog.js", "src/store/eventsStore.js"]);
    assert.match(store.items[0].raw_summary, /personal devlog renderer/i);

    const html = await readFile(outputPath, "utf8");
    assert.match(html, /Chronicle/);
    assert.match(html, /Session Events/);

    const brainHtml = await readFile(path.join(tempDir, "project-brain.html"), "utf8");
    assert.match(brainHtml, /data-panel="overview"/);
    assert.match(brainHtml, /Search anything/);

    const indexMarkdown = await readFile(path.join(tempDir, "_INDEX.md"), "utf8");
    assert.match(indexMarkdown, /Chronicle Project Index/);

    const teamHtml = await readFile(path.join(tempDir, "team-report.html"), "utf8");
    assert.match(teamHtml, /Team Report/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("team report excludes private items and never renders raw summaries", () => {
  const html = renderTeamReport(teamReportItems(), { storePath: "data/chronicle.json" });

  assert.match(html, /What Shipped/);
  assert.match(html, /Blocked/);
  assert.match(html, /Decisions/);
  assert.match(html, /Team-safe shipped summary/);
  assert.match(html, /Public launch note/);
  assert.doesNotMatch(html, /Private roadmap spike/);
  assert.doesNotMatch(html, /PRIVATE_RAW_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /TEAM_RAW_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /PUBLIC_RAW_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /PUBLIC_SUMMARY_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /src\/secret-file.js/);
});

test("team report renders to file through renderer and CLI", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "chronicle-team-"));
  try {
    const storePath = path.join(tempDir, "chronicle.json");
    const rendererPath = path.join(tempDir, "team-renderer.html");
    const cliPath = path.join(tempDir, "team-cli.html");
    await writeFile(storePath, `${JSON.stringify({ schema_version: 2, generated_by: "test", items: teamReportItems() }, null, 2)}\n`, "utf8");

    const result = await renderTeamReportToFile({ storePath, outputPath: rendererPath });
    await main(["render", "team", "--store", storePath, "--output", cliPath]);

    assert.equal(result.visibleCount, 4);
    assert.match(await readFile(rendererPath, "utf8"), /Chronicle Team Report/);
    assert.match(await readFile(cliPath, "utf8"), /Team-safe shipped summary/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("public build page only renders safe public summaries", () => {
  const html = renderPublicBuildPage(publicBuildItems(), { version: "v0.1.0" });

  assert.match(html, /Chronicle Build Log/);
  assert.match(html, /Added the public timeline/);
  assert.match(html, /Node.js/);
  assert.doesNotMatch(html, /PRIVATE_RAW_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /TEAM_RAW_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /PUBLIC_RAW_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /SUMMARY_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /UNSAFE_PUBLIC_DO_NOT_RENDER/);
  assert.doesNotMatch(html, /\/Users\/me\/secret/);
  assert.doesNotMatch(html, /localhost:3000/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<script src=/i);
  assert.doesNotMatch(html, /<link/i);
});

test("public draft and ship commands enforce approval", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "chronicle-public-"));
  try {
    const storePath = path.join(tempDir, "chronicle.json");
    const draftPath = path.join(tempDir, "public-draft.html");
    const shipPath = path.join(tempDir, "public", "index.html");
    await writeFile(storePath, `${JSON.stringify({ schema_version: 2, generated_by: "test", items: publicStoreItems() }, null, 2)}\n`, "utf8");

    await main(["public", "draft", "--version", "v0.1.0", "--store", storePath, "--output", draftPath]);
    assert.match(await readFile(draftPath, "utf8"), /Added the public timeline/);
    assert.equal(JSON.parse(await readFile(storePath, "utf8")).items.some((item) => item.kind === "release"), false);

    await assert.rejects(
      () => main(["public", "ship", "--version", "v0.1.0", "--store", storePath, "--output", shipPath]),
      /--approve/,
    );

    await main(["public", "ship", "--version", "v0.1.0", "--approve", "--dry-run", "--store", storePath, "--output", shipPath]);
    assert.match(await readFile(shipPath, "utf8"), /Added the public timeline/);
    assert.equal(JSON.parse(await readFile(storePath, "utf8")).items.some((item) => item.kind === "release"), false);

    await main(["public", "ship", "--version", "v0.1.0", "--approve", "--store", storePath, "--output", shipPath]);
    const shippedStore = JSON.parse(await readFile(storePath, "utf8"));
    const release = shippedStore.items.find((item) => item.kind === "release");
    assert.equal(release.visibility, "public");
    assert.equal(release.data.version, "v0.1.0");
    assert.deepEqual(release.data.item_ids, ["evt_public_good"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("public GitHub Pages dry run does not record a release", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "chronicle-pages-dry-"));
  try {
    const storePath = path.join(tempDir, "chronicle.json");
    const outputPath = path.join(tempDir, "public", "index.html");
    await writeFile(storePath, `${JSON.stringify({ schema_version: 2, generated_by: "test", items: publicStoreItems() }, null, 2)}\n`, "utf8");

    await main([
      "public",
      "ship",
      "--version",
      "v0.1.0",
      "--approve",
      "--dry-run",
      "--github-pages",
      "--store",
      storePath,
      "--output",
      outputPath,
    ]);

    assert.match(await readFile(outputPath, "utf8"), /Added the public timeline/);
    assert.equal(JSON.parse(await readFile(storePath, "utf8")).items.some((item) => item.kind === "release"), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("project brain renders every main tab, search data, and no external dependencies", () => {
  const html = renderProjectBrain(sampleItems(), { storePath: "data/chronicle.json" });

  for (const panel of ["overview", "features", "files", "timeline", "decisions", "roadmap"]) {
    assert.match(html, new RegExp(`data-panel="${panel}"`));
  }
  assert.match(html, /window.__CHRONICLE_DATA__/);
  assert.match(html, /data-go-tab="files"/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /<script src=/i);
  assert.doesNotMatch(html, /<link/i);
  assert.doesNotMatch(html, /onclick=/i);
  assert.doesNotMatch(html, /CSS\.escape/);
});

test("project brain and root index render to files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "chronicle-brain-"));
  try {
    const storePath = path.join(tempDir, "chronicle.json");
    const brainPath = path.join(tempDir, "project-brain.html");
    const indexPath = path.join(tempDir, "_INDEX.md");
    await writeFile(storePath, `${JSON.stringify({ schema_version: 2, generated_by: "test", items: sampleItems() }, null, 2)}\n`, "utf8");

    const brainResult = await renderProjectBrainToFile({ storePath, outputPath: brainPath });
    const indexResult = await renderRootIndexToFile({ storePath, outputPath: indexPath });

    assert.equal(brainResult.itemCount, 4);
    assert.equal(indexResult.itemCount, 4);
    assert.match(await readFile(brainPath, "utf8"), /Project Brain/);
    assert.match(await readFile(indexPath, "utf8"), /Key Files/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("secret detector flags likely API keys", () => {
  const fakeKey = `sk-${"abcdefghijklmnopqrstuvwxyz123456"}`;
  assert.deepEqual(detectSecrets(`OPENAI_API_KEY=${fakeKey}`), ["openai_key", "generic_secret_assignment"]);
});

test("captureSession forces secret-looking summaries to private", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "chronicle-secret-"));
  try {
    const storePath = path.join(tempDir, "chronicle.json");
    const transcriptPath = path.resolve("tests/fixtures/claude-session.jsonl");

    await captureSession({
      cwd: tempDir,
      hookInput: {
        session_id: "secret-session-001",
        transcript_path: transcriptPath,
        hook_event_name: "Stop",
        turn_id: "turn-secret",
      },
      sourceTool: "claude-code",
      storePath,
      outputPath: path.join(tempDir, "devlog.html"),
      summaryOverride: `Stored OPENAI_API_KEY=${`sk-${"abcdefghijklmnopqrstuvwxyz123456"}`} while debugging.`,
    });

    const store = JSON.parse(await readFile(storePath, "utf8"));
    assert.equal(store.items[0].visibility, "private");
    assert.ok(store.items[0].safety_flags.includes("raw_summary:openai_key"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("public events reject local paths and internal URLs", () => {
  const event = {
    id: "evt_1234abcd",
    kind: "event",
    type: "note",
    date: "2026-05-29",
    session_id: "session",
    source_tool: "codex",
    title: "Updated /Users/me/private/app.js",
    summary: "Safe summary",
    raw_summary: "Safe raw summary",
    public_summary: "See http://localhost:3000 for the demo",
    tech: [],
    tags: [],
    files_touched: 0,
    visibility: "public",
    confidence: "high",
    status: "completed",
    source_ref: {},
    files: [],
    links: { features: [], files: [], decisions: [], roadmap: [], events: [], releases: [] },
    data: {},
    safety_flags: [],
    created_at: "2026-05-29T00:00:00.000Z",
    updated_at: "2026-05-29T00:00:00.000Z",
  };

  assert.ok(validateEvent(event).some((error) => error.includes("public items cannot contain")));
});

function sampleItems() {
  return [
    baseItem({
      id: "evt_phase3",
      kind: "event",
      type: "feature_added",
      title: "Built the project brain renderer",
      summary: "Rendered tabs, cross-links, and search.",
      raw_summary: "Rendered tabs, cross-links, and search.",
      session_id: "session-phase3",
      source_tool: "codex",
      tech: ["Node.js", "HTML"],
      files: ["src/render/projectBrain.js"],
      links: { features: ["feat_brain"], files: ["file_projectbrain"], decisions: [], roadmap: [], events: [], releases: [] },
    }),
    baseItem({
      id: "feat_brain",
      kind: "feature",
      title: "Project brain HTML",
      summary: "A self-contained HTML page for the private project brain.",
      raw_summary: "A self-contained HTML page for the private project brain.",
      status: "completed",
      files: ["src/render/projectBrain.js"],
      links: { features: [], files: ["file_projectbrain"], decisions: ["dec_single_file"], roadmap: [], events: ["evt_phase3"], releases: [] },
    }),
    baseItem({
      id: "file_projectbrain",
      kind: "file",
      title: "src/render/projectBrain.js",
      summary: "Renders the project brain HTML.",
      raw_summary: "Renders the project brain HTML.",
      data: { path: "src/render/projectBrain.js", role: "Renders the project brain HTML." },
      links: { features: ["feat_brain"], files: [], decisions: [], roadmap: [], events: ["evt_phase3"], releases: [] },
    }),
    baseItem({
      id: "dec_single_file",
      kind: "decision",
      title: "Use one self-contained HTML file",
      summary: "A single file works offline and is easy to share privately.",
      raw_summary: "A single file works offline and is easy to share privately.",
      links: { features: ["feat_brain"], files: [], decisions: [], roadmap: [], events: [], releases: [] },
    }),
  ];
}

function teamReportItems() {
  return [
    baseItem({
      id: "evt_private_hidden",
      kind: "event",
      type: "feature_added",
      title: "Private roadmap spike",
      summary: "Private summary should not render.",
      raw_summary: "PRIVATE_RAW_DO_NOT_RENDER src/secret-file.js",
      visibility: "private",
      status: "completed",
      session_id: "private-session",
      source_tool: "codex",
    }),
    baseItem({
      id: "evt_team_shipped",
      kind: "event",
      type: "feature_added",
      title: "Team shipped item",
      summary: "Team-safe shipped summary",
      raw_summary: "TEAM_RAW_DO_NOT_RENDER",
      visibility: "team",
      status: "completed",
      session_id: "team-session",
      source_tool: "codex",
      tech: ["Node.js"],
      data: { time_spent_minutes: 95 },
    }),
    baseItem({
      id: "evt_public_launch",
      kind: "event",
      type: "feature_added",
      title: "Public launch item",
      summary: "PUBLIC_SUMMARY_DO_NOT_RENDER",
      raw_summary: "PUBLIC_RAW_DO_NOT_RENDER",
      public_summary: "Public launch note",
      visibility: "public",
      status: "completed",
      session_id: "public-session",
      source_tool: "claude-code",
    }),
    baseItem({
      id: "evt_team_blocked",
      kind: "event",
      type: "note",
      title: "Waiting on deploy token",
      summary: "Blocked until deployment credentials are confirmed.",
      raw_summary: "BLOCKED_RAW_DO_NOT_RENDER",
      visibility: "team",
      status: "blocked",
      session_id: "blocked-session",
      source_tool: "gemini",
    }),
    baseItem({
      id: "dec_team_architecture",
      kind: "decision",
      title: "Keep reports static",
      summary: "Static reports are easy to share and review.",
      raw_summary: "DECISION_RAW_DO_NOT_RENDER",
      visibility: "team",
      status: "completed",
    }),
  ];
}

function publicBuildItems() {
  return [
    baseItem({
      id: "evt_private_hidden",
      kind: "event",
      type: "feature_added",
      title: "Private hidden item",
      summary: "Private summary should not render.",
      raw_summary: "PRIVATE_RAW_DO_NOT_RENDER /Users/me/secret/private.js",
      visibility: "private",
      session_id: "private-session",
      source_tool: "codex",
    }),
    baseItem({
      id: "evt_team_hidden",
      kind: "event",
      type: "feature_added",
      title: "Team hidden item",
      summary: "Team summary should not render.",
      raw_summary: "TEAM_RAW_DO_NOT_RENDER",
      visibility: "team",
      session_id: "team-session",
      source_tool: "codex",
    }),
    baseItem({
      id: "evt_public_good",
      kind: "event",
      type: "feature_added",
      title: "Public timeline",
      summary: "SUMMARY_DO_NOT_RENDER",
      raw_summary: "PUBLIC_RAW_DO_NOT_RENDER",
      public_summary: "Added the public timeline.",
      visibility: "public",
      session_id: "public-session",
      source_tool: "claude-code",
      tech: ["Node.js", "/Users/me/secret-tech"],
    }),
    baseItem({
      id: "evt_public_unsafe",
      kind: "event",
      type: "note",
      title: "Unsafe public item",
      summary: "Unsafe summary should not render.",
      raw_summary: "Unsafe raw should not render.",
      public_summary: "UNSAFE_PUBLIC_DO_NOT_RENDER http://localhost:3000",
      visibility: "public",
      safety_flags: ["public_summary:internal_url"],
      session_id: "unsafe-session",
      source_tool: "gemini",
    }),
  ];
}

function publicStoreItems() {
  return [
    baseItem({
      id: "evt_public_good",
      kind: "event",
      type: "feature_added",
      title: "Public timeline",
      summary: "Added the public timeline.",
      raw_summary: "Added the public timeline.",
      public_summary: "Added the public timeline.",
      visibility: "public",
      status: "completed",
      session_id: "public-session",
      source_tool: "claude-code",
      tech: ["Node.js"],
    }),
    baseItem({
      id: "evt_private_hidden",
      kind: "event",
      type: "note",
      title: "Private note",
      summary: "Private note",
      raw_summary: "Private note",
      visibility: "private",
      session_id: "private-session",
      source_tool: "codex",
    }),
  ];
}

function baseItem(overrides) {
  const files = overrides.files ?? [];
  return {
    id: "evt_base",
    kind: "event",
    type: "note",
    title: "Base item",
    summary: "Base summary",
    raw_summary: "Base summary",
    public_summary: "",
    date: "2026-05-29",
    session_id: undefined,
    source_tool: undefined,
    tech: [],
    tags: [],
    files_touched: files.length,
    visibility: "private",
    confidence: "high",
    status: "unknown",
    source_ref: {},
    files,
    links: { features: [], files: [], decisions: [], roadmap: [], events: [], releases: [] },
    data: {},
    safety_flags: [],
    created_at: "2026-05-29T00:00:00.000Z",
    updated_at: "2026-05-29T00:00:00.000Z",
    ...overrides,
    files_touched: files.length,
  };
}
