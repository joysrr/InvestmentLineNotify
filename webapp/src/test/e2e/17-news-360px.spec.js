import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test("新聞頁 360px 下無橫向滾動", async ({ page }) => {
  await setupE2EContext(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/news", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  const hasHorizontalScroll = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalScroll).toBe(false);
});
