/**
 * scripts/fetch-longterm-data.mjs
 *
 * 從 Yahoo Finance 抓取 0050.TW、00675L.TW、^VIX 的完整歷史日線資料
 * 並重建 data/backtest/timeline.json（約 2003~今日）
 *
 * 說明：
 *  - 00675L 成立於 2016/11，之前用 0050 × 1.8 近似模擬（槓桿 ETF 歷史估算）
 *  - PB 使用 pbHistory.json 已存資料（月頻），不足的日期用最近值 Forward-Fill
 *  - VIX 從 Yahoo ^VIX 抓取完整歷史
 */

import https from "https";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const OUTPUT_FILE = path.join(DATA_DIR, "backtest", "timeline.json");
const STOCK_HISTORY_DIR = path.join(DATA_DIR, "stock_history");

// ─── 工具函式 ───────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          Accept: "application/json",
          ...headers,
        },
        timeout: 20000,
      },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}

function toDateStr(ts) {
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10);
}

// ─── Yahoo Finance 抓取 ──────────────────────────────────────────────────────

async function fetchYahoo(symbol, from = "2003-01-01") {
  const fromTs = Math.floor(new Date(from).getTime() / 1000);
  const toTs = Math.floor(Date.now() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&period1=${fromTs}&period2=${toTs}`;

  console.log(`  📡 抓取 ${symbol} ...`);
  let retries = 3;
  while (retries-- > 0) {
    try {
      const { status, body } = await httpsGet(url);
      if (status !== 200) throw new Error(`HTTP ${status}`);
      const json = JSON.parse(body);
      const result = json.chart?.result?.[0];
      if (!result) throw new Error(`無 chart.result: ${body.slice(0, 200)}`);

      const timestamps = result.timestamp || [];
      // ⚠️ 注意：adjclose 對於台股 ETF（如 0050）會有大幅回溯跳空問題
      // （Yahoo 把歷史配息一次性回溯，導致特定日期出現 -75% 的假跌幅）
      // 因此：台股股票/ETF 用 close（原始未調整），VIX 等指數用 adjclose
      // 00675L 因發行日短、配息少，繼續用 adjclose 問題不大
      const adjcloses = result.indicators?.adjclose?.[0]?.adjclose || [];
      const rawcloses = result.indicators?.quote?.[0]?.close || [];
      // 預設優先 rawclose（避免跳空），只有 rawclose 完全沒資料才 fallback adjclose
      const closes =
        rawcloses.filter(Boolean).length >= timestamps.length * 0.9
          ? rawcloses
          : adjcloses.length === timestamps.length
            ? adjcloses
            : rawcloses;
      const highs = result.indicators?.quote?.[0]?.high || [];
      const lows = result.indicators?.quote?.[0]?.low || [];

      const rows = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (!close || isNaN(close)) continue; // 跳過 null/NaN
        rows.push({
          date: toDateStr(timestamps[i]),
          close: Math.round(close * 100) / 100,
          high: highs[i] ? Math.round(highs[i] * 100) / 100 : null,
          low: lows[i] ? Math.round(lows[i] * 100) / 100 : null,
        });
      }
      console.log(
        `  ✅ ${symbol}: ${rows.length} 筆 (${rows[0]?.date} ~ ${rows.at(-1)?.date})`,
      );
      return rows;
    } catch (e) {
      console.warn(`  ⚠️ ${symbol} 失敗 (剩 ${retries} 次): ${e.message}`);
      await sleep(2000);
    }
  }
  throw new Error(`❌ ${symbol} 抓取徹底失敗`);
}

// ─── 載入本地 PB ─────────────────────────────────────────────────────────────

async function loadPbHistory() {
  try {
    const raw = await fs.readFile(
      path.join(DATA_DIR, "pbHistory.json"),
      "utf-8",
    );
    const arr = JSON.parse(raw);
    return arr.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    console.warn("  ⚠️ pbHistory.json 不存在，PB 全部使用預設值 2.0");
    return [];
  }
}

// ─── 修改以處理 0050 股票分割 (2025-06-18 1 拆 4) ──────────────────────────
// Yahoo Finance 已將歷史資料除以 4。為忠實反映回測期間的真實資金消耗，
// 我們把 2025-06-18 (不含) 之前的價格全部乘以 4 還原為歷史真實價格。
function revertStockSplit(timeline) {
  const SPLIT_DATE = "2025-06-18";
  let adjusted = [];
  for (const d of timeline) {
    if (d.date < SPLIT_DATE) {
      adjusted.push({
        ...d,
        price0050: Math.round(d.price0050 * 4 * 100) / 100,
        // 如果 00675L 原本是依照 0050 按比例模擬出來的，也要跟著放大 4 倍
        // 因為 00675L 是 2016 成立，其真實資料不應該受影響，只修補 simulated675L 段
        price00675L:
          d.simulated675L && d.price00675L !== null
            ? Math.round(d.price00675L * 4 * 100) / 100
            : d.price00675L,
      });
    } else {
      adjusted.push(d);
    }
  }
  return adjusted;
}

// ─── 偵測並修補 Yahoo 的無故跳空 (如 2014-01-02 的 -75% 回溯) ───────────
function fixDataJumps(timeline) {
  const jumpPoints = [];
  // 先找跳空斷點
  for (let i = 1; i < timeline.length; i++) {
    const change =
      (timeline[i].price0050 - timeline[i - 1].price0050) /
      timeline[i - 1].price0050;
    // -20% 跌幅視為異常跳空 (除了可能的系統性崩盤，但 0050 歷史上鮮少單日跌超 -20%)
    if (change < -0.2 && timeline[i].date < "2025-06-18") {
      jumpPoints.push({
        idx: i,
        date: timeline[i].date,
        ratio: timeline[i].price0050 / timeline[i - 1].price0050,
      });
    }
  }

  if (jumpPoints.length === 0) return timeline;

  let adjustedRaw = [...timeline];
  for (const jump of jumpPoints.sort((a, b) => b.idx - a.idx)) {
    const ratio = jump.ratio;
    console.log(
      `  🔧 修補 0050 跳空於 ${jump.date}，比例: ${(ratio * 100).toFixed(1)}%`,
    );
    for (let i = 0; i < jump.idx; i++) {
      adjustedRaw[i] = {
        ...adjustedRaw[i],
        price0050: Math.round(adjustedRaw[i].price0050 * ratio * 100) / 100,
      };
      if (adjustedRaw[i].simulated675L && adjustedRaw[i].price00675L !== null) {
        adjustedRaw[i].price00675L =
          Math.round(adjustedRaw[i].price00675L * ratio * 100) / 100;
      }
    }
  }

  // 修正跳空點之後所有的模擬 00675L，防止單日跳水被槓桿放大成負值
  let last0050 = null;
  let last675L = null;
  const FIRST_REAL_Z2 = "2016-09-23";
  for (let i = 0; i < adjustedRaw.length; i++) {
    const d = adjustedRaw[i];
    if (d.date >= FIRST_REAL_Z2) break;
    if (d.simulated675L && d.price00675L < 0) {
      if (last0050 && last675L && last675L > 0) {
        const dailyReturn = (d.price0050 - last0050) / last0050;
        const simReturn = dailyReturn * 1.8;
        const newPrice = Math.max(
          0.01,
          Math.round(last675L * (1 + simReturn) * 100) / 100,
        );
        d.price00675L = newPrice;
      } else {
        d.price00675L = Math.round((d.price0050 / 2.5) * 100) / 100;
      }
    }
    last0050 = d.price0050;
    if (d.price00675L > 0) last675L = d.price00675L;
  }

  return adjustedRaw;
}

function simulate00675L(
  price0050,
  prev0050,
  prev675L,
  leverageMultiplier = 1.8,
) {
  if (!prev0050 || !prev675L || prev0050 === 0) return null;
  const dailyReturn = (price0050 - prev0050) / prev0050;
  const simReturn = dailyReturn * leverageMultiplier;
  return Math.round(prev675L * (1 + simReturn) * 100) / 100;
}

// ─── 主程式 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 開始建構 20 年回測 Timeline");
  console.log("   資料來源: Yahoo Finance");
  console.log("");

  // 1. 抓取資料
  await sleep(300);
  const rows0050 = await fetchYahoo("0050.TW", "2003-01-01");
  await sleep(800);
  const rows00675L = await fetchYahoo("00675L.TW", "2016-01-01");
  await sleep(800);
  const rowsVix = await fetchYahoo("^VIX", "2003-01-01");

  // 2. 載入 PB
  const pbHistory = await loadPbHistory();

  // 3. 建立快速查找 Map
  const _map0050 = new Map(rows0050.map((r) => [r.date, r.close]));
  const map00675L = new Map(rows00675L.map((r) => [r.date, r.close]));
  const mapVix = new Map(rowsVix.map((r) => [r.date, r.close]));

  // 4. 以 0050 為主時序，對齊所有資料
  console.log("");
  console.log("🔗 對齊資料中...");

  let lastVix = 15.0;
  let lastPb = 2.0;
  let last0050 = null;
  let last675L = null;

  // PB Forward-Fill 指針
  let pbIdx = 0;

  const timeline = [];
  const sorted0050 = rows0050.sort((a, b) => a.date.localeCompare(b.date));

  // 00675L 上市前最後一個已知真實價（用於接續模擬基準）
  // 00675L 成立日: 2016-11-04，用 2016-11-04 真實收盤當錨點
  const FIRST_675L_DATE = rows00675L[0]?.date || "2016-11-04";

  for (const row of sorted0050) {
    const date = row.date;
    const price0050 = row.close;

    // PB Forward-Fill
    while (pbIdx < pbHistory.length - 1 && pbHistory[pbIdx + 1].date <= date) {
      pbIdx++;
    }
    if (pbHistory[pbIdx]?.date <= date) {
      lastPb = pbHistory[pbIdx].pb ?? lastPb;
    }

    // VIX Forward-Fill
    if (mapVix.has(date)) lastVix = mapVix.get(date);

    // 00675L 價格
    let price00675L;
    if (date >= FIRST_675L_DATE && map00675L.has(date)) {
      // 真實資料
      price00675L = map00675L.get(date);
      last675L = price00675L;
    } else if (date < FIRST_675L_DATE) {
      // 用 0050 × 1.8 模擬
      if (last0050 === null) {
        // 第一天無法計算，用 0050 / 3 大致估（NAV 初始比例）
        price00675L = Math.round((price0050 / 3) * 100) / 100;
      } else {
        price00675L = simulate00675L(
          price0050,
          last0050,
          last675L ?? price0050 / 3,
        );
      }
      last675L = price00675L;
    } else {
      // 00675L 資料中斷（如假日時序不一致）→ 用前一個真實值
      price00675L = last675L;
    }

    last0050 = price0050;

    timeline.push({
      date,
      price0050,
      price00675L,
      vix: Math.round(lastVix * 100) / 100,
      pb: Math.round(lastPb * 100) / 100,
      simulated675L: date < FIRST_675L_DATE, // 標記哪些是模擬的
    });
  }

  // 自動化修補與股票分割還原
  console.log("🛠  修補歷史資料...");
  const fixedTimeline = fixDataJumps(timeline);
  console.log("📈 還原股票分割 (2025-06-18 1拆4)...");
  const finalTimeline = revertStockSplit(fixedTimeline);

  // 5. 存回本地快取（分月 stock_history）
  console.log("💾 儲存月份快取...");
  const byMonth = {};
  for (const row of finalTimeline) {
    const ym = row.date.slice(0, 7).replace("-", "");
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push({ date: row.date, close: row.close });
  }
  const byMonth675L = {};
  for (const row of rows00675L) {
    const ym = row.date.slice(0, 7).replace("-", "");
    if (!byMonth675L[ym]) byMonth675L[ym] = [];
    byMonth675L[ym].push({ date: row.date, close: row.close });
  }

  await fs.mkdir(STOCK_HISTORY_DIR, { recursive: true });
  for (const [ym, rows] of Object.entries(byMonth)) {
    await fs.writeFile(
      path.join(STOCK_HISTORY_DIR, `0050_${ym}.json`),
      JSON.stringify(rows, null, 2),
    );
  }
  for (const [ym, rows] of Object.entries(byMonth675L)) {
    await fs.writeFile(
      path.join(STOCK_HISTORY_DIR, `00675L_${ym}.json`),
      JSON.stringify(rows, null, 2),
    );
  }

  // 6. 輸出 timeline.json
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalTimeline, null, 2));

  console.log("");
  console.log(`✅ Timeline 建構完成！`);
  console.log(`   總筆數：${finalTimeline.length} 個交易日`);
  console.log(
    `   範圍：${finalTimeline[0]?.date} → ${finalTimeline.at(-1)?.date}`,
  );
  console.log(
    `   00675L 模擬期：${finalTimeline[0]?.date} → ${FIRST_675L_DATE}（前）`,
  );
  console.log(`   儲存路徑：${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error("❌ 失敗:", e.message);
  process.exit(1);
});
