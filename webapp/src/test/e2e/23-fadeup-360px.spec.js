import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test("T-05/T-06: .fade-up 卡片在 360px 下不溢出容器，微回饋不導致橫向滾動", async ({
  page,
}) => {
  await setupE2EContext(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("http://localhost:5173/#/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // 等待頁面載入
  await page.waitForTimeout(2000);

  // 尋找帶有 .fade-up 的卡片元素
  const fadeUpCards = page.locator(".fade-up");

  // 若頁面有 fade-up 元素，驗證不溢出
  if ((await fadeUpCards.count()) > 0) {
    const container = page.locator(".iln-page, .view-container").first();
    const box = await container.boundingBox();

    const cardBoxes = await fadeUpCards.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()),
    );

    cardBoxes.forEach((cardBox, i) => {
      expect(
        cardBox.x + cardBox.width,
        `fade-up 卡片 ${i} 右邊界超出容器（${cardBox.x + cardBox.width} > ${box.x + box.width}）`,
      ).toBeLessThanOrEqual(box.x + box.width + 0.5);
    });
  }

  // 360px 下不應出現橫向滾動條
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = 360;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
});
