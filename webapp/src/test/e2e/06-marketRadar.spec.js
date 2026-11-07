import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("06-MarketRadarView - 市場雷達", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/radar", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("RAD-001: 應正確加載市場雷達頁面", async ({ page }) => {
    await expect(
      page.locator(".page-title").filter({ hasText: "市場雷達" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("RAD-002: 點擊多空對決子分頁應跳轉至 #/macro", async ({ page }) => {
    const macroTab = page
      .locator(".subtab-btn")
      .filter({ hasText: "多空對決" });
    await expect(macroTab).toBeVisible({ timeout: 15000 });
    await macroTab.click();
    await expect(page).toHaveURL(/#\/macro/);
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

    await page.goto("#/radar", { waitUntil: "domcontentloaded" });
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
