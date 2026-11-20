import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("390x844 六頁主流程與溢位回歸", () => {
  const pages = [
    { name: "/dashboard", path: "#/dashboard" },
    { name: "/insights", path: "#/insights" },
    { name: "/macro", path: "#/macro", expectedUrl: /#\/insights\?tab=macro/ },
    { name: "/news", path: "#/news" },
    { name: "/account", path: "#/account" },
    { name: "/chart", path: "#/chart" },
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

  for (const { name, path, expectedUrl } of pages) {
    test(`${name} 390x844 頁面可見、無橫向溢位、底欄可見、無 Console 錯誤`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await setupE2EContext(page);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      // URL 匹配期望頁面（驗證頁面正確載入；/macro 導向 Insights tab）
      const urlPattern = expectedUrl || new RegExp(`${path}$`);
      await expect(page).toHaveURL(urlPattern);

      // 390×844：無橫向溢位
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(390);

      // 底部導覽可見且未被內容遮擋
      const bottomNav = page.locator(".bottom-nav, .floating-pill");
      await expect(bottomNav.first()).toBeVisible({ timeout: 10000 });

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
