import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertValidChronicleStore, assertValidItems } from "../schema/validateEvents.js";
import { formatLocalDate, nowIso } from "../utils/date.js";

const EMPTY_LINKS = {
  features: [],
  files: [],
  decisions: [],
  roadmap: [],
  events: [],
  releases: [],
};

const GENERATED_BY = "chronicle-devlog@0.4.0";

export async function loadEventStore(storePath) {
  return loadChronicleStore(storePath);
}

export async function loadChronicleStore(storePath) {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return emptyStore();
    }
    throw error;
  }
}

export async function appendEvents(storePath, events) {
  return appendItems(storePath, events.map((event) => normalizeItem({ ...event, kind: "event" })));
}

export async function appendItems(storePath, items) {
  const store = await loadChronicleStore(storePath);
  const normalizedItems = items.map(normalizeItem);
  assertValidItems(normalizedItems);

  const existingKeys = new Set(store.items.map(itemKey));
  const newItems = [];
  let skippedCount = 0;

  for (const item of normalizedItems) {
    const key = itemKey(item);
    if (existingKeys.has(key)) {
      skippedCount += 1;
      continue;
    }
    existingKeys.add(key);
    newItems.push(item);
  }

  const nextStore = withCompatibilityViews({
    schema_version: 2,
    generated_by: GENERATED_BY,
    items: [...store.items, ...newItems].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
  });

  assertValidChronicleStore(nextStore);

  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(toPersistedStore(nextStore), null, 2)}\n`, "utf8");

  return { appendedCount: newItems.length, skippedCount };
}

export function normalizeStore(parsed) {
  if (Array.isArray(parsed)) {
    return withCompatibilityViews({ ...emptyStore(), items: parsed.map(legacyEventToItem) });
  }
  if (Array.isArray(parsed?.items)) {
    return withCompatibilityViews({
      schema_version: 2,
      generated_by: parsed.generated_by ?? GENERATED_BY,
      items: parsed.items.map(normalizeItem),
    });
  }
  if (Array.isArray(parsed?.events)) {
    return withCompatibilityViews({
      schema_version: 2,
      generated_by: parsed.generated_by ?? GENERATED_BY,
      items: parsed.events.map(legacyEventToItem),
    });
  }
  return emptyStore();
}

export function normalizeItem(item) {
  const kind = item.kind ?? "event";
  const files = Array.isArray(item.files) ? item.files.filter((file) => typeof file === "string") : [];
  const rawSummary = typeof item.raw_summary === "string" ? item.raw_summary : "";
  const publicSummary = typeof item.public_summary === "string" ? item.public_summary : "";
  const summary = typeof item.summary === "string" ? item.summary : rawSummary;
  const createdAt = item.created_at ?? nowIso();
  const links = normalizeLinks(item.links, files);

  return {
    id: item.id ?? createFallbackId(kind, item.title ?? summary),
    kind,
    type: item.type ?? (kind === "event" ? "note" : undefined),
    title: item.title ?? titleFromSummary(summary || rawSummary),
    summary,
    raw_summary: rawSummary,
    public_summary: publicSummary,
    date: item.date ?? formatLocalDate(new Date()),
    session_id: item.session_id ?? (kind === "event" ? "manual" : undefined),
    source_tool: item.source_tool ?? (kind === "event" ? "claude-code" : undefined),
    tech: Array.isArray(item.tech) ? item.tech.filter((entry) => typeof entry === "string") : [],
    tags: Array.isArray(item.tags) ? item.tags.filter((entry) => typeof entry === "string") : [],
    files_touched: files.length,
    visibility: item.visibility ?? "private",
    confidence: item.confidence ?? "low",
    status: item.status ?? "unknown",
    source_ref: item.source_ref ?? {},
    files,
    links,
    data: item.data ?? {},
    safety_flags: Array.isArray(item.safety_flags) ? item.safety_flags.filter((entry) => typeof entry === "string") : [],
    created_at: createdAt,
    updated_at: item.updated_at ?? createdAt,
  };
}

export function legacyEventToItem(event) {
  return normalizeItem({
    ...event,
    kind: "event",
    summary: event.raw_summary ?? event.summary ?? "",
    links: normalizeLinks(event.links, event.files ?? []),
  });
}

function emptyStore() {
  return withCompatibilityViews({
    schema_version: 2,
    generated_by: GENERATED_BY,
    items: [],
  });
}

function withCompatibilityViews(store) {
  return {
    ...store,
    events: store.items.filter((item) => item.kind === "event"),
  };
}

function toPersistedStore(store) {
  return {
    schema_version: 2,
    generated_by: store.generated_by,
    items: store.items,
  };
}

function normalizeLinks(links, files = []) {
  const normalized = { ...EMPTY_LINKS, ...(links ?? {}) };
  normalized.files = Array.from(new Set([...(normalized.files ?? []), ...files]));
  return Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []]));
}

function titleFromSummary(summary) {
  const line = String(summary).split("\n").find((candidate) => /^(Outcome|Goal):/.test(candidate)) ?? String(summary).split("\n")[0] ?? "Captured session";
  return line.replace(/^(Outcome|Goal):\s*/, "").trim().slice(0, 120) || "Captured session";
}

function itemKey(item) {
  const turnId = item.source_ref?.turn_id;
  if (item.kind === "event" && turnId) {
    return `${item.source_tool}:${item.session_id}:${turnId}`;
  }
  return item.id;
}

function createFallbackId(kind, text) {
  const prefix = {
    event: "evt",
    feature: "feat",
    file: "file",
    decision: "dec",
    roadmap: "plan",
    release: "rel",
    action_intent: "act",
  }[kind] ?? "evt";
  let hash = 0;
  for (const char of String(text ?? "chronicle")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}
