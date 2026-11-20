import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("390x844 六頁主流程與溢位回歸", () => {
  const pages = [
    { name: "/dashboard", path: "#/dashboard", selector: ".view-container" },
    {
      name: "/insights",
      path: "#/insights",
      selector: "h2.page-title",
    },
    {
      name: "/strategy-config",
      path: "#/strategy-config",
      selector: "[data-testid='strategy-config-editor']",
    },
    { name: "/news", path: "#/news", selector: ".view-container" },
    { name: "/account", path: "#/account", selector: "h1.page-title" },
    { name: "/chart", path: "#/chart", selector: ".view-title" },
  ];

  test.beforeEach(async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });
    page._consoleErrors = consoleErrors;
  });

  for (const { name, path, selector } of pages) {
    test(`${name} 390x844 頁面可見、無橫向溢位、底欄可見、無 Console 錯誤`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await setupE2EContext(page);
      await page.goto(path, { waitUntil: "domcontentloaded" });

      // 頁面主體 selector 可見（驗證頁面正確載入，非 EmptyState 假通過）
      await expect(page.locator(selector).first()).toBeVisible({
        timeout: 15000,
      });

      // 390×844：無橫向溢位
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(390);

      // 底部導覽可見且未被內容遮擋
      const bottomNav = page.locator(".bottom-nav, .floating-pill");
      await expect(bottomNav.first()).toBeVisible({ timeout: 10000 });

      // 底導高度 CSS 變數已寫入，頁面內容不會被底導遮擋
      const bottomNavHeight = await page.evaluate(() =>
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--bottom-nav-height",
          ) || "0",
          10,
        ),
      );
      expect(bottomNavHeight).toBeGreaterThan(0);

      // .app-main padding-bottom 與底導高度一致，內容不會藏在導覽後
      const appMainPaddingBottom = await page.evaluate(() =>
        parseInt(
          getComputedStyle(document.querySelector(".app-main")).paddingBottom ||
            "0",
          10,
        ),
      );
      expect(appMainPaddingBottom).toBeGreaterThanOrEqual(bottomNavHeight);

      // 底導本身位於視窗內（不超出右/底邊界）
      const navBox = await bottomNav.first().boundingBox();
      expect(navBox).not.toBeNull();
      expect(navBox.x).toBeGreaterThanOrEqual(0);
      expect(navBox.x + navBox.width).toBeLessThanOrEqual(390);
      expect(navBox.y + navBox.height).toBeLessThanOrEqual(844);

      // 頁面文字不得殘留 NaN 或原始 ISO 時間戳
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toMatch(/\bNaN\b/);
      expect(bodyText).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Console 無未處理錯誤
      const consoleErrors = page._consoleErrors || [];
      expect(consoleErrors.length).toBe(0);
    });
  }
});
