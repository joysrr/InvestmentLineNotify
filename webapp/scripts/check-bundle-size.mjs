import { readdirSync, readFileSync } from "fs";
import { gzipSync } from "zlib";
import { join } from "path";

const DIST_ASSETS = "dist/assets";
const BUDGET_KB = 500;

const files = readdirSync(DIST_ASSETS).filter((f) => f.endsWith(".js"));
let totalGzip = 0;

for (const f of files) {
  const buf = readFileSync(join(DIST_ASSETS, f));
  const gz = gzipSync(buf);
  const kb = (gz.length / 1024).toFixed(1);
  totalGzip += gz.length;
  console.log(`${f}: ${kb} KB (gzip)`);
}

const totalKb = (totalGzip / 1024).toFixed(1);
console.log(`\nTotal JS gzip: ${totalKb} KB`);

if (totalKb > BUDGET_KB) {
  console.error(`\n❌ 超出預算 ${BUDGET_KB} KB（實際 ${totalKb} KB）`);
  process.exit(1);
}
console.log(`\n✅ 在預算 ${BUDGET_KB} KB 內`);
