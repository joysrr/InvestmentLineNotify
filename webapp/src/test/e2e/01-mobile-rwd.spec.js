import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("01-MobileRWD - 手機端響應式與邊界溢出檢查", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  });

  test("RWD-001: 375px 窄螢幕下首頁不應出現橫向滾動條 (No Horizontal Overflow)", async ({
    page,
  }) => {
    // Expand collapsible sections to test full content width
    const strategyHeader = page.locator(".strategy-status-card .card-header");
    if (await strategyHeader.isVisible()) {
      await strategyHeader.click();
      await page.waitForTimeout(500);
    }

    const analysisHeader = page.locator(".analysis-card .card-header");
    if (await analysisHeader.isVisible()) {
      await analysisHeader.click();
      await page.waitForTimeout(500);
    }

    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(isOverflowing).toBe(false);
  });

  test("RWD-002: 375px 窄螢幕下底欄 Bottom Nav 應完好顯現且可點擊", async ({
    page,
  }) => {
    const bottomNav = page.locator(".floating-pill");
    await expect(bottomNav).toBeVisible();

    // Check width of bottom nav pill fits within 375px
    const navBox = await bottomNav.boundingBox();
    expect(navBox.width).toBeLessThanOrEqual(375);
  });
});
