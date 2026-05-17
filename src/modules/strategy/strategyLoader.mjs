import logger from "../../utils/logger.mjs";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { validateStrategyConfig } from "./strategySchema.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CUSTOM_STRATEGY_PATH = resolve(
  __dirname,
  "../../../data/config/Strategy.custom.json",
);
const DEFAULT_STRATEGY_PATH = resolve(
  __dirname,
  "../../../data/config/Strategy.default.json",
);

/**
 * 載入單一 Strategy JSON 檔案
 * @param {string} filePath - 檔案路徑
 * @returns {Promise<Object|null>}
 */
async function loadStrategyFile(filePath) {
  try {
    const text = await readFile(filePath, "utf-8");
    const json = JSON.parse(text);
    validateStrategyConfig(json);
    return json;
  } catch (err) {
    if (err.code === "ENOENT") {
      // 檔案不存在不需印 warn，屬預期行為 (例如 custom 檔可能不存在)
      return null;
    }
    logger.warn(
      { error: err.message, path: filePath },
      `⚠️ [StrategyLoader] 策略檔載入或驗證失敗`,
    );
    return null;
  }
}

/**
 * 策略配置門戶：自動判斷加載模式與備援 (Shadow Override)
 */
export async function fetchStrategyConfigUnified() {
  // 1. 優先嘗試讀取客戶自訂配置檔 (Shadow Override)
  let strategy = await loadStrategyFile(CUSTOM_STRATEGY_PATH);
  let source = "custom";

  // 2. 若無自訂檔或自訂檔毀損，讀取出廠預設值
  if (!strategy) {
    strategy = await loadStrategyFile(DEFAULT_STRATEGY_PATH);
    source = "default";
  }

  // 3. 失敗則嘗試 Archive 備份 (作為最後保底)
  if (!strategy) {
    strategy = await archiveManager.getStrategyCache();
    source = "archive";
  }

  if (!strategy) {
    throw new Error("[StrategyLoader] 所有策略來源均失效，系統無法啟動");
  }

  logger.info(
    { source, version: strategy.version || "Unknown" },
    `[StrategyLoader] 成功載入策略 (來源：${source}) v${strategy.version || "Unknown"}`,
  );
  return strategy;
}

// 支援測試指令：node src/modules/strategy/strategyLoader.mjs --test-merge
if (process.argv.includes("--test-merge")) {
  fetchStrategyConfigUnified()
    .then((s) => {
      logger.info("✅ 策略聚合測試成功！");
      logger.info(
        {
          version: s.version,
          description: s.description,
          buyRules: s.buy?.dropScoreRules?.length,
          valuationTiers: s.valuationGuard?.tiers?.length,
        },
        "核心欄位檢查",
      );
    })
    .catch((err) => {
      logger.error({ error: err.message }, "❌ 策略聚合測試失敗");
      process.exit(1);
    });
}
