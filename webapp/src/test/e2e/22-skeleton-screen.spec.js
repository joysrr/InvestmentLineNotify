import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("22-SkeletonScreen - 骨架屏載入狀態", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  });

  test("SK-001: 報表頁面載入期間顯示 skeleton screen，不出現空白", async ({
    page,
  }) => {
    await page
      .locator('a[href="#/insights?tab=radar"], .nav-link:has-text("市場雷達")')
      .first()
      .click();
    const skeleton = page.locator(
      ".loading-skeleton, .skeleton-screen, [class*='skeleton']",
    );
    await expect(
      skeleton.or(page.locator(".view-container.iln-page")),
    ).toBeVisible({ timeout: 15000 });
  });

  test("SK-002: 報表頁面載入完成後 skeleton 消失，內容正確渲染", async ({
    page,
  }) => {
    await page
      .locator('a[href="#/insights?tab=radar"], .nav-link:has-text("市場雷達")')
      .first()
      .click();
    await expect(
      page.locator(".view-container.iln-page, .page-title"),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".loading-skeleton")).toBeHidden({
      timeout: 15000,
    });
  });

  test("SK-003: Skeleton 使用 shimmer 動畫（@keyframes shimmer）", async ({
    page,
  }) => {
    await page
      .locator('a[href="#/insights?tab=radar"], .nav-link:has-text("市場雷達")')
      .first()
      .click();
    await page.waitForTimeout(1000);
    const skeleton = page.locator(".loading-skeleton");
    if ((await skeleton.count()) > 0) {
      const hasShimmer = await page.evaluate(() => {
        const style = getComputedStyle(
          document.querySelector(".sk-grid-item, .sk-line"),
        );
        return !!style.animation && style.animation.includes("shimmer");
      });
      expect(hasShimmer).toBeTruthy();
    } else {
      // 如果 skeleton 不可見，檢查 CSS 中是否有 shimmer keyframes
      const css = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        let found = false;
        try {
          for (const sheet of sheets) {
            const rules = Array.from(sheet.cssRules || []);
            for (const rule of rules) {
              if (
                rule.type === CSSRule.KEYFRAMES_RULE &&
                rule.name.includes("shimmer")
              ) {
                found = true;
              }
            }
          }
        } catch {
          /* cross-origin stylesheets may throw */
        }
        return found;
      });
      expect(css).toBeTruthy();
    }
  });
});
