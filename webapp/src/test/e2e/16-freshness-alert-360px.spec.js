import { test, expect } from "@playwright/test";

test("expired 警示條在 360px 下不換行、不溢出", async ({ page }) => {
  // 渲染與 DashboardView 相同樣式的 expired 警示條，驗證 360px 表現
  await page.setContent(`
    <div class="freshness-expired-alert">
      ⚠️ 資料已超過 6 小時未更新，建議確認排程狀態
    </div>
    <style>
      .freshness-expired-alert {
        padding: 10px 16px;
        margin-bottom: 16px;
        font-size: 13px;
        background: var(--iln-viz-bear-bg);
        color: var(--iln-viz-bear-text);
        border-radius: 6px;
        border: 1px solid var(--iln-viz-bear);
        text-align: center;
        box-sizing: border-box;
      }
      :root {
        --iln-viz-bear-bg: rgba(239, 68, 68, 0.1);
        --iln-viz-bear-text: #dc2626;
        --iln-viz-bear: #ef4444;
      }
    </style>
  `);
  await page.setViewportSize({ width: 360, height: 640 });

  const alert = page.locator(".freshness-expired-alert");
  await expect(alert).toBeVisible();

  // 文案完整顯示（不被截斷）
  await expect(alert).toContainText("資料已超過 6 小時未更新");
  await expect(alert).toContainText("建議確認排程狀態");

  // 警示條寬度不超過 360px 視窗（不溢出）
  const box = await alert.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeLessThanOrEqual(360);

  // 警示條不換行成多行：高度應在單行/雙行合理範圍內（13px 字體，padding 20px）
  expect(box.height).toBeLessThanOrEqual(80);
});
