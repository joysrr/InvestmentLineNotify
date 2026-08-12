const { test, expect } = require('@playwright/test');

test('debug DOM after navigation', async ({ page }) => {
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

  await page.goto("#/dashboard", { waitUntil: "networkidle" });

  // Let's see what's in the #app element
  const appInnerHTML = await page.locator("#app").innerHTML();
  console.log('#app innerHTML length:', appInnerHTML.length);
  console.log('#app innerHTML first 500 chars:', appInnerHTML.substring(0, 500));

  // Also, let's see if there are any elements with class dash-title
  const dashTitleCount = await page.locator('.dash-title').count();
  console.log('.dash-title count:', dashTitleCount);

  // Let's also check for any error in the console
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Wait a bit for any console errors
  await page.waitForTimeout(3000);

  if (errors.length > 0) {
    console.log('Console errors:');
    errors.forEach((err, i) => {
      console.log(`${i}: ${err}`);
    });
  } else {
    console.log('No console errors');
  }

  // Take a screenshot
  await page.screenshot({ path: 'debug_dom_after_navigation.png' });
});