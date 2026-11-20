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

  test("NWS-005: 寬屏新聞池使用雙欄網格", async ({ page }) => {
    await page.route("**/api/news**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            title: "E2E 測試新聞",
            url: "https://example.com/news",
            source: "測試來源",
            publishedAt: "2026-11-20T09:00:00Z",
          },
        ]),
      });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .locator(".subtab-bar .subtab-btn")
      .filter({ hasText: "新聞池" })
      .click();
    const list = page.locator(".pool-list.news-list");
    await expect(list).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("E2E 測試新聞")).toBeVisible();
    const columns = await list.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(columns).toBe(2);
  });

  test("NWS-006: 點擊新聞卡片會透過 Telegram openLink 開啟原文", async ({
    page,
  }) => {
    const articleUrl = "https://example.com/e2e-article";
    await page.addInitScript(() => {
      window.__openedLinks = [];
      window.Telegram.WebApp.openLink = (url) => window.__openedLinks.push(url);
    });
    await page.route("**/api/news**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            title: "openLink 驗收新聞",
            link: articleUrl,
            source: "測試來源",
            pubDate: "2026-11-20T09:00:00Z",
          },
        ]),
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .locator(".subtab-bar .subtab-btn")
      .filter({ hasText: "新聞池" })
      .click();
    await page.getByText("openLink 驗收新聞").click();
    await expect
      .poll(() => page.evaluate(() => window.__openedLinks))
      .toEqual([articleUrl]);
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
