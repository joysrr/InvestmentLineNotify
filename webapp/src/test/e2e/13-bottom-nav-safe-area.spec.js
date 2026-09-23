import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

const pages = [
  { name: "市場雷達", route: "#/radar" },
  { name: "多空對決", route: "#/macro" },
  { name: "技術指標", route: "#/technical" },
  { name: "新聞", route: "#/news" },
];

for (const { name, route } of pages) {
  test(`${name}頁應保留足夠的底部導覽安全區`, async ({ page }) => {
    await setupE2EContext(page);
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page
      .locator(".view-container")
      .waitFor({ state: "visible", timeout: 30000 });

    const view = page.locator(".view-container");
    const paddingBottom = await view.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).paddingBottom),
    );

    expect(
      paddingBottom,
      `${name}頁的底部 padding 必須至少 112px，避免固定導覽列遮住最後內容`,
    ).toBeGreaterThanOrEqual(112);

    const tail = await page.locator(".view-container").evaluate((element) => {
      const marker = document.createElement("div");
      marker.dataset.testid = "bottom-safe-area-marker";
      marker.style.height = "1px";
      element.append(marker);
      return marker.dataset.testid;
    });

    await page.locator(".app-main").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    const geometry = await Promise.all([
      page.locator(`[data-testid="${tail}"]`).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { bottom: rect.bottom };
      }),
      page.locator(".nav-container").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top };
      }),
    ]);

    expect(
      geometry[0].bottom,
      `${name}頁滾到底後，最後內容必須位於固定導覽列上緣之上`,
    ).toBeLessThanOrEqual(geometry[1].top - 8);
  });
}
