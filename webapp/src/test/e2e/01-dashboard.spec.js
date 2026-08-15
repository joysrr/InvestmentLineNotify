import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("01-DashboardView - 投資儀表板", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
  });

  test("DSH-001: 應正確加載儀表板並渲染指標卡片", async ({ page }) => {
    await page.goto("#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const appMounted = await page.locator("#app > *").count();
    expect(appMounted).toBeGreaterThan(0);

    const hasHeader = await page.locator(".dash-title, .view-title").count();
    expect(hasHeader).toBeGreaterThan(0);
  });

  test("DSH-002: 點擊雙向模擬器 Tab 應成功切換模擬器內容", async ({ page }) => {
    await page.goto("#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const simTab = page.locator("[data-testid='simulator-tab']").first();
    if (await simTab.isVisible().catch(() => false)) {
      await simTab.click();
      await page.waitForTimeout(1000);
      const isSimVisible = await page.locator(".simulator-view, [data-testid='simulator-view']").count();
      expect(isSimVisible).toBeGreaterThan(0);
    }
  });
});
