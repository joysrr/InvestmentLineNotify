// src/runSocialSentimentFetch.mjs
//
// 職責：Telegram Bot /sentiment 指令用 — 手動觸發社群情編快照生成。
// 呼叫 social-sentiment-optimizer 的 daily_snapshot.py，
// 產生 data/sentiment/social_sentiment_daily.json 供 InvestmentLineNotify 使用。
//
// 此指令會覆蓋現有 social_sentiment_daily.json，
// 但不影響 han-investment-news-collector.sh 的正常排程。

import { execFile } from "child_process";
import logger from "./utils/logger.mjs";

const OPTIMIZER_ROOT = "/workspace/projects/social-sentiment-optimizer";
const OUTPUT_PATH =
  "/workspace/projects/InvestmentLineNotify/data/sentiment/social_sentiment_daily.json";
const HISTORY_FILE = `${OPTIMIZER_ROOT}/data/raw/news_history.jsonl`;
const PRICE_FILE = `${OPTIMIZER_ROOT}/data/raw/price_history.jsonl`;

/**
 * 手動觸發 daily_snapshot.py 生成社群情緒快照。
 *
 * @returns {Promise<{success: boolean, outputPath: string, stdout?: string, stderr?: string, error?: string}>}
 */
export async function runSocialSentimentFetch() {
  logger.info("💬 [SocialSentiment] 開始手動觸發社群情緻快照生成...");

  const args = [
    "-m",
    "social_optimizer.daily_snapshot",
    "--history",
    HISTORY_FILE,
    "--price-history",
    PRICE_FILE,
    "--output",
    OUTPUT_PATH,
  ];

  return new Promise((resolve) => {
    const child = execFile(
      "python3",
      args,
      {
        cwd: OPTIMIZER_ROOT,
        timeout: 60000, // 60 second timeout
        env: {
          ...process.env,
          PYTHONPATH: `${OPTIMIZER_ROOT}/src:${process.env.PYTHONPATH || ""}`,
        },
      },
      (err, stdout, stderr) => {
        if (err) {
          logger.error(err, "❌ [SocialSentiment] daily_snapshot.py 執行失敗");
          resolve({
            success: false,
            outputPath: OUTPUT_PATH,
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

        logger.info(`✅ [SocialSentiment] 社群情緻快照已更新: ${OUTPUT_PATH}`);
        resolve({
          success: true,
          outputPath: OUTPUT_PATH,
          stdout,
          stderr,
        });
      },
    );

    // Handle child process error (e.g., python3 not found, module not found)
    child.on("error", (error) => {
      logger.error(error, "❌ [SocialSentiment] Child process error");
      resolve({
        success: false,
        outputPath: OUTPUT_PATH,
        stdout: "",
        stderr: error.message,
        error: `Child process error: ${error.message}`,
      });
    });
  });
}
