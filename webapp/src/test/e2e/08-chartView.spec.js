import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("08-ChartView - 資產趨勢圖表", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/chart", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("CRT-001: 應正確加載資產趨勢圖表頁面", async ({ page }) => {
    await expect(
      page.locator(".view-title").filter({ hasText: "資產趨勢" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("CRT-004: 從 Account 進入後可返回 Account", async ({ page }) => {
    await page.goto("#/account", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /資產趨勢圖表/ }).click();
    await expect(page).toHaveURL(/#\/chart\?source=account/);
    await page.getByTestId("chart-back").click();
    await expect(page).toHaveURL(/#\/account/);
  });

  test("CRT-003: 有資料時圖表容器在窄屏與桌機都不溢位，並呈現指標標籤", async ({
    page,
  }) => {
    await page.route("**/api/reports/snapshots**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          snapshots: [
            {
              date: "2026-10-20",
              netValueMarket: 12345,
              qty0050: 1000,
              qtyZ2: 500,
              totalLoan: 300000,
            },
            {
              date: "2026-11-20",
              netValueMarket: 13500,
              qty0050: 1100,
              qtyZ2: 600,
              totalLoan: 280000,
            },
          ],
          hasEncryption: true,
        }),
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.setViewportSize({ width: 390, height: 844 });
    const wrapper = page.locator(".chart-wrapper");
    await expect(wrapper).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(".s-label").filter({ hasText: "市價淨値" }),
    ).toBeVisible();
    await expect(
      page.locator(".s-label").filter({ hasText: "0050 市價" }),
    ).toBeVisible();
    await expect(
      page.locator(".s-label").filter({ hasText: "00675L 市價" }),
    ).toBeVisible();
    await expect(
      page.locator(".s-label").filter({ hasText: "融資餘額" }),
    ).toBeVisible();

    const mobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(mobileOverflow).toBe(false);
    const chart = page.locator(".chart");
    const mobileChartWidth = await chart.evaluate(
      (element) => element.getBoundingClientRect().width,
    );

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(wrapper).toBeVisible();
    const desktopChartWidth = await chart.evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    expect(desktopChartWidth).toBeGreaterThan(mobileChartWidth);
    const desktopOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(desktopOverflow).toBe(false);
  });
});
