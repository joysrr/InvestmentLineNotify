import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("06-MarketRadarView - 市場雷達", () => {
  test("RAD-001: 應正確加載市場雷達頁面", async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/radar", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const hasHeader = await page.locator(".page-title, .view-title").filter({ hasText: "市場雷達" }).count();
    expect(hasHeader).toBeGreaterThan(0);
  });
});
