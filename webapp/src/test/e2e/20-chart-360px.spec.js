import { test, expect } from "@playwright/test";

const MOCK_SNAPSHOTS = JSON.stringify({
  snapshots: [
    { date: "2026-01-02", netValueMarket: 100 },
    { date: "2026-01-05", netValueMarket: 102 },
    { date: "2026-01-06", netValueMarket: 101 },
    { date: "2026-01-07", netValueMarket: 103 },
    { date: "2026-01-08", netValueMarket: 105 },
  ],
  hasEncryption: true,
});

test("ChartView 360px 下時間範圍按鈕寬高 ≥44px 且無橫向滾動", async ({
  page,
}) => {
  // 1. 注入 init script：模擬 fetch 回傳固定快照資料
  await page.addInitScript((mockData) => {
    window.__PLAYWRIGHT__ = true;
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      const u = typeof url === "string" ? url : url.url;
      if (u.includes("/api/reports/snapshots")) {
        return new Response(mockData, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, options);
    };
  }, MOCK_SNAPSHOTS);

  // 2. 設 360px 視窗並導航
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("http://localhost:5173/#/chart", {
    waitUntil: "networkidle",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  // 3. 等時間範圍按鈕出現
  const timeRangeBar = page.locator(".time-range-bar");
  await expect(timeRangeBar).toBeVisible({ timeout: 5000 });

  // 4. 斷言：每個時間範圍按鈕寬高 ≥ 44px（幾何斷言）
  const btnCount = await timeRangeBar.locator(".time-range-btn").count();
  expect(btnCount, "應有 5 個時間範圍按鈕").toBe(5);

  for (let i = 0; i < btnCount; i++) {
    const btn = timeRangeBar.locator(".time-range-btn").nth(i);
    const box = await btn.boundingBox();
    expect(box, `時間範圍按鈕 ${i} 應有 boundingBox`).not.toBeNull();
    expect(box.width, `時間範圍按鈕 ${i} 寬度應 ≥ 44px`).toBeGreaterThanOrEqual(
      44,
    );
    expect(
      box.height,
      `時間範圍按鈕 ${i} 高度應 ≥ 44px`,
    ).toBeGreaterThanOrEqual(44);
  }

  // 5. 斷言：無橫向滾動
  const scrollInfo = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollInfo.scrollWidth, "360px 下不應有橫向滾動").toBeLessThanOrEqual(
    scrollInfo.clientWidth,
  );
});

test("ChartView 桌面寬度下時間範圍按鈕正常渲染", async ({ page }) => {
  await page.addInitScript((mockData) => {
    window.__PLAYWRIGHT__ = true;
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      const u = typeof url === "string" ? url : url.url;
      if (u.includes("/api/reports/snapshots")) {
        return new Response(mockData, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url, options);
    };
  }, MOCK_SNAPSHOTS);

  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("http://localhost:5173/#/chart", {
    waitUntil: "networkidle",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  const timeRangeBar = page.locator(".time-range-bar");
  await expect(timeRangeBar).toBeVisible({ timeout: 5000 });

  const btnCount = await timeRangeBar.locator(".time-range-btn").count();
  expect(btnCount, "應有 5 個時間範圍按鈕").toBe(5);
});
