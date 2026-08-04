import { test, expect } from '@playwright/test';

test.describe('SimulatorView - Forward Simulation (正向模擬)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses to avoid dependency on real backend data
    await page.route('**/api/v1/simulate', async route => {
      // Return mock forward simulation response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          simulatedPrice0050: 180,
          simulatedPriceZ2: 280,
          priceDiffPct0050: 2.5,
          priceDiffPctZ2: 1.8,
          strategyScore: 65,
          strategyStatus: '觀望 (策略分數不足)',
          strategyTarget: '維持',
          strategySuggestion: '建議維持現狀，等待更明確訊號',
          maintenanceMargin: 142.3,
          portfolioHealth: {
            maintenanceRisk: { level: 'Protect', score: 72 }
          },
          lifecycleStage: '成長期',
          calculationMode: 'forward',
          dataAsOf: '2026-08-04',
          timestamp: new Date().toISOString(),
          assumptions: ['假設聯動比例不變', '假設無重大突發事件'],
          warnings: ['價格偏離超過 10%，結果可能不反映單日情境'],
          currentPrice0050: 175,
          currentPriceZ2: 275,
          indicators: {},
          dataQuality: {
            ma240: 'OK',
            rsi: 'OK',
            kd: 'OK',
            macd: 'OK',
            ma20: 'OK',
            ma60: 'OK',
            atr: 'OK'
          },
          disclaimer: '此為條件分析，非價格預測亦非投資建議。'
        })
      });
    });

    await page.route('**/api/v1/simulate/reverse', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          target: { type: 'maintenanceRatio', value: 150 },
          reachable: true,
          method: 'analytical',
          reason: '可達成',
          results: {
            price0050: 185.5,
            priceZ2: 288.2,
            achievedValue: 150.1
          },
          calculationMode: 'reverse_analytical',
          timestamp: new Date().toISOString(),
          dataAsOf: '2026-08-04',
          disclaimer: '此為條件分析，非價格預測亦非投資建議。'
        })
      });
    });

    await page.route('**/api/reports*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          date: '2026-08-04',
          price0050: 175,
          currentPrice: 275,
          basePrice: 150,
          portfolio: { totalValue: 1000000 },
          VIX: 15.99,
          vixArr: [15, 16, 15.5]
        }])
      });
    });

    // Navigate to the simulator page (hash-based routing)
    await page.goto('#/simulator');
    // Wait for the app to mount and Telegram to be ready
    await page.waitForSelector('.simulator-view', { timeout: 10000 });
  });

  test('should load simulator view with forward mode by default', async ({ page }) => {
    // Check header
    await expect(page.locator('.sim-title')).toHaveText('0050 雙向模擬器');
    await expect(page.locator('.sim-subtitle')).toHaveText('股價 ⇄ 策略分數 / 條件反推');

    // Check mode tabs
    await expect(page.locator('text=股價 → 分數')).toBeVisible();
    await expect(page.locator('text=目標 → 價格')).toBeVisible();

    // Check input fields exist (by label text)
    await expect(page.locator('text=0050 預估價格')).toBeVisible();
    await expect(page.locator('text=00675L 預估價格')).toBeVisible();
    await expect(page.locator('button:has-text("執行模擬")')).toBeVisible();
  });

  test('should run forward simulation with valid inputs', async ({ page }) => {
    // Fill in price inputs - use label to find input
    await page.locator('label:has-text("0050 預估價格") ~ input').fill('180');
    await page.locator('label:has-text("00675L 預估價格") ~ input').fill('280');

    // Click run button
    await page.locator('button:has-text("執行模擬")').click();

    // Since mock API responds instantly, result appears immediately
    // Just wait for result card to appear
    await expect(page.locator('.score-label:has-text("策略分數")')).toBeVisible({ timeout: 10000 });
    
    // Check for key result elements - match actual rendered text
    await expect(page.locator('text=建議維持現狀')).toBeVisible(); // strategySuggestion
    await expect(page.locator('text=模擬 0050')).toBeVisible(); // price summary
    await expect(page.locator('text=模擬 00675L')).toBeVisible();
  });

  test('should show disabled button when 0050 price is empty', async ({ page }) => {
    // Only fill Z2 price
    await page.locator('label:has-text("00675L 預估價格") ~ input').fill('280');
    // Button should be disabled when 0050 is empty
    await expect(page.locator('button:has-text("執行模擬")')).toBeDisabled();
  });

  test('should clear result when clear button clicked', async ({ page }) => {
    // First run a simulation
    await page.locator('label:has-text("0050 預估價格") ~ input').fill('180');
    await page.locator('label:has-text("00675L 預估價格") ~ input').fill('280');
    await page.locator('button:has-text("執行模擬")').click();
    await expect(page.locator('.score-label:has-text("策略分數")')).toBeVisible({ timeout: 10000 });

    // Click clear
    await page.locator('button:has-text("清除結果")').click();

    // Result should be gone
    await expect(page.locator('.score-label:has-text("策略分數")')).toBeHidden({ timeout: 5000 });
  });

  test('should show deviation warning when price deviates from market', async ({ page }) => {
    // Use a price far from market (assuming market ~180)
    await page.locator('label:has-text("0050 預估價格") ~ input').fill('250');
    await page.locator('label:has-text("00675L 預估價格") ~ input').fill('280');
    await page.locator('button:has-text("執行模擬")').click();
    await expect(page.locator('.score-label:has-text("策略分數")')).toBeVisible({ timeout: 10000 });

    // Check for deviation warning in the input area
    await expect(page.locator('.input-warning:has-text("偏離")')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('SimulatorView - Reverse Simulation (反向推導)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/v1/simulate/reverse', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          target: { type: 'maintenanceRatio', value: 150 },
          reachable: true,
          method: 'analytical',
          reason: '可達成',
          results: {
            price0050: 185.5,
            priceZ2: 288.2,
            achievedValue: 150.1
          },
          calculationMode: 'reverse_analytical',
          timestamp: new Date().toISOString(),
          dataAsOf: '2026-08-04',
          disclaimer: '此為條件分析，非價格預測亦非投資建議。'
        })
      });
    });

    await page.route('**/api/reports*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          date: '2026-08-04',
          price0050: 175,
          currentPrice: 275,
          basePrice: 150,
          portfolio: { totalValue: 1000000 },
          VIX: 15.99,
          vixArr: [15, 16, 15.5]
        }])
      });
    });

    await page.goto('#/simulator');
    await page.waitForSelector('.simulator-view', { timeout: 10000 });
  });

  test('should switch to reverse mode when tab clicked', async ({ page }) => {
    await page.locator('text=目標 → 價格').click();
    await expect(page.locator('text=目標類型')).toBeVisible();
    await expect(page.locator('label:has-text("維持率")')).toBeVisible();
    await expect(page.locator('button:has-text("反向推導")')).toBeVisible();
  });

  test('should show disabled button when target value is empty for numeric types', async ({ page }) => {
    await page.locator('text=目標 → 價格').click();
    
    // Default is maintenance ratio, don't fill value
    // Button should be disabled
    await expect(page.locator('button:has-text("反向推導")')).toBeDisabled();
  });

  test('should show target input changes when selecting different target types', async ({ page }) => {
    await page.locator('text=目標 → 價格').click();
    
    // Select RSI from dropdown
    await page.locator('.selector-field').first().selectOption('rsi');
    await expect(page.locator('label:has-text("RSI")')).toBeVisible();
    
    // Select KD Cross
    await page.locator('.selector-field').first().selectOption('kdCross');
    // Direction selector appears - second select
    await expect(page.locator('.selector-field').nth(1)).toBeVisible();
    await page.locator('.selector-field').nth(1).selectOption('golden');
  });
});

test.describe('SimulatorView - Data Quality & Disclaimer', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/v1/simulate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          simulatedPrice0050: 180,
          simulatedPriceZ2: 280,
          priceDiffPct0050: 2.5,
          priceDiffPctZ2: 1.8,
          strategyScore: 65,
          strategyStatus: '觀望 (策略分數不足)',
          strategyTarget: '維持',
          strategySuggestion: '建議維持現狀，等待更明確訊號',
          maintenanceMargin: 142.3,
          portfolioHealth: {
            maintenanceRisk: { level: 'Protect', score: 72 }
          },
          lifecycleStage: '成長期',
          calculationMode: 'forward',
          dataAsOf: '2026-08-04',
          timestamp: new Date().toISOString(),
          assumptions: ['假設聯動比例不變', '假設無重大突發事件'],
          warnings: ['價格偏離超過 10%，結果可能不反映單日情境'],
          currentPrice0050: 175,
          currentPriceZ2: 275,
          indicators: {},
          dataQuality: {
            ma240: 'OK',
            rsi: 'OK',
            kd: 'OK',
            macd: 'OK',
            ma20: 'OK',
            ma60: 'OK',
            atr: 'OK'
          },
          disclaimer: '此為條件分析，非價格預測亦非投資建議。'
        })
      });
    });

    await page.route('**/api/reports*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          date: '2026-08-04',
          price0050: 175,
          currentPrice: 275,
          basePrice: 150,
          portfolio: { totalValue: 1000000 },
          VIX: 15.99,
          vixArr: [15, 16, 15.5]
        }])
      });
    });

    await page.goto('#/simulator');
    await page.waitForSelector('.simulator-view', { timeout: 10000 });
  });

  test('should show data quality badges after simulation', async ({ page }) => {
    await page.locator('label:has-text("0050 預估價格") ~ input').fill('180');
    await page.locator('label:has-text("00675L 預估價格") ~ input').fill('280');
    await page.locator('button:has-text("執行模擬")').click();
    
    await expect(page.locator('.score-label:has-text("策略分數")')).toBeVisible({ timeout: 10000 });
    
    // Check data quality section - the text in the result shows data quality badges
    await expect(page.locator('text=MA240')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=RSI')).toBeVisible();
    await expect(page.locator('text=KD')).toBeVisible();
    await expect(page.locator('text=MACD')).toBeVisible();
  });

  test('should show disclaimer banner after simulation', async ({ page }) => {
    await page.locator('label:has-text("0050 預估價格") ~ input').fill('180');
    await page.locator('label:has-text("00675L 預估價格") ~ input').fill('280');
    await page.locator('button:has-text("執行模擬")').click();
    
    await expect(page.locator('.score-label:has-text("策略分數")')).toBeVisible({ timeout: 10000 });
    
    // Check disclaimer
    await expect(page.locator('text=非投資建議')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=條件分析')).toBeVisible();
  });
});