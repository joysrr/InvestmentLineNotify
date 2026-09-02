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
    // 模擬器與回測報表已移至 /simulator 的獨立子頁籤，總覽頁不應再出現
    const simTab = page.locator("[data-testid='simulator-tab']");
    await expect(simTab).toHaveCount(0);
    const tabsText = page.locator(".dash-tabs");
    await expect(tabsText).not.toContainText("0050 雙向模擬器");
    await expect(tabsText).not.toContainText("回測報表");
  });

  test("DSH-003: 模擬器子頁籤可切換試算與歷史回測報表", async ({ page }) => {
    await page.goto("#/simulator", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await expect(page.locator("[data-testid='simulator-subtabs']")).toBeVisible(
      { timeout: 15000 },
    );
    // 預設顯示試算模擬器
    await expect(
      page.locator("[data-testid='simulator-subtabs'] .subtab-item").first(),
    ).toHaveClass(/active/);
    // 點擊歷史回測報表子頁籤
    await page.locator("[data-testid='subtab-backtest-report']").click();
    await page.waitForTimeout(1000);
    await expect(
      page.locator(".view-title").filter({ hasText: "回測報表" }).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});
