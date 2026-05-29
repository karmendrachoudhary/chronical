import { parseJsonlTranscript } from "./jsonlTranscript.js";

export function parseClaudeTranscript(raw) {
  return parseJsonlTranscript(raw, "claude-code");
}
