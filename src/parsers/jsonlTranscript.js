import { cleanText } from "../utils/text.js";

const FILE_PATTERN = /(?:^|[\s"'`(])((?:\.{1,2}\/|\/)?[A-Za-z0-9_@./-]+\.(?:js|jsx|ts|tsx|mjs|cjs|py|json|md|html|css|scss|yml|yaml|toml|sql|go|rs|java|kt|swift|php|rb|sh|txt|xml|lock))(?:$|[\s"'`),:])/g;
const IGNORED_BARE_WORDS = new Set(["Node.js", "Next.js", "Auth.js"]);

export function parseJsonlTranscript(raw, sourceTool) {
  const records = raw.split(/\r?\n/).filter(Boolean).map((line) => safeJson(line));
  const session = {
    userPrompts: [],
    assistantMessages: [],
    tools: [],
    commands: [],
    files: [],
    errors: [],
    decisions: [],
    packageChanges: [],
    testCommands: [],
    notes: [],
    confidence: records.length > 0 ? "medium" : "low",
    sessionId: null,
  };

  for (const record of records) {
    if (!record) {
      continue;
    }
    session.sessionId ??= record.session_id ?? record.sessionId ?? null;
    collectRecord(record, session, sourceTool);
  }

  session.files = Array.from(new Set(session.files.map(normalizeFilePath).filter(Boolean)));
  session.tools = Array.from(new Set(session.tools.filter(Boolean)));
  session.commands = Array.from(new Set(session.commands.filter(Boolean)));
  session.errors = compact(Array.from(new Set(session.errors)));
  session.decisions = compact(Array.from(new Set(session.decisions)));
  session.packageChanges = compact(Array.from(new Set(session.packageChanges)));
  session.testCommands = compact(Array.from(new Set(session.testCommands)));
  session.userPrompts = compact(session.userPrompts);
  session.assistantMessages = compact(session.assistantMessages);

  if (session.assistantMessages.length > 0 || session.files.length > 0) {
    session.confidence = "high";
  }

  return session;
}

function collectRecord(record, session) {
  const role = record.message?.role ?? record.role ?? record.type ?? "";
  const content = record.message?.content ?? record.content ?? record.items ?? record.output ?? record.input;

  if (role === "user") {
    session.userPrompts.push(...extractText(content));
  }
  if (role === "assistant") {
    session.assistantMessages.push(...extractText(content));
  }

  walk(record, (value, key) => {
    if (key === "name" && typeof value === "string" && looksLikeToolName(value)) {
      session.tools.push(value);
    }
    if ((key === "command" || key === "cmd") && typeof value === "string") {
      session.commands.push(value);
      if (/\b(test|vitest|jest|playwright|pytest|cargo test|go test|npm test|pnpm test)\b/i.test(value)) {
        session.testCommands.push(value);
      }
      if (/\b(npm install|npm i|pnpm add|yarn add|pip install|bundle add|cargo add)\b/i.test(value)) {
        session.packageChanges.push(value);
      }
    }
    if ((key === "file_path" || key === "filepath" || key === "path") && typeof value === "string") {
      session.files.push(value);
    }
    if (typeof value === "string") {
      session.files.push(...extractFilePaths(value));
      collectTextSignals(value, session);
    }
  });
}

function collectTextSignals(value, session) {
  const text = cleanText(value, 700);
  if (!text) {
    return;
  }
  if (/\b(error|failed|failure|exception|traceback|blocked|blocker|cannot|could not)\b/i.test(text)) {
    session.errors.push(text);
  }
  if (/\b(decided|decision|chose|chosen|because|tradeoff|instead of|switched from)\b/i.test(text)) {
    session.decisions.push(text);
  }
}

function extractText(value) {
  const text = [];
  walk(value, (inner, key) => {
    if (typeof inner !== "string") {
      return;
    }
    if (["text", "content", "message", "summary"].includes(key)) {
      text.push(inner);
    }
  });
  return text;
}

function walk(value, visitor, key = "") {
  visitor(value, key);
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visitor, key);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      walk(childValue, visitor, childKey);
    }
  }
}

function extractFilePaths(text) {
  const matches = [];
  for (const match of text.matchAll(FILE_PATTERN)) {
    matches.push(match[1]);
  }
  return matches;
}

function normalizeFilePath(filePath) {
  const normalized = filePath.trim().replace(/^['"`]+|['"`.,:;]+$/g, "").replace(/\/+/g, "/");
  if (IGNORED_BARE_WORDS.has(normalized)) {
    return "";
  }
  return normalized;
}

function compact(items) {
  return items.map((item) => cleanText(item, 1200)).filter(Boolean);
}

function safeJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function looksLikeToolName(value) {
  return /^(Bash|Edit|Write|Read|MultiEdit|Glob|Grep|TodoWrite|apply_patch|mcp__|Shell|Run|Save|Replace)/.test(value);
}
