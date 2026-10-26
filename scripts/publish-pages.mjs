import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  }).trim();
}

if (!existsSync(join(dist, "index.html"))) throw new Error("Run npm run build before publishing.");
if (git(["status", "--porcelain"])) throw new Error("Commit the source changes before publishing.");

const sourceCommit = git(["rev-parse", "HEAD"]);
const gitDirectory = git(["rev-parse", "--absolute-git-dir"]);
const previous = git(["ls-remote", "--heads", "origin", "refs/heads/gh-pages"]).split(/\s/)[0];
let parent = "";
if (previous) {
  git(["fetch", "origin", "refs/heads/gh-pages"]);
  parent = git(["rev-parse", "FETCH_HEAD"]);
  if (parent !== previous) throw new Error("The deployment branch changed during publishing. Run npm run deploy again.");
}

// A separate temporary index stages only dist/. The current branch and index stay intact.
const temporaryDirectory = mkdtempSync(join(tmpdir(), "taxbench-pages-"));
const indexPath = join(temporaryDirectory, "index");
try {
  const environment = { ...process.env, GIT_INDEX_FILE: indexPath };
  const staticGit = args => git(["--git-dir", gitDirectory, "--work-tree", dist, ...args], { cwd: dist, env: environment });
  staticGit(["read-tree", "--empty"]);
  staticGit(["add", "--all", "--force"]);
  const tree = staticGit(["write-tree"]);
  const commit = git(["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", `Deploy static site from ${sourceCommit}`]);
  // A regular push rejects concurrent updates; no force push is used.
  git(["push", "origin", `${commit}:refs/heads/gh-pages`]);
  console.log(`Published static files to gh-pages from ${sourceCommit}.`);
} finally {
  for (const filename of readdirSync(temporaryDirectory)) unlinkSync(join(temporaryDirectory, filename));
  rmdirSync(temporaryDirectory);
}
