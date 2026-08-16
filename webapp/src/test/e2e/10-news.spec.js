import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("10-NewsView - 即時新聞與情意素分析", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/news", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("NWS-001: 應正確加載新聞頁面（允許 API 錯誤狀態）", async ({ page }) => {
    // 頁面應該渲染，即使 API 失敗也會顯示錯誤提示（GlobalErrorBoundary 或錯誤區塊）
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    // 驗證有標題或錯誤區塊
    const hasTitle = await page
      .locator(".region-header, .news-header, .view-title, .status-error")
      .first()
      .isVisible({ timeout: 5000 });
    expect(hasTitle).toBeTruthy();
  });
});
