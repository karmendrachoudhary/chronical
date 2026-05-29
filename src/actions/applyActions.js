import { readFile } from "node:fs/promises";
import path from "node:path";
import { syncMarkdownSourceToStore, writeItemsMarkdown } from "../source/markdownSource.js";
import { loadChronicleStore } from "../store/eventsStore.js";

const ALLOWED_ACTIONS = new Set(["set_feature_status", "set_roadmap_status"]);
const ALLOWED_STATUSES = new Set(["completed", "blocked", "in_progress", "planned", "idea", "unknown"]);

export async function applyActionIntents({ storePath, actionsPath, rootDir = process.cwd(), sourceDir = "chronicle", approve = false }) {
  if (!approve) {
    throw new Error("Refusing to apply action intents without --approve. Review chronicle-actions.json first, then rerun with --approve.");
  }

  const store = await loadChronicleStore(storePath);
  const actions = await loadActionFile(actionsPath);
  const byId = new Map(store.items.map((item) => [item.id, item]));
  const updated = [];
  const skipped = [];

  for (const intent of actions) {
    const result = applyIntent(intent, byId);
    if (result.item) {
      byId.set(result.item.id, result.item);
      updated.push(result.item);
    } else {
      skipped.push({ intent, reason: result.reason });
    }
  }

  if (updated.length > 0) {
    await writeItemsMarkdown({ rootDir, sourceDir, items: updated, subdir: path.join("actions") });
    await syncMarkdownSourceToStore({ rootDir, sourceDir, storePath });
  }

  return { appliedCount: updated.length, skippedCount: skipped.length, skipped };
}

export async function loadActionFile(actionsPath) {
  const parsed = JSON.parse(await readFile(actionsPath, "utf8"));
  const intents = Array.isArray(parsed) ? parsed : parsed.intents;
  if (!Array.isArray(intents)) {
    throw new Error("Action file must be an array or an object with an intents array.");
  }
  return intents.map(normalizeIntent);
}

export function normalizeIntent(intent) {
  return {
    action: String(intent?.action ?? ""),
    target: String(intent?.target ?? ""),
    value: String(intent?.value ?? ""),
    created_at: String(intent?.created_at ?? new Date().toISOString()),
  };
}

function applyIntent(intent, byId) {
  if (!ALLOWED_ACTIONS.has(intent.action)) {
    return { reason: `unsupported action ${intent.action}` };
  }
  if (!ALLOWED_STATUSES.has(intent.value)) {
    return { reason: `unsupported status ${intent.value}` };
  }

  const item = byId.get(intent.target);
  if (!item) {
    return { reason: `target ${intent.target} was not found` };
  }

  if (intent.action === "set_feature_status" && item.kind !== "feature") {
    return { reason: `target ${intent.target} is not a feature` };
  }
  if (intent.action === "set_roadmap_status" && item.kind !== "roadmap") {
    return { reason: `target ${intent.target} is not a roadmap item` };
  }

  return {
    item: {
      ...item,
      status: intent.value,
      updated_at: new Date().toISOString(),
      data: {
        ...(item.data ?? {}),
        last_action_intent: intent,
      },
    },
  };
}
