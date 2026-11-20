import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils";

const ROUTES = [
  { path: "/dashboard", selector: ".view-container" },
  { path: "/news", selector: ".view-container" },
  { path: "/account", selector: ".page-title" },
  { path: "/chart", selector: ".view-container" },
  {
    path: "/strategy-config",
    selector: "[data-testid='strategy-config-editor']",
  },
];

async function go(page, path) {
  await setupE2EContext(page);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(`#${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
}

test.describe("P2-126 1024px 桌面版面邊界", () => {
  for (const route of ROUTES) {
    const path = typeof route === "string" ? route : route.path;
    const selector =
      typeof route === "string" ? ".view-container" : route.selector;
    test(`${path} 1024px 無橫向溢位且頁面可見`, async ({ page }) => {
      await go(page, path);
      await expect(page.locator(selector)).toBeVisible({
        timeout: 10000,
      });
      const width = await page.evaluate(() =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ),
      );
      expect(width).toBeLessThanOrEqual(1024);
    });
  }

  test("Insights 總經事件網格於 1024px 可見且無橫向溢位", async ({ page }) => {
    await setupE2EContext(page);
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.route("**/reports**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            date: "2026-11-20",
            macroAnalysis: {
              conclusion: {
                short_summary: "測試總結",
                market_direction: "BULLISH",
              },
              bull_events: [{ title: "測試多方事件", score: 10 }],
              bear_events: [{ title: "測試空方事件", score: 8 }],
            },
          },
        ]),
      });
    });
    await page.goto("#/insights?tab=macro", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await expect(
      page.getByRole("heading", { name: "總經多空對決" }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".macro-events-grid")).toBeVisible();
    const width = await page.evaluate(() =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    );
    expect(width).toBeLessThanOrEqual(1024);
  });
});
