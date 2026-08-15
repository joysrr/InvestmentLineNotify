import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("03-BacktestReportView - 回測報表分析", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/backtest-report", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("BKT-001: 應正確加載回測報表頁面與圖表", async ({ page }) => {
    await expect(page.locator(".view-title").filter({ hasText: "回測報表" })).toBeVisible({ timeout: 15000 });
  });

  test("BKT-002: 應提供匯出按鈕", async ({ page }) => {
    const exportBtn = page.locator("button").filter({ hasText: "匯出 CSV" });
    await expect(exportBtn.first()).toBeVisible();
  });
});