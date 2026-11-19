import { chromium } from "playwright";
import { spawn } from "child_process";
import { join } from "path";
const root = process.cwd();
const server = spawn(
  join(root, "node_modules/.bin/vite"),
  ["--host", "127.0.0.1", "--port", "5173", "--strictPort"],
  {
    cwd: root,
    env: { ...process.env, VITE_USE_MOCK_API: "true" },
    stdio: "ignore",
  },
);
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  headless: true,
});
for (const width of [375, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: "dev-bypass",
        ready() {},
        expand() {},
        close() {},
        BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
      },
    };
  });
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (!u.pathname.startsWith("/api/")) return route.continue();
    const p = u.pathname;
    const data = p.includes("strategy-config/meta")
      ? { fields: [], version: "mock" }
      : p.includes("news")
        ? { items: [] }
        : p.includes("reports")
          ? []
          : { status: "ok", data: {} };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("http://localhost:5173/#/dashboard", {
    waitUntil: "networkidle",
    timeout: 20000,
  });
  await page.screenshot({
    path: `.agent-report/latest/screenshots/dashboard-${width}.png`,
    fullPage: true,
  });
  const text = await page.locator("body").innerText();
  if (text.includes("登入憑證為空") || text.includes("Telegram SDK 未就緒"))
    throw new Error(`auth text at ${width}`);
  await page.close();
}
await browser.close();
server.kill();
console.log("captured 4 screenshots with mock auth");
