import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("11-StrategyView - 策略總覽與狀態", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/strategy", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("STR-001: 應正確重導向至策略設定頁面", async ({ page }) => {
    // /strategy should redirect to /strategy-config
    await expect(page).toHaveURL(/.*#\/strategy-config/);
    await expect(page.locator("h2.editor-title")).toContainText("策略參數設定");
  });
});
