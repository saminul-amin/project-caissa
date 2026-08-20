import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * The vendored engine build is a distributed third-party artifact under GPL-3.0.
 * Its identity must never drift silently, so the exact bytes are pinned here and
 * verified in CI. Update these digests only together with `THIRD_PARTY_NOTICES.md`.
 *
 * Digests are taken over the bytes a checkout produces, not over the upstream download.
 * `.gitattributes` normalises text to LF, so a digest captured from a CRLF working copy
 * would pass on the machine that vendored the file and fail on every fresh clone.
 */
const pinnedAssets = [
  {
    path: "apps/web/public/engine/stockfish-18-lite-single.js",
    sha256: "5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391",
  },
  {
    path: "apps/web/public/engine/stockfish-18-lite-single.wasm",
    sha256: "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
  },
  {
    path: "LICENSES/GPL-3.0.txt",
    sha256: "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903",
  },
];

const violations = [];

for (const asset of pinnedAssets) {
  const absolute = path.join(process.cwd(), asset.path);
  let bytes;
  try {
    bytes = await readFile(absolute);
  } catch {
    violations.push(`${asset.path}: missing`);
    continue;
  }

  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.sha256) {
    violations.push(`${asset.path}: expected ${asset.sha256}, found ${digest}`);
  }
}

if (violations.length > 0) {
  console.error(
    "Vendored engine assets do not match their pinned digests:\n" +
      violations.map((item) => `- ${item}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`Verified ${String(pinnedAssets.length)} pinned third-party assets.`);
}
