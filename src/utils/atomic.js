import { copyFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeTextFileAtomic(filePath, content, { backup = false } = {}) {
  const resolved = path.resolve(filePath);
  const directory = path.dirname(resolved);
  const tempPath = path.join(directory, `.${path.basename(resolved)}.${process.pid}.${Date.now()}.tmp`);

  await mkdir(directory, { recursive: true });
  if (backup) {
    await copyFile(resolved, `${resolved}.bak`).catch((error) => {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    });
  }

  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, resolved);
}

export async function writeJsonFileAtomic(filePath, value, options = {}) {
  await writeTextFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`, options);
}
