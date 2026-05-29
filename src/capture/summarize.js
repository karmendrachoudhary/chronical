import { cleanText } from "../utils/text.js";
import { spawn } from "node:child_process";

const TYPE_RULES = [
  ["bugfix", /\b(fix|fixed|bug|crash|error|failing|regression|broken)\b/i],
  ["refactor", /\b(refactor|cleanup|simplify|restructure|rename)\b/i],
  ["dependency_changed", /\b(dependency|dependencies|package|npm install|pnpm add|yarn add|pip install)\b/i],
  ["version_bump", /\b(version|release|tag|changelog|bump)\b/i],
  ["decision", /\b(decided|decision|chose|tradeoff|because)\b/i],
];

const TECH_RULES = [
  ["React", /\breact\b|\.jsx\b|\.tsx\b/i],
  ["Next.js", /\bnext\.js\b|next\.config/i],
  ["Node.js", /\bnode\b|package\.json|\.mjs\b|\.cjs\b/i],
  ["TypeScript", /\btypescript\b|\.ts\b|\.tsx\b|tsconfig/i],
  ["JavaScript", /\bjavascript\b|\.js\b|\.mjs\b/i],
  ["Python", /\bpython\b|\.py\b|requirements\.txt|pyproject\.toml/i],
  ["HTML", /\.html\b|\bhtml\b/i],
  ["CSS", /\.css\b|\bcss\b/i],
  ["SQLite", /\bsqlite\b|\.sqlite\b|\.db\b/i],
  ["Supabase", /\bsupabase\b/i],
  ["Auth.js", /\bauth\.js\b|nextauth/i],
  ["GitHub Pages", /github pages|gh-pages/i],
];

export async function summarizeSession({ parsed, hookInput, sourceTool, summarizerCommand = null, gitFacts = null }) {
  const fallback = buildOfflineSummary({ parsed, hookInput, sourceTool, gitFacts });
  if (!summarizerCommand) {
    return fallback;
  }

  const external = await runExternalSummarizer({ summarizerCommand, parsed, hookInput, sourceTool, gitFacts }).catch(() => null);
  return mergeSummary(fallback, external);
}

export function buildOfflineSummary({ parsed, hookInput, sourceTool, gitFacts = null }) {
  const hookPrompt = typeof hookInput?.prompt === "string" ? hookInput.prompt : "";
  let hookAssistantMessage = "";
  if (typeof hookInput?.prompt_response === "string") {
    hookAssistantMessage = hookInput.prompt_response;
  } else if (typeof hookInput?.last_assistant_message === "string") {
    hookAssistantMessage = hookInput.last_assistant_message;
  }
  const userGoal = lastUseful(parsed.userPrompts) || hookPrompt;
  const assistantOutcome = lastUseful(parsed.assistantMessages) || hookAssistantMessage;
  const files = parsed.files.slice(0, 12);
  const tools = parsed.tools.slice(0, 8);
  const commands = parsed.commands.slice(0, 5);
  const blockers = parsed.errors.slice(0, 3);
  const decisions = parsed.decisions.slice(0, 3);
  const tests = parsed.testCommands.slice(0, 3);
  const packageChanges = parsed.packageChanges.slice(0, 3);
  const lines = [];

  lines.push(`Captured a ${sourceTool} coding session.`);

  if (userGoal) {
    lines.push(`Goal: ${cleanText(userGoal, 700)}`);
  }
  if (assistantOutcome) {
    lines.push(`Outcome: ${cleanText(assistantOutcome, 900)}`);
  }
  if (files.length > 0) {
    lines.push(`Files touched: ${files.join(", ")}${parsed.files.length > files.length ? ", ..." : ""}`);
  }
  if (tools.length > 0) {
    lines.push(`Tools used: ${Array.from(new Set(tools)).join(", ")}.`);
  }
  if (commands.length > 0) {
    lines.push(`Commands observed: ${commands.map((command) => cleanText(command, 120)).join(" | ")}`);
  }
  if (tests.length > 0) {
    lines.push(`Verification: ${tests.map((command) => cleanText(command, 140)).join(" | ")}`);
  }
  if (packageChanges.length > 0) {
    lines.push(`Dependency changes: ${packageChanges.map((command) => cleanText(command, 140)).join(" | ")}`);
  }
  if (gitFacts?.available) {
    lines.push(`Git: ${gitFacts.branch || "detached"}@${gitFacts.head || "unknown"}.`);
    if (gitFacts.changed_files?.length) {
      lines.push(`Working tree changes: ${gitFacts.changed_files.slice(0, 12).join(", ")}${gitFacts.changed_files.length > 12 ? ", ..." : ""}`);
    }
    if (gitFacts.diff_stat) {
      lines.push(`Diff stat: ${cleanText(gitFacts.diff_stat, 420)}`);
    }
  }
  if (decisions.length > 0) {
    lines.push(`Decisions: ${decisions.map((decision) => cleanText(decision, 220)).join(" | ")}`);
  }
  if (blockers.length > 0) {
    lines.push(`Blockers or errors: ${blockers.map((error) => cleanText(error, 220)).join(" | ")}`);
  }
  if (parsed.notes.length > 0) {
    lines.push(`Capture note: ${parsed.notes.join(" ")}`);
  }
  const rawSummary = lines.join("\n");
  return {
    title: buildTitle({ assistantOutcome, userGoal, files }),
    rawSummary,
    publicSummary: "",
    type: classifyEventType(rawSummary, files),
    status: inferStatus(rawSummary),
    tech: detectTech(`${rawSummary}\n${files.join("\n")}`),
  };
}

export function classifyEventType(summary, files) {
  for (const [type, pattern] of TYPE_RULES) {
    if (pattern.test(summary)) {
      return type;
    }
  }

  if (/\b(add|added|create|created|implement|implemented|build|built|ship|shipped)\b/i.test(summary) || files.length > 0) {
    return "feature_added";
  }

  return "note";
}

export function detectTech(text) {
  return TECH_RULES.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

export function inferStatus(summary) {
  if (/\b(blocked|blocker|cannot|could not|waiting on|needs approval|failed to)\b/i.test(summary)) {
    return "blocked";
  }
  if (/\b(todo|in progress|partial|follow-up|next step|remaining)\b/i.test(summary)) {
    return "in_progress";
  }
  if (/\b(added|implemented|fixed|rendered|validated|completed|built|created|updated)\b/i.test(summary)) {
    return "completed";
  }
  return "unknown";
}

function buildTitle({ assistantOutcome, userGoal, files }) {
  const source = assistantOutcome || userGoal || (files.length > 0 ? `Touched ${files.length} file${files.length === 1 ? "" : "s"}` : "Captured coding session");
  return cleanText(source, 120);
}

function mergeSummary(fallback, external) {
  if (!external || typeof external !== "object") {
    return fallback;
  }
  return {
    title: cleanText(external.title, 120) || fallback.title,
    rawSummary: cleanText(external.raw_summary ?? external.rawSummary, 4000) || fallback.rawSummary,
    publicSummary: cleanText(external.public_summary ?? external.publicSummary, 280),
    type: TYPE_RULES.some(([type]) => type === external.type) || external.type === "feature_added" || external.type === "note" ? external.type : fallback.type,
    status: ["completed", "blocked", "in_progress", "unknown"].includes(external.status) ? external.status : fallback.status,
    tech: Array.isArray(external.tech) ? external.tech.filter((item) => typeof item === "string") : fallback.tech,
  };
}

function runExternalSummarizer({ summarizerCommand, parsed, hookInput, sourceTool, gitFacts }) {
  return new Promise((resolve, reject) => {
    const child = spawn(summarizerCommand, { shell: true, stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    const errors = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("summarizer command timed out"));
    }, 30000);

    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => errors.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(Buffer.concat(errors).toString("utf8") || `summarizer exited with ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify({ parsed, hookInput, sourceTool, gitFacts }));
  });
}

function lastUseful(items) {
  return [...items].reverse().find((item) => cleanText(item, 20).length > 0) ?? "";
}
