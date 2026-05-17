import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const STOCK_HISTORY_DIR = path.join(DATA_DIR, "stock_history");
const OUTPUT_FILE = path.join(DATA_DIR, "backtest", "timeline.json");

async function loadJson(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log("--- \u{1F682} 開始建構回測對齊資料 ---");

  // 1. 載入 VIX 與 PB 歷史
  const vixHistory =
    (await loadJson(path.join(DATA_DIR, "vixHistory.json"))) || [];
  const pbHistory =
    (await loadJson(path.join(DATA_DIR, "pbHistory.json"))) || [];

  // 轉成 Map 加快查找 (Date -> Value)
  const vixMap = new Map(vixHistory.map((i) => [i.date, i.value]));
  const pbMap = new Map(pbHistory.map((i) => [i.date, i.pb]));

  // 2. 掃描 0050 / 00675L 的歷史檔案
  const files = await fs.readdir(STOCK_HISTORY_DIR);
  const files0050 = files.filter((f) => f.startsWith("0050_")).sort();
  const files00675L = files.filter((f) => f.startsWith("00675L_")).sort();

  console.log(
    `找到 ${files0050.length} 個 0050 月份資料, ${files00675L.length} 個 00675L 月份資料`,
  );

  // 3. 聚合 0050 價格 (母座標)
  let timeline0050 = [];
  for (const file of files0050) {
    const data = await loadJson(path.join(STOCK_HISTORY_DIR, file));
    if (data) timeline0050 = timeline0050.concat(data);
  }
  // 去重並排序 (由舊到新)
  timeline0050 = Array.from(
    new Map(timeline0050.map((i) => [i.date, i])).values(),
  );
  timeline0050.sort((a, b) => a.date.localeCompare(b.date));

  // 4. 聚合 00675L 價格 (Lookup 用)
  let map00675L = new Map();
  for (const file of files00675L) {
    const data = await loadJson(path.join(STOCK_HISTORY_DIR, file));
    if (data) data.forEach((row) => map00675L.set(row.date, row));
  }

  // 5. 對齊資料
  let lastPb = 2.0;
  let lastVix = 15.0;

  // 為了確保 PB 會抓取過去最近的，我們需要先把 PB 依日期排序
  const sortedPbs = pbHistory.sort((a, b) => a.date.localeCompare(b.date));

  const alignedTimeline = timeline0050.map((day0050) => {
    const date = day0050.date;
    const day00675L = map00675L.get(date);

    // 更新 VIX
    if (vixMap.has(date)) {
      lastVix = vixMap.get(date);
    }

    // 更新 PB (抓取日期 <= 當前日期的最大 PB)
    // 雖然 Map 查找較快，但 PB 主要是每月 1 號，所以需要 Forward Fill
    const currentDayPb = sortedPbs.filter((p) => p.date <= date).pop();
    if (currentDayPb) lastPb = currentDayPb.pb;

    return {
      date,
      price0050: day0050.close,
      price00675L: day00675L ? day00675L.close : null,
      vix: lastVix,
      pb: lastPb,
      raw: {
        "0050": day0050,
        "00675L": day00675L || null,
      },
    };
  });

  // 6. 輸出
  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(alignedTimeline, null, 2));

  console.log(
    `\u2705 對齊完成! 產出 ${alignedTimeline.length} 筆回測時效資料.`,
  );
  console.log(`\u{1F4CD} 儲存路徑: ${OUTPUT_FILE}`);

  // 簡單取樣印出檢查
  if (alignedTimeline.length > 0) {
    console.log("第一筆:", alignedTimeline[0]);
    console.log("最後一筆:", alignedTimeline[alignedTimeline.length - 1]);
  }
}

main().catch((err) => {
  console.error("\u274C 建構失敗:", err);
  process.exit(1);
});
