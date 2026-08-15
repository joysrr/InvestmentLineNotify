import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("05-TechnicalView - 技術指標詳情", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/technical", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("TEC-001: 應正確加載技術指標詳情", async ({ page }) => {
    await expect(page.locator(".view-title").filter({ hasText: "技術指標" })).toBeVisible({ timeout: 15000 });
  });
});