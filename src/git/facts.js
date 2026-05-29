import { execFile } from "node:child_process";
import path from "node:path";

export async function collectGitFacts({ rootDir = process.cwd(), files = [] } = {}) {
  const [head, branch, status, recentCommits, diffStat] = await Promise.all([
    git(rootDir, ["rev-parse", "--short", "HEAD"]),
    git(rootDir, ["branch", "--show-current"]),
    git(rootDir, ["status", "--porcelain"]),
    git(rootDir, ["log", "--oneline", "-5"]),
    git(rootDir, ["diff", "--stat", "--", ...files.filter(Boolean)]),
  ]);

  const changedFiles = parseStatusFiles(status.stdout);
  return {
    available: !head.error,
    head: head.stdout.trim(),
    branch: branch.stdout.trim(),
    changed_files: changedFiles,
    recent_commits: recentCommits.stdout.trim().split("\n").filter(Boolean),
    diff_stat: diffStat.stdout.trim(),
  };
}

export function foldersWithChanges(files) {
  return Array.from(new Set(files.map((file) => path.posix.dirname(file)).filter((folder) => folder && folder !== "."))).sort();
}

async function git(cwd, args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

function parseStatusFiles(statusOutput) {
  return String(statusOutput ?? "").split("\n").map((line) => {
    if (!line.trim()) return null;
    const file = line.slice(3).trim();
    return file.includes(" -> ") ? file.split(" -> ").at(-1) : file;
  }).filter(Boolean);
}
