import { execFileSync } from "node:child_process";
import process from "node:process";

const prohibited = [
  /(^|\/)dist\//u,
  /(^|\/)coverage\//u,
  /(^|\/)node_modules\//u,
  /(^|\/)__pycache__\//u,
  /(^|\/)playwright-report\//u,
  /(^|\/)test-results\//u,
  /(^|\/)\.venv\//u,
  /\.py[co]$/u,
  /\.tsbuildinfo$/u,
];

let trackedFiles = [];
try {
  trackedFiles = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\0")
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
} catch {
  console.log(
    "Artifact check skipped tracked-file inspection because Git metadata is unavailable.",
  );
  process.exit(0);
}

const violations = trackedFiles.filter((file) => prohibited.some((pattern) => pattern.test(file)));

if (violations.length > 0) {
  console.error(
    "Generated artifacts are committed:\n" + violations.map((file) => `- ${file}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log("No unintended generated artifacts are tracked.");
}
