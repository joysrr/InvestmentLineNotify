import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        executablePath:
          "/opt/hermes/.playwright/chromium_headless_shell-1234/chrome-linux/headless_shell",
      },
    },
  ],
  // webServer disabled - servers started manually
  // webServer: {
  //   command: "./scripts/start-e2e-servers.sh",
  //   url: "http://localhost:5173",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  //   env: {
  //     NODE_ENV: "development",
  //   },
  // },
});
