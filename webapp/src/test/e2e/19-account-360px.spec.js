import { test, expect } from "@playwright/test";

const MOCK_STATUS = JSON.stringify({
  _meta: {
    lastRun: "2026-08-17T08:00:00Z",
    sources: {
      cnnFearGreed: { status: "SUCCESS", lastFetch: "2026-08-17T07:00:00Z" },
      marginKgi: { status: "FAILED", error: "provider failed" },
    },
  },
  data: {
    rawCnn: { score: 20, rating: "Fear" },
    rawFx: { currentRate: 32.1, changePercent: -0.5 },
  },
});

const MOCK_REPORTS = JSON.stringify([
  {
    date: "2026-08-17",
    signals: {
      valuationGuardResult: { currentPR: 40 },
      grossLeverage: 1.8,
      maintenanceMargin: 165,
    },
  },
]);

const MOCK_EVIDENCE = JSON.stringify({
  verificationScope: "persisted evidence only",
  generatedAt: "2026-10-21T00:00:00Z",
  items: [{ field: "test.field" }],
});

test("AccountView 360px 下 3 個分組無橫向滾動且各分組在視窗內", async ({
  page,
}) => {
  // 1. 注入 init script：模擬 fetch 回傳固定資料，確保內容正確渲染
  await page.addInitScript(
    (mockData) => {
      window.__PLAYWRIGHT__ = true;
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        const u = typeof url === "string" ? url : url.url;
        if (u.includes("/api/status")) {
          return new Response(mockData.status, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("/api/reports")) {
          return new Response(mockData.reports, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (u.includes("/api/data-evidence-report")) {
          return new Response(mockData.evidence, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return originalFetch(url, options);
      };
    },
    { status: MOCK_STATUS, reports: MOCK_REPORTS, evidence: MOCK_EVIDENCE },
  );

  // 2. 設 360px 視窗並導航
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("http://localhost:5173/#/account", { timeout: 10000 });

  // 3. 等待頁面內容載入（等待首個 CollapsibleHeader 出現）
  const headers = page.locator(".collapsible-header");
  await expect(headers.first()).toBeVisible({ timeout: 5000 });

  // 4. 斷言 1：無橫向滾動
  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scroll.scrollWidth,
    `documentElement.scrollWidth(${scroll.scrollWidth}) 應 <= clientWidth(${scroll.clientWidth})`,
  ).toBeLessThanOrEqual(scroll.clientWidth);

  // 5. 斷言 2：3 個 CollapsibleSection（策略參數、關於、資料來源）與現行版本一致
  const groupCount = await headers.count();
  expect(groupCount, "應有 3 個 CollapsibleSection 分組標題").toBe(3);

  // 6. 斷言 3：每個分組在 360px 視窗內（x >= 0 且 right <= 360）
  const boxes = await headers.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, width: r.width, right: r.right };
    }),
  );
  boxes.forEach((box, i) => {
    expect(box.x, `第 ${i + 1} 組左緣 x 應 >= 0`).toBeGreaterThanOrEqual(0);
    expect(box.right, `第 ${i + 1} 組右緣 right 應 <= 360`).toBeLessThanOrEqual(
      360,
    );
  });
});
