import { existsSync, readdirSync, readFileSync } from "fs";
import { gzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const BUDGETS_KB = {
  initialJsGzip: 156,
  totalJsGzip: 380,
  totalCssGzip: 80,
  maxChunkGzip: 180,
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const distDir = process.env.DIST_DIR || join(scriptDir, "..", "dist");
const assetsDir = join(distDir, "assets");
const manifestPath = join(distDir, ".vite", "manifest.json");

const fail = (message) => {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
};

if (!existsSync(assetsDir) || !existsSync(manifestPath)) {
  fail(`找不到建置輸出：${distDir}`);
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const gzipSize = (file) =>
    gzipSync(readFileSync(join(assetsDir, file))).length;
  const files = readdirSync(assetsDir).filter((file) =>
    /\.(js|css)$/.test(file),
  );
  const entryFiles = new Set(
    Object.values(manifest)
      .filter((node) => node.isEntry && node.file)
      .map((node) => node.file.replace(/^assets\//, "")),
  );
  const initialFiles = new Set(entryFiles);
  const totalByType = { js: 0, css: 0 };
  let initialJs = 0;
  let failed = false;

  for (const file of files) {
    const bytes = gzipSize(file);
    const type = file.endsWith(".css") ? "css" : "js";
    totalByType[type] += bytes;
    if (type === "js" && initialFiles.has(file)) initialJs += bytes;
    if (type === "js" && bytes / 1024 > BUDGETS_KB.maxChunkGzip) {
      fail(
        `JS chunk ${file} 超過 ${BUDGETS_KB.maxChunkGzip} KB（${(bytes / 1024).toFixed(1)} KB gzip）`,
      );
      failed = true;
    }
  }

  const checks = [
    ["初始 JS gzip", initialJs, BUDGETS_KB.initialJsGzip],
    ["總 JS gzip", totalByType.js, BUDGETS_KB.totalJsGzip],
    ["總 CSS gzip", totalByType.css, BUDGETS_KB.totalCssGzip],
  ];
  console.log("=== Performance budget ===");
  for (const [label, bytes, budget] of checks) {
    const actual = bytes / 1024;
    console.log(`${label}: ${actual.toFixed(1)} KB / ${budget} KB gzip`);
    if (actual > budget) {
      fail(`${label} 超標`);
      failed = true;
    }
  }
  if (!failed) console.log("✅ Performance budget 通過");
}

if (process.exitCode) process.exit(1);
