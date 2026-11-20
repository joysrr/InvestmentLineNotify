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
    await page.goBack();
    await expect(page).toHaveURL(/#\/account/);
    await expect(
      page.locator(".page-title").filter({ hasText: "系統狀態" }),
    ).toBeVisible();
  });

  test("ACC-004: 通知設定操作提供回饋（不代表持久化）", async ({ page }) => {
    const hourInput = page.locator(
      '.notification-settings input[placeholder="0-23"]',
    );
    await hourInput.fill("10");
    await page.getByRole("button", { name: "儲存設定" }).click();
    await expect(page.locator(".save-feedback")).toContainText(
      "通知設定已儲存",
    );
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
