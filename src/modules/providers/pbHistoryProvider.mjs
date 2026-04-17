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
