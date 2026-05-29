import { readFile } from "node:fs/promises";

const DEFAULT_CONFIG = {
  store: "data/chronicle.json",
  personalOutput: "dist/devlog.html",
};

export async function loadChronicleConfig(configPath = "chronicle.config.json") {
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8"));
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}
