#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, newPage, installApiMocks } from "./lib/browser.mjs";
import { captureRoute } from "./lib/capture.mjs";
import * as fixtures from "./lib/fixtures.mjs";
import { ROUTES } from "./lib/routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(__dirname, "../..");
const BASELINE_DIR = path.join(webappRoot, ".agent-baseline");
const SCREENSHOT_DIR = path.join(BASELINE_DIR, "screenshots");
const MANIFEST_PATH = path.join(BASELINE_DIR, "manifest.json");
const BASE_URL = process.env.AGENT_BASE_URL || "http://localhost:5174";

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

async function main() {
  const reset = process.argv.includes("--reset");
  if (!reset && (await exists(MANIFEST_PATH))) {
    console.error("Baseline 已存在。若要覆蓋請加 --reset");
    process.exit(1);
  }

  await fs.rm(BASELINE_DIR, { recursive: true, force: true });
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  console.log(`[baseline] → ${BASE_URL}`);
  const manifest = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    routes: [],
  };

  for (const route of ROUTES) {
    console.log(`[baseline] ${route.slug} …`);
    // 每頁獨立 browser，跑完立刻關（避免 OOM）
    let browser;
    try {
      browser = await launch();
      const { page, context } = await newPage(browser);
      await installApiMocks(page, fixtures);
      const r = await captureRoute(page, route, BASE_URL, SCREENSHOT_DIR);
      await context.close();
      manifest.routes.push(r);
      const icon = r.errors.length === 0 ? "✓" : "✗";
      console.log(`  ${icon} ${route.slug} (${r.durationMs}ms, ${r.errors.length} err)`);
    } catch (e) {
      console.error(`  ✗ ${route.slug} 崩潰: ${e.message.slice(0, 200)}`);
      manifest.routes.push({
        slug: route.slug, path: route.path, title: route.title,
        durationMs: 0, errors: [`CRASH: ${e.message.slice(0, 200)}`],
        warnings: [], failedRequests: [],
        screenshotPath: null, screenshotHash: null, screenshotBytes: 0,
      });
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  const errTotal = manifest.routes.reduce((s, r) => s + r.errors.length, 0);
  const okCount = manifest.routes.filter((r) => r.errors.length === 0).length;
  console.log(`\n[baseline] 已存 → ${MANIFEST_PATH}`);
  console.log(`[baseline] ${manifest.routes.length} 路由：${okCount} ok, ${manifest.routes.length - okCount} 有錯誤（總計 ${errTotal} errors）`);
  process.exit(0);
}

main().catch((e) => { console.error("[baseline] FAIL:", e); process.exit(1); });
