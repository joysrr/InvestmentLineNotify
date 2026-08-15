import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("07-MacroBattleView - 總經多空對決", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/macro", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("MAC-001: 應正確加載總經頁面", async ({ page }) => {
    await expect(page.locator(".view-title, .page-title").filter({ hasText: "總經" })).toBeVisible({ timeout: 15000 });
  });
});