import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "..", "views", "AccountView.vue");
const source = readFileSync(SRC, "utf8");

const scriptStart = source.indexOf("<script setup>");
const scriptEnd = source.indexOf("</script>", scriptStart);
const scriptBody = source.slice(scriptStart, scriptEnd);

describe("AccountView prTrendOption design tokens (R3)", () => {
  it("定義 readToken 工具函式，從 CSS 設計令牌讀取色值", () => {
    expect(scriptBody).toContain("function readToken");
  });

  it("prTrendOption 面積填色 colorStops 由 readToken 讀取令牌，不含硬編碼裸 rgba", () => {
    expect(scriptBody).toContain('readToken("--iln-brand-fill-strong"');
    expect(scriptBody).toContain('readToken("--iln-brand-fill-fade"');
    // 腳本區不得以硬編碼字串直接指定 brand 色（須經 readToken 讀取令牌；fallback 字串為容錯預設，不算直接賦值）
    expect(scriptBody).not.toMatch(/color:\s*"rgba\(36,\s*129,\s*204/);
  });
});
