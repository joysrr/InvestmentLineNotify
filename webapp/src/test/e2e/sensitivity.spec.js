import { test, expect } from "@playwright/test";

test.describe("SimulatorView - Sensitivity Analysis (敏感度分析)", () => {
  test.beforeEach(async ({ page }) => {
    // Inject test environment
    await page.addInitScript(() => {
      window.Telegram = {
        WebApp: {
          initData: "",
          initDataUnsafe: { user: { id: 123456789 } },
          ready: () => {},
          expand: () => {},
          close: () => {},
          MainButton: { show: () => {}, hide: () => {}, onClick: () => {} },
          BackButton: { show: () => {}, hide: () => {}, onClick: () => {} },
          HapticFeedback: { impactOccurred: () => {} },
          themeParams: { bg_color: "#ffffff", text_color: "#000000" },
          isExpanded: true,
          viewportHeight: window.innerHeight,
          viewportStableHeight: window.innerHeight,
        },
      };
    });

    // Mock API routes
    await page.route("**/api/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: 123456789, is_authorized: true } }),
      });
    });

    await page.route("**/api/reports?limit=1", async (route) => {
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
    });

    await page.route("**/api/v1/simulate/sensitivity", async (route) => {
      const postData = route.request().postDataJSON();

      // 根據請求類型返回不同模擬資料
      if (postData.multiParams && postData.multiParams.length > 1) {
        // Tornado 圖請求
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            singleParam: {
              paramPath: postData.targetParam,
              metric: "strategyScore",
              points: [],
              slope: 0,
              correlation: 0,
            },
            multiParam: {
              results: postData.multiParams.map((mp, i) => ({
                paramPath: mp.path,
                impact: 50 - i * 5,
                direction: i % 2 === 0 ? "positive" : "negative",
              })),
              keyDrivers: postData.multiParams.slice(0, 3).map((mp) => mp.path),
            },
            timestamp: new Date().toISOString(),
            disclaimer: "此為敏感度分析結果，非投資建議。",
          }),
        });
      } else {
        // 單參數敏感度曲線
        const points = [];
        const min = postData.scanRange?.min || 140;
        const max = postData.scanRange?.max || 180;
        const step = postData.scanRange?.step || 1;
        for (let x = min; x <= max; x += step) {
          points.push({ x, y: 80 + (x - min) * 0.5 });
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            singleParam: {
              paramPath: postData.targetParam,
              metric: postData.metrics?.[0] || "strategyScore",
              points,
              slope: 0.5,
              correlation: 0.92,
            },
            multiParam: {
              results: [],
              keyDrivers: [],
            },
            timestamp: new Date().toISOString(),
            disclaimer: "此為敏感度分析結果，非投資建議。",
          }),
        });
      }
    });

    // Navigate to simulator
    await page.goto("#/dashboard", { waitUntil: "networkidle" });
    await page.waitForSelector("#app > *", { timeout: 60000 });
    await page.waitForSelector(".dash-tabs", { timeout: 60000 });
    await page.locator("text=模擬器").click();
    await page.waitForSelector(".simulator-view", { timeout: 10000 });
  });

  test("應正確渲染敏感度分析 Tab", async ({ page }) => {
    // Click sensitivity tab
    await page.locator("text=敏感度分析").click();
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Verify title
    await expect(page.locator(".sensitivity-title")).toHaveText("敏感度分析");
    await expect(page.locator(".sensitivity-subtitle")).toContainText(
      "參數影響度",
    );
  });

  test("應能選擇目標參數並設定掃描範圍", async ({ page }) => {
    await page.locator("text=敏感度分析").click();
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Select parameter
    await page
      .locator(".param-selector select")
      .selectOption("maintenance.protectTrigger");
    await expect(page.locator(".param-selector select")).toHaveValue(
      "maintenance.protectTrigger",
    );

    // Set scan range
    await page.locator(".range-config input[name='min']").fill("140");
    await page.locator(".range-config input[name='max']").fill("180");
    await page.locator(".range-config input[name='step']").fill("1");

    // Verify values
    await expect(page.locator(".range-config input[name='min']")).toHaveValue(
      "140",
    );
    await expect(page.locator(".range-config input[name='max']")).toHaveValue(
      "180",
    );
    await expect(page.locator(".range-config input[name='step']")).toHaveValue(
      "1",
    );
  });

  test("應能切換觀測指標", async ({ page }) => {
    await page.locator("text=敏感度分析").click();
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Select metrics (multiple)
    await page
      .locator(".metric-selector select")
      .selectOption(["strategyScore", "maintenanceMargin"]);
    await expect(page.locator(".metric-selector select")).toHaveValue([
      "strategyScore",
      "maintenanceMargin",
    ]);
  });

  test("應能切換圖表類型 (敏感度曲線 / Tornado 圖)", async ({ page }) => {
    await page.locator("text=敏感度分析").click();
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Verify both tabs exist
    await expect(page.locator(".chart-toggle text=敏感度曲線")).toBeVisible();
    await expect(page.locator(".chart-toggle text=Tornado 圖")).toBeVisible();

    // Switch to Tornado chart
    await page.locator(".chart-toggle text=Tornado 圖").click();
    await expect(
      page.locator(".chart-toggle .el-tabs__item.is-active text=Tornado 圖"),
    ).toBeVisible();

    // Switch back to sensitivity chart
    await page.locator(".chart-toggle text=敏感度曲線").click();
    await expect(
      page.locator(".chart-toggle .el-tabs__item.is-active text=敏感度曲線"),
    ).toBeVisible();
  });

  test("單參數敏感度分析應顯示曲線圖", async ({ page }) => {
    await page.locator("text=敏感度分析").click();
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Setup
    await page
      .locator(".param-selector select")
      .selectOption("maintenance.protectTrigger");
    await page.locator(".range-config input[name='min']").fill("140");
    await page.locator(".range-config input[name='max']").fill("180");
    await page.locator(".range-config input[name='step']").fill("1");

    // Ensure sensitivity chart tab is active
    await page.locator(".chart-toggle text=敏感度曲線").click();

    // Execute
    await page.locator(".execute-btn:has-text('開始分析')").click();

    // Wait for result
    await expect(page.locator(".sensitivity-chart-container")).toBeVisible({
      timeout: 15000,
    });

    // Verify key drivers panel
    await expect(page.locator(".key-drivers-panel")).toBeVisible();
  });

  test("多參數掃描應顯示 Tornado 圖", async ({ page }) => {
    await page.locator("text=敏感度分析").click();
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Switch to Tornado chart
    await page.locator(".chart-toggle text=Tornado 圖").click();

    // Execute (Tornado chart uses multiParams)
    await page.locator(".execute-btn:has-text('開始分析')").click();

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
    await page.locator("text=敏感度分析").click();
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    await page
      .locator(".param-selector select")
      .selectOption("maintenance.protectTrigger");
    await page.locator(".range-config input[name='min']").fill("140");
    await page.locator(".range-config input[name='max']").fill("180");
    await page.locator(".range-config input[name='step']").fill("1");

    await page.locator(".execute-btn:has-text('開始分析')").click();
    await expect(page.locator(".sensitivity-chart-container")).toBeVisible({
      timeout: 15000,
    });

    // Verify stats displayed
    await expect(page.locator(".chart-stats")).toContainText("斜率");
    await expect(page.locator(".chart-stats")).toContainText("相關係數");
  });

  test("空參數驗證應阻止執行", async ({ page }) => {
    await page.locator("text=敏感度分析").click();
    await page.waitForSelector(".sensitivity-panel", { timeout: 5000 });

    // Don't select parameter, try to execute
    const executeBtn = page.locator(".execute-btn:has-text('開始分析')");
    await expect(executeBtn).toBeDisabled();
  });
});
