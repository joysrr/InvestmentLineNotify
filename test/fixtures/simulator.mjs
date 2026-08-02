// test/fixtures/simulator.mjs
// 真實資料抽樣 + 手工極端案例 (DEC-26)

import { readFile } from "fs/promises";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const DATA_DIR = resolve(__dirname, "../../data");

/** 讀取真實最新戰報作為基礎 fixture */
export async function loadRealLatestReport() {
  try {
    const files = await readFile(
      resolve(DATA_DIR, "market/latest.json"),
      "utf-8",
    );
    return JSON.parse(files);
  } catch {
    return null;
  }
}

/** 模擬完整的 latestReport 結構 (基於真實資料) */
export const mockLatestReport = {
  date: "2026-08-01",
  currentPrice: 116.5, // 00675L 現價
  price0050: 175.0, // 0050 現價
  basePrice: 115.0, // 00675L 基準價
  VIX: 18.5,
  macroMarketDirection: "NEUTRAL",
  RSI: 52.3,
  cnnScore: 45,
  currentRate: 31.2,
  maintenanceRatio: 142.5,
  portfolio: {
    qty0050: 10000,
    qtyZ2: 5000,
    cash: 50000,
    totalLoan: 800000,
    lastBuyDate: "2026-01-15",
  },
  // 指標陣列 (足夠長度供 MA240 計算)
  closeArr: Array.from(
    { length: 250 },
    (_, i) => 110 + Math.sin(i * 0.1) * 10 + Math.random() * 2,
  ),
  highArr: Array.from(
    { length: 250 },
    (_, i) => 112 + Math.sin(i * 0.1) * 10 + Math.random() * 2,
  ),
  lowArr: Array.from(
    { length: 250 },
    (_, i) => 108 + Math.sin(i * 0.1) * 10 + Math.random() * 2,
  ),
  // 0050 歷史
  closeArr0050: Array.from(
    { length: 250 },
    (_, i) => 170 + Math.sin(i * 0.1) * 8 + Math.random() * 1.5,
  ),
  highArr0050: Array.from(
    { length: 250 },
    (_, i) => 172 + Math.sin(i * 0.1) * 8 + Math.random() * 1.5,
  ),
  lowArr0050: Array.from(
    { length: 250 },
    (_, i) => 168 + Math.sin(i * 0.1) * 8 + Math.random() * 1.5,
  ),
  // 原始資料
  rawValuation: { pb: 1.15, pe: 14.2 },
  rawUsMarket: { vix: 18.5, spy: 450.2 },
  rawCnn: { score: 45, rating: "Neutral" },
  rawMargin: { maintenanceRatio: 142.5 },
  rawFx: { currentRate: 31.2 },
  // 歷史記錄
  pbRecords: Array.from({ length: 200 }, (_, i) => ({
    date: `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    pb: 1.1 + (i % 10) * 0.02,
  })),
  pbRecordsObjects: [],
  valuationGuardState: { defenseLatch: false },
  institutionalNet: 5000,
  institutionalHistory: Array.from(
    { length: 30 },
    () => Math.floor(Math.random() * 10000) - 5000,
  ),
  // 計算用陣列 (將在 dataAdapter 重新計算)
  ma20Arr: [],
  ma60Arr: [],
  ma240Arr: [],
  ma60SlopeArr: [],
  macdArr: [],
  kdArr: [],
  rsiArr: [],
  atrArr: [],
  vixArr: Array.from({ length: 30 }, () => 15 + Math.random() * 10),
};

/** 模擬策略設定 */
export const mockStrategyConfig = {
  version: "2.8.0",
  grossLeverage: {
    enabled: true,
    maxRatio: 2.5,
    warnRatio: 2.0,
  },
  trading: {
    cooldownDays: 20,
    budget: { dailyMaxPct: 5, rollingDays: 10, rollingMaxPct: 15 },
  },
  sell: {
    trailingStop: { enabled: true, activationPct: 5, trailPct: 3 },
  },
  macroSentiment: {
    enabled: true,
    bearishCooldownMultiplier: 1.5,
  },
  overrideHierarchy: {
    panicBypassEnabled: true,
    panicBypassDropPct: 15,
    panicVixThreshold: 30,
  },
  valuationGuard: {
    enabled: true,
    latch: { triggerPb: 1.3, unlockMa60SlopeThreshold: 0.1 },
  },
};

/** 極端測試案例 */
export const extremeFixtures = {
  // 價格極端
  priceAtLowerBound: 50,
  priceAtUpperBound: 500,
  priceBelowBound: 49,
  priceAboveBound: 501,
  // 維持率極端
  maintenanceRatioCritical: 110, // 臨界
  maintenanceRatioSafe: 200, // 安全
  // RSI 極端
  rsiOversold: 15,
  rsiOverbought: 85,
  // 缺月資料
  incompleteHistory: {
    ...mockLatestReport,
    closeArr: Array.from({ length: 50 }, (_, i) => 110 + i * 0.1), // 僅 50 筆
  },
  // 零持倉
  zeroPortfolio: {
    ...mockLatestReport,
    portfolio: {
      qty0050: 0,
      qtyZ2: 0,
      cash: 100000,
      totalLoan: 0,
      lastBuyDate: null,
    },
  },
  // 負現金 (槓桿過高)
  negativeCashPortfolio: {
    ...mockLatestReport,
    portfolio: {
      qty0050: 20000,
      qtyZ2: 10000,
      cash: -200000,
      totalLoan: 1500000,
      lastBuyDate: "2026-01-15",
    },
  },
};

/** 歷史月份 key 列表 (用於快取測試) */
export const requiredMonthKeys = [
  "202508",
  "202509",
  "202510",
  "202511",
  "202512",
  "202601",
  "202602",
  "202603",
  "202604",
  "202605",
  "202606",
  "202607",
  "202608",
];

/** 建立模擬股價歷史檔案內容 */
export function createMockStockHistory(stockNo, monthKey, count = 20) {
  const basePrice = stockNo === "0050" ? 170 : 110;
  return Array.from({ length: count }, (_, i) => ({
    date: `${monthKey.slice(0, 4)}-${monthKey.slice(4)}-${String(i + 1).padStart(2, "0")}`,
    open: basePrice + Math.random() * 2,
    high: basePrice + Math.random() * 3,
    low: basePrice - Math.random() * 2,
    close: basePrice + (Math.random() - 0.5) * 4,
    volume: Math.floor(Math.random() * 10000000) + 1000000,
  }));
}
