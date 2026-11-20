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
    await expect(page.locator(".view-container.iln-page")).toBeVisible({
      timeout: 15000,
    });
    // 驗證有頁面標題或錯誤區塊（空狀態下顯示 page-title 而非 region-header）
    const hasTitle = await page
      .locator(
        ".page-title, .region-header, .news-header, .view-title, .status-error, .state-box",
      )
      .first()
      .isVisible({ timeout: 5000 });
    expect(hasTitle).toBeTruthy();
  });

  test("NWS-004: .subtab-bar 為 sticky 且不遮擋頁首（P2-127）", async ({
    page,
  }) => {
    const pageHeader = page.locator(".page-header");
    const subtabBar = page.locator(".subtab-bar");

    await expect(pageHeader).toBeVisible();
    await expect(subtabBar).toBeVisible();

    // 捲動真正的容器後，sticky 列不得跑到視窗上緣以外
    await page.locator(".app-main").evaluate((element) => {
      element.scrollTop = Math.min(300, element.scrollHeight);
    });
    const stickyState = await subtabBar.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        position: getComputedStyle(element).position,
      };
    });
    expect(stickyState.position).toBe("sticky");
    expect(stickyState.top).toBeGreaterThanOrEqual(0);
  });
});
