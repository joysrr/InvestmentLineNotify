import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("21-RouteTransition - 頁面過場與載入狀態", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  });

  test("RT-001: 路由切換時載入指示器可見，不出現空白或異常", async ({
    page,
  }) => {
    // 點擊 Bottom Nav 新聞 Tab，觸發路由切換至 /news
    await page
      .locator('a[href="#/news"], .nav-link:has-text("新聞")')
      .first()
      .click();

    // 載入期間應可見 route-loading 或頁面內容；不應出現空白/異常
    const loading = page.locator(".route-loading");
    const content = page.locator(".view-container.iln-page");
    await expect(loading.or(content)).toBeVisible({ timeout: 15000 });
  });

  test("RT-002: 新聞頁面載入完成後應正確渲染內容", async ({ page }) => {
    await page
      .locator('a[href="#/news"], .nav-link:has-text("新聞")')
      .first()
      .click();
    await expect(
      page.locator(".view-container.iln-page, .page-title, .region-header"),
    ).toBeVisible({ timeout: 15000 });
  });

  test("RT-003: 路由切換後不應短暫顯示空白（無內容狀態持續）", async ({
    page,
  }) => {
    await page
      .locator('a[href="#/news"], .nav-link:has-text("新聞")')
      .first()
      .click();
    // 5 秒內頁面必須有可見內容，排除長時間空白
    await expect(
      page.locator(".view-container.iln-page, .route-loading"),
    ).toBeVisible({ timeout: 5000 });
  });
});
