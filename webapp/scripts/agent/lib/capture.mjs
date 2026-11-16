import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function captureRoute(page, route, baseUrl, screenshotDir) {
  const errors = [];
  const warnings = [];
  const failedRequests = [];

  // Abort noise: 由 capture 收尾 / context.close / Vite HMR 引起，非真回归
  const ABORT_NOISE_RE =
    /Failed to fetch|net::ERR_ABORTED|The user aborted a request|TypeError: Failed to fetch|WebSocket connection to .ws:\/\/.*failed|ws:\/\/[^\s]+\/.*ERR_CONNECTION_REFUSED/;

  const onConsole = (msg) => {
    const t = msg.type();
    const txt = msg.text();
    if (t === "error") {
      if (ABORT_NOISE_RE.test(txt)) return;
      errors.push(txt.slice(0, 500));
    } else if (t === "warning") {
      warnings.push(txt.slice(0, 500));
    }
  };
  const onPageError = (err) => errors.push("UNCAUGHT: " + err.message.slice(0, 500));
  const onRequestFailed = (req) => {
    if (req.url().includes("/api/")) return;
    failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText || "?"}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);

  const start = Date.now();
  try {
    await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await page
      .waitForFunction(
        () => {
          const el = document.getElementById("app");
          return el && el.children.length > 0 && el.innerHTML.length > 100;
        },
        { timeout: 15000 },
      )
      .catch(() => {
        errors.push("RENDER_TIMEOUT: #app 未在 15s 內渲染");
      });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
  } catch (e) {
    errors.push(`NAV_FAIL: ${e.message.slice(0, 300)}`);
  }
  const durationMs = Date.now() - start;

  // 給 in-flight 請求收尾時間，避免截圖後 context.close 引發 abort 雜訊
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  let screenshotBuf = null;
  let screenshotPath = null;
  try {
    screenshotBuf = await page.screenshot({ fullPage: true, type: "png" });
    screenshotPath = path.join(screenshotDir, `${route.slug}.png`);
    await fs.writeFile(screenshotPath, screenshotBuf);
  } catch (e) {
    errors.push(`SHOT_FAIL: ${e.message.slice(0, 300)}`);
  }

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("requestfailed", onRequestFailed);

  return {
    slug: route.slug,
    path: route.path,
    title: route.title,
    durationMs,
    errors,
    warnings,
    failedRequests,
    screenshotPath,
    screenshotHash: screenshotBuf ? sha256(screenshotBuf) : null,
    screenshotBytes: screenshotBuf ? screenshotBuf.length : 0,
  };
}
