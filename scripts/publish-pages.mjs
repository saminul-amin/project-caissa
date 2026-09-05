import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

/**
 * Publishes the production build to GitHub Pages by hand.
 *
 * GitHub Actions is deliberately not involved: the account cannot spend Actions minutes,
 * and a static site does not need a pipeline. The script runs the same quality gate as a
 * release, then commits `apps/web/dist` onto the `gh-pages` branch through a temporary git
 * worktree and pushes it. The published commit message records the source commit, so any
 * deployed version can be traced back to the exact tree that produced it.
 *
 * Usage:
 *   node scripts/publish-pages.mjs                 verify, build, commit, push
 *   node scripts/publish-pages.mjs --skip-verify   build only (for a rebuild of a verified tree)
 *   node scripts/publish-pages.mjs --dry-run       do everything except push
 */
const root = process.cwd();
const distDirectory = path.join(root, "apps", "web", "dist");
const branch = "gh-pages";
const remote = "origin";
const arguments_ = new Set(process.argv.slice(2));
const dryRun = arguments_.has("--dry-run");
const skipVerify = arguments_.has("--skip-verify");

function git(args, options = {}) {
  // With inherited stdio there is no captured output, and execFileSync returns null.
  const output = execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
  return output === null ? "" : output.toString().trim();
}

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

function fail(message) {
  console.error(`publish-pages: ${message}`);
  process.exit(1);
}

if (git(["status", "--porcelain"]) !== "") {
  fail("the working tree has uncommitted changes; publish only from a committed tree.");
}

const sourceCommit = git(["rev-parse", "HEAD"]);
const sourceSummary = git(["log", "-1", "--format=%h %s"]);

run("corepack", skipVerify ? ["pnpm", "build"] : ["pnpm", "verify"]);

if (!existsSync(path.join(distDirectory, "index.html"))) {
  fail("apps/web/dist/index.html is missing after the build.");
}

const worktree = mkdtempSync(path.join(tmpdir(), "caissa-pages-"));
const remoteHasBranch = git(["ls-remote", "--heads", remote, branch]) !== "";

try {
  if (remoteHasBranch) {
    git(["fetch", remote, `${branch}:refs/remotes/${remote}/${branch}`]);
    git(["worktree", "add", "--force", "-B", branch, worktree, `${remote}/${branch}`]);
  } else {
    git(["worktree", "add", "--force", "--detach", worktree]);
    git(["checkout", "--orphan", branch], { cwd: worktree });
    git(["rm", "-rf", "--quiet", "."], { cwd: worktree });
  }

  for (const entry of readdirSync(worktree)) {
    if (entry === ".git") continue;
    rmSync(path.join(worktree, entry), { force: true, recursive: true });
  }
  cpSync(distDirectory, worktree, { recursive: true });
  // GitHub Pages runs Jekyll by default, which would drop files and folders starting with
  // an underscore. The marker file switches that off.
  writeFileSync(path.join(worktree, ".nojekyll"), "");

  git(["add", "--all"], { cwd: worktree });
  const staged = git(["status", "--porcelain"], { cwd: worktree });
  if (staged === "") {
    console.log("publish-pages: the published site already matches this build; nothing to push.");
  } else {
    git(
      [
        "-c",
        "user.name=Caissa release",
        "-c",
        "user.email=release@caissa.invalid",
        "commit",
        "--quiet",
        "-m",
        `Publish ${sourceSummary}\n\nSource-Commit: ${sourceCommit}`,
      ],
      { cwd: worktree },
    );
    if (dryRun) {
      console.log(`publish-pages: dry run; ${branch} was committed locally but not pushed.`);
    } else {
      git(["push", remote, `HEAD:refs/heads/${branch}`], { cwd: worktree, stdio: "inherit" });
      console.log(`publish-pages: pushed ${branch} from source commit ${sourceCommit}.`);
    }
  }
} finally {
  git(["worktree", "remove", "--force", worktree]);
}

const originUrl = git(["remote", "get-url", remote]);
const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/u.exec(originUrl);
if (match) {
  console.log(`publish-pages: site URL https://${match[1]}.github.io/${match[2]}/`);
}
