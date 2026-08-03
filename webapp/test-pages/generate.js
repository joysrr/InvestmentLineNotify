#!/usr/bin/env node
/**
 * Generate test HTML pages for each route
 * Run: node webapp/test-pages/generate.js
 */

const fs = require("fs");
const path = require("path");

const routes = [
  { route: "#/dashboard", name: "總覽", title: "Dashboard" },
  { route: "#/radar", name: "市場雷達", title: "Market Radar" },
  { route: "#/macro", name: "多空對決", title: "Macro Battle" },
  { route: "#/chart", name: "圖表", title: "Chart" },
  { route: "#/reports", name: "報告", title: "Reports" },
  { route: "#/news", name: "新聞", title: "News" },
  { route: "#/strategy", name: "策略", title: "Strategy" },
  { route: "#/account", name: "帳戶", title: "Account" },
  { route: "#/simulator", name: "模擬器", title: "Simulator" },
];

const template = fs.readFileSync(path.join(__dirname, "template.html"), "utf8");

const outputDir = path.join(__dirname, "..", "dist", "test-pages");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

routes.forEach((r) => {
  const html = template
    .replace(/{{PAGE_NAME}}/g, r.name)
    .replace(/{{PAGE_TITLE}}/g, r.title)
    .replace(/{{ROUTE}}/g, r.route);

  const filename = `test-${r.route.replace("#/", "")}.html`;
  fs.writeFileSync(path.join(outputDir, filename), html);
  console.log(`✅ Generated: ${filename}`);
});

console.log(`\n📁 Output: ${outputDir}`);
console.log(`🔢 Total: ${routes.length} pages`);
