import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const ignoredDirectories = new Set(["coverage", "dist", "node_modules", "playwright-report"]);
const violations = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function report(file, rule, detail) {
  violations.push(`${path.relative(root, file)}: ${rule} — ${detail}`);
}

for (const sourceRoot of [
  "apps/web/src",
  "packages/chess-core/src",
  "packages/shared-contracts/src",
]) {
  const absoluteRoot = path.join(root, sourceRoot);
  const files = await collectFiles(absoluteRoot);

  for (const file of files) {
    const relativeFile = path.relative(root, file).replaceAll("\\", "/");
    const source = await readFile(file, "utf8");

    if (/^packages\/chess-core\//u.test(relativeFile)) {
      if (/from\s+["'](?:react|react-dom|zustand|dexie)(?:\/[^"']*)?["']/u.test(source)) {
        report(file, "chess-core-framework-boundary", "framework or persistence import");
      }
      if (/\b(?:window|document|localStorage|indexedDB)\b/u.test(source)) {
        report(file, "chess-core-runtime-boundary", "browser API usage");
      }
    }

    if (/^packages\//u.test(relativeFile) && /from\s+["'][^"']*apps\//u.test(source)) {
      report(file, "package-application-boundary", "domain package imports application code");
    }

    if (/^apps\/web\/src\/(?:features|ui)\//u.test(relativeFile)) {
      if (/from\s+["'][^"']*infrastructure\/(?:db|persistence|storage)/u.test(source)) {
        report(file, "ui-persistence-boundary", "UI imports a persistence implementation");
      }
      if (/\b(?:CaissaDatabase|indexedDB)\b/u.test(source)) {
        report(file, "ui-database-boundary", "UI references a database implementation");
      }
    }

    if (/^apps\/web\/src\/features\//u.test(relativeFile) && /\bfetch\s*\(/u.test(source)) {
      report(file, "feature-transport-boundary", "feature code uses raw fetch");
    }

    if (/^apps\/web\/src\/application\//u.test(relativeFile)) {
      if (/from\s+["']dexie(?:\/[^"']*)?["']/u.test(source)) {
        report(file, "application-persistence-port-boundary", "application code imports Dexie");
      }
      if (/\b(?:indexedDB|IDBDatabase|IDBFactory)\b/u.test(source)) {
        report(file, "application-browser-storage-boundary", "application code uses IndexedDB");
      }
      if (/from\s+["'][^"']*infrastructure\/persistence/u.test(source)) {
        report(file, "application-infrastructure-boundary", "application imports an adapter");
      }
    }

    if (
      /^apps\/web\/src\//u.test(relativeFile) &&
      !/^apps\/web\/src\/infrastructure\/persistence\//u.test(relativeFile) &&
      /from\s+["']dexie(?:\/[^"']*)?["']/u.test(source)
    ) {
      report(
        file,
        "dexie-adapter-boundary",
        "Dexie is imported outside persistence infrastructure",
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture checks failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture source restrictions passed.");
}
