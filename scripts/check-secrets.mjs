import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  "__pycache__",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/u],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/u],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u],
];

async function walk(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

function trackedFiles() {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\0")
      .filter(Boolean)
      .map((file) => path.join(root, file));
  } catch {
    return null;
  }
}

const files = trackedFiles() ?? (await walk(root));
const violations = [];

for (const file of files) {
  if (path.basename(file) === "pnpm-lock.yaml") {
    continue;
  }
  let content;
  try {
    content = await readFile(file, "utf8");
  } catch {
    continue;
  }
  for (const [name, pattern] of patterns) {
    if (pattern.test(content)) {
      violations.push(`${path.relative(root, file)}: ${name}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Potential secrets detected:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Secret patterns not found in ${files.length} files.`);
}
