// scripts/audit-pages.mjs
// WebApp 頁面系統性盤點：載入每個路由，截圖，檢查 console error，列出互動元素
import { chromium } from "playwright";
import fs from "fs";

const BASE_URL = "http://localhost:5173";
const ROUTES = [
  { path: "/#/dashboard", name: "儀表板" },
  { path: "/#/technical", name: "技術分析" },
  { path: "/#/radar", name: "市場雷達" },
  { path: "/#/macro", name: "總體戰情" },
  { path: "/#/chart", name: "圖表" },
  { path: "/#/reports", name: "歷史戰報" },
];

// 從環境變數讀取 batch index
const _BATCH_TOTAL = parseInt(process.env.AUDIT_BATCH || "1");
const BATCH_IDX = parseInt(process.env.AUDIT_BATCH_IDX || "0");
const allBatches = [
  [
    { path: "/#/dashboard", name: "儀表板" },
    { path: "/#/technical", name: "技術分析" },
    { path: "/#/radar", name: "市場雷達" },
  ],
  [
    { path: "/#/macro", name: "總體戰情" },
    { path: "/#/chart", name: "圖表" },
    { path: "/#/reports", name: "歷史戰報" },
  ],
  [
    { path: "/#/news", name: "新聞" },
    { path: "/#/strategy", name: "策略" },
    { path: "/#/account", name: "帳戶" },
  ],
  [
    { path: "/#/simulator", name: "策略模擬器" },
    { path: "/#/strategy-config", name: "策略設定" },
  ],
];
const _ROUTES_TO_RUN = allBatches[BATCH_IDX] || allBatches[0];

const audit = {
  timestamp: new Date().toISOString(),
  pages: [],
  summary: { ok: 0, warning: 0, error: 0 },
};

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});

for (const route of ROUTES) {
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  const failedRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text().substring(0, 200));
    if (msg.type() === "warning") warnings.push(msg.text().substring(0, 200));
  });
  page.on("pageerror", (err) =>
    errors.push("UNCAUGHT: " + err.message.substring(0, 200)),
  );
  page.on("requestfailed", (req) =>
    failedRequests.push(
      `${req.method()} ${req.url()} - ${req.failure()?.errorText}`,
    ),
  );

  const startTime = Date.now();
  try {
    await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
    await page.waitForTimeout(2500); // 等 Vue 完整 render
    const loadTime = Date.now() - startTime;

    // 計算可互動元素
    const interactives = await page.evaluate(() => {
      return {
        buttons: document.querySelectorAll("button").length,
        inputs: document.querySelectorAll("input").length,
        selects: document.querySelectorAll("select").length,
        links: document.querySelectorAll("a").length,
        hasContent: document.body.innerText.length > 100,
        title: document.title,
        mainText:
          document.querySelector("main")?.innerText?.substring(0, 200) || "N/A",
      };
    });

    // 截圖
    const screenshotPath = `/tmp/audit-${route.path.replace(/[/#]/g, "_")}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    audit.pages.push({
      path: route.path,
      name: route.name,
      status: errors.length === 0 ? "OK" : "ERROR",
      loadTimeMs: loadTime,
      errors,
      warnings: warnings.slice(0, 5),
      failedRequests: failedRequests.slice(0, 5),
      interactives,
      screenshot: screenshotPath,
    });

    if (errors.length === 0) audit.summary.ok++;
    else audit.summary.error++;
  } catch (e) {
    audit.pages.push({
      path: route.path,
      name: route.name,
      status: "TIMEOUT",
      error: e.message.substring(0, 200),
    });
    audit.summary.error++;
  }

  await page.close();
}

await browser.close();

fs.writeFileSync("/tmp/page-audit.json", JSON.stringify(audit, null, 2));

console.log("\n================================================");
console.log("📊 WebApp 頁面盤點結果");
console.log("================================================\n");
for (const p of audit.pages) {
  const icon = p.status === "OK" ? "✅" : p.status === "ERROR" ? "❌" : "⏱️ ";
  console.log(
    `${icon} ${p.name.padEnd(12)} ${p.path.padEnd(25)} ${p.loadTimeMs || "?"}ms`,
  );
  if (p.errors?.length > 0) {
    for (const e of p.errors) console.log(`     ❌ ${e}`);
  }
  if (p.interactives) {
    console.log(
      `     📦 buttons=${p.interactives.buttons} inputs=${p.interactives.inputs} selects=${p.interactives.selects}`,
    );
  }
  console.log();
}

console.log("================================================");
console.log(
  `📊 總計: ✅ ${audit.summary.ok} OK | ❌ ${audit.summary.error} ERROR`,
);
console.log("================================================");
