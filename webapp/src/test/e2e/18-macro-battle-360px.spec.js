import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test("MacroBattle 在 360px 下 bull/bear 積分條上下堆疊（column）", async ({
  page,
}) => {
  await setupE2EContext(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("http://localhost:5173/#/insights?tab=macro", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(1000);

  const scoreWrap = page.locator(".score-wrap");
  await expect(scoreWrap).toBeVisible();

  const flexDirection = await scoreWrap.evaluate((el) => {
    return getComputedStyle(el).flexDirection;
  });
  expect(flexDirection).toBe("column");
});

test("MacroBattle 在桌面寬度下 bull/bear 積分條左右並排（row）", async ({
  page,
}) => {
  await setupE2EContext(page);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("http://localhost:5173/#/insights?tab=macro", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(1000);

  const scoreWrap = page.locator(".score-wrap");
  await expect(scoreWrap).toBeVisible();

  const flexDirection = await scoreWrap.evaluate((el) => {
    return getComputedStyle(el).flexDirection;
  });
  expect(flexDirection).toBe("row");
});
