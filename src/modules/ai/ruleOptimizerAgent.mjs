import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { callAI, PROVIDERS } from "./aiClient.mjs";
import { createLangfuseScore } from "./langfuseClient.mjs";
import { archiveManager } from "../data/archiveManager.mjs";
import logger from "../../utils/logger.mjs";

const DATA_DIR = join(process.cwd(), "data");
const BLACKLIST_PATH = join(DATA_DIR, "config", "blacklist.json");
const GOLDEN_PATH = join(DATA_DIR, "config", "goldenDataset.json");
const HISTORY_PATH = join(DATA_DIR, "config", "optimizerHistory.json");
const NEWS_LOGS_DIR = join(DATA_DIR, "news_logs");

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `optimizer-local-${Date.now()}`;

// ── 常數：單次安全上限 ────────────────────────────────────────────────────────
const MAX_RULES_PER_RUN_PER_REGION = 5; // 單一 region 每次最多新增 5 條

// ============================================================
// 工具函式
// ============================================================

async function safeLangfuseScore(payload) {
  try {
    await createLangfuseScore(payload.traceId, payload.name, payload.value, {
      comment: payload.comment,
    });
  } catch (err) {
    logger.warn(
      { name: payload.name, error: err.message },
      "Langfuse score 寫入失敗",
    );
  }
}

/**
 * 掃描 news_logs 目錄，找最新一筆 passedArticles_{region}_*.json
 * YYYY-MM-DD 格式的字母排序自然對應時間遞增，不需要計算日期
 * @param {"TW"|"US"} region
 * @returns {{ filename: string, dateStr: string } | null}
 */
function findLatestLogFile(region) {
  let files;
  try {
    files = readdirSync(NEWS_LOGS_DIR);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  const prefix = `passedArticles_${region}_`;
  files = files
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
    logger.warn({ region }, "Optimizer 找不到任何 passedArticles 日誌，跳過");
    return { articles: [], dateStr: null };
  }
  const filePath = join(NEWS_LOGS_DIR, found.filename);
  logger.info({ region, filename: found.filename }, "Optimizer 讀取最新 log");
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

/** 關卡 2：非過度通用 / 非過度狹隘 */
export function isReasonablePattern(pattern) {
  const literal = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tooGeneric = /^[\w\s]{50,}$/;
  const tooSpecific = /\d{4}-\d{2}-\d{2}/;
  return !tooGeneric.test(literal) && !tooSpecific.test(literal);
}

/** 關卡 3：未出現在 golden dataset（避免誤殺） */
export function notInGoldenDataset(pattern, goldenDataset) {
  return !goldenDataset.some((a) => {
    const regex = new RegExp(pattern);
    return regex.test(a.title);
  });
}

/** 關卡 4：未出現在當前 blacklist（避免重複） */
export function notInBlacklist(pattern, blacklistData) {
  return !blacklistData.titleBlackListPatterns.includes(pattern);
}

/**
 * 四關卡驗證 + 準備最終可接受 / 拒絕清單
 * @returns {{ accepted: Array, rejected: Array }}
 */
function validateAndPrepare(rules, blacklistData, goldenDataset) {
  const accepted = [];
  const rejected = [];

  for (const rule of rules) {
    const { regex, reason } = rule;

    if (!regex || typeof regex !== "string") {
      rejected.push({ rule, rejectReason: "invalid_format" });
      continue;
    }

    if (!isValidRegex(regex, "")) {
      rejected.push({ rule, rejectReason: "invalid_syntax" });
      continue;
    }

    if (!isReasonablePattern(regex)) {
      rejected.push({ rule, rejectReason: "unreasonable_pattern" });
      continue;
    }

    if (!notInGoldenDataset(regex, goldenDataset)) {
      rejected.push({ rule, rejectReason: "golden_dataset_kill" });
      continue;
    }

    if (!notInBlacklist(regex, blacklistData)) {
      rejected.push({ rule, rejectReason: "already_in_blacklist" });
      continue;
    }

    accepted.push({
      regexLiteral: regex,
      reason,
      addedAt: new Date().toISOString(),
    });
  }

  return { accepted, rejected };
}

/** 追加至 blacklist.json */
function appendToBlacklist(accepted, blacklistData) {
  blacklistData.titleBlackListPatterns.push(
    ...accepted.map((r) => r.regexLiteral),
  );
  blacklistData.lastUpdated = new Date().toISOString();
}

/** 更新 optimizerHistory.json，追加本次執行紀錄 */
function updateOptimizerHistory(date, region, accepted, rejected) {
  let history = { lastUpdated: "", history: [] };

  try {
    history = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      logger.warn(
        { region, error: err.message },
        "Optimizer 讀取 optimizerHistory.json 失敗，使用空結構",
      );
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
  logger.info({ region }, "Optimizer optimizerHistory.json 已更新");
}

// ============================================================
// AI 呼叫
// ============================================================

async function callOptimizerAI(articleTitles, region) {
  const promptVariables = {
    regionLabel: region === "TW" ? "台股" : "美股",
    count: articleTitles.length,
    titlesText: articleTitles,
  };

  try {
    const { text, traceId } = await callAI("News/RuleOptimizer", {
      sessionId,
      provider: PROVIDERS.GEMINI,
      keyIndex: 2,
      promptVariables,
    });
    const parsed = JSON.parse(text || '{"rules":[]}');
    return { rules: parsed.rules || [], traceId };
  } catch (err) {
    logger.warn({ region, error: err.message }, "Optimizer AI 呼叫失敗");
    return { rules: [], traceId: null };
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
  let blacklistData, goldenDataset;
  try {
    blacklistData = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
  } catch (err) {
    throw new Error(`[Optimizer] 讀取 blacklist.json 失敗：${err.message}`);
  }
  try {
    goldenDataset = JSON.parse(readFileSync(GOLDEN_PATH, "utf-8"));
  } catch (err) {
    throw new Error(`[Optimizer] 讀取 goldenDataset.json 失敗：${err.message}`);
  }

  const results = {
    tw: { accepted: [], rejected: [] },
    us: { accepted: [], rejected: [] },
  };

  for (const region of ["TW", "US"]) {
    const key = region.toLowerCase();
    const { articles, dateStr } = readPassedArticles(region);
    if (!dateStr || articles.length === 0) {
      logger.info({ region }, "Optimizer 無文章資料，跳過");
      continue;
    }
    logger.info({ region, dateStr }, "Optimizer 分析日期");

    const titles = extractTitles(articles);
    logger.info(
      { region, titlesCount: titles.length },
      "Optimizer 清洗後標題數",
    );

    const { rules: aiRules, traceId } = await callOptimizerAI(titles, region);
    logger.info(
      { region, aiRulesCount: aiRules.length },
      "Optimizer AI 建議規則數",
    );

    const { accepted, rejected } = validateAndPrepare(
      aiRules,
      blacklistData,
      goldenDataset,
    );

    // ── 批次上限保護 ──────────────────────────────────────────────────────────
    if (accepted.length > MAX_RULES_PER_RUN_PER_REGION) {
      logger.warn(
        {
          region,
          acceptedCount: accepted.length,
          maxAllowed: MAX_RULES_PER_RUN_PER_REGION,
          cappedCount: accepted.length - MAX_RULES_PER_RUN_PER_REGION,
        },
        "Optimizer 單次通過規則數超過安全上限，截斷",
      );
      const capped = accepted.splice(MAX_RULES_PER_RUN_PER_REGION);
      rejected.push(
        ...capped.map((r) => ({ ...r, rejectReason: "batch_cap" })),
      );
    }

    logger.info(
      { region, accepted: accepted.length, rejected: rejected.length },
      "Optimizer 規則驗證結果",
    );

    const total = accepted.length + rejected.length;
    if (traceId && total > 0) {
      const goldenKills = rejected.filter(
        (r) => r.rejectReason === "golden_dataset_kill",
      ).length;

      const acceptRate = accepted.length / total;
      const goldenKillRate = goldenKills / total;

      await safeLangfuseScore({
        traceId,
        name: "Optimizer_Accept_Rate",
        value: acceptRate,
        comment: JSON.stringify({ accepted: accepted.length, total }),
      });

      await safeLangfuseScore({
        traceId,
        name: "Optimizer_Golden_Kill_Rate",
        value: goldenKillRate,
        comment: JSON.stringify({ goldenKills, total }),
      });
    }

    if (accepted.length > 0) {
      appendToBlacklist(accepted, blacklistData);
    }

    updateOptimizerHistory(dateStr, region, accepted, rejected);
    results[key] = { accepted, rejected };
  }

  writeFileSync(
    BLACKLIST_PATH,
    JSON.stringify(blacklistData, null, 2),
    "utf-8",
  );
  logger.info("Optimizer blacklist.json 已更新");

  await archiveManager
    .saveAiLog({ type: "RuleOptimizer", rawResult: results })
    .catch((err) =>
      logger.warn(
        { error: err.message },
        "Archive 儲存 RuleOptimizer 紀錄失敗",
      ),
    );

  return results;
}

/**
 * 依據 optimizerHistory.json 中的指定日期 + region 執行 rollback
 * 從 blacklist.json 中移除該批次新增的規則，並標記 history 中 rolledBack = true
 *
 * @param {string} date   - 欲 rollback 的日期（YYYY-MM-DD）
 * @param {"TW"|"US"|"ALL"} region - 指定 region，或 "ALL" 表示兩者一起
 * @returns {{ removed: number }}
 */
export function rollbackOptimizerRules(date, region = "ALL") {
  let history;
  try {
    history = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
  } catch (err) {
    logger.error({ error: err.message }, "Rollback 讀取 history 失敗");
    return { removed: 0 };
  }

  let blacklist;
  try {
    blacklist = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
  } catch (err) {
    logger.error({ error: err.message }, "Rollback 讀取 blacklist 失敗");
    return { removed: 0 };
  }

  const targets = history.history.filter(
    (h) =>
      h.date === date &&
      (region === "ALL" || h.region === region) &&
      h.rolledBack === false,
  );

  if (targets.length === 0) {
    logger.info({ date, region }, "Rollback 找不到可 rollback 的紀錄");
    return { removed: 0 };
  }

  let removed = 0;
  for (const entry of targets) {
    const rulesToRemove = new Set(entry.addedRules.map((r) => r.regexLiteral));
    const before = blacklist.titleBlackListPatterns.length;
    blacklist.titleBlackListPatterns = blacklist.titleBlackListPatterns.filter(
      (p) => !rulesToRemove.has(p),
    );
    const delta = before - blacklist.titleBlackListPatterns.length;
    removed += delta;
    entry.rolledBack = true;
    entry.rolledBackAt = new Date().toISOString();
    logger.info(
      { region: entry.region, date, removed: delta },
      "Rollback 移除規則",
    );
  }

  blacklist.lastUpdated = new Date().toISOString();
  writeFileSync(BLACKLIST_PATH, JSON.stringify(blacklist, null, 2), "utf-8");

  history.lastUpdated = new Date().toISOString();
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");

  logger.info({ removed }, "Rollback 完成，共移除規則數");
  return { removed };
}
