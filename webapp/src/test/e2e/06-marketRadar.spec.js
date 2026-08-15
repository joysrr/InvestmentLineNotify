import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("06-MarketRadarView - 市場雷達", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/radar", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("RAD-001: 應正確加載市場雷達頁面", async ({ page }) => {
    await expect(page.locator(".page-title").filter({ hasText: "市場雷達" })).toBeVisible({ timeout: 15000 });
  });
});