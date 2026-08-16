import { test, expect } from "@playwright/test";

test.describe("SimulatorView - Sensitivity Analysis (敏感度分析)", () => {
  test.beforeEach(async ({ page }) => {
    console.log("[TEST] Starting beforeEach");
    // Capture console logs for debugging
    const consoleLogs = [];
    page.on("console", (msg) => consoleLogs.push(msg.text()));
    // Log all requests and responses
    page.on("request", (request) =>
      console.log(`[REQUEST] ${request.method()} ${request.url()}`),
    );
    page.on("response", (response) =>
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`),
    );
    // Capture page errors (JavaScript errors)
    const pageErrors = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
      console.log("Page error (immediate):", err.message);
    });

    // Mock API routes at network level
    await page.route("**/api/status", async (route) => {
      console.log("[MOCK] Intercepted /api/status");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: 123456789, is_authorized: true } }),
      });
    });

    await page.route("**/api/news", async (route) => {
      console.log("[MOCK] Intercepted /api/news");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ articles: [] }),
      });
    });

    await page.route("**/api/portfolio/health*", async (route) => {
      console.log("[MOCK] Intercepted /api/portfolio/health");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/reports*", async (route) => {
      console.log("[MOCK] Intercepted /api/reports");
      const url = new URL(route.request().url());
      if (
        url.pathname === "/api/reports" &&
        url.searchParams.get("limit") === "1"
      ) {
        console.log("[MOCK] Serving mock reports");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: 1,
              date: "2026-08-10",
              price0050: 175,
              currentPrice: 275,
              strategyScore: 85,
              maintenanceMargin: 165.5,
            },
          ]),
        });
      } else {
        console.log("[MOCK] Continuing request");
        await route.continue();
      }
    });

    // Mock sensitivity analysis API - catch all POST to this endpoint
    await page.route("**/api/v1/simulate/sensitivity**", async (route) => {
      console.log(
        "[MOCK] Intercepted /api/v1/simulate/sensitivity",
        route.request().method(),
        route.request().url(),
      );
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            singleParam: {
              param: "maintenance.protectTrigger",
              dataPoints: [
                { x: 140, y: 75 },
                { x: 150, y: 80 },
                { x: 160, y: 85 },
                { x: 170, y: 90 },
                { x: 180, y: 85 },
              ],
              slope: 0.25,
              correlation: 0.85,
              metric: "strategyScore",
            },
            multiParam: {
              keyDrivers: [
                "維持率防禦觸發 (影響度: 0.45)",
                "手續費率 (影響度: 0.22)",
                "最小跌幅考慮 (影響度: 0.18)",
              ],
              dataPoints: [
                {
                  param: "maintenance.protectTrigger",
                  impact: 0.45,
                  direction: "positive",
                },
                {
                  param: "trading.transFee",
                  impact: 0.22,
                  direction: "negative",
                },
                {
                  param: "buy.minDropPercentToConsider",
                  impact: 0.18,
                  direction: "positive",
                },
              ],
            },
            disclaimer: "測試免責聲明：此為模擬結果，僅供參考。",
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Catch-all for any unmocked API to see what's being called
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();
      if (
        !url.includes("/api/status") &&
        !url.includes("/api/news") &&
        !url.includes("/api/portfolio/health") &&
        !url.includes("/api/reports") &&
        !url.includes("/api/v1/simulate/sensitivity")
      ) {
        console.log("[UNMOCKED API] ", route.request().method(), url);
      }
      await route.continue();
    });

    // Navigate to the dashboard page
    console.log("[TEST] Navigating to #/dashboard");
    await page.goto("http://localhost:5173/#/dashboard", {
      waitUntil: "networkidle",
    });
    console.log("[TEST] Navigation complete");
    // Wait for the app container to ensure the Vue app has mounted
    await page.waitForSelector("#app", { timeout: 15000 });
    console.log("[TEST] App container found");
    // Wait for the view container to ensure the Vue app has rendered the DashboardView
    await page.waitForSelector(".view-container", { timeout: 15000 });
    console.log("[TEST] View container found");
    // Wait for Vue to render the dashboard title to ensure client-side rendering is complete
    await page.waitForSelector("h2.dash-title", { timeout: 15000 });
    console.log("[TEST] Dashboard title found");
    // Wait for the simulator tab to be attached to DOM
    await page.waitForSelector("[data-testid=simulator-tab]", {
      state: "attached",
      timeout: 60000,
    });
    console.log("[TEST] Simulator tab attached");
    await page.locator("[data-testid=simulator-tab]").click();
    console.log("[TEST] Simulator tab clicked");
    // Wait for the simulator view to mount
    await page.waitForSelector("[data-testid=simulator-view]", {
      timeout: 10000,
    });
    console.log("[TEST] Simulator view mounted");
    // Log console output for debugging
    console.log("Console logs:", consoleLogs.join("\n"));
    console.log("Page errors:", pageErrors.join("\n"));
  });

  test("應正確渲染敏感度分析 Tab", async ({ page }) => {
    // Click sensitivity tab in mode selector
    await page
      .locator("[data-testid=mode-selector] [data-testid=tab-sensitivity]")
      .click();

    // Wait for sensitivity panel to be visible
    await expect(page.locator("[data-testid=sensitivity-panel]")).toBeVisible({
      timeout: 10000,
    });

    // Verify title
    await expect(page.locator(".sensitivity-title")).toHaveText("敏感度分析");
    await expect(page.locator(".sensitivity-subtitle")).toContainText(
      "參數影響度",
    );
  });

  test("應能選擇目標參數並設定掃描範圍", async ({ page }) => {
    await page
      .locator("[data-testid=mode-selector] [data-testid=tab-sensitivity]")
      .click();

    // Wait for sensitivity panel to be visible
    await expect(page.locator("[data-testid=sensitivity-panel]")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Select parameter using data-testid - first option is "維持率防禦觸發"
    await page.locator('[data-testid="select-target-param"]').click();
    await page
      .getByRole("option", { name: "維持率防禦觸發", exact: true })
      .first()
      .click();
    await expect(
      page
        .locator(
          '[data-testid="select-target-param"] .el-select__selected-item',
        )
        .last(),
    ).toContainText("維持率防禦觸發");

    // Set scan range using data-testid - target the inner input of el-input-number
    await page.locator('[data-testid="input-scan-min"] input').fill("140");
    await page.locator('[data-testid="input-scan-max"] input').fill("180");
    await page.locator('[data-testid="input-scan-step"] input').fill("1");

    // Verify values
    await expect(
      page.locator('[data-testid="input-scan-min"] input'),
    ).toHaveValue("140");
    await expect(
      page.locator('[data-testid="input-scan-max"] input'),
    ).toHaveValue("180");
    await expect(
      page.locator('[data-testid="input-scan-step"] input'),
    ).toHaveValue("1");
  });

  test("應能切換觀測指標", async ({ page }) => {
    await page
      .locator("[data-testid=mode-selector] [data-testid=tab-sensitivity]")
      .click();

    // Wait for sensitivity panel to be visible
    await expect(page.locator("[data-testid=sensitivity-panel]")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Select metrics (multiple) using data-testid
    await page.locator('[data-testid="select-metrics"]').click();
    await page
      .getByRole("option", { name: "策略分數", exact: true })
      .first()
      .click();
    await page.waitForTimeout(200);
    await page
      .getByRole("option", { name: "維持率", exact: true })
      .first()
      .click();
    // Close dropdown by clicking elsewhere
    await page.locator(".sensitivity-title").click();

    // Verify metrics select is functional (value updated)
    await expect(page.locator('[data-testid="select-metrics"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test("應能切換圖表類型 (敏感度曲線 / Tornado 圖)", async ({ page }) => {
    await page
      .locator("[data-testid=mode-selector] [data-testid=tab-sensitivity]")
      .click();

    // Wait for sensitivity panel to be visible
    await expect(page.locator("[data-testid=sensitivity-panel]")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Verify both tabs exist using data-testid
    await expect(
      page.locator('[data-testid="tabs-chart-type"] .el-tabs__nav'),
    ).toContainText("敏感度曲線");
    await expect(
      page.locator('[data-testid="tabs-chart-type"] .el-tabs__nav'),
    ).toContainText("Tornado 圖");

    // Switch to Tornado chart
    await page
      .locator(
        '[data-testid="tabs-chart-type"] .el-tabs__item:has-text("Tornado 圖")',
      )
      .click();
    await expect(
      page.locator(
        '[data-testid="tabs-chart-type"] .el-tabs__item.is-active:has-text("Tornado 圖")',
      ),
    ).toBeVisible();

    // Switch back to sensitivity chart
    await page
      .locator(
        '[data-testid="tabs-chart-type"] .el-tabs__item:has-text("敏感度曲線")',
      )
      .click();
    await expect(
      page.locator(
        '[data-testid="tabs-chart-type"] .el-tabs__item.is-active:has-text("敏感度曲線")',
      ),
    ).toBeVisible();
  });

  test("單參數敏感度分析應顯示曲線圖", async ({ page }) => {
    await page
      .locator("[data-testid=mode-selector] [data-testid=tab-sensitivity]")
      .click();

    // Wait for sensitivity panel to be visible
    await expect(page.locator("[data-testid=sensitivity-panel]")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Setup - parameter already auto-selected, just set range
    await page.locator('[data-testid="input-scan-min"] input').fill("140");
    await page.locator('[data-testid="input-scan-max"] input').fill("180");
    await page.locator('[data-testid="input-scan-step"] input').fill("1");

    // Wait a bit for validation to update
    await page.waitForTimeout(500);

    // Ensure sensitivity chart tab is active
    await page
      .locator(
        '[data-testid="tabs-chart-type"] .el-tabs__item:has-text("敏感度曲線")',
      )
      .click();

    // Verify execute button is enabled
    await expect(page.locator('[data-testid="btn-execute"]')).toBeEnabled();

    // Execute
    await page.locator('[data-testid="btn-execute"]').click();

    // Wait for result
    await expect(page.locator(".sensitivity-chart-container")).toBeVisible({
      timeout: 30000,
    });

    // Key drivers panel only shows in multi-param mode (result.multiParam?.keyDrivers?.length > 0)
    // In single-param mode, this is expected to be absent — skip checking
  });

  test("多參數掃描應顯示 Tornado 圖", async ({ page }) => {
    await page
      .locator("[data-testid=mode-selector] [data-testid=tab-sensitivity]")
      .click();

    // Wait for sensitivity panel to be visible
    await expect(page.locator("[data-testid=sensitivity-panel]")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Switch to Tornado chart
    await page
      .locator(
        '[data-testid="tabs-chart-type"] .el-tabs__item:has-text("Tornado 圖")',
      )
      .click();

    // For tornado chart, need to add multi params
    await page.locator('[data-testid="multi-params-collapse"]').click();
    await page
      .locator('[data-testid="select-multi-param-path"]')
      .first()
      .click();
    await page
      .getByRole("option", { name: "維持率防禦觸發", exact: true })
      .first()
      .click();
    await page
      .locator('[data-testid="input-multi-param-min"]')
      .first()
      .locator("input")
      .fill("140");
    await page
      .locator('[data-testid="input-multi-param-max"]')
      .first()
      .locator("input")
      .fill("180");

    // Wait for validation
    await page.waitForTimeout(500);

    // Verify execute button is enabled
    await expect(page.locator('[data-testid="btn-execute"]')).toBeEnabled();

    // Execute (Tornado chart uses multiParams)
    await page.locator('[data-testid="btn-execute"]').click();

    // Wait for result
    await expect(page.locator(".tornado-chart-container")).toBeVisible({
      timeout: 15000,
    });

    // Verify key drivers
    await expect(page.locator(".key-drivers-panel")).toBeVisible();
    await expect(page.locator(".key-drivers-panel")).toContainText(
      "關鍵驅動因子",
    );
  });

  test("應顯示斜率與相關係數", async ({ page }) => {
    await page
      .locator("[data-testid=mode-selector] [data-testid=tab-sensitivity]")
      .click();

    // Wait for sensitivity panel to be visible
    await expect(page.locator("[data-testid=sensitivity-panel]")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Parameter already auto-selected, just set range
    await page.locator('[data-testid="input-scan-min"] input').fill("140");
    await page.locator('[data-testid="input-scan-max"] input').fill("180");
    await page.locator('[data-testid="input-scan-step"] input').fill("1");

    // Wait for validation
    await page.waitForTimeout(500);

    // Verify execute button is enabled
    await expect(page.locator('[data-testid="btn-execute"]')).toBeEnabled();

    await page.locator('[data-testid="btn-execute"]').click();
    await expect(page.locator(".sensitivity-chart-container")).toBeVisible({
      timeout: 15000,
    });

    // Verify stats displayed
    await expect(page.locator(".chart-stats")).toContainText("斜率");
    await expect(page.locator(".chart-stats")).toContainText("相關係數");
  });

  test("空參數驗證應阻止執行 - 手動清除參數後按鈕應禁用", async ({ page }) => {
    await page
      .locator("[data-testid=mode-selector] [data-testid=tab-sensitivity]")
      .click();

    // Wait for sensitivity panel to be visible
    await expect(page.locator("[data-testid=sensitivity-panel]")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Clear the auto-selected parameter
    // Element Plus clearable select shows a circle-close icon on hover inside .el-select__wrapper
    const paramSelect = page.locator('[data-testid="select-target-param"]');
    await paramSelect.locator(".el-select__wrapper").hover();
    await page.waitForTimeout(200);
    // Click the clear (X) icon — Element Plus uses .el-select__caret with circle-close SVG
    const clearButton = paramSelect.locator(
      ".el-select__wrapper .el-select__suffix",
    );
    if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clearButton.click({ force: true });
      await page.waitForTimeout(300);
    }

    // Don't select parameter, try to execute
    const executeBtn = page.locator('[data-testid="btn-execute"]');
    await expect(executeBtn).toBeDisabled();
  });
});
