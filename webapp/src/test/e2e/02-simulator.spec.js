import { test, expect } from "@playwright/test";
import { setupE2EContext } from "./e2e-utils.js";

test.describe("02-SimulatorView - 雙向模擬器", () => {
  test.beforeEach(async ({ page }) => {
    await setupE2EContext(page);
    await page.goto("#/simulator", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("SIM-001: 應正確加載模擬器頁面", async ({ page }) => {
    await expect(page.locator("[data-testid='simulator-view'], .simulator-view").first()).toBeVisible({ timeout: 15000 });
  });

  test("SIM-002: Mode Selector 應顯示 5 個模式標籤", async ({ page }) => {
    const tabs = page.locator("[data-testid^='tab-']");
    await expect(tabs).toHaveCount(5);
  });

  test("SIM-003: 點擊 正向模擬 Tab 應顯示 ForwardPanel", async ({ page }) => {
    await page.locator("[data-testid='tab-forward']").click();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='forward-panel']")).toBeVisible({ timeout: 10000 });
  });

  test("SIM-004: 正向面板應有 0050 價格輸入框", async ({ page }) => {
    await page.locator("[data-testid='tab-forward']").click();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='input-price0050']")).toBeVisible({ timeout: 10000 });
  });

  test("SIM-005: 正向面板應有 Z2 價格輸入框", async ({ page }) => {
    await page.locator("[data-testid='tab-forward']").click();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='input-pricez2']")).toBeVisible({ timeout: 10000 });
  });

  test("SIM-006: 正向面板應有開始計算按鈕", async ({ page }) => {
    await page.locator("[data-testid='tab-forward']").click();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='btn-run-forward']")).toBeVisible({ timeout: 10000 });
  });

  test("SIM-007: 點擊 反向推導 Tab 應顯示 ReversePanel", async ({ page }) => {
    await page.locator("[data-testid='tab-reverse']").click();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='reverse-panel']")).toBeVisible({ timeout: 10000 });
  });

  test("SIM-008: 反向面板應有目標選擇器", async ({ page }) => {
    await page.locator("[data-testid='tab-reverse']").click();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='target-selector']")).toBeVisible({ timeout: 10000 });
  });

  test("SIM-009: 反向面板應有開始推導按鈕", async ({ page }) => {
    await page.locator("[data-testid='tab-reverse']").click();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='btn-run-reverse']")).toBeVisible({ timeout: 10000 });
  });

  test("SIM-010: 點擊 批次模擬 Tab 應顯示 BatchPanel", async ({ page }) => {
    await page.locator("[data-testid='tab-batch']").click();
    await page.waitForTimeout(500);
    await expect(page.locator("[data-testid='batch-panel']")).toBeVisible({ timeout: 10000 });
  });
});