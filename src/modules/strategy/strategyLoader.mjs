import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { validateStrategyConfig } from "./strategySchema.mjs";
import { archiveManager } from "../data/archiveManager.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PARTS_DIR = resolve(__dirname, "../../../data/config/parts");
const FALLBACK_STRATEGY_PATH = resolve(
  __dirname,
  "../../../data/config/Strategy.json",
);

/**
 * 載入並聚合策略設定子模組
 */
export async function loadModularStrategy() {
  const parts = [
    "SystemConfig.json",
    "AssetConfig.json",
    "IndicatorConfig.json",
    "GuardConfig.json",
  ];

  const merged = {};

  try {
    for (const part of parts) {
      const path = resolve(CONFIG_PARTS_DIR, part);
      const text = await readFile(path, "utf-8");
      const json = JSON.parse(text);
      Object.assign(merged, json);
    }

    // 驗證聚合後的完整物件
    validateStrategyConfig(merged);
    return merged;
  } catch (err) {
    console.warn(`⚠️ [StrategyLoader] 模組化加載失敗：${err.message}`);
    return null;
  }
}

/**
 * 載入單一 Strategy.json (舊版備援)
 */
async function loadLegacyStrategy() {
  try {
    const text = await readFile(FALLBACK_STRATEGY_PATH, "utf-8");
    const json = JSON.parse(text);
    validateStrategyConfig(json);
    return json;
  } catch (err) {
    console.warn(`⚠️ [StrategyLoader] 舊版備援讀取失敗：${err.message}`);
    return null;
  }
}

/**
 * 策略配置門戶：自動判斷加載模式與備援
 */
export async function fetchStrategyConfigUnified() {
  // 1. 優先嘗試模組化加載
  let strategy = await loadModularStrategy();
  let source = "modular";

  // 2. 失敗則嘗試舊版單一文件
  if (!strategy) {
    strategy = await loadLegacyStrategy();
    source = "legacy";
  }

  // 3. 最後嘗試 Archive 備份
  if (!strategy) {
    strategy = await archiveManager.getStrategyCache();
    source = "archive";
  }

  if (!strategy) {
    throw new Error("[StrategyLoader] 所有策略來源均失效，系統無法啟動");
  }

  console.log(
    `[StrategyLoader] 成功載入策略 (來源: ${source}) v${strategy.version || "Unknown"}`,
  );
  return strategy;
}

// 支援測試指令：node src/modules/strategy/strategyLoader.mjs --test-merge
if (process.argv.includes("--test-merge")) {
  fetchStrategyConfigUnified()
    .then((s) => {
      console.log("✅ 策略聚合測試成功！");
      console.log("核心欄位檢查：");
      console.log(`- Version: ${s.version}`);
      console.log(`- Description: ${s.description}`);
      console.log(`- Buy Rules: ${s.buy?.dropScoreRules?.length} 條`);
      console.log(`- Valuation Tiers: ${s.valuationGuard?.tiers?.length} 條`);
    })
    .catch((err) => {
      console.error("❌ 策略聚合測試失敗：", err.message);
      process.exit(1);
    });
}
