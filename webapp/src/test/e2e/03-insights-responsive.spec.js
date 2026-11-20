import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

async function openInsights(
  page,
  width,
  tab = "radar",
  marketDirection = "BULLISH",
) {
  await setupE2EContext(page);
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/reports**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          date: "2026-11-20",
          macroAnalysis: {
            conclusion: {
              short_summary: "測試總結",
              market_direction: marketDirection,
            },
            bull_events: [
              { title: "測試多方事件", score: 10, analysis: "測試分析" },
              { title: "測試多方事件二", score: 5 },
            ],
            bear_events: [{ title: "測試空方事件", score: 8 }],
          },
        },
      ]),
    });
  });
  await page.goto(`#/insights?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
}

test.describe("03-Insights 響應式版面", () => {
  test("INS-001: MarketRadar 在 390px 不產生水平溢位", async ({ page }) => {
    await openInsights(page, 390);
    await expect(page.locator(".insights-view")).toBeVisible();
    await expect(
      page.locator('[data-testid="insights-tab-radar"]'),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("INS-003: 多空事件分數呈現正負語義，方向圖示符合 BULLISH/BEARISH/NEUTRAL", async ({
    page,
  }) => {
    for (const [direction, badgeClass, iconName] of [
      ["BULLISH", "badge-bull", "trending-up"],
      ["BEARISH", "badge-bear", "trending-down"],
      ["NEUTRAL", "badge-neutral", "neutral"],
    ]) {
      await openInsights(page, 390, "macro", direction);
      await expect(
        page.locator(`.direction-badge.${badgeClass}`),
      ).toBeVisible();
      await expect(page.locator(`.direction-badge svg`).first()).toBeVisible();
      await expect(page.locator(`.direction-badge svg`).first()).toHaveClass(
        `icon-${iconName}`,
      );
      await expect(
        page.locator(".event-card--bull .event-score").first(),
      ).toHaveText("+10");
      await expect(page.locator(".event-card--bear .event-score")).toHaveText(
        "-8",
      );
    }
  });

  test("INS-004: 內嵌標籤可互切，雷達與總經內容在手機及桌面保持可見", async ({
    page,
  }) => {
    await openInsights(page, 390, "radar");
    const radarTab = page.locator('[data-testid="insights-tab-radar"]');
    const macroTab = page.locator('[data-testid="insights-tab-macro"]');
    await expect(radarTab).toBeVisible();
    await expect(macroTab).toBeVisible();
    await radarTab.click();
    await expect(page.locator(".radar-overview")).toBeVisible();
    await macroTab.click();
    await expect(page.locator(".macro-events-grid")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);

    await page.setViewportSize({ width: 1024, height: 900 });
    await radarTab.click();
    await expect(page.locator(".radar-overview")).toBeVisible();
    await macroTab.click();
    await expect(page.locator(".macro-events-grid")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
    ).toBe(false);
  });

  test("INS-005: 有資料的內嵌雷達手機單欄、桌面雙欄且兩個核心面板可見", async ({
    page,
  }) => {
    await openInsights(page, 390, "radar");
    await page.route("**/api/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            leadingIndicators: {
              stateMachine: { state: "IDLE", activeDays: 0 },
              radars: [],
              triggeredRadars: [],
              cashExposureAnalysis: {
                status: "RECOMMEND_DCA",
                suggestedDcaAmt: 10000,
                exposureGap: 50000,
                targetExposure: 0.6,
                targetLeverage: 1,
                currentLeverage: 0.8,
                message: "驗收資料",
              },
            },
          },
          updatedAt: "2026-11-20T08:00:00.000Z",
        }),
      }),
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    const overview = page.locator(".radar-overview");
    await expect(overview).toBeVisible();
    await expect(overview.locator(":scope > *").first()).toBeVisible();
    await expect(overview.locator(":scope > *").nth(1)).toContainText(
      "現金曝險分析",
    );
    const mobile = await overview.evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      overflow: element.scrollWidth > element.clientWidth,
    }));
    expect(mobile.columns).toBe(1);
    expect(mobile.overflow).toBe(false);

    await page.setViewportSize({ width: 1024, height: 900 });
    const desktop = await overview.evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      overflow: element.scrollWidth > element.clientWidth,
    }));
    expect(desktop.columns).toBe(2);
    expect(desktop.overflow).toBe(false);
  });

  test("INS-002: MacroBattle 在 800px 事件卡為雙欄且無水平溢位", async ({
    page,
  }) => {
    await openInsights(page, 800, "macro");
    const eventGrid = page.locator(".macro-events-grid");
    await expect(eventGrid).toBeVisible({ timeout: 15000 });
    const columns = await eventGrid.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    );
    expect(columns).toBe(2);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
