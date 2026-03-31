/**
 * test-all.mjs
 * 統一入口：依序執行所有測試
 *
 * 執行方式：node test-all.mjs
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testFiles = [
  "test-keywordConfig.mjs",
  "test-keywords.mjs",
  "test-archiveManager.mjs",
];

let allPassed = true;
const results = [];

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  console.log(`\n${"═".repeat(55)}`);
  console.log(`  執行：${file}`);
  console.log(`${"═".repeat(55)}`);
  try {
    execSync(`node "${filePath}"`, { stdio: "inherit" });
    results.push({ file, ok: true });
  } catch {
    results.push({ file, ok: false });
    allPassed = false;
  }
}

console.log(`\n${"═".repeat(55)}`);
console.log("  執行摘要");
console.log(`${"═".repeat(55)}`);
for (const r of results) {
  console.log(`  ${r.ok ? "✅" : "❌"} ${r.file}`);
}
console.log(`${"─".repeat(55)}`);
if (allPassed) {
  console.log("  ✅ 所有測試通過！可以進行下一步部署。");
} else {
  console.error("  ❌ 部分測試失敗，請修復後重新執行。");
  process.exit(1);
}