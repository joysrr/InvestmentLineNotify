import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "../components/radar/ExtremeRadarPanel.vue");
const source = readFileSync(FILE, "utf-8");
const styleBlock = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";

const RAW_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;

describe("ExtremeRadarPanel 色彩令牌使用", () => {
  it("style 區塊內不得出現裸色值", () => {
    const offenders = styleBlock
      .split("\n")
      .map((text, i) => ({ no: i + 1, text: text.trim() }))
      .filter(({ text }) => RAW_COLOR_RE.test(text));
    expect(offenders).toEqual([]);
  });

  it("不得保留已無 template 引用的死 CSS class", () => {
    for (const cls of [
      "toggle-btn",
      "discipline-card",
      "radar-panel-header",
      "panel-severity-critical",
    ]) {
      expect(styleBlock).not.toMatch(new RegExp(`\\.${cls}\\b`));
    }
  });

  it("dark 段不得重複定義已由令牌覆寫的 background", () => {
    expect(styleBlock).not.toMatch(
      /\.dark \.radar-mini-item[\s\S]{0,120}background:\s*rgba/,
    );
    expect(styleBlock).not.toMatch(
      /\.dark \.triggered-item[\s\S]{0,120}background:\s*rgba/,
    );
  });
});
