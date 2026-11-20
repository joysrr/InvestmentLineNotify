import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("07-MacroBattleView - 總經多空對決", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/macro", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("MAC-001: 應正確加載總經頁面", async ({ page }) => {
    await expect(
      page.locator(".view-title, .page-title").filter({ hasText: "總經" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("MAC-003: 390x844 無水平溢位且頁面可見", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupE2EContext(page);
    await page.goto("#/macro", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await expect(
      page.locator(".page-title").filter({ hasText: "總經" }),
    ).toBeVisible({ timeout: 15000 });
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });
});
