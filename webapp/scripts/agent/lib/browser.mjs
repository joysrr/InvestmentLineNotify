import { chromium } from "playwright";

export async function launch() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });
}

export async function newPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(25000);

  await page.addInitScript(() => {
    window.__PLAYWRIGHT__ = true;
    if (!window.Telegram || !window.Telegram.WebApp) {
      window.Telegram = {
        WebApp: {
          initData: "dev-bypass",
          initDataUnsafe: { user: { id: 1, first_name: "Test", username: "testuser" } },
          ready: () => {}, expand: () => {}, close: () => {},
          BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
          MainButton: { setParams: () => {}, show: () => {}, hide: () => {}, enable: () => {}, disable: () => {} },
          HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
          themeParams: {
            bg_color: "#0D1117", text_color: "#E6E0E9", hint_color: "#9AA6B2",
            link_color: "#D0BCFF", button_color: "#D0BCFF", button_text_color: "#0D1117",
            secondary_bg_color: "#17171E",
          },
          viewportHeight: 844, viewportStableHeight: 844,
          headerColor: "#0D1117", backgroundColor: "#0D1117",
          isExpanded: true, colorScheme: "dark", version: "7.0", platform: "ios",
          setHeaderColor: () => {}, setBackgroundColor: () => {},
          isVersionAtLeast: () => true,
        },
      };
    }
  });

  

  return { page, context };
}

const API_URL_RE = new RegExp("^https?://[^/]+/api(/|$|\\?)");

export async function installApiMocks(page, fixturesModule) {
  await page.route(API_URL_RE, async (route) => {
    try {
      const url = new URL(route.request().url());
      const body = fixturesModule.fixtureFor(url.pathname);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    } catch (e) {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: String(e) }) });
    }
  });
}
