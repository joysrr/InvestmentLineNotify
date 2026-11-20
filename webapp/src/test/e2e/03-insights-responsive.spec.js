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
