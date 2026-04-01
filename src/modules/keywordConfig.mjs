// keywordConfig.mjs
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

// ── 從 newsFetcher-3.mjs 搬移的靜態常數 ─────────────────────────────────────

/** 台灣市場 - 靜態搜尋關鍵字池 (18筆，請從 newsFetcher-3.mjs 搬移) */
export const baseTwQueries = [
  // ── 核心標的（標題，確保主角是它們）──────────────────
  { keyword: "台股", searchType: "intitle" },
  { keyword: "大盤", searchType: "intitle" },
  { keyword: "台積電 法說", searchType: "intitle" },
  { keyword: "台積電 ADR", searchType: "intitle" },
  { keyword: "台積電 外資", searchType: "intitle" },

  // ── 資金與籌碼面（廣泛）────────────────────────────
  { keyword: "外資", searchType: "broad" },
  { keyword: "三大法人", searchType: "broad" },
  { keyword: "融資 融券", searchType: "broad" },
  { keyword: "集中度 籌碼", searchType: "broad" },
  { keyword: "國安基金", searchType: "broad" },

  // ── 貨幣政策與流動性────────────────────────────────
  { keyword: "央行", searchType: "broad" },
  { keyword: "升息 降息", searchType: "broad" },
  { keyword: "新台幣", searchType: "broad" },

  // ── 基本面與經濟環境────────────────────────────────
  { keyword: "通膨", searchType: "broad" },
  { keyword: "出口", searchType: "broad" },
  { keyword: "外銷訂單", searchType: "broad" },
  { keyword: "景氣燈號", searchType: "broad" },
  { keyword: "PMI", searchType: "broad" },
];

/** 美國市場 - 靜態搜尋關鍵字池 (18筆，請從 newsFetcher-3.mjs 搬移) */
export const baseUsQueries = [
  // ── 核心指數（標題）────────────────────────────────
  { keyword: "S&P 500", searchType: "intitle" },
  { keyword: "Nasdaq", searchType: "intitle" },
  { keyword: "CPI", searchType: "intitle" },
  { keyword: "Dow Jones", searchType: "intitle" },

  // ── 貨幣政策與重要人物──────────────────────────────
  { keyword: "Federal Reserve", searchType: "broad" },
  { keyword: "Fed", searchType: "broad" },
  { keyword: "Powell", searchType: "broad" },
  { keyword: "FOMC", searchType: "broad" },

  // ── 資金流動性（新增整個區塊）──────────────────────
  { keyword: "Treasury yields", searchType: "broad" },
  { keyword: "dollar index", searchType: "broad" },
  { keyword: "credit spread", searchType: "broad" },
  { keyword: "liquidity", searchType: "broad" },

  // ── 總經指標────────────────────────────────────────
  { keyword: "inflation", searchType: "broad" },
  { keyword: "payrolls", searchType: "broad" },
  { keyword: "recession", searchType: "broad" },
  { keyword: "GDP", searchType: "broad" },
  { keyword: "jobless claims", searchType: "broad" },
  { keyword: "ISM", searchType: "broad" },
];

/** 台灣新聞 RSS URL 排除關鍵字 */
export const twExcludeKeywords = [
  { keyword: "排行", searchType: "intitle" },
  { keyword: "日法人", searchType: "intitle" },
  { keyword: "即時新聞", searchType: "intitle" },
  { keyword: "買超個股", searchType: "intitle" },
  { keyword: "賣超個股", searchType: "intitle" },
  { keyword: "前十大", searchType: "intitle" }
];

/** 美國新聞 RSS URL 排除關鍵字 */
export const usExcludeKeywords = [
  { keyword: "Q1 Earnings", searchType: "intitle" },
  { keyword: "Q2 Earnings", searchType: "intitle" },
  { keyword: "Q3 Earnings", searchType: "intitle" },
  { keyword: "Q4 Earnings", searchType: "intitle" },
  { keyword: "price target", searchType: "broad" },
  { keyword: "stock forecast", searchType: "broad" },
  { keyword: "Liquidity Pulse", searchType: "broad" },
  { keyword: "Liquidity Mapping", searchType: "broad" },
  { keyword: "Powell Industries", searchType: "intitle" }
];

// ── Blacklist 動態載入 ────────────────────────────────────────────────────────

const BLACKLIST_PATH = path.join(DATA_DIR, "config", "blacklist.json");

/**
 * 解析 JSON 中的 regex 字串
 * 支援兩種格式：
 *   - "/pattern/flags"  → 帶旗標
 *   - "pattern"         → 預設加上 /i 旗標
 */
function parseRegexString(str) {
  const withFlags = str.match(/^\/(.+)\/([gimsuy]*)$/s);
  if (withFlags) {
    return new RegExp(withFlags[1], withFlags[2]);
  }
  return new RegExp(str, "i");
}

/**
 * 載入 blacklist.json，回傳已解析的資料結構
 * @returns {Promise<{
 *   twExcludedSources: Set<string>,
 *   usExcludedSources: Set<string>,
 *   titleBlackListPatterns: RegExp[]
 * }>}
 */
export async function loadBlacklist() {
  const raw = await fs.readFile(BLACKLIST_PATH, "utf-8");
  const data = JSON.parse(raw);

  return {
    twExcludedSources: [...new Set(data.twExcludedSources)],
    usExcludedSources: [...new Set(data.usExcludedSources)],
    titleBlackListPatterns: data.titleBlackListPatterns.map(parseRegexString),
  };
}