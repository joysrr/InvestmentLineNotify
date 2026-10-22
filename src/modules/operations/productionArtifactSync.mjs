/**
 * Copy production data and logs into an isolated diagnostic snapshot.
 * This module deliberately does not perform deployment or touch PM2.
 */

import { createHash } from "crypto";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { join, relative, resolve } from "path";

const EXCLUDED_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".bot_lock",
]);

function isExcluded(relativePath) {
  return relativePath
    .split("/")
    .some((part) => EXCLUDED_NAMES.has(part) || part.endsWith(".secret"));
}

async function listFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    const relativePath = relative(rootDir, absolutePath).split("\\").join("/");

    if (isExcluded(relativePath)) continue;

    if (entry.isDirectory()) {
      files.push(...(await listFiles(rootDir, absolutePath)));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

async function describeFiles(files, snapshotDir) {
  return Promise.all(
    files.map(async ({ absolutePath, relativePath }) => {
      const content = await readFile(absolutePath);
      const destinationPath = join(snapshotDir, relativePath);
      return {
        relativePath,
        bytes: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
        destinationPath,
      };
    }),
  );
}

function createSnapshotName(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, "-");
}

export async function syncProductionArtifacts({
  sourceDataDir,
  sourceLogsDir,
  destinationRoot,
  dryRun = false,
  now = new Date(),
}) {
  if (!sourceDataDir || !sourceLogsDir || !destinationRoot) {
    throw new Error(
      "sourceDataDir, sourceLogsDir and destinationRoot are required",
    );
  }

  const sources = {
    data: resolve(sourceDataDir),
    logs: resolve(sourceLogsDir),
  };

  for (const source of Object.values(sources)) {
    const sourceStats = await stat(source);
    if (!sourceStats.isDirectory()) {
      throw new Error(`Artifact source is not a directory: ${source}`);
    }
  }

  const snapshotName = createSnapshotName(now);
  const snapshotDir = join(resolve(destinationRoot), snapshotName);
  const sourceFiles = [
    ...(await listFiles(sources.data)).map((file) => ({
      ...file,
      relativePath: `data/${file.relativePath}`,
    })),
    ...(await listFiles(sources.logs)).map((file) => ({
      ...file,
      relativePath: `logs/${file.relativePath}`,
    })),
  ];
  const files = await describeFiles(sourceFiles, snapshotDir);

  if (dryRun) {
    return {
      status: "dry-run",
      snapshotDir,
      manifestPath: join(snapshotDir, "manifest.json"),
      files,
    };
  }

  await mkdir(snapshotDir, { recursive: true });
  await cp(sources.data, join(snapshotDir, "data"), {
    recursive: true,
    filter: (sourcePath) => !isExcluded(relative(sources.data, sourcePath)),
  });
  await cp(sources.logs, join(snapshotDir, "logs"), {
    recursive: true,
    filter: (sourcePath) => !isExcluded(relative(sources.logs, sourcePath)),
  });

  const manifest = {
    operation: "sync-production-artifacts",
    createdAt: now.toISOString(),
    sources,
    files: files.map(({ destinationPath: _destinationPath, ...file }) => file),
  };
  const manifestPath = join(snapshotDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { status: "completed", snapshotDir, manifestPath, files };
}

export { isExcluded };
