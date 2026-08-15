import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("04-AccountView - 系統狀態與帳戶", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/account", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("ACC-001: 應正確加載系統狀態頁面", async ({ page }) => {
    await expect(page.locator(".page-title").filter({ hasText: "系統狀態" })).toBeVisible({ timeout: 15000 });
  });
});