import { readdirSync, readFileSync } from "fs";
import { gzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_ASSETS = join(__dirname, "..", "dist", "assets");
const MANIFEST_PATH = join(__dirname, "..", "dist", ".vite", "manifest.json");
const INITIAL_BUDGET_KB = 156.0;
const TOTAL_BUDGET_KB = 380.0;

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

/** 從 entry 節點遞迴收集所有 initial chunk 檔名 */
const collectInitial = (entryKey, visited = new Set()) => {
  if (visited.has(entryKey)) return;
  visited.add(entryKey);
  const node = manifest[entryKey];
  if (!node) return;
  for (const imp of node.imports || []) {
    collectInitial(imp, visited);
  }
};

const entryKeys = Object.keys(manifest).filter(
  (k) => manifest[k].isEntry === true,
);
const initialKeys = new Set();
for (const ek of entryKeys) {
  collectInitial(ek, initialKeys);
}

/** 讀取並 gzip 壓縮單一 chunk，回傳 gzip 位元組數 */
const gzipSizeOf = (fileName) => {
  const buf = readFileSync(join(DIST_ASSETS, fileName));
  return gzipSync(buf).length;
};

/** 列出 dist/assets 下所有 .js 檔並計算 gzip */
const allJs = readdirSync(DIST_ASSETS).filter((f) => f.endsWith(".js"));

/** 收集所有 initial chunk 的 file 名稱（含 entry 與其遞迴 imports） */
const initialFiles = new Set();
for (const ek of initialKeys) {
  const node = manifest[ek];
  if (node && node.file) {
    initialFiles.add(node.file); // e.g. "assets/index-OeX5x-AJ.js"
  }
}

console.log("=== Bundle 體積報告 ===\n");
console.log(
  `初始預算: ${INITIAL_BUDGET_KB} KB | 總和預算: ${TOTAL_BUDGET_KB} KB\n`,
);

let totalGzip = 0;
let initialGzip = 0;

for (const f of allJs) {
  const gz = gzipSizeOf(f);
  const kb = (gz / 1024).toFixed(1);
  const isInitial = initialFiles.has(`assets/${f}`);
  totalGzip += gz;
  if (isInitial) {
    initialGzip += gz;
    console.log(`  [INITIAL] ${f}: ${kb} KB (gzip)`);
  } else {
    console.log(`  [LAZY]    ${f}: ${kb} KB (gzip)`);
  }
}

const initialKb = (initialGzip / 1024).toFixed(1);
const totalKb = (totalGzip / 1024).toFixed(1);

console.log(
  `\nInitial JS gzip: ${initialKb} KB (預算 ${INITIAL_BUDGET_KB} KB)`,
);
console.log(`Total JS gzip:   ${totalKb} KB (預算 ${TOTAL_BUDGET_KB} KB)`);

let failed = false;
if (initialKb > INITIAL_BUDGET_KB) {
  console.error(
    `\n❌ 初始體積超標 ${INITIAL_BUDGET_KB} KB（實際 ${initialKb} KB）`,
  );
  failed = true;
}
if (totalKb > TOTAL_BUDGET_KB) {
  console.error(`\n❌ 總體積超標 ${TOTAL_BUDGET_KB} KB（實際 ${totalKb} KB）`);
  failed = true;
}

if (!failed) {
  console.log("\n✅ 體積閘門通過");
} else {
  process.exit(1);
}
