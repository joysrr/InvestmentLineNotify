import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("08-ChartView - 資產趨勢圖表", () => {
  test("CRT-001: 應正確加載資產趨勢圖表頁面", async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/chart", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const hasHeader = await page.locator(".view-title, .page-title").filter({ hasText: "資產趨勢" }).count();
    expect(hasHeader).toBeGreaterThan(0);
  });
});
