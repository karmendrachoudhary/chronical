import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseClaudeTranscript } from "../parsers/claudeCode.js";
import { parseCodexTranscript } from "../parsers/codex.js";
import { parseGeminiTranscript } from "../parsers/gemini.js";
import { renderPersonalDevlogToFile } from "../render/personalDevlog.js";
import { renderProjectBrainToFile } from "../render/projectBrain.js";
import { renderRootIndexToFile } from "../render/projectIndex.js";
import { collectEventSafetyFlags, redactSecrets } from "../safety/redaction.js";
import { appendEvents } from "../store/eventsStore.js";
import { formatLocalDate, nowIso } from "../utils/date.js";
import { classifyEventType, detectTech, inferStatus, summarizeSession } from "./summarize.js";

export async function captureSession({
  cwd,
  hookInput,
  sourceTool,
  transcriptPath,
  storePath,
  outputPath,
  brainOutputPath = null,
  rootIndexOutputPath = null,
  renderAfterCapture = false,
  summaryOverride,
  summarizerCommand = null,
}) {
  const resolvedSourceTool = normalizeSourceTool(sourceTool ?? detectSourceTool(hookInput, transcriptPath));
  const resolvedTranscriptPath = transcriptPath ?? hookInput?.transcript_path ?? hookInput?.agent_transcript_path ?? null;
  const parsed = await parseTranscript({ sourceTool: resolvedSourceTool, transcriptPath: resolvedTranscriptPath });
  const summary = summaryOverride
    ? manualSummary(summaryOverride, parsed)
    : await summarizeSession({ parsed, hookInput, sourceTool: resolvedSourceTool, summarizerCommand });
  const rawSummary = summary.rawSummary;
  const files = Array.from(new Set(parsed.files)).sort();
  const turnId = hookInput?.turn_id ?? null;
  const createdAt = nowIso();

  const event = {
    id: createEventId({ sourceTool: resolvedSourceTool, sessionId: hookInput?.session_id, turnId, rawSummary }),
    kind: "event",
    type: summary.type,
    date: formatLocalDate(new Date()),
    session_id: hookInput?.session_id ?? parsed.sessionId ?? "manual",
    source_tool: resolvedSourceTool,
    title: summary.title,
    summary: rawSummary,
    raw_summary: rawSummary,
    public_summary: redactSecrets(summary.publicSummary ?? ""),
    tech: summary.tech?.length ? summary.tech : detectTech(`${rawSummary}\n${files.join("\n")}`),
    tags: [],
    files_touched: files.length,
    visibility: "private",
    confidence: parsed.confidence,
    status: summary.status,
    source_ref: {
      transcript_path: resolvedTranscriptPath,
      cwd: cwd ?? hookInput?.cwd ?? process.cwd(),
      turn_id: turnId,
      hook_event_name: hookInput?.hook_event_name ?? null,
    },
    files,
    links: {
      features: [],
      files,
      decisions: [],
      roadmap: [],
      events: [],
      releases: [],
    },
    data: {},
    safety_flags: [],
    created_at: createdAt,
    updated_at: createdAt,
  };

  event.safety_flags = collectEventSafetyFlags(event);

  // The public page is allowlist-only later. If anything looks secret-like now,
  // keep the event private and record why for the personal devlog.
  if (event.safety_flags.length > 0) {
    event.visibility = "private";
  }

  await mkdir(path.dirname(storePath), { recursive: true });
  const appendResult = await appendEvents(storePath, [event]);

  const renderedPaths = [];
  let renderedPath = null;
  if (renderAfterCapture) {
    const renderResult = await renderPersonalDevlogToFile({ storePath, outputPath });
    renderedPath = renderResult.outputPath;
    renderedPaths.push(renderResult.outputPath);

    // Phase 3 makes the project-brain HTML the main artifact. Keep the older
    // personal devlog for compatibility, then refresh the brain and root map.
    if (brainOutputPath) {
      const brainResult = await renderProjectBrainToFile({ storePath, outputPath: brainOutputPath });
      renderedPaths.push(brainResult.outputPath);
    }
    if (rootIndexOutputPath) {
      const indexResult = await renderRootIndexToFile({ storePath, outputPath: rootIndexOutputPath });
      renderedPaths.push(indexResult.outputPath);
    }
  }

  return {
    sourceTool: resolvedSourceTool,
    appendedCount: appendResult.appendedCount,
    skippedCount: appendResult.skippedCount,
    renderedPath,
    renderedPaths,
  };
}

async function parseTranscript({ sourceTool, transcriptPath }) {
  if (!transcriptPath) {
    return emptyParsedSession("No transcript path was provided by the hook.");
  }

  try {
    const raw = await readFile(transcriptPath, "utf8");
    if (sourceTool === "codex") {
      return parseCodexTranscript(raw);
    }
    if (sourceTool === "gemini") {
      return parseGeminiTranscript(raw);
    }
    return parseClaudeTranscript(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyParsedSession(`Transcript could not be read: ${message}`);
  }
}

function emptyParsedSession(note) {
  return {
    userPrompts: [],
    assistantMessages: [],
    tools: [],
    commands: [],
    files: [],
    errors: [],
    decisions: [],
    packageChanges: [],
    testCommands: [],
    notes: [note],
    confidence: "low",
  };
}

function manualSummary(rawSummary, parsed) {
  return {
    title: rawSummary.split("\n").find(Boolean)?.slice(0, 120) || "Manual Chronicle summary",
    rawSummary,
    publicSummary: "",
    type: classifyEventType(rawSummary, parsed.files),
    status: inferStatus(rawSummary),
    tech: detectTech(`${rawSummary}\n${parsed.files.join("\n")}`),
  };
}

function detectSourceTool(hookInput, transcriptPath) {
  const text = `${hookInput?.source_tool ?? ""} ${hookInput?.model ?? ""} ${hookInput?.hook_event_name ?? ""} ${transcriptPath ?? hookInput?.transcript_path ?? ""}`.toLowerCase();
  if (text.includes(".codex") || text.includes("codex")) {
    return "codex";
  }
  if (text.includes(".gemini") || text.includes("gemini") || hookInput?.hook_event_name === "SessionEnd") {
    return "gemini";
  }
  return "claude-code";
}

function normalizeSourceTool(value) {
  if (["claude-code", "codex", "gemini"].includes(value)) {
    return value;
  }
  return "claude-code";
}

function createEventId({ sourceTool, sessionId, turnId, rawSummary }) {
  const stableInput = `${sourceTool}:${sessionId ?? "manual"}:${turnId ?? "no-turn"}:${rawSummary.slice(0, 120)}`;
  let hash = 0;
  for (let index = 0; index < stableInput.length; index += 1) {
    hash = (hash * 31 + stableInput.charCodeAt(index)) >>> 0;
  }
  return `evt_${hash.toString(16).padStart(8, "0")}`;
}
