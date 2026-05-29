import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { upsertItems } from "../store/eventsStore.js";
import { writeTextFileAtomic } from "../utils/atomic.js";

const SOURCE_MARKER = "<!-- Chronicle source item. Edit narrative fields carefully; regenerate HTML after changes. -->";

export async function writeSessionItemMarkdown({ rootDir = process.cwd(), sourceDir = "chronicle", item }) {
  const date = item.date || new Date().toISOString().slice(0, 10);
  return writeItemMarkdown({ rootDir, sourceDir, item, subdir: path.join("sessions", date) });
}

export async function writeItemMarkdown({ rootDir = process.cwd(), sourceDir = "chronicle", item, subdir = null }) {
  const existingSource = safeExistingMarkdownSource({ rootDir, sourceDir, item });
  const itemSubdir = subdir ?? path.join("items", item.kind ?? "unknown");
  const filePath = existingSource ?? path.join(rootDir, sourceDir, itemSubdir, `${safeFileName(item.id)}.md`);
  await writeTextFileAtomic(filePath, itemToMarkdown(item), { backup: true });
  return filePath;
}

export async function writeItemsMarkdown({ rootDir = process.cwd(), sourceDir = "chronicle", items, subdir = null }) {
  const paths = [];
  for (const item of items) {
    paths.push(await writeItemMarkdown({ rootDir, sourceDir, item, subdir }));
  }
  return paths;
}

export async function syncMarkdownSourceToStore({ rootDir = process.cwd(), sourceDir = "chronicle", storePath }) {
  const items = await readMarkdownSourceItems({ rootDir, sourceDir });
  if (!items.length) {
    return { itemCount: 0, insertedCount: 0, updatedCount: 0 };
  }

  const result = await upsertItems(storePath, items);
  return { itemCount: items.length, ...result };
}

export async function readMarkdownSourceItems({ rootDir = process.cwd(), sourceDir = "chronicle" } = {}) {
  const sourceRoot = path.join(rootDir, sourceDir);
  const files = await findMarkdownFiles(sourceRoot);
  const items = [];

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8").catch(() => null);
    const item = raw ? markdownToItem(raw, filePath, rootDir) : null;
    if (item) {
      items.push(item);
    }
  }

  return items;
}

export function itemToMarkdown(item) {
  const metadata = {
    schema_version: 1,
    id: item.id,
    kind: item.kind,
    type: item.type,
    date: item.date,
    session_id: item.session_id,
    source_tool: item.source_tool,
    visibility: item.visibility,
    status: item.status,
    confidence: item.confidence,
    tech: item.tech ?? [],
    tags: item.tags ?? [],
    files: item.files ?? [],
    files_touched: item.files_touched ?? 0,
    links: item.links ?? {},
    source_ref: item.source_ref ?? {},
    data: { ...(item.data ?? {}), source_format: "markdown" },
    safety_flags: item.safety_flags ?? [],
    created_at: item.created_at,
    updated_at: item.updated_at,
  };

  return `${SOURCE_MARKER}
---chronicle-json
${JSON.stringify(metadata, null, 2)}
---
# ${item.title ?? "Untitled Chronicle item"}

## Summary

${item.summary ?? ""}

## Raw Notes

${item.raw_summary ?? ""}

## Public Summary

${item.public_summary ?? ""}
`;
}

export function markdownToItem(markdown, filePath = "source.md", rootDir = process.cwd()) {
  const match = String(markdown).match(/---chronicle-json\n([\s\S]*?)\n---\n/);
  if (!match) return null;

  const metadata = JSON.parse(match[1]);
  const sections = parseSections(markdown.slice(match.index + match[0].length));
  const title = firstHeading(markdown) ?? metadata.title ?? metadata.id;
  const sourcePath = path.relative(rootDir, filePath).split(path.sep).join("/");

  return {
    ...metadata,
    title,
    summary: sections.Summary ?? metadata.summary ?? "",
    raw_summary: sections["Raw Notes"] ?? metadata.raw_summary ?? "",
    public_summary: sections["Public Summary"] ?? metadata.public_summary ?? "",
    source_ref: { ...(metadata.source_ref ?? {}), markdown_source: sourcePath },
    data: { ...(metadata.data ?? {}), source_format: "markdown" },
  };
}

async function findMarkdownFiles(directory) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMarkdownFiles(filePath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(filePath);
    }
  }
  return files;
}

function parseSections(markdown) {
  const sections = {};
  const lines = String(markdown).split(/\r?\n/);
  let current = null;
  let buffer = [];

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (current) sections[current] = buffer.join("\n").trim();
      current = heading[1].trim();
      buffer = [];
    } else if (current) {
      buffer.push(line);
    }
  }
  if (current) sections[current] = buffer.join("\n").trim();
  return sections;
}

function firstHeading(markdown) {
  return String(markdown).split(/\r?\n/).find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim();
}

function safeFileName(value) {
  return String(value ?? "item").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function safeExistingMarkdownSource({ rootDir, sourceDir, item }) {
  const sourcePath = item?.source_ref?.markdown_source;
  if (!sourcePath || typeof sourcePath !== "string") return null;
  const normalizedSourceDir = sourceDir.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  const normalizedSourcePath = sourcePath.replaceAll("\\", "/");
  if (!normalizedSourcePath.startsWith(`${normalizedSourceDir}/`)) return null;

  const resolved = path.resolve(rootDir, normalizedSourcePath);
  const sourceRoot = path.resolve(rootDir, sourceDir);
  const relative = path.relative(sourceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}
