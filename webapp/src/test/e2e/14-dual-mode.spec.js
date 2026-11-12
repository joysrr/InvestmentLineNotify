import { test, expect } from "@playwright/test";
import { navigateToView } from "./e2e-utils.js";

// P2-2 Light/Dark 雙模式手動驗證（自動化截圖）
// 10 個可達 view × 2 色階 = 20 個截圖，驗證不崩潰、設計令牌套用正確
const VIEWS = [
  { name: "dashboard", path: "/dashboard" },
  { name: "technical", path: "/technical" },
  { name: "radar", path: "/radar" },
  { name: "macro", path: "/macro" },
  { name: "chart", path: "/chart" },
  { name: "news", path: "/news" },
  { name: "theory", path: "/theory" },
  { name: "account", path: "/account" },
  { name: "strategy-config", path: "/strategy-config" },
  { name: "strategy-status", path: "/strategy-status" },
];

const SCHEMES = ["light", "dark"];

for (const scheme of SCHEMES) {
  for (const { name, path } of VIEWS) {
    test(`P2-2 [${scheme}] ${name} (${path}) renders without crash`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await navigateToView(page, path);
      // 等待 Vue 掛載：#app 下有子節點，代表非空白 shell
      await page.waitForFunction(
        () => document.querySelector("#app")?.children.length > 0,
        { timeout: 15000 },
      );
      await page.screenshot({
        path: `test-results/e2e-dual-mode/${name}-${scheme}.png`,
        fullPage: true,
      });
      // P2-2 產出色階摘要 → summary.jsonl
      const schemeInfo = await page.evaluate(() => {
        const bodyStyle = getComputedStyle(document.body);
        return {
          bg: bodyStyle.backgroundColor,
          color: bodyStyle.color,
        };
      });
      const fs = require("fs");
      const pathModule = require("path");
      const dir = "test-results/e2e-dual-mode";
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(
        pathModule.join(dir, "summary.jsonl"),
        JSON.stringify({ name, scheme, ...schemeInfo }) + "\n",
      );
      // 斷言頁面非空白（有可見內容，未崩潰）
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.trim().length).toBeGreaterThan(0);
    });
  }
}
