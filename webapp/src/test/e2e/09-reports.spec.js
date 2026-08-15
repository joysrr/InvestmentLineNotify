import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("09-ReportsView - AI 分析報告摘要", () => {
  test("RPT-001: 應正確加載報告頁面", async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/reports", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const hasHeader = await page.locator(".view-title").filter({ hasText: "報告摘要" }).count();
    expect(hasHeader).toBeGreaterThan(0);
  });
});