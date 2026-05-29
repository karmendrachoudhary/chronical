import { scanTextForSafety } from "../safety/redaction.js";

const ITEM_KINDS = new Set(["event", "feature", "file", "decision", "roadmap", "release", "action_intent"]);
const EVENT_TYPES = new Set(["feature_added", "bugfix", "refactor", "dependency_changed", "version_bump", "decision", "note"]);
const SOURCE_TOOLS = new Set(["claude-code", "codex", "gemini"]);
const VISIBILITIES = new Set(["private", "team", "public"]);
const CONFIDENCE = new Set(["low", "medium", "high"]);
const STATUSES = new Set(["completed", "blocked", "in_progress", "planned", "idea", "unknown"]);
const ALLOWED_ITEM_KEYS = new Set([
  "id",
  "kind",
  "type",
  "title",
  "summary",
  "raw_summary",
  "public_summary",
  "date",
  "session_id",
  "source_tool",
  "tech",
  "tags",
  "files_touched",
  "visibility",
  "confidence",
  "status",
  "source_ref",
  "files",
  "links",
  "data",
  "safety_flags",
  "created_at",
  "updated_at",
]);

export function validateEventStore(store) {
  return validateChronicleStore(store);
}

export function validateChronicleStore(store) {
  const errors = [];
  if (!store || typeof store !== "object" || Array.isArray(store)) {
    return ["store must be an object"];
  }
  if (store.schema_version !== 2) {
    errors.push("schema_version must be 2");
  }
  if (!Array.isArray(store.items)) {
    errors.push("items must be an array");
    return errors;
  }

  const ids = new Set();
  store.items.forEach((item, index) => {
    for (const error of validateItem(item)) {
      errors.push(`items[${index}].${error}`);
    }
    if (ids.has(item?.id)) {
      errors.push(`items[${index}].id duplicates an earlier item`);
    }
    ids.add(item?.id);
  });
  return errors;
}

export function validateEvent(event) {
  return validateItem(event);
}

export function validateItem(item) {
  const errors = [];
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return ["must be an object"];
  }

  for (const key of Object.keys(item)) {
    if (!ALLOWED_ITEM_KEYS.has(key)) {
      errors.push(`${key} is not allowed by schema version 2`);
    }
  }

  requiredString(item, "id", errors, /^(evt|feat|file|dec|plan|rel|act)_[a-z0-9_-]{4,}$/);
  requiredEnum(item, "kind", ITEM_KINDS, errors);
  requiredString(item, "title", errors);
  requiredString(item, "summary", errors, undefined, { allowEmpty: true });
  requiredString(item, "raw_summary", errors, undefined, { allowEmpty: true });
  requiredString(item, "public_summary", errors, undefined, { allowEmpty: true });
  requiredString(item, "date", errors, /^\d{4}-\d{2}-\d{2}$/);
  requiredArrayOfStrings(item, "tech", errors);
  requiredArrayOfStrings(item, "tags", errors);
  requiredInteger(item, "files_touched", errors, { min: 0 });
  requiredEnum(item, "visibility", VISIBILITIES, errors);
  requiredEnum(item, "confidence", CONFIDENCE, errors);
  requiredEnum(item, "status", STATUSES, errors);
  requiredArrayOfStrings(item, "files", errors);
  requiredLinks(item.links, errors);
  requiredArrayOfStrings(item, "safety_flags", errors);
  requiredString(item, "created_at", errors);
  requiredString(item, "updated_at", errors);

  if (item.kind === "event") {
    requiredEnum(item, "type", EVENT_TYPES, errors);
    requiredString(item, "session_id", errors);
    requiredEnum(item, "source_tool", SOURCE_TOOLS, errors);
  }

  if (item.kind === "file" && !item.data?.path) {
    errors.push("file items must set data.path");
  }

  if (item.visibility === "public") {
    if (!item.public_summary.trim()) {
      errors.push("public_summary is required when visibility is public");
    }
    const computedFlags = [
      ...scanTextForSafety(item.raw_summary, { field: "raw_summary", includePrivacyPatterns: false }),
      ...scanTextForSafety(item.public_summary, { field: "public_summary", includePrivacyPatterns: true }),
      ...scanTextForSafety(item.title, { field: "title", includePrivacyPatterns: true }),
      ...scanTextForSafety(item.summary, { field: "summary", includePrivacyPatterns: true }),
    ].map((flag) => flag.label);
    if (item.safety_flags.length > 0 || computedFlags.length > 0) {
      errors.push("public items cannot contain safety flags or publishable secret/privacy patterns");
    }
  }

  if (item.files_touched !== item.files.length) {
    errors.push("files_touched must match files.length");
  }

  return errors;
}

export function assertValidEventStore(store) {
  assertValidChronicleStore(store);
}

export function assertValidChronicleStore(store) {
  const errors = validateChronicleStore(store);
  if (errors.length > 0) {
    throw new Error(`Chronicle store is invalid:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

export function assertValidEvents(items) {
  assertValidItems(items);
}

export function assertValidItems(items) {
  const errors = items.flatMap((item, index) => validateItem(item).map((error) => `items[${index}].${error}`));
  if (errors.length > 0) {
    throw new Error(`Chronicle item is invalid:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

function requiredString(item, field, errors, pattern, { allowEmpty = false } = {}) {
  if (typeof item[field] !== "string" || (!allowEmpty && !item[field].trim())) {
    errors.push(`${field} must be a ${allowEmpty ? "string" : "non-empty string"}`);
    return;
  }
  if (pattern && !pattern.test(item[field])) {
    errors.push(`${field} has an invalid format`);
  }
}

function requiredEnum(item, field, allowed, errors) {
  if (!allowed.has(item[field])) {
    errors.push(`${field} must be one of ${Array.from(allowed).join(", ")}`);
  }
}

function requiredArrayOfStrings(item, field, errors) {
  if (!Array.isArray(item[field]) || item[field].some((entry) => typeof entry !== "string")) {
    errors.push(`${field} must be an array of strings`);
  }
}

function requiredLinks(links, errors) {
  if (!links || typeof links !== "object" || Array.isArray(links)) {
    errors.push("links must be an object");
    return;
  }
  for (const [key, value] of Object.entries(links)) {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
      errors.push(`links.${key} must be an array of strings`);
    }
  }
}

function requiredInteger(item, field, errors, { min } = {}) {
  if (!Number.isInteger(item[field])) {
    errors.push(`${field} must be an integer`);
    return;
  }
  if (Number.isInteger(min) && item[field] < min) {
    errors.push(`${field} must be >= ${min}`);
  }
}
