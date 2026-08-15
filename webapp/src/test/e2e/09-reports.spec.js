import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("09-ReportsView - AI 分析報告摘要", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/reports", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("RPT-001: 應正確加載報告頁面", async ({ page }) => {
    await expect(page.locator(".view-title").filter({ hasText: "報告摘要" })).toBeVisible({ timeout: 15000 });
  });
});