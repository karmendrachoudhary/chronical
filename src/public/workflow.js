import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { renderPublicBuildPageToFile } from "../render/publicBuildPage.js";
import { syncMarkdownSourceToStore, writeItemMarkdown } from "../source/markdownSource.js";
import { formatLocalDate, nowIso } from "../utils/date.js";

const execFileAsync = promisify(execFile);

const EMPTY_LINKS = {
  features: [],
  files: [],
  decisions: [],
  roadmap: [],
  events: [],
  releases: [],
};

export async function draftPublicBuildPage({ storePath, outputPath, version = "draft" }) {
  return renderPublicBuildPageToFile({ storePath, outputPath, version });
}

export async function shipPublicBuildPage({
  storePath,
  outputPath,
  version,
  approve = false,
  dryRun = false,
  githubPages = false,
  pagesBranch = "gh-pages",
  pagesPath = "index.html",
  rootDir = process.cwd(),
  sourceDir = "chronicle",
}) {
  if (!approve) {
    throw new Error("Refusing to ship public page without --approve. Draft first, review the HTML, then ship with --approve.");
  }
  if (!version?.trim()) {
    throw new Error("Public ship requires --version, for example --version v0.1.0.");
  }

  const renderResult = await renderPublicBuildPageToFile({ storePath, outputPath, version });
  let releaseResult = { appendedCount: 0, skippedCount: 0 };
  let publishResult = null;

  if (githubPages) {
    publishResult = await publishPublicOutput({ outputPath, branch: pagesBranch, pagesPath, dryRun });
  }

  if (!dryRun) {
    const releaseItem = createReleaseItem({ version, outputPath, model: renderResult });
    await writeItemMarkdown({ rootDir, sourceDir, item: releaseItem, subdir: "releases" });
    const syncResult = await syncMarkdownSourceToStore({ rootDir, sourceDir, storePath });
    releaseResult = { appendedCount: syncResult.insertedCount, skippedCount: syncResult.updatedCount };
  }

  return {
    ...renderResult,
    dryRun,
    release: releaseResult,
    publish: publishResult,
  };
}

export function createReleaseItem({ version, outputPath, model }) {
  const createdAt = nowIso();
  const publicSummary = `Published ${version} build update.`;

  return {
    id: `rel_${hashText(version)}`,
    kind: "release",
    title: `${version} public release`,
    summary: publicSummary,
    raw_summary: "",
    public_summary: publicSummary,
    date: formatLocalDate(new Date()),
    tech: [],
    tags: ["public-release"],
    files_touched: 0,
    visibility: "public",
    confidence: "high",
    status: "completed",
    source_ref: {},
    files: [],
    links: EMPTY_LINKS,
    data: {
      version,
      public_release: true,
      output_path: outputPath,
      shipped_at: createdAt,
      item_ids: model.updates.map((item) => item.id),
    },
    safety_flags: [],
    created_at: createdAt,
    updated_at: createdAt,
  };
}

export async function publishPublicOutput({ outputPath, branch = "gh-pages", pagesPath = "index.html", dryRun = false }) {
  const safePagesPath = normalizePagesPath(pagesPath);
  const planned = {
    branch,
    pagesPath: safePagesPath,
    outputPath,
    steps: [
      `copy ${outputPath} to ${safePagesPath}`,
      `commit on ${branch}`,
      `push origin HEAD:${branch}`,
    ],
  };

  if (dryRun) {
    return { ...planned, dryRun: true, published: false };
  }

  await stat(outputPath);
  const repoRoot = await git(["rev-parse", "--show-toplevel"]);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "chronicle-gh-pages-"));
  const worktreePath = path.join(tempRoot, "worktree");

  try {
    await checkoutPagesWorktree({ repoRoot, worktreePath, branch });
    const destination = path.join(worktreePath, safePagesPath);
    assertInside(worktreePath, destination);

    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(outputPath, destination);
    await writeFile(path.join(worktreePath, ".nojekyll"), "", "utf8");
    await git(["add", safePagesPath, ".nojekyll"], { cwd: worktreePath });

    const status = await git(["status", "--porcelain"], { cwd: worktreePath });
    if (!status.trim()) {
      return { ...planned, dryRun: false, published: false, message: "No GitHub Pages changes to publish." };
    }

    await git(["commit", "-m", `Publish Chronicle public page ${branch}`], { cwd: worktreePath });
    await git(["push", "origin", `HEAD:${branch}`], { cwd: worktreePath });
    return { ...planned, dryRun: false, published: true };
  } finally {
    await git(["worktree", "remove", "--force", worktreePath], { cwd: repoRoot, allowFailure: true });
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function checkoutPagesWorktree({ repoRoot, worktreePath, branch }) {
  if (await remoteBranchExists(repoRoot, branch)) {
    await git(["fetch", "origin", `${branch}:refs/remotes/origin/${branch}`], { cwd: repoRoot });
    await git(["worktree", "add", "--detach", worktreePath, `origin/${branch}`], { cwd: repoRoot });
    return;
  }

  if (await localBranchExists(repoRoot, branch)) {
    await git(["worktree", "add", "--detach", worktreePath, branch], { cwd: repoRoot });
    return;
  }

  await git(["worktree", "add", "--detach", worktreePath, "HEAD"], { cwd: repoRoot });
  await git(["switch", "--orphan", branch], { cwd: worktreePath });
  // This runs only inside the temporary worktree, so the main project files are not touched.
  await git(["rm", "-rf", "."], { cwd: worktreePath, allowFailure: true });
}

async function remoteBranchExists(repoRoot, branch) {
  return gitOk(["ls-remote", "--exit-code", "--heads", "origin", branch], { cwd: repoRoot });
}

async function localBranchExists(repoRoot, branch) {
  return gitOk(["rev-parse", "--verify", branch], { cwd: repoRoot });
}

async function gitOk(args, options = {}) {
  try {
    await git(args, options);
    return true;
  } catch {
    return false;
  }
}

async function git(args, { cwd = process.cwd(), allowFailure = false } = {}) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 1024 * 1024 });
    return stdout.trim();
  } catch (error) {
    if (allowFailure) return "";
    const stderr = error?.stderr?.toString().trim();
    const message = stderr || error?.message || String(error);
    throw new Error(`git ${args.join(" ")} failed: ${message}`);
  }
}

function normalizePagesPath(value) {
  const raw = String(value || "index.html").replaceAll("\\", "/");
  const normalized = path.posix.normalize(raw);
  if (path.isAbsolute(raw) || normalized === ".." || normalized.startsWith("../") || normalized.includes("\0")) {
    throw new Error("--pages-path must stay inside the GitHub Pages branch.");
  }
  return normalized === "." ? "index.html" : normalized;
}

function assertInside(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to write outside the GitHub Pages worktree.");
  }
}

function hashText(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
