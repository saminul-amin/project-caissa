import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { deflateRawSync } from "node:zlib";

/**
 * Builds the itch.io HTML5 upload package from an existing production build.
 *
 * The package is produced from `apps/web/dist` without rebuilding, so the bytes that
 * were verified by the quality gate are exactly the bytes that ship. Every itch.io
 * packaging limit is checked before the archive is written.
 */
const distDirectory = path.join(process.cwd(), "apps", "web", "dist");
const outputDirectory = path.join(process.cwd(), "dist-itch");
const archiveName = "caissa-itch.zip";

const limits = Object.freeze({
  maximumExtractedBytes: 500 * 1024 * 1024,
  maximumFileBytes: 200 * 1024 * 1024,
  maximumFiles: 1_000,
  maximumPathLength: 240,
});

async function collectFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute, relative)));
    } else if (entry.isFile()) {
      files.push({ absolute, relative });
    }
  }
  return files;
}

function validate(files) {
  const problems = [];

  if (!files.some((file) => file.relative === "index.html")) {
    problems.push("index.html is not at the archive root.");
  }
  if (files.length > limits.maximumFiles) {
    problems.push(
      `${String(files.length)} files exceeds the ${String(limits.maximumFiles)} limit.`,
    );
  }

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (file.size > limits.maximumFileBytes) {
      problems.push(`${file.relative} is larger than the per-file limit.`);
    }
    if (file.relative.length > limits.maximumPathLength) {
      problems.push(`${file.relative} exceeds the path-length limit.`);
    }
    if (!/^[\w./-]+$/u.test(file.relative)) {
      problems.push(`${file.relative} contains characters that are unsafe across platforms.`);
    }
  }

  if (totalBytes > limits.maximumExtractedBytes) {
    problems.push("The extracted package exceeds the total size limit.");
  }

  return { problems, totalBytes };
}

/** Minimal store/deflate ZIP writer; avoids adding a packaging dependency for one archive. */
function createZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const deflated = deflateRawSync(entry.data, { level: 9 });
    const useDeflate = deflated.length < entry.data.length;
    const payload = useDeflate ? deflated : entry.data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x21, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    chunks.push(localHeader, nameBytes, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x21, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(0, 42);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + payload.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, centralBuffer, end]);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

try {
  await stat(distDirectory);
} catch {
  console.error("No production build found. Run `pnpm build` before packaging for itch.io.");
  process.exit(1);
}

const discovered = await collectFiles(distDirectory);
const files = await Promise.all(
  discovered.map(async (file) => ({ ...file, size: (await stat(file.absolute)).size })),
);

const { problems, totalBytes } = validate(files);
if (problems.length > 0) {
  console.error("itch.io package validation failed:\n" + problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}

const entries = await Promise.all(
  files
    .sort((left, right) => left.relative.localeCompare(right.relative))
    .map(async (file) => ({ data: await readFile(file.absolute), name: file.relative })),
);

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const archive = createZip(entries);
const archivePath = path.join(outputDirectory, archiveName);
await new Promise((resolve, reject) => {
  const stream = createWriteStream(archivePath);
  stream.on("error", reject);
  stream.on("finish", resolve);
  stream.end(archive);
});

const manifest = {
  archive: archiveName,
  archiveBytes: archive.length,
  archiveSha256: createHash("sha256").update(archive).digest("hex"),
  extractedBytes: totalBytes,
  fileCount: entries.length,
  itchProjectSettings: {
    fullscreenButton: true,
    kind: "HTML",
    mobileFriendly: true,
    sharedArrayBufferRequired: false,
  },
};
await writeFile(
  path.join(outputDirectory, "itch-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  [
    `Packaged ${String(entries.length)} files (${formatBytes(totalBytes)} extracted).`,
    `Archive: ${path.relative(process.cwd(), archivePath)} (${formatBytes(archive.length)}).`,
    `SHA-256: ${manifest.archiveSha256}`,
  ].join("\n"),
);

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
