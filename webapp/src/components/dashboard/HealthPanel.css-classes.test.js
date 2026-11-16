import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const healthPanelPath = path.resolve(__dirname, "./HealthPanel.vue");

const source = fs.readFileSync(healthPanelPath, "utf-8");

// 提取 <template> 中使用的 class 類名
const templateMatch = source.match(/<template>([\s\S]*?)<\/template>/);
const templateHtml = templateMatch ? templateMatch[1] : "";

const templateClasses = new Set();
const classRegex = /class=["']([^"']+)["']/g;
let match;
while ((match = classRegex.exec(templateHtml)) !== null) {
  const classes = match[1].split(/\s+/);
  for (const cls of classes) {
    if (cls.startsWith(":")) continue; // 動態綁定如 :class="..."
    if (cls.includes("?")) continue; // 動態運算式如 comp.status?.toLowerCase()
    templateClasses.add(cls);
  }
}

// section-title 已在 shared-styles.css 全局定義，無需在 scoped 中重複
templateClasses.delete("section-title");

// 提取 <style scoped> 中定義的 CSS 類名
const styleMatch = source.match(/<style scoped>([\s\S]*?)<\/style>/);
const styleCss = styleMatch ? styleMatch[1] : "";

const styleClasses = new Set();
const cssClassRegex = /\.([a-zA-Z0-9_-]+)/g;
let cssMatch;
while ((cssMatch = cssClassRegex.exec(styleCss)) !== null) {
  styleClasses.add(cssMatch[1]);
}

describe("HealthPanel CSS 類名匹配性", () => {
  const missing = [];
  for (const cls of templateClasses) {
    if (!styleClasses.has(cls)) {
      missing.push(cls);
    }
  }

  it("模板中使用的所有靜態 CSS 類名都應在 <style scoped> 中有定義", () => {
    console.log("模板類名:", [...templateClasses].sort().join(", "));
    console.log("CSS 定義類名:", [...styleClasses].sort().join(", "));
    console.log("缺失的類名:", missing.sort().join(", "));
    expect(missing).toEqual([]);
  });
});
