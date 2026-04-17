/**
 * pbHistoryProvider.mjs
 *
 * PB 歷史快取管理模組，負責讀寫 data/pbHistory.json。
 *
 * 設計原則：
 *   - 本模組完全不打任何外部 API
 *   - 所有 PB 資料來源由呼叫方提供（marketData.mjs 傳入當日值）
 *   - 歷史補齊透過 twseProvider.fetchMarketValuationHistory() 計算
 *
 * 對外三個介面：
 *   getPbHistoryRecords()         → 讀取全部紀錄，回傳 { date, pb }[] 陣列
 *   appendToday(date, pb)         → 追加當日 PB（已存在相同日期則略過，冪等）
 *   checkAndBackfill(targetDays)  → 不足 targetDays 筆時，呼叫 twseProvider 補齊
 *
 * 資料格式（data/pbHistory.json）：
 *   [
 *     { "date": "2021-01-29", "pb": 1.72 },
 *     ...
 *   ]
 *
 * 注意：
 *   - 歷史回算使用當前股本（偏差 < 1-2%，作為估值分位數參考可接受）
 *   - 每月最後交易日為代表值（TWSE 月報端點回傳該月最後一個交易日資料）
 *   - 每日 appendToday() 追加的是實際交易日資料，粒度為日
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchMarketValuationHistory } from "./twseProvider.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../../../data/pbHistory.json");

// ── 內部工具函式 ───────────────────────────────────────────────────────────

/**
 * 讀取 pbHistory.json，若不存在則回傳空陣列
 * @returns {{ date: string, pb: number }[]}
 */
function readRecords() {
  try {
    if (!fs.existsSync(DATA_PATH)) return [];
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 將紀錄陣列寫回 pbHistory.json（升序排序，去重複）
 * @param {{ date: string, pb: number }[]} records
 */
function writeRecords(records) {
  const map = new Map();
  for (const r of records) {
    if (r.date && Number.isFinite(r.pb) && r.pb > 0) {
      map.set(r.date, r);
    }
  }
  const sorted = [...map.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(sorted, null, 2), "utf-8");
}

/**
 * 從日期字串取得 "YYYYMM" 月份鍵
 * @param {string} isoDate  格式 YYYY-MM-DD
 * @returns {string} 格式 "YYYYMM"
 */
function toMonthKey(isoDate) {
  return isoDate.slice(0, 7).replace("-", "");
}

// ── 對外介面 ───────────────────────────────────────────────────────────────

/**
 * 讀取全部 PB 歷史紀錄（升序排列）
 * @returns {{ date: string, pb: number }[]}
 */
export function getPbHistoryRecords() {
  return readRecords();
}

/**
 * 追加當日 PB 紀錄（冪等，相同 date 只寫入一次）
 *
 * 由 marketData.mjs 在 rawValuation 成功取得後呼叫：
 *   appendToday(result.date, result.pb)
 *
 * @param {string} date  ISO 日期字串 YYYY-MM-DD
 * @param {number} pb    當日市值加權 PB
 * @returns {boolean}    true = 成功寫入；false = 已存在略過或資料無效
 */
export function appendToday(date, pb) {
  if (!date || !Number.isFinite(pb) || pb <= 0) {
    console.warn("[pbHistoryProvider] appendToday: 無效參數，略過", {
      date,
      pb,
    });
    return false;
  }

  const records = readRecords();
  if (records.some((r) => r.date === date)) {
    console.log(`[pbHistoryProvider] appendToday: ${date} 已存在，略過`);
    return false;
  }

  records.push({ date, pb });
  writeRecords(records);
  console.log(`[pbHistoryProvider] appendToday: 寫入 ${date} PB=${pb}`);
  return true;
}

/**
 * 檢查紀錄筆數，不足 targetDays 時向 twseProvider 補齊歷史資料。
 *
 * 補齊策略：
 *   1. 計算已有資料的最舊月份，從更早的月份往前補
 *   2. 若完全無資料，從今日往前回溯 65 個月
 *   3. 目標 1260 筆（約 5 年交易日），若回算後仍不足，降至 630 筆（2.5 年）
 *   4. 補齊後去重複，升序排序寫回
 *
 * @param {number} [targetDays=1260]  目標筆數
 * @returns {Promise<{ added: number, total: number, reachedTarget: boolean }>}
 */
export async function checkAndBackfill(targetDays = 1260) {
  const records = readRecords();
  const currentCount = records.length;

  if (currentCount >= targetDays) {
    console.log(
      `[pbHistoryProvider] 已有 ${currentCount} 筆，無需補齊（目標 ${targetDays}）`,
    );
    return { added: 0, total: currentCount, reachedTarget: true };
  }

  const fallbackTarget = 630;
  const needed = targetDays - currentCount;
  console.log(
    `[pbHistoryProvider] 目前 ${currentCount} 筆，需補約 ${needed} 筆，開始歷史回算...`,
  );

  // 計算補齊範圍
  const today = new Date();
  const endYYYYMM = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}`;

  // 起始月份：從最舊資料再往前 65 個月，或直接往前 65 個月
  let startDate = new Date(today);
  if (records.length > 0) {
    // 從最舊一筆的月份往前再推
    startDate = new Date(records[0].date);
  }
  startDate.setMonth(startDate.getMonth() - 65);
  const startYYYYMM = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}`;

  // 呼叫 twseProvider 歷史回算
  let fetched = [];
  try {
    fetched = await fetchMarketValuationHistory(startYYYYMM, endYYYYMM);
  } catch (e) {
    console.warn(
      "[pbHistoryProvider] fetchMarketValuationHistory 失敗:",
      e.message,
    );
    return { added: 0, total: currentCount, reachedTarget: false };
  }

  if (fetched.length === 0) {
    console.warn("[pbHistoryProvider] 歷史回算無資料，補齊中止");
    return { added: 0, total: currentCount, reachedTarget: false };
  }

  // 合併、去重複、升序排序寫回
  const merged = [...records, ...fetched];
  writeRecords(merged);

  const finalRecords = readRecords();
  const finalCount = finalRecords.length;
  const added = finalCount - currentCount;

  // 判斷是否達標
  const reachedTarget = finalCount >= targetDays;
  const reachedFallback = finalCount >= fallbackTarget;

  if (reachedTarget) {
    console.log(
      `[pbHistoryProvider] ✅ 補齊完成：新增 ${added} 筆，共 ${finalCount} 筆，達標（${targetDays}）`,
    );
  } else if (reachedFallback) {
    console.warn(
      `[pbHistoryProvider] ⚠️ 補齊完成：共 ${finalCount} 筆，未達 ${targetDays} 但已達最低門檻 ${fallbackTarget}`,
    );
  } else {
    console.warn(
      `[pbHistoryProvider] ❌ 補齊後僅 ${finalCount} 筆，低於最低門檻 ${fallbackTarget}，請確認 TWSE 資料可用性`,
    );
  }

  return { added, total: finalCount, reachedTarget };
}
