import { parseJsonlTranscript } from "./jsonlTranscript.js";

export function parseCodexTranscript(raw) {
  return parseJsonlTranscript(raw, "codex");
}
