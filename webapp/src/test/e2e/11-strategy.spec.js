import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("11-StrategyView - 策略總覽與狀態", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/strategy", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("STR-001: 應正確加載策略總覽頁面", async ({ page }) => {
    await expect(page.locator(".view-title").filter({ hasText: "投資策略" })).toBeVisible({ timeout: 15000 });
  });
});