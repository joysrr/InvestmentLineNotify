import { chromium } from "playwright";
import { spawn } from "child_process";
import { join } from "path";
import { mkdir } from "fs/promises";

const root = process.cwd();
const scenarios = ["rich", "risk", "empty", "error", "weak-network"];
const pages = [
  ["dashboard", "/#/dashboard"],
  ["account", "/#/account"],
  ["technical", "/#/technical"],
  ["radar", "/#/radar"],
  ["macro", "/#/macro"],
  ["chart", "/#/chart"],
  ["news", "/#/news"],
  ["strategy", "/#/strategy"],
  ["strategy-config", "/#/strategy-config"],
];
const outputRoot = ".agent-report/mock-scenarios-375";
await mkdir(outputRoot, { recursive: true });

const server = spawn(
  join(root, "node_modules/.bin/vite"),
  ["--host", "127.0.0.1", "--port", "5173", "--strictPort"],
  {
    cwd: root,
    env: { ...process.env, VITE_USE_MOCK_API: "true" },
    stdio: "ignore",
  },
);
const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
try {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  for (const scenario of scenarios) {
    const dir = join(outputRoot, scenario);
    await mkdir(dir, { recursive: true });
    for (const [name, path] of pages) {
      const page = await browser.newPage({
        viewport: { width: 375, height: 900 },
        deviceScaleFactor: 1,
      });
      await page.addInitScript((value) => {
        window.__PLAYWRIGHT__ = true;
        window.__ILN_MOCK_SCENARIO_OVERRIDE__ = value;
        window.Telegram = {
          WebApp: {
            initData: "dev-bypass",
            ready() {},
            expand() {},
            close() {},
            BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} },
          },
        };
      }, scenario);
      await page.goto(`http://localhost:5173${path}?mock=${scenario}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page.waitForTimeout(scenario === "weak-network" ? 4500 : 1800);
      await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
      await page.close();
      console.log(`captured ${scenario}/${name}`);
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(
  `captured ${scenarios.length * pages.length} screenshots at ${outputRoot}`,
);
