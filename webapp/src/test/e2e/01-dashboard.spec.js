import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("01-DashboardView - 投資儀表板", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("DSH-001: 應正確加載儀表板並渲染指標卡片", async ({ page }) => {
    await expect(page.locator(".dash-title")).toBeVisible({ timeout: 15000 });
    const appChildren = page.locator("#app > *");
    await expect(appChildren).toHaveCount(1);
  });

  test("DSH-002: 總覽頁不再包含重複的模擬器與回測報表頂層 Tab", async ({
    page,
  }) => {
    // 模擬器與回測報表已從 DashboardView 移除，不可復原
    const simTab = page.locator("[data-testid='simulator-tab']");
    await expect(simTab).toHaveCount(0);
    // 模擬器頁面已整體移除，底部導航不再包含模擬器 Tab
    await expect(page.locator("[data-testid='nav-tab-backtest']")).toHaveCount(
      0,
    );
  });

  test.skip("DSH-003: 模擬器頁面已整體移除，不可復原", async ({ page }) => {
    // 模擬器頁面已從當前版本移除，此測試保留作為記錄，不執行
  });

  test("DSH-004: Bottom nav 應顯示新聞 Tab 並可導航至 NewsView", async ({
    page,
  }) => {
    // News Tab 應顯示於 bottom nav
    await expect(page.locator("[data-testid='nav-tab-news']")).toBeVisible();
    // 點擊後導航至 /news
    await page.locator("[data-testid='nav-tab-news']").click();
    await page.waitForTimeout(2000);
    await expect(page.locator(".subtab-bar .subtab-btn").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator(".subtab-bar .subtab-btn").first()).toContainText(
      "精選報告",
    );
  });
});
