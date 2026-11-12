import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

// Phase 5 防線：真正硬編碼 hex 不得超過門檻（目標 ≤ 50）
const THRESHOLD = 50;
const EXCLUDE_DIRS = ["tokens.css", "node_modules", "test/", "dist/"];
const EXCLUDE_PATTERNS = [
  /var\([^,]+,\s*#[0-9a-fA-F]{3,8}/, // var fallback（不算真正硬編碼）
  /\/\*\s*業務語義色/, // 已註解業務語義色
  /\/\*\s*ECharts canvas/, // ECharts 畫布色
];

const srcDir = resolve(__dirname, "../../");

function getSourceFiles() {
  const out = execSync(
    "find src -type f \\( -name '*.vue' -o -name '*.js' -o -name '*.mjs' \\) ! -path '*/node_modules/*' ! -path '*/test/*'",
    { cwd: srcDir, encoding: "utf-8" },
  );
  return out.trim().split("\n").filter(Boolean);
}

function countTrueHardcodedHex() {
  const files = getSourceFiles();
  let count = 0;
  const violations = [];

  for (const f of files) {
    if (EXCLUDE_DIRS.some((d) => f.includes(d))) continue;
    const content = readFileSync(join(srcDir, f), "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/#[0-9a-fA-F]{3,8}/.test(line)) continue;
      if (EXCLUDE_PATTERNS.some((p) => p.test(line))) continue;
      count += 1;
      violations.push({ file: f, line: i + 1, text: line.trim() });
    }
  }

  return { count, violations };
}

describe("Phase 5 hex-audit guard", () => {
  it(`真正硬編碼 hex 應 ≤ ${THRESHOLD}`, () => {
    const { count, violations } = countTrueHardcodedHex();
    expect(count).toBeLessThanOrEqual(
      THRESHOLD,
      `超過 ${THRESHOLD} 處（目前 ${count} 處）：\n${violations
        .slice(0, 20)
        .map((v) => `  ${v.file}:${v.line} ${v.text}`)
        .join("\n")}`,
    );
  });
});
