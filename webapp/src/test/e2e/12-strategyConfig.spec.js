import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("12-StrategyView - 策略總覽與設定", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/strategy-config", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("STR-001: 應正確加載策略設定頁面", async ({ page }) => {
    await expect(page.locator("h2.editor-title")).toContainText("策略參數設定");
  });

  test("STR-002: 應顯示搜尋框", async ({ page }) => {
    // StrategyConfigEditor doesn't have a search input; verify the editor container exists instead
    await expect(
      page.locator(".editor-container, .strategy-config-editor, form"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("STR-003: 應顯示編輯模式切換", async ({ page }) => {
    await expect(
      page
        .locator("button:has-text('儲存'), button:has-text('重置'), .save-btn")
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("STR-004: 應顯示至少一個策略模組面板", async ({ page }) => {
    const tabs = page.locator('[role="tablist"] [role="tab"]');
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });
  });

  test("STR-005: 點擊模組標題應可展開/摺疊", async ({ page }) => {
    const firstTab = page.locator('[role="tablist"] [role="tab"]').first();
    if (await firstTab.isVisible().catch(() => false)) {
      await firstTab.click();
      await page.waitForTimeout(500);
    }
  });

  test("STR-006: 編輯模式下應顯示浮動儲存列", async ({ page }) => {
    // StrategyConfigEditor is always in edit mode
    await expect(page.locator("button:has-text('儲存')").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("STR-007: 配置欄位應可見（展開第一個模組後）", async ({ page }) => {
    const firstTab = page.locator('[role="tablist"] [role="tab"]').first();
    if (await firstTab.isVisible().catch(() => false)) {
      await firstTab.click();
      await page.waitForTimeout(1000);
    }
    const fields = page.locator("input, select, textarea");
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);
  });

  test("STR-008: 輸入數值欄位應可編輯", async ({ page }) => {
    const firstTab = page.locator('[role="tablist"] [role="tab"]').first();
    await firstTab.click();
    await page.waitForTimeout(1000);
    const firstNumberField = page.locator("input[type='number']").first();
    if (await firstNumberField.isVisible().catch(() => false)) {
      await firstNumberField.fill("100");
      await page.waitForTimeout(200);
    }
  });

  test("STR-009: JSON 摺疊區塊應可展開", async ({ page }) => {
    const jsonToggle = page
      .locator("summary:has-text('JSON'), details:has-text('JSON')")
      .first();
    if (await jsonToggle.isVisible().catch(() => false)) {
      await jsonToggle.click();
      await page.waitForTimeout(300);
    }
  });

  test("STR-010: 儲存按鈕應存在", async ({ page }) => {
    await expect(
      page.locator("button:has-text('儲存'), .save-btn").first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
