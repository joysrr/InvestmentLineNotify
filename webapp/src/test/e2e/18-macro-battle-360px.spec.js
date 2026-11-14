import { test, expect } from "@playwright/test";

const MOCK_REPORT = JSON.stringify([
  {
    id: "mock-report-1",
    date: "2026-11-10",
    macroAnalysis: {
      bull_events: [
        { title: "mock bull 1", weight: 1 },
        { title: "mock bull 2", weight: 1 },
      ],
      bear_events: [{ title: "mock bear 1", weight: 1 }],
      neutral_events: [],
      conclusion: {
        market_direction: "neutral",
        short_summary: "mock summary",
        key_takeaways: [],
      },
    },
  },
]);

test("MacroBattle 360px 下 bull / bear 上下堆疊且無橫向滾動", async ({
  page,
}) => {
  // 1. 注入 init script：標記為 Playwright 環境並模擬 fetch 回傳固定資料
  await page.addInitScript((mockData) => {
    window.__PLAYWRIGHT__ = true;
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      const u = typeof url === "string" ? url : url.url;
      if (u.includes("/api/reports")) {
        return new Response(mockData, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, options);
    };
  }, MOCK_REPORT);

  // 2. 設 360px 視窗並導航
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("http://localhost:5173/#/insights?tab=macro", {
    waitUntil: "networkidle",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  // 3. 等 .score-wrap 出現
  const scoreWrap = page.locator(".score-wrap");
  await expect(scoreWrap).toBeVisible({ timeout: 5000 });

  // 4. 斷言 1：flex-direction 為 column（360px 媒體查詢生效）
  const flexDirection = await scoreWrap.evaluate(
    (el) => window.getComputedStyle(el).flexDirection,
  );
  expect(flexDirection, ".score-wrap 在 360px 下應為 column").toBe("column");

  // 5. 斷言 2：bull 與 bear 上下排列（boundingBox 幾何驗證）
  const bullBox = await page.locator(".score-side--bull").first().boundingBox();
  const bearBox = await page.locator(".score-side--bear").first().boundingBox();
  expect(bullBox, ".score-side--bull 應存在").not.toBeNull();
  expect(bearBox, ".score-side--bear 應存在").not.toBeNull();
  expect(bearBox.y, "bear 應在 bull 下方（上下堆疊）").toBeGreaterThanOrEqual(
    bullBox.y + bullBox.height - 1,
  );
  expect(
    Math.abs(bearBox.x - bullBox.x),
    "bull/bear 左緣應對齊",
  ).toBeLessThanOrEqual(2);

  // 6. 斷言 3：無橫向滾動
  const scrollInfo = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollInfo.scrollWidth, "360px 下不應有橫向滾動").toBeLessThanOrEqual(
    scrollInfo.clientWidth,
  );
});

test("MacroBattle 桌面寬度下 bull / bear 左右並排", async ({ page }) => {
  // 1. 注入 init script
  await page.addInitScript((mockData) => {
    window.__PLAYWRIGHT__ = true;
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      const u = typeof url === "string" ? url : url.url;
      if (u.includes("/api/reports")) {
        return new Response(mockData, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, options);
    };
  }, MOCK_REPORT);

  // 2. 設桌面寬度並導航
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("http://localhost:5173/#/insights?tab=macro", {
    waitUntil: "networkidle",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  // 3. 等 .score-wrap 出現
  const scoreWrap = page.locator(".score-wrap");
  await expect(scoreWrap).toBeVisible({ timeout: 5000 });

  // 4. 斷言：flex-direction 為 row（桌面並排）
  const flexDirection = await scoreWrap.evaluate(
    (el) => window.getComputedStyle(el).flexDirection,
  );
  expect(flexDirection, "桌面寬度下 .score-wrap 應為 row").toBe("row");
});
