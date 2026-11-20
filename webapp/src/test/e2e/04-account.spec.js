import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("04-AccountView - 系統狀態與帳戶", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/account", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("ACC-001: 應正確加載系統狀態頁面", async ({ page }) => {
    await expect(
      page.locator(".page-title").filter({ hasText: "系統狀態" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("ACC-002: 點擊資產趨勢圖表按鈕應跳轉至 #/chart", async ({ page }) => {
    const chartBtn = page.locator(".chart-link-btn");
    await expect(chartBtn).toBeVisible({ timeout: 15000 });
    await chartBtn.click();
    await expect(page).toHaveURL(/#\/chart/);
  });

  test("ACC-003: StrategyConfigEditor 在 390px 螢幕無水平溢位", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("#/strategy-config", { waitUntil: "domcontentloaded" });
    const editor = page.locator('[data-testid="strategy-config-editor"]');
    await expect(editor).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: /策略參數設定/ }),
    ).toBeVisible();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  });
});
