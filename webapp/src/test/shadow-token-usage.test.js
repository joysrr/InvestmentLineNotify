import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { readdirSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");

function readVueFiles(dir) {
  const results = [];
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".vue"))
        results.push(readFileSync(full, "utf8"));
    }
  }
  walk(dir);
  return results;
}

function readTokensCss() {
  return readFileSync(join(ROOT, "src/styles/tokens.css"), "utf8");
}

describe("shadow-token-usage", () => {
  const vueContents = readVueFiles(join(ROOT, "src"));
  const tokensCss = readTokensCss();

  it("不應出現「有偏移量 + var(--iln-shadow-*)」的部分替換寫法", () => {
    const bad = vueContents.filter((c) =>
      /box-shadow:\s*\d[\s\S]*?var\(--iln-shadow-/s.test(c),
    );
    expect(bad).toEqual([]);
  });

  it("box-shadow: var(--iln-shadow-*) 完整替換寫法應可用", () => {
    const good = vueContents.filter((c) =>
      /box-shadow:\s*var\(--iln-shadow-/.test(c),
    );
    // 至少應有一筆完整替換的用法存在（驗證測試本身不為空）
    expect(good.length).toBeGreaterThan(0);
  });

  it("tokens.css 中 --iln-shadow-* 定義值必須以數字開頭（含偏移量）", () => {
    const defs = tokensCss.match(/--iln-shadow-\w+:\s*([^;]+);/g);
    for (const def of defs) {
      const value = def.split(":")[1].split(";")[0].trim();
      expect(/^\d/.test(value)).toBe(true);
    }
  });
});
