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
    // 新單頁版 DashboardView 無頂層 dash-tabs；模擬器只在底部導覽 bar 單一呈現
    await expect(
      page.locator("[data-testid='nav-tab-simulator']"),
    ).toBeVisible();
    await expect(page.locator("[data-testid='nav-tab-backtest']")).toHaveCount(
      0,
    );
  });

  test("DSH-003: 模擬器頁面應正常載入雙向模擬器面板", async ({ page }) => {
    await page.goto("#/simulator", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await expect(page.locator("[data-testid='mode-selector']")).toBeVisible({
      timeout: 15000,
    });
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
