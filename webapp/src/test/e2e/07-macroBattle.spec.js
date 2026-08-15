import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("07-MacroBattleView - 總經多空對決", () => {
  test("MAC-001: 應正確加載總經頁面", async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/macro", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const hasHeader = await page.locator(".page-title, .view-title").filter({ hasText: "總經" }).count();
    expect(hasHeader).toBeGreaterThan(0);
  });
});
