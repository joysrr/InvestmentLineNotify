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
      // 記憶體受限環境（手機容器）下的降載參數
      "--single-process",
      "--no-zygote",
      "--renderer-process-limit=1",
      "--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints",
      "--js-flags=--max-old-space-size=256",
    ],
  });
}

export async function newPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
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
            bg_color: "#FEF7FF", text_color: "#1D1B20", hint_color: "#79747E",
            link_color: "#6750A4", button_color: "#6750A4", button_text_color: "#FFFFFF",
            secondary_bg_color: "#F7F2FA",
          },
          viewportHeight: 844, viewportStableHeight: 844,
          headerColor: "#FEF7FF", backgroundColor: "#FEF7FF",
          isExpanded: true, colorScheme: "light", version: "7.0", platform: "ios",
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
