import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test("MacroBattleView 在 360px 下無橫向滾動且正常渲染", async ({ page }) => {
  await setupE2EContext(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("http://localhost:5173/#/insights?tab=macro", {
    waitUntil: "networkidle",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  // 驗證頁面標題正確（MacroBattleView 已掛載）
  const title = await page.locator("h2").first().textContent();
  expect(title).toContain("多空對決");

  // 驗證 360px 下無橫向滾動
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);

  // 驗證頁面結構不崩潰
  await expect(page.locator(".view-container")).toBeVisible();
});

test("MacroBattleView 在桌面寬度下正常渲染", async ({ page }) => {
  await setupE2EContext(page);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("http://localhost:5173/#/insights?tab=macro", {
    waitUntil: "networkidle",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  const title = await page.locator("h2").first().textContent();
  expect(title).toContain("多空對決");
  await expect(page.locator(".view-container")).toBeVisible();
});
