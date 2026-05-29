import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { upsertItems } from "../store/eventsStore.js";
import { formatLocalDate } from "../utils/date.js";
import { cleanText } from "../utils/text.js";

const EMPTY_LINKS = {
  features: [],
  files: [],
  decisions: [],
  roadmap: [],
  events: [],
  releases: [],
};

export async function importSuperpowersArtifacts({
  storePath,
  rootDir = process.cwd(),
  specsDir = "docs/superpowers/specs",
  plansDir = "docs/superpowers/plans",
}) {
  const specs = await readMarkdownFiles(path.resolve(rootDir, specsDir), rootDir);
  const plans = await readMarkdownFiles(path.resolve(rootDir, plansDir), rootDir);
  const items = [
    ...specs.flatMap((file) => specFileToItems(file)),
    ...plans.flatMap((file) => planFileToItems(file)),
  ];

  if (items.length === 0) {
    return { insertedCount: 0, updatedCount: 0, itemCount: 0, specCount: specs.length, planCount: plans.length };
  }

  const result = await upsertItems(storePath, items);
  return { ...result, itemCount: items.length, specCount: specs.length, planCount: plans.length };
}

export function specFileToItems(file) {
  const title = cleanTitle(firstHeading(file.content) ?? path.basename(file.relativePath, ".md"));
  const summary = firstParagraph(file.content) || `Superpowers design spec from ${file.relativePath}.`;
  const featureId = itemId("feat", `${file.relativePath}:feature`);
  const decisionItems = decisionLines(file.content).map((line) => decisionItem({ file, line, featureId }));
  const feature = baseItem({
    id: featureId,
    kind: "feature",
    title,
    summary,
    raw_summary: file.content,
    status: "planned",
    tags: ["superpowers", "spec"],
    files: [file.relativePath],
    links: { ...EMPTY_LINKS, decisions: decisionItems.map((item) => item.id) },
    data: { artifact_type: "superpowers_spec", path: file.relativePath },
    created_at: file.modifiedAt,
    updated_at: file.modifiedAt,
  });

  return [feature, ...decisionItems];
}

export function planFileToItems(file) {
  const planTitle = cleanTitle(firstHeading(file.content) ?? path.basename(file.relativePath, ".md"));
  const tasks = parsePlanTasks(file.content);
  const items = [];

  for (const task of tasks) {
    const roadmapId = itemId("plan", `${file.relativePath}:roadmap:${task.title}`);
    const featureId = itemId("feat", `${file.relativePath}:feature:${task.title}`);
    const eventId = itemId("evt", `${file.relativePath}:event:${task.title}`);
    const status = taskStatus(task);

    items.push(baseItem({
      id: roadmapId,
      kind: "roadmap",
      title: task.title,
      summary: task.summary || `${task.title} from ${planTitle}.`,
      raw_summary: task.body,
      status,
      tags: ["superpowers", "plan"],
      files: [file.relativePath, ...task.files],
      links: { ...EMPTY_LINKS, features: status === "completed" ? [featureId] : [], events: status === "completed" ? [eventId] : [] },
      data: {
        artifact_type: "superpowers_plan_task",
        plan_path: file.relativePath,
        plan_title: planTitle,
        checkbox_total: task.checkboxTotal,
        checkbox_done: task.checkboxDone,
      },
      created_at: file.modifiedAt,
      updated_at: file.modifiedAt,
    }));

    if (status === "completed") {
      const summary = `Completed ${task.title} from ${planTitle}.`;
      items.push(baseItem({
        id: featureId,
        kind: "feature",
        title: task.title,
        summary,
        raw_summary: task.body,
        status: "completed",
        tags: ["superpowers", "completed-phase"],
        files: task.files,
        links: { ...EMPTY_LINKS, roadmap: [roadmapId], events: [eventId] },
        data: { artifact_type: "superpowers_completed_phase", plan_path: file.relativePath, roadmap_id: roadmapId },
        created_at: file.modifiedAt,
        updated_at: file.modifiedAt,
      }));
      items.push(baseItem({
        id: eventId,
        kind: "event",
        type: "feature_added",
        title: summary,
        summary,
        raw_summary: task.body,
        status: "completed",
        session_id: `superpowers:${file.relativePath}`,
        source_tool: "codex",
        tags: ["superpowers", "completed-phase"],
        files: task.files,
        links: { ...EMPTY_LINKS, features: [featureId], roadmap: [roadmapId] },
        data: { artifact_type: "superpowers_completed_phase", plan_path: file.relativePath, roadmap_id: roadmapId },
        created_at: file.modifiedAt,
        updated_at: file.modifiedAt,
      }));
    }
  }

  return items;
}

export function parsePlanTasks(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const tasks = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s+Task\s+\d+[:.)-]?\s*(.+)$/i);
    if (heading) {
      if (current) tasks.push(finalizeTask(current));
      current = { title: cleanTitle(heading[1]), bodyLines: [] };
      continue;
    }
    if (current) current.bodyLines.push(line);
  }

  if (current) tasks.push(finalizeTask(current));
  return tasks;
}

async function readMarkdownFiles(directory, rootDir) {
  try {
    await stat(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const entries = await walk(directory);
  const files = [];
  for (const filePath of entries.filter((entry) => entry.endsWith(".md"))) {
    const fileStat = await stat(filePath);
    files.push({
      absolutePath: filePath,
      relativePath: toPosix(path.relative(rootDir, filePath)),
      content: await readFile(filePath, "utf8"),
      modifiedAt: fileStat.mtime.toISOString(),
      date: formatLocalDate(fileStat.mtime),
    });
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function finalizeTask(task) {
  const body = task.bodyLines.join("\n").trim();
  const checkboxes = [...body.matchAll(/- \[(x|X| )\]/g)];
  return {
    title: task.title,
    body,
    summary: firstParagraph(body),
    files: extractFiles(body),
    checkboxTotal: checkboxes.length,
    checkboxDone: checkboxes.filter((match) => match[1].toLowerCase() === "x").length,
  };
}

function taskStatus(task) {
  if (task.checkboxTotal > 0 && task.checkboxDone === task.checkboxTotal) return "completed";
  if (task.checkboxDone > 0) return "in_progress";
  return "planned";
}

function decisionItem({ file, line, featureId }) {
  return baseItem({
    id: itemId("dec", `${file.relativePath}:decision:${line}`),
    kind: "decision",
    title: cleanTitle(line),
    summary: line,
    raw_summary: line,
    status: "completed",
    tags: ["superpowers", "spec-decision"],
    files: [file.relativePath],
    links: { ...EMPTY_LINKS, features: [featureId] },
    data: { artifact_type: "superpowers_spec_decision", path: file.relativePath },
    created_at: file.modifiedAt,
    updated_at: file.modifiedAt,
  });
}

function decisionLines(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const decisions = [];
  let insideDecisionSection = false;
  for (const line of lines) {
    const heading = line.match(/^#{2,4}\s+(.+)$/);
    if (heading) {
      insideDecisionSection = /decision|trade.?off|architecture/i.test(heading[1]);
      continue;
    }
    if (insideDecisionSection) {
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      if (bullet) decisions.push(bullet[1].trim());
    }
  }
  return decisions.slice(0, 12);
}

function extractFiles(markdown) {
  const files = new Set();
  const pathPattern = /`([^`]+\.[A-Za-z0-9]{1,8}(?::\d+(?:-\d+)?)?)`/g;
  for (const match of String(markdown ?? "").matchAll(pathPattern)) {
    const cleaned = match[1].replace(/:\d+(?:-\d+)?$/, "");
    if (!cleaned.includes(" ") && !cleaned.startsWith("http")) files.add(cleaned);
  }
  return Array.from(files).slice(0, 20);
}

function firstHeading(markdown) {
  return String(markdown ?? "").split(/\r?\n/).find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim();
}

function firstParagraph(markdown) {
  const withoutFences = String(markdown ?? "").replace(/```[\s\S]*?```/g, "");
  const paragraph = withoutFences
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^#{1,6}\s+.*$/gm, "").replace(/^>.*$/gm, "").trim())
    .find((block) => block && !block.startsWith("-") && !block.includes("REQUIRED SUB-SKILL"));
  return cleanText(paragraph, 260);
}

function baseItem(overrides) {
  const files = overrides.files ?? [];
  const createdAt = overrides.created_at ?? new Date().toISOString();
  return {
    id: overrides.id,
    kind: overrides.kind,
    type: overrides.type,
    title: overrides.title,
    summary: overrides.summary ?? "",
    raw_summary: overrides.raw_summary ?? overrides.summary ?? "",
    public_summary: "",
    date: overrides.date ?? formatLocalDate(new Date(createdAt)),
    session_id: overrides.session_id,
    source_tool: overrides.source_tool,
    tech: [],
    tags: overrides.tags ?? [],
    files_touched: files.length,
    visibility: "private",
    confidence: "medium",
    status: overrides.status ?? "unknown",
    source_ref: { superpowers_path: overrides.data?.path ?? overrides.data?.plan_path },
    files,
    links: overrides.links ?? EMPTY_LINKS,
    data: overrides.data ?? {},
    safety_flags: [],
    created_at: createdAt,
    updated_at: overrides.updated_at ?? createdAt,
  };
}

function cleanTitle(value) {
  return cleanText(String(value ?? "").replace(/^[:.)\-\s]+/, ""), 140) || "Untitled Superpowers artifact";
}

function itemId(prefix, value) {
  return `${prefix}_${hashText(value)}`;
}

function hashText(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
