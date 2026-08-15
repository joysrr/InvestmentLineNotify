/**
 * E2E Test Utility Functions
 * Unified Telegram SDK Mock & Page Helper for Playwright E2E tests
 */

/**
 * Setup standard Telegram WebApp environment & Playwright bypass flag
 * @param {import('@playwright/test').Page} page
 */
export async function setupE2EContext(page) {
  await page.addInitScript(() => {
    window.__PLAYWRIGHT__ = true;
    window.Telegram = {
      WebApp: {
        initData: "dev-bypass",
        initDataUnsafe: {
          user: {
            id: 123456789,
            first_name: "Test",
            last_name: "User",
            username: "testuser",
            language_code: "zh-TW",
          },
        },
        ready: () => {},
        expand: () => {},
        close: () => {},
        MainButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
        themeParams: {
          bg_color: "#ffffff",
          text_color: "#000000",
          hint_color: "#999999",
          link_color: "#2481cc",
          button_color: "#2481cc",
          button_text_color: "#ffffff",
          secondary_bg_color: "#f0f0f0",
        },
        isExpanded: true,
        viewportHeight: window.innerHeight,
        viewportStableHeight: window.innerHeight,
        headerColor: "#ffffff",
        backgroundColor: "#ffffff",
      },
    };
  });
}

/**
 * Safely wait for Vue App to mount without error boundary fallback
 * @param {import('@playwright/test').Page} page
 * @param {string} routePath
 */
export async function navigateToView(page, routePath) {
  await setupE2EContext(page);
  await page.goto(`http://localhost:5173${routePath}`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000);
}
