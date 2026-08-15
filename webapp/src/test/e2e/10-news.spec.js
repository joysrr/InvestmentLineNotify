import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("10-NewsView - 即時新聞與情意素分析", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/news", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("NWS-001: 應正確加載新聞頁面", async ({ page }) => {
    await expect(page.locator(".region-header, .news-header").first()).toBeVisible({ timeout: 15000 });
  });
});