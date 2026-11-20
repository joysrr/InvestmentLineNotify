import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("06-MarketRadarView - 市場雷達", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/insights?tab=radar", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("RAD-004: 390px 標籤不溢位，缺值與匯率精度可讀", async ({ page }) => {
    await page.route("**/api/reports**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            date: "2026-11-20",
            macroData: { rawFx: { currentRate: 31.246 } },
            leadingIndicators: { isLongTermDefense: false },
          },
        ]),
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            rawUsMarket: { vix: 18.5, spxChg: 1.2 },
            rawCnn: { score: null, rating: "—" },
            rawValuation: { pe: null, pb: null },
            rawFx: { currentRate: 31.246 },
            leadingIndicators: { isLongTermDefense: false },
          },
          updatedAt: "2026-11-20T08:00:00.000Z",
        }),
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".radar-grid").last()).toBeVisible({
      timeout: 15000,
    });
    const grid = page.locator(".radar-grid").last();
    const bounds = await grid.evaluate((element) => {
      const labels = [...element.querySelectorAll(".stat-card__label")];
      return {
        overflow: element.scrollWidth > element.clientWidth,
        labels: labels.map((label) => ({
          text: label.textContent.trim(),
          overflow: label.scrollWidth > label.clientWidth,
        })),
      };
    });
    expect(bounds.overflow).toBe(false);
    expect(bounds.labels.every((label) => !label.overflow)).toBe(true);
    await expect(
      page.locator(".stat-card").filter({ hasText: "美元/台幣" }),
    ).toContainText("31.3");
    await expect(
      page.locator(".stat-card").filter({ hasText: "大盤 PE" }),
    ).toContainText("—");
  });

  test("RAD-005: 1024px 雷達指標維持三欄網格", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    const grid = page.locator(".radar-grid").nth(1);
    await expect(grid).toBeVisible({ timeout: 15000 });
    const columns = await grid.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(columns).toBe(3);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("RAD-001: 應正確加載市場雷達頁面", async ({ page }) => {
    await expect(
      page.locator(".page-title").filter({ hasText: "市場雷達" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("RAD-002: 點擊多空對決子分頁應跳轉至 #/insights?tab=macro", async ({
    page,
  }) => {
    // 多空對決子分頁已從 MarketRadarView 移至 InsightsView，通過 SegmentedControl 切換
    const macroTab = page
      .locator("button, [role='button']")
      .filter({ hasText: /多空|macro/i });
    await expect(macroTab.first()).toBeVisible({ timeout: 15000 });
    await macroTab.first().click();
    await expect(page).toHaveURL(/#\/insights\?tab=macro/);
  });
});

test.describe("06-MarketRadarView - 長期防禦模式狀態欄 (Phase 4)", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);

    // 攔截 /api/status，返回 isLongTermDefense: true
    await page.route("**/api/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            leadingIndicators: {
              isLongTermDefense: true,
            },
          },
        }),
      });
    });

    await page.goto("#/insights?tab=radar", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("RAD-003: isLongTermDefense 為 true 時顯示長期防禦模式狀態欄", async ({
    page,
  }) => {
    const badge = page.locator(".defense-mode-badge");
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(badge).toContainText("長期防禦模式");
  });
});
