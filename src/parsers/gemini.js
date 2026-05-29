import { parseJsonlTranscript } from "./jsonlTranscript.js";

export function parseGeminiTranscript(raw) {
  return parseJsonlTranscript(raw, "gemini");
}
