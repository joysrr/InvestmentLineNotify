import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { callAI, PROVIDERS } from "./aiClient.mjs";
import { RULE_OPTIMIZER_SCHEMA, buildOptimizerPrompt } from "./prompts.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

const DATA_DIR = join(process.cwd(), "data");
const BLACKLIST_PATH = join(DATA_DIR, "config", "blacklist.json");
const GOLDEN_PATH = join(DATA_DIR, "config", "goldenDataset.json");
const HISTORY_PATH = join(DATA_DIR, "config", "optimizerHistory.json");
const NEWS_LOGS_DIR = join(DATA_DIR, "news_logs");

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `optimizer-local-${Date.now()}`;

// ============================================================
// 工具函式
// ============================================================

/**
 * 掃描 news_logs 目錄，找最新一筆 passedArticles_{region}_*.json
 * YYYY-MM-DD 格式的字母排序自然對應時間遞增，不需要計算日期
 * @param {"TW"|"US"} region
 * @returns {{ filename: string, dateStr: string } | null}
 */
function findLatestLogFile(region) {
  if (!existsSync(NEWS_LOGS_DIR)) return null;
  const prefix = `passedArticles_${region}_`;
  const files = readdirSync(NEWS_LOGS_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort(); // 字母排序 = 時間遞增，最後一個即最新
  if (files.length === 0) return null;
  const filename = files[files.length - 1];
  const dateStr = filename.replace(prefix, "").replace(".json", "");
  return { filename, dateStr };
}

/**
 * 讀取指定 region 的 passedArticles 日誌，自動找最新 log
 * @param {"TW"|"US"} region
 * @returns {Array<Object>}
 */
function readPassedArticles(region) {
  const found = findLatestLogFile(region);
  if (!found) {
    console.warn(`[Optimizer] ⚠️  找不到任何 passedArticles_${region}_*.json，跳過`);
    return { articles: [], dateStr: null };
  }
  const filePath = join(NEWS_LOGS_DIR, found.filename);
  console.log(`[Optimizer] ${region} 讀取最新 log：${found.filename}`);
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  return { articles: data.articles || [], dateStr: found.dateStr };
}

/**
 * 清除標題中的來源尾綴，例如：「台積電法說 - 經濟日報」→「台積電法說」
 */
function normalizeTitle(title) {
  return title.replace(/\s*-\s*[^-]{2,40}$/, "").trim();
}

/**
 * 從 articles 陣列中萃取去重後的標題清單
 */
function extractTitles(articles) {
  const seen = new Set();
  return articles
    .map((a) => normalizeTitle(a.title))
    .filter((t) => t.length > 5 && !seen.has(t) && seen.add(t));
}

// ============================================================
// Sandbox 驗證（四關卡）— 均 export，供測試腳本直接呼叫
// ============================================================

/** 關卡 1：Regex 語法合法性 */
export function isValidRegex(pattern, flags) {
  try {
    new RegExp(pattern, flags);
    return true;
  } catch {
    return false;
  }
}

/**
 * 關卡 2：廣泛度防護
 *
 * 判斷規則：
 * - .* / .+ / \w+ 開頭 → 直接視為廣泛（主體即為通配）
 * - .{...} 開頭 → 廣泛
 * - \d+ 開頭時「例外處理」：
 *   若 \d+ 後接有具體語意的文字（如「stocks? to buy」「(檔|支)...必買」），
 *   則視為精確規則，不觸發廣泛警告。
 *   僅當 \d+ 後只剩空字串或純通配符時，才視為廣泛。
 *
 * 設計動機：
 *   現有黑名單已有 "/\\d+ inflation-resistant stock/i" 這類合法規則，
 *   若把所有 \d+ 開頭都擋下會造成誤判。
 */
const OVERBROAD_HEAD_TESTS = [
  /^\.\*/,  // .* 開頭
  /^\.\+/,  // .+ 開頭
  /^\\w\+/, // \w+ 開頭
  /^\.\{/,  // .{...} 開頭
];

// 純通配符字元集（用來判斷 \d+ 後面是否「沒有實質語意內容」）
const WILDCARD_ONLY_RE = /^[.*+?{}\[\]\\|() \t\d]*$/;

export function isOverbroad(pattern) {
  const p = pattern.trim();

  // 主要通配開頭檢查
  if (OVERBROAD_HEAD_TESTS.some((t) => t.test(p))) return true;

  // \d+ 開頭的精細判斷
  if (/^\\d\+/.test(p)) {
    const afterDigit = p.replace(/^\\d\+/, "");
    // 後面是空字串或只剩通配符 → 廣泛
    if (afterDigit === "" || WILDCARD_ONLY_RE.test(afterDigit)) return true;
    // 後面有具體文字（如 stocks?、檔|支、inflation 等）→ 不廣泛
    return false;
  }

  return false;
}

/** 將 { pattern, flags } 轉換為 blacklist.json 字串格式 "/pattern/flags" */
export function toRegexLiteral(pattern, flags) {
  return `/${pattern}/${flags ?? ""}`;
}

/** 關卡 3：與既有規則重複（字串比對，配合 blacklist.json 實際格式） */
export function isDuplicate(pattern, flags, existingPatterns) {
  const candidate = toRegexLiteral(pattern, flags);
  return existingPatterns.includes(candidate);
}

/**
 * 關卡 4：黃金清單碰撞測試
 * @param {RegExp} newRegex
 * @param {Array<{title: string}>} goldenItems
 */
export function passesGoldenTest(newRegex, goldenItems) {
  return !goldenItems.some((item) => newRegex.test(item.title));
}

/**
 * 完整 Sandbox 驗證流程（四關卡依序執行）
 * @param {Array<{pattern, flags, reason}>} aiRules
 * @param {Object} blacklist - blacklist.json raw JSON
 * @param {Array<{title}>} goldenDataset
 * @returns {{ accepted: Array, rejected: Array }}
 */
export function validateAndPrepare(aiRules, blacklist, goldenDataset) {
  const accepted = [];
  const rejected = [];

  for (const rule of aiRules) {
    // 關卡 1：語法合法性
    if (!isValidRegex(rule.pattern, rule.flags)) {
      rejected.push({ ...rule, rejectReason: "invalid_regex" });
      continue;
    }
    // 關卡 2：廣泛度防護
    if (isOverbroad(rule.pattern)) {
      rejected.push({ ...rule, rejectReason: "overbroad" });
      continue;
    }
    // 關卡 3：重複規則（字串比對 raw JSON）
    if (isDuplicate(rule.pattern, rule.flags, blacklist.titleBlackListPatterns)) {
      rejected.push({ ...rule, rejectReason: "duplicate" });
      continue;
    }
    // 關卡 4：黃金清單碰撞（硬性防線）
    const regex = new RegExp(rule.pattern, rule.flags);
    if (!passesGoldenTest(regex, goldenDataset)) {
      rejected.push({ ...rule, rejectReason: "golden_dataset_kill" });
      continue;
    }

    accepted.push({
      regexLiteral: toRegexLiteral(rule.pattern, rule.flags),
      reason: rule.reason,
    });
  }

  return { accepted, rejected };
}

// ============================================================
// 檔案讀寫
// ============================================================

/** 將通過驗證的規則 append 到 blacklist.json（in-memory mutation） */
function appendToBlacklist(accepted, blacklistData) {
  blacklistData.titleBlackListPatterns.push(...accepted.map((r) => r.regexLiteral));
  blacklistData.lastUpdated = new Date().toISOString();
}

/** 更新 optimizerHistory.json，追加本次執行紀錄 */
function updateOptimizerHistory(date, region, accepted, rejected) {
  let history = { lastUpdated: "", history: [] };

  if (existsSync(HISTORY_PATH)) {
    try {
      history = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
    } catch {
      console.warn("[Optimizer] ⚠️  讀取 optimizerHistory.json 失敗，使用空結構");
    }
  }

  history.history.push({
    date,
    region,
    addedRules: accepted,
    rejectedRules: rejected,
    savedAt: new Date().toISOString(),
    rolledBack: false,
  });

  history.lastUpdated = new Date().toISOString();
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
  console.log(`[Optimizer] 📒 optimizerHistory.json 已更新（${region}）`);
}

// ============================================================
// AI 呼叫
// ============================================================

async function callOptimizerAI(articleTitles, region) {
  const userPrompt = buildOptimizerPrompt(articleTitles, region);

  try {
    const rawJson = await callAI("RuleOptimizer", userPrompt, {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 2,
      responseSchema: RULE_OPTIMIZER_SCHEMA,
    });
    const parsed = JSON.parse(rawJson || '{"rules":[]}');
    return parsed.rules || [];
  } catch (err) {
    console.warn(`[Optimizer] ⚠️  AI 呼叫失敗 (${region}):`, err.message);
    return [];
  }
}

// ============================================================
// 主流程
// ============================================================

/**
 * 執行每日黑名單優化
 * @returns {Promise<{ tw: { accepted, rejected }, us: { accepted, rejected } }>}
 */
export async function runRuleOptimizer() {
  if (!existsSync(BLACKLIST_PATH)) {
    throw new Error(`[Optimizer] blacklist.json 不存在：${BLACKLIST_PATH}`);
  }
  if (!existsSync(GOLDEN_PATH)) {
    throw new Error(`[Optimizer] goldenDataset.json 不存在：${GOLDEN_PATH}`);
  }

  const blacklistData = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
  const goldenDataset = JSON.parse(readFileSync(GOLDEN_PATH, "utf-8"));

  const results = {
    tw: { accepted: [], rejected: [] },
    us: { accepted: [], rejected: [] },
  };

  for (const region of ["TW", "US"]) {
    const key = region.toLowerCase();
    const { articles, dateStr } = readPassedArticles(region);
    if (!dateStr || articles.length === 0) {
      console.log(`[Optimizer] ${region} 無文章資料，跳過`);
      continue;
    }
    console.log(`[Optimizer] 🗓️  ${region} 分析日期：${dateStr}`);

    const titles = extractTitles(articles);
    console.log(`[Optimizer] ${region} 清洗後標題數：${titles.length}`);

    const aiRules = await callOptimizerAI(titles, region);
    console.log(`[Optimizer] ${region} AI 建議規則數：${aiRules.length}`);

    const { accepted, rejected } = validateAndPrepare(aiRules, blacklistData, goldenDataset);
    console.log(`[Optimizer] ${region} ✅ 通過：${accepted.length}  ❌ 拒絕：${rejected.length}`);

    if (accepted.length > 0) {
      appendToBlacklist(accepted, blacklistData);
    }

    updateOptimizerHistory(dateStr, region, accepted, rejected);
    results[key] = { accepted, rejected };
  }

  writeFileSync(BLACKLIST_PATH, JSON.stringify(blacklistData, null, 2), "utf-8");
  console.log("[Optimizer] 💾 blacklist.json 已更新");

  await archiveManager
    .saveAiLog({ type: "RuleOptimizer", rawResult: results })
    .catch((err) => console.warn("⚠️ [Archive] 儲存 RuleOptimizer 紀錄失敗:", err.message));

  return results;
}
