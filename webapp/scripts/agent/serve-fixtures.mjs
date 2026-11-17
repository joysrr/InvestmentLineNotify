#!/usr/bin/env node
/**
 * 靜態伺服器 + /api/* fixtures
 * 用途：讓 dist 產物配上示範資料，供 chromium CLI / 手機瀏覽器截圖驗證排版。
 *
 * - serve dist/ 靜態檔
 * - /api/* 走 fixtures.mjs 的 fixtureFor()
 * - index.html 把 telegram.org 外鏈換成內聯 mock（headless 連外網會超時）
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureFor } from "./lib/fixtures.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../../dist");
const PORT = Number(process.env.FIXTURE_PORT || 5175);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

// Telegram mock：light M3，與 browser.mjs 一致（A2 決策）
const TELEGRAM_MOCK = `<script>
window.__PLAYWRIGHT__ = true;
(function(){
  var t = { bg:"#141218", text:"#E6E0E9", hint:"#938F99", link:"#D0BCFF",
            button:"#D0BCFF", buttonText:"#1D1B20", secondaryBg:"#211F26" };
  var r = document.documentElement;
  r.style.setProperty("--tg-theme-bg-color", t.bg);
  r.style.setProperty("--tg-theme-text-color", t.text);
  r.style.setProperty("--tg-theme-hint-color", t.hint);
  r.style.setProperty("--tg-theme-link-color", t.link);
  r.style.setProperty("--tg-theme-button-color", t.button);
  r.style.setProperty("--tg-theme-button-text-color", t.buttonText);
  r.style.setProperty("--tg-theme-secondary-bg-color", t.secondaryBg);
  r.style.backgroundColor = t.bg;
  r.dataset.tgScheme = "dark";
  document.addEventListener("DOMContentLoaded", function(){
    document.body.style.background = t.bg;
    document.body.style.color = t.text;
  });
})();
window.Telegram = { WebApp: {
  initData: "query_id=mock&user=%7B%22id%22%3A1%7D&auth_date=" + Math.floor(Date.now()/1000) + "&hash=mock",
  initDataUnsafe: { user: { id: 1, first_name: "Mock", username: "mockuser" } },
  ready: () => {}, expand: () => {}, close: () => {},
  BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
  MainButton: { setParams: () => {}, show: () => {}, hide: () => {}, enable: () => {}, disable: () => {} },
  HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
  themeParams: {
    bg_color: "#141218", text_color: "#E6E0E9", hint_color: "#938F99",
    link_color: "#D0BCFF", button_color: "#D0BCFF", button_text_color: "#1D1B20",
    secondary_bg_color: "#211F26"
  },
  viewportHeight: 844, viewportStableHeight: 844,
  headerColor: "#141218", backgroundColor: "#141218",
  isExpanded: true, colorScheme: "dark", version: "7.0", platform: "ios",
  setHeaderColor: () => {}, setBackgroundColor: () => {},
  isVersionAtLeast: () => true,
}};
</script>`;

function serveIndexHtml(res) {
  let html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  // 把 telegram.org 外鏈 script 換成內聯 mock
  html = html.replace(
    /<script\s+src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"><\/script>/,
    TELEGRAM_MOCK,
  );
  // 保險：若沒匹配到（格式不同），在 </head> 前注入
  // 移除 eruda 外链（headless 無外網會阻塞）
  html = html.replace(/<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/eruda"><\/script>\s*/g, "");
  html = html.replace(/<script>eruda\.init\(\);<\/script>\s*/g, "");
  if (!html.includes("window.Telegram =")) {
    html = html.replace("</head>", TELEGRAM_MOCK + "</head>");
  }
  res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
  res.end(html);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // ── API ──
    if (url.pathname.startsWith("/api/")) {
      const body = fixtureFor(url.pathname);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
      return;
    }

    // ── index.html ──
    if (url.pathname === "/" || url.pathname === "/index.html") {
      serveIndexHtml(res);
      return;
    }

    // ── 靜態檔 ──
    const filePath = path.join(DIST, decodeURIComponent(url.pathname));
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403); res.end("forbidden"); return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPA fallback
      serveIndexHtml(res);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=60",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[serve-fixtures] http://127.0.0.1:${PORT}  (dist=${DIST})`);
  console.log(`[serve-fixtures] 7 頁：`);
  for (const p of ["dashboard", "insights?tab=radar", "insights?tab=macro", "chart", "news", "account", "strategy-config"]) {
    console.log(`  http://127.0.0.1:${PORT}/#/${p}`);
  }
});
