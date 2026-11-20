import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("02-Dashboard drawer 互動與窄螢幕", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  });

  test("DSH-014: 過期狀態顯示警示與 FreshnessBadge，首屏內容可見", async ({
    page,
  }) => {
    await page.route("**/api/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          _meta: { lastRun: "2026-01-01T00:00:00.000Z" },
        }),
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const expiredAlert = page.locator(".freshness-expired-alert");
    await expect(expiredAlert).toBeVisible();
    await expect(page.locator(".freshness-badge--expired")).toBeVisible();
    const alertBox = await expiredAlert.boundingBox();
    expect(alertBox).not.toBeNull();
    expect(alertBox.y + alertBox.height).toBeLessThanOrEqual(844);
    const hero = page.locator("[data-testid='decision-hero']");
    if (await hero.count()) {
      expect(alertBox.y).toBeLessThan((await hero.boundingBox()).y);
    }
    const freshness = page.locator(".dashboard-freshness");
    const spacing = await freshness.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        marginBottom: parseFloat(style.marginBottom),
        nextTop: element.nextElementSibling.getBoundingClientRect().top,
        bottom: element.getBoundingClientRect().bottom,
      };
    });
    expect(spacing.marginBottom).toBe(0);
    expect(spacing.nextTop - spacing.bottom).toBeLessThanOrEqual(24);

    const sectionSpacing = await page.evaluate(() => {
      const content = document.querySelector(".tab-content-area");
      const cockpit = document.querySelector(".cockpit-section");
      const contentStyle = getComputedStyle(content);
      const cockpitStyle = getComputedStyle(cockpit);
      return {
        contentGap: parseFloat(contentStyle.rowGap),
        cockpitMarginBottom: parseFloat(cockpitStyle.marginBottom),
        cockpitNextGap:
          cockpit.nextElementSibling.getBoundingClientRect().top -
          cockpit.getBoundingClientRect().bottom,
      };
    });
    expect(sectionSpacing.contentGap).toBeGreaterThan(0);
    expect(sectionSpacing.cockpitMarginBottom).toBe(0);
    expect(sectionSpacing.cockpitNextGap).toBeGreaterThanOrEqual(0);
    expect(sectionSpacing.cockpitNextGap).toBeLessThanOrEqual(24);
  });

  test("DSH-010: 點擊總經象限卡片開啟 drawer，Escape 關閉，窄螢幕內容不溢位", async ({
    page,
  }) => {
    await page.locator("[data-testid='macro-cockpit-card']").click();
    await expect(
      page.getByRole("heading", { name: "市場總經環境明細" }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("美股 VIX 恐慌指數")).toBeVisible();
    await expect(page.getByText("台股大盤 PB 歷史分位 (PR)")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "市場總經環境明細" }),
    ).toBeHidden({ timeout: 5000 });
    const bodyRect = await page.locator("body").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(bodyRect.width).toBeLessThanOrEqual(390);
  });

  test("DSH-011: 點擊資產安全卡片開啟 drawer，Escape 關閉", async ({
    page,
  }) => {
    await page.locator("[data-testid='portfolio-shield-card']").click();
    await expect(
      page.getByRole("heading", { name: "資產風控與維持率明細" }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("質押整戶維持率")).toBeVisible();
    await expect(page.getByText("當前總槓桿倍率")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "資產風控與維持率明細" }),
    ).toBeHidden({ timeout: 5000 });
  });

  test("DSH-012: 鮮度警示（如有）不擋住抽屜觸發卡片，抽屜仍可正常開啟與關閉", async ({
    page,
  }) => {
    const alert = page.locator(".freshness-expired-alert");
    const alertVisible = (await alert.count()) > 0 && (await alert.isVisible());
    if (alertVisible) {
      await expect(
        page.locator("[data-testid='macro-cockpit-card']"),
      ).toBeVisible();
    }
    await page.locator("[data-testid='macro-cockpit-card']").click();
    await expect(
      page.getByRole("heading", { name: "市場總經環境明細" }),
    ).toBeVisible({
      timeout: 10000,
    });
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: "市場總經環境明細" }),
    ).toBeHidden({ timeout: 5000 });
  });

  test("DSH-013: 策略設定 drawer 打開後焦點進入第一個分組標籤，Escape 關閉", async ({
    page,
  }) => {
    await page.locator("[data-testid='fab-strategy-config']").click();
    await expect(page.getByRole("heading", { name: "策略設定" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("[data-testid='section-groups']")).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole("dialog", { name: "策略設定" })
          .evaluate((drawer) => drawer.contains(document.activeElement)),
      )
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "策略設定" })).toBeHidden({
      timeout: 5000,
    });
  });
});
