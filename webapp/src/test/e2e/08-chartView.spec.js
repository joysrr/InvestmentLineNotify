import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("08-ChartView - 資產趨勢圖表", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/chart", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("CRT-001: 應正確加載資產趨勢圖表頁面", async ({ page }) => {
    await expect(page.locator(".view-title").filter({ hasText: "資產趨勢" })).toBeVisible({ timeout: 15000 });
  });
});