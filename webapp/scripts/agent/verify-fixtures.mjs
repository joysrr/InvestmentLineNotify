#!/usr/bin/env node
// 同進程起 http server → 自測 → 關閉。零子進程、零 chromium、零截圖。
import http from "node:http";
import { fixtureFor } from "./lib/fixtures.mjs";

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(fixtureFor(u.pathname)));
    return;
  }
  res.writeHead(404); res.end();
});

srv.listen(0, "127.0.0.1", async () => {
  const port = srv.address().port;
  const base = `http://127.0.0.1:${port}`;
  const cases = [
    ["/api/status",           "obj",  (d) => d._meta?.sources ? Object.keys(d._meta.sources).length + " sources" : "MISSING"],
    ["/api/reports?limit=30", "arr",  (d) => d.length + " reports, target=" + d[0]?.signals?.target],
    ["/api/reports/snapshots?limit=90", "obj", (d) => (d.snapshots?.length ?? 0) + " pts"],
    ["/api/news",             "arr",  (d) => d.length + " news, first=" + (d[0]?.title || "").slice(0, 16)],
    ["/api/report/news",      "arr",  (d) => d.length + " report-news"],
    ["/api/portfolio/health", "obj",  (d) => "score=" + d.score + " metrics=" + (d.metrics?.length ?? 0)],
    ["/api/strategy-config",  "obj",  (d) => d.config ? "keys=" + Object.keys(d.config).length : "MISSING"],
    ["/api/strategy-status",  "obj",  (d) => "checks=" + (d.checks?.length ?? 0)],
    ["/api/social-sentiment", "obj",  (d) => "series=" + (d.series?.length ?? 0)],
    ["/api/data-evidence-report", "obj", (d) => "items=" + (d.items?.length ?? 0)],
    ["/api/replay-evidence",  "arr",  (d) => d.length + " evidence"],
  ];
  let fail = 0;
  console.log("端點".padEnd(34) + "形狀    詳情");
  console.log("-".repeat(90));
  for (const [ep, want, detail] of cases) {
    try {
      const r = await fetch(base + ep);
      const d = await r.json();
      const isArr = Array.isArray(d);
      const ok = want === "arr" ? isArr : (!isArr && d && typeof d === "object");
      if (!ok) fail++;
      console.log(ep.padEnd(34) + (isArr ? "array" : "object").padEnd(8) + (ok ? "✅ " : "❌ ") + detail(d));
    } catch (e) {
      fail++;
      console.log(ep.padEnd(34) + "ERROR   ❌ " + e.message.slice(0, 40));
    }
  }
  console.log("-".repeat(90));
  console.log(fail === 0 ? "全部通過 ✅（fixture 資料形狀正確）" : `${fail} 項失敗 ❌`);
  srv.close();
  process.exit(fail === 0 ? 0 : 1);
});
