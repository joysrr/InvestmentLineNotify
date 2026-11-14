import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test("FloatingPill 在 360px 寬下 5 項不換行、不溢出", async ({ page }) => {
  await setupE2EContext(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("http://localhost:5173/", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // 等待 FloatingPill 出現（5 個 nav-item）
  const navItems = page.locator(".nav-item");
  await expect(navItems).toHaveCount(5);

  // 1. 所有 item 在同一行：比較 boundingBox().y
  const boxes = await navItems.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()),
  );
  const firstY = boxes[0].y;
  boxes.forEach((box, i) => {
    expect(
      Math.abs(box.y - firstY),
      `item ${i} 不在同一行（y=${box.y}, 基準 y=${firstY}）`,
    ).toBeLessThan(1);
  });

  // 2. 不溢出容器：最後一個 item 的 right <= 容器 right
  const container = await page.locator(".nav-container").boundingBox();
  const lastItem = boxes[boxes.length - 1];
  expect(
    lastItem.x + lastItem.width,
    `最後一個 item 右邊界超出容器（${lastItem.x + lastItem.width} > ${container.x + container.width}）`,
  ).toBeLessThanOrEqual(container.x + container.width + 0.5);

  // 3. 文字不被截斷：每個 item 的 scrollWidth <= clientWidth
  const overflowFlags = await navItems.evaluateAll((els) =>
    els.map((el) => el.scrollWidth > el.clientWidth + 1),
  );
  expect(
    overflowFlags,
    "存在 item 內容溢出（scrollWidth > clientWidth）",
  ).not.toContain(true);
});
