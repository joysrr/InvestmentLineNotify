// src/runSocialSentimentFetch.mjs
//
// 職責：Telegram Bot /sentiment 指令用 — 手動觸發社群情緒快照生成。
// 呼叫 social-sentiment-optimizer 的 daily_snapshot.py，
// 產生 data/sentiment/social_sentiment_daily.json 供 InvestmentLineNotify 使用。
//
// 此指令會覆蓋現有 social_sentiment_daily.json，
// 但不影響 han-investment-news-collector.sh 的正常排程。

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./utils/logger.mjs";
import { DEFAULT_SENTIMENT_FILE_PATH } from "./modules/providers/socialSentimentProvider.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * 動態解析 social-sentiment-optimizer 專案根目錄
 * 遵循專案慣例：優先同層相對目錄 ../social-sentiment-optimizer，或由環境變數覆蓋
 */
export function resolveOptimizerRoot() {
  if (process.env.SOCIAL_OPTIMIZER_PATH) {
    return path.resolve(process.env.SOCIAL_OPTIMIZER_PATH);
  }

  // 嘗試相對路徑：專案同層 (如 /home/ubuntu/social-sentiment-optimizer 或 /workspace/projects/social-sentiment-optimizer)
  const siblingPath = path.resolve(
    PROJECT_ROOT,
    "..",
    "social-sentiment-optimizer",
  );
  if (fs.existsSync(siblingPath)) {
    return siblingPath;
  }

  // 嘗試專案內部子目錄
  const nestedPath = path.resolve(PROJECT_ROOT, "social-sentiment-optimizer");
  if (fs.existsSync(nestedPath)) {
    return nestedPath;
  }

  return siblingPath;
}

/**
 * 手動觸發 daily_snapshot.py 生成社群情緒快照。
 *
 * @returns {Promise<{success: boolean, outputPath: string, stdout?: string, stderr?: string, error?: string}>}
 */
export async function runSocialSentimentFetch() {
  logger.info("💬 [SocialSentiment] 開始手動觸發社群情緒快照生成...");

  const optimizerRoot = resolveOptimizerRoot();
  const outputPath = DEFAULT_SENTIMENT_FILE_PATH;
  const historyFile = path.resolve(
    optimizerRoot,
    "data",
    "raw",
    "news_history.jsonl",
  );
  const priceFile = path.resolve(
    optimizerRoot,
    "data",
    "raw",
    "price_history.jsonl",
  );

  if (!fs.existsSync(optimizerRoot)) {
    const errorMsg = `找不到社群分析模組目錄: ${optimizerRoot}`;
    logger.error(errorMsg);
    return {
      success: false,
      outputPath,
      error: errorMsg,
    };
  }

  const args = [
    "-m",
    "social_optimizer.daily_snapshot",
    "--history",
    historyFile,
    "--price-history",
    priceFile,
    "--output",
    outputPath,
  ];

  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    const child = execFile(
      "python3",
      args,
      {
        cwd: optimizerRoot,
        timeout: 60000,
        env: {
          ...process.env,
          PYTHONPATH: `${path.resolve(optimizerRoot, "src")}:${process.env.PYTHONPATH || ""}`,
        },
      },
      (err, stdout, stderr) => {
        if (err) {
          logger.error(err, "❌ [SocialSentiment] daily_snapshot.py 執行失敗");
          safeResolve({
            success: false,
            outputPath,
            stdout,
            stderr,
            error: err.message,
          });
          return;
        }

        if (stderr) {
          logger.warn(
            stderr,
            "⚠️ [SocialSentiment] daily_snapshot.py 有 stderr 輸出",
          );
        }

        logger.info(`✅ [SocialSentiment] 社群情緒快照已更新: ${outputPath}`);
        safeResolve({
          success: true,
          outputPath,
          stdout,
          stderr,
        });
      },
    );

    child.on("error", (error) => {
      logger.error(error, "❌ [SocialSentiment] Child process error");
      safeResolve({
        success: false,
        outputPath,
        stdout: "",
        stderr: error.message,
        error: `Child process error: ${error.message}`,
      });
    });
  });
}
