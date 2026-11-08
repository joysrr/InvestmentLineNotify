import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP_DIR = path.join(ROOT, "scripts", "__tmp_verify_endpoint__");
const ROUTES_DIR = path.join(TMP_DIR, "src", "api", "routes");
const WEBAPP_SRC = path.join(TMP_DIR, "webapp", "src");

let verifyModule;

beforeEach(async () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(ROUTES_DIR, { recursive: true });
  fs.mkdirSync(path.join(WEBAPP_SRC, "views"), { recursive: true });
  fs.mkdirSync(path.join(WEBAPP_SRC, "api"), { recursive: true });
  verifyModule = await import("./verify-endpoint-usage.mjs");
});

afterEach(async () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

describe("Phase 1 — 端點使用盤點驗證腳本 (TDD)", () => {
  it("extractBackendRoutes 能從路由文件提取所有 fastify.get/post 端點", () => {
    writeFile(
      path.join(ROUTES_DIR, "status.mjs"),
      `fastify.get("/status", async () => {})\nfastify.post("/status/reset", async () => {})`,
    );
    writeFile(
      path.join(ROUTES_DIR, "news.mjs"),
      `fastify.get("/news", async () => {})`,
    );

    const routes = verifyModule.extractBackendRoutes(TMP_DIR);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/status");
    expect(paths).toContain("/status/reset");
    expect(paths).toContain("/news");
    expect(routes.length).toBe(3);
  });

  it("extractFrontendFetchCalls 能從 .vue/.js 文件提取 fetch* 調用", () => {
    writeFile(
      path.join(WEBAPP_SRC, "views", "DashboardView.vue"),
      `fetchReports();\nfetchStatus();\n`,
    );
    writeFile(path.join(WEBAPP_SRC, "views", "NewsView.vue"), `fetchNews();\n`);
    writeFile(
      path.join(WEBAPP_SRC, "api", "index.js"),
      `export const fetchReports = () => {}\nexport const fetchStatus = () => {}\nexport const fetchNews = () => {}\n`,
    );

    const calls = verifyModule.extractFrontendFetchCalls(TMP_DIR);
    expect(calls).toContain("fetchReports");
    expect(calls).toContain("fetchStatus");
    expect(calls).toContain("fetchNews");
  });

  it("buildEndpointUsageMap 識別未被調用的後端端點", () => {
    writeFile(
      path.join(ROUTES_DIR, "status.mjs"),
      `fastify.get("/status", async () => {})`,
    );
    writeFile(
      path.join(ROUTES_DIR, "news.mjs"),
      `fastify.get("/news", async () => {})`,
    );
    writeFile(
      path.join(ROUTES_DIR, "deployRoutes.mjs"),
      `fastify.get("/deploy", async () => {})`,
    );
    writeFile(
      path.join(WEBAPP_SRC, "views", "DashboardView.vue"),
      `fetchStatus();`,
    );
    writeFile(
      path.join(WEBAPP_SRC, "api", "index.js"),
      `export const fetchStatus = () => {}`,
    );

    const result = verifyModule.buildEndpointUsageMap({ rootDir: TMP_DIR });
    const unusedPaths = result.unusedBackendEndpoints.map((e) => e.path);
    expect(unusedPaths).toContain("/news");
    expect(unusedPaths).toContain("/deploy");
    const usedPaths = result.usedBackendEndpoints.map((e) => e.backendPath);
    expect(usedPaths).toContain("/status");
  });

  it("識別前端調用但後端無對應端點的情況", () => {
    writeFile(
      path.join(ROUTES_DIR, "status.mjs"),
      `fastify.get("/status", async () => {})`,
    );
    writeFile(
      path.join(WEBAPP_SRC, "views", "DashboardView.vue"),
      `fetchPortfolioHealth();`,
    );
    writeFile(
      path.join(WEBAPP_SRC, "api", "index.js"),
      `export const fetchPortfolioHealth = () => {}`,
    );

    const result = verifyModule.buildEndpointUsageMap({ rootDir: TMP_DIR });
    expect(result.frontendCallsWithoutBackend).toContain(
      "fetchPortfolioHealth",
    );
  });
});
