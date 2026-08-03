/**
 * Backfill historical stock data for simulator testing
 * Fetches missing months from TWSE and saves to data/stock_history/
 *
 * Usage: node scripts/backfill_stock_history.mjs
 */

import { fetchStockHistoryWithAutoFill } from "../src/modules/providers/historyProvider.mjs";
import fs from "fs/promises";
import path from "path";

const STOCK_HISTORY_DIR = path.join(process.cwd(), "data", "stock_history");
const SYMBOLS = ["0050.TW", "00675L.TW"];

// Simulator 需要最近 13 個月的資料 (REQUIRED_HISTORY_MONTHS = 13)
function getRequiredMonthKeys() {
  const now = new Date();
  const monthKeys = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return monthKeys;
}

async function backfill() {
  console.log("📥 開始回補歷史股價資料...\n");

  const requiredMonths = getRequiredMonthKeys();
  console.log(
    `需要的月份 (共 ${requiredMonths.length} 個): ${requiredMonths.join(", ")}\n`,
  );

  // 先檢查現有檔案
  for (const symbol of SYMBOLS) {
    const stockNo = symbol.replace(".TW", "");
    console.log(`\n🔍 檢查 ${stockNo} 現有資料...`);

    const existing = [];
    for (const monthKey of requiredMonths) {
      const filePath = path.join(
        STOCK_HISTORY_DIR,
        `${stockNo}_${monthKey}.json`,
      );
      try {
        await fs.access(filePath);
        existing.push(monthKey);
      } catch {
        // 檔案不存在
      }
    }
    console.log(
      `  ✅ 已存在: ${existing.length > 0 ? existing.join(", ") : "無"}`,
    );
  }

  // 使用 historyProvider 抓取完整歷史 (會自動回補)
  for (const symbol of SYMBOLS) {
    const stockNo = symbol.replace(".TW", "");
    console.log(`\n📥 抓取 ${symbol} 完整歷史資料 (目標 250+ 筆)...`);

    try {
      // 抓取足夠多筆資料以覆蓋 13 個月
      const history = await fetchStockHistoryWithAutoFill(symbol, 250);
      console.log(`  📊 共抓取 ${history.length} 筆`);

      // 按月份分組並存檔
      const byMonth = {};
      for (const row of history) {
        const date = new Date(row.date);
        const monthKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!byMonth[monthKey]) byMonth[monthKey] = [];
        byMonth[monthKey].push(row);
      }

      // 存檔每個月份
      for (const [monthKey, rows] of Object.entries(byMonth)) {
        // 只存需要的月份
        if (requiredMonths.includes(monthKey)) {
          // 按日期排序 (舊到新)
          rows.sort((a, b) => new Date(a.date) - new Date(b.date));
          const filePath = path.join(
            STOCK_HISTORY_DIR,
            `${stockNo}_${monthKey}.json`,
          );
          await fs.writeFile(filePath, JSON.stringify(rows, null, 2));
          console.log(`  💾 ${stockNo}_${monthKey}.json (${rows.length} 筆)`);
        }
      }
    } catch (err) {
      console.error(`  ❌ ${symbol} 抓取失敗:`, err.message);
    }

    // 禮貌性等待避免 API 限制
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 最終驗證
  console.log("\n✅ 回補完成，驗證結果:");
  for (const symbol of SYMBOLS) {
    const stockNo = symbol.replace(".TW", "");
    let allComplete = true;
    for (const monthKey of requiredMonths) {
      const filePath = path.join(
        STOCK_HISTORY_DIR,
        `${stockNo}_${monthKey}.json`,
      );
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        console.log(`  ✅ ${stockNo}_${monthKey}: ${data.length} 筆`);
      } catch {
        console.log(`  ❌ ${stockNo}_${monthKey}: 缺失`);
        allComplete = false;
      }
    }
    if (allComplete) {
      console.log(`  🎉 ${stockNo} 13 個月資料完整！`);
    }
  }

  console.log(
    "\n📝 注意: 202608 (當月) 資料可能不完整，模擬器會用 MA240 Fallback 處理",
  );
}

backfill().catch(console.error);
