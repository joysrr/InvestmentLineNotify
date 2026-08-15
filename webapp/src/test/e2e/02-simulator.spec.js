import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("02-SimulatorView - 雙向模擬器", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/simulator", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("SIM-001: 預設載入 Mode 選擇器並顯示正向面板", async ({ page }) => {
    await expect(page.locator("[data-testid=mode-selector]")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-testid=tab-forward]")).toHaveClass(/active/);
    await expect(page.locator("[data-testid=forward-panel]")).toBeVisible();
  });

  test("SIM-002: 正向模擬輸入參數後點擊計算，驗證結果卡片正確顯示", async ({ page }) => {
    await page.fill("[data-testid=price-input-0050]", "150");
    await page.fill("[data-testid=price-input-z2]", "55");
    await page.waitForTimeout(500);

    await page.click("[data-testid=btn-run-forward]");
    await page.waitForTimeout(8000);

    await expect(page.locator("[data-testid=result-card]")).toBeVisible({ timeout: 10000 });
  });

  test("SIM-003: 0050 價格為空時計算按鈕應禁用", async ({ page }) => {
    await page.fill("[data-testid=price-input-0050]", "");
    await page.fill("[data-testid=price-input-z2]", "");
    await page.waitForTimeout(500);

    const runBtn = page.locator("[data-testid=btn-run-forward]");
    await expect(runBtn).toBeDisabled();
  });

  test("SIM-004: 清除結果按鈕點擊後結果應消失", async ({ page }) => {
    await page.fill("[data-testid=price-input-0050]", "150");
    await page.fill("[data-testid=price-input-z2]", "55");
    await page.click("[data-testid=btn-run-forward]");
    await page.waitForTimeout(8000);

    await expect(page.locator("[data-testid=result-card]")).toBeVisible();

    await page.click("[data-testid=btn-clear-forward]");
    await page.waitForTimeout(500);

    await expect(page.locator("[data-testid=result-card]")).toBeHidden();
  });

  test("SIM-005: 價格偏離警告顯示", async ({ page }) => {
    await page.fill("[data-testid=price-input-0050]", "200");
    await page.blur("[data-testid=price-input-0050]");
    await page.waitForTimeout(1000);

    const warning = page.locator("[data-testid=price-input-warning-0050]");
    await expect(warning).toBeVisible({ timeout: 5000 });
    await expect(warning).toContainText("偏離");
  });

  test("SIM-006: 切換至反向推導模式", async ({ page }) => {
    await page.click("[data-testid=tab-reverse]");
    await page.waitForTimeout(500);

    await expect(page.locator("[data-testid=tab-reverse]")).toHaveClass(/active/);
    await expect(page.locator("[data-testid=reverse-panel]")).toBeVisible();
    await expect(page.locator("[data-testid=target-selector]")).toBeVisible();
  });

  test("SIM-007: 反向推導 - 目標值為空時計算按鈕應禁用", async ({ page }) => {
    await page.click("[data-testid=tab-reverse]");
    await page.waitForTimeout(500);

    const runBtn = page.locator("[data-testid=btn-run-reverse]");
    await expect(runBtn).toBeDisabled();
  });

  test("SIM-008: 切換不同目標類型時輸入欄位正確變化", async ({ page }) => {
    await page.click("[data-testid=tab-reverse]");
    await page.waitForTimeout(500);

    await expect(page.locator("[data-testid=target-input]")).toBeVisible();

    await page.locator("[data-testid=target-selector]").click();
    await page.getByText("KD 交叉").click();
    await page.waitForTimeout(500);

    await expect(page.locator("[data-testid=target-input] select")).toBeVisible();
  });

  test("SIM-009: 模擬後顯示資料品質標記", async ({ page }) => {
    await page.fill("[data-testid=price-input-0050]", "150");
    await page.fill("[data-testid=price-input-z2]", "55");
    await page.click("[data-testid=btn-run-forward]");
    await page.waitForTimeout(8000);

    await expect(page.locator("[data-testid=data-quality-badges]")).toBeVisible();
  });

  test("SIM-010: 模擬後顯示免責聲明橫幅", async ({ page }) => {
    await page.fill("[data-testid=price-input-0050]", "150");
    await page.fill("[data-testid=price-input-z2]", "55");
    await page.click("[data-testid=btn-run-forward]");
    await page.waitForTimeout(8000);

    await expect(page.locator("[data-testid=disclaimer-banner]")).toBeVisible();
  });
});