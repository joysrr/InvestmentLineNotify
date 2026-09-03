import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("06-NewsTab - 新聞頁", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  });

  test("NWS-001: News Tab 應顯示於 Bottom Nav 並預設為 report", async ({
    page,
  }) => {
    await expect(page.locator("[data-testid='nav-tab-news']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-tab-news']")).toContainText(
      "新聞",
    );
  });

  test("NWS-002: 點擊 News Tab 後預設顯示精選報告 (report subtab)", async ({
    page,
  }) => {
    await page.locator("[data-testid='nav-tab-news']").click();
    await page.waitForTimeout(3000);
    // default subtab = report (first subtab-btn has .active)
    await expect(page.locator(".subtab-bar .subtab-btn").first()).toContainText(
      "精選報告",
    );
    await expect(page.locator(".subtab-bar .subtab-btn").first()).toHaveClass(
      /active/,
    );
  });

  test("NWS-003: report subtab 報告區渲染 (含生成時間或空狀態提示)", async ({
    page,
  }) => {
    await page.locator("[data-testid='nav-tab-news']").click();
    await page.waitForTimeout(3000);
    // Report view container is present
    // Report view renders: either real report-content OR the
    // "尚未產生" empty-state placeholder (both are valid post-load states).
    const reportContent = page.locator(".report-content");
    const emptyState = page.locator(".state-box:has-text('尚未產生')");
    await expect(reportContent.or(emptyState)).toBeVisible({ timeout: 8000 });
  });
});
