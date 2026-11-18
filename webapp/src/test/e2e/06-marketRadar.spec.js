import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("06-MarketRadarView - 市場雷達", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/insights?tab=radar", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("RAD-001: 應正確加載市場雷達頁面", async ({ page }) => {
    await expect(
      page.locator(".page-title").filter({ hasText: "市場雷達" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("RAD-002: 點擊多空對決子分頁應跳轉至 #/insights?tab=macro", async ({
    page,
  }) => {
    // 多空對決子分頁已從 MarketRadarView 移至 InsightsView，通過 SegmentedControl 切換
    const macroTab = page
      .locator("button, [role='button']")
      .filter({ hasText: /多空|macro/i });
    await expect(macroTab.first()).toBeVisible({ timeout: 15000 });
    await macroTab.first().click();
    await expect(page).toHaveURL(/#\/insights\?tab=macro/);
  });
});

test.describe("06-MarketRadarView - 長期防禦模式狀態欄 (Phase 4)", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);

    // 攔截 /api/status，返回 isLongTermDefense: true
    await page.route("**/api/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            leadingIndicators: {
              isLongTermDefense: true,
            },
          },
        }),
      });
    });

    await page.goto("#/insights?tab=radar", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("RAD-003: isLongTermDefense 為 true 時顯示長期防禦模式狀態欄", async ({
    page,
  }) => {
    const badge = page.locator(".defense-mode-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toContainText("長期防禦模式");
  });
});
