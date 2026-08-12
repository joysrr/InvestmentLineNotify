#!/usr/bin/env node
/**
 * deploy-local.mjs
 * 本地部署腳本 - 可獨立執行
 * 用法: node scripts/deploy-local.mjs [--rollback] [--tag TAG_NAME]
 */

import { deploymentExecutor } from "../src/modules/deployment/executor.mjs";
import { fileURLToPath } from "url";
import { resolve } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const PROJECT_ROOT = resolve(__dirname, "..");

// 載入環境變數
import "dotenv/config";

/**
 * 解析命令列參數
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    rollback: false,
    rollbackTarget: null,
    deployPath: process.env.DEPLOY_PATH || PROJECT_ROOT,
    pm2Ecosystem: process.env.PM2_ECOSYSTEM || "ecosystem.config.js",
    webappPath: process.env.WEBAPP_PATH || resolve(PROJECT_ROOT, "webapp"),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--rollback" || arg === "-r") {
      options.rollback = true;
    } else if (arg === "--tag" || arg === "-t") {
      options.rollbackTarget = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * 印出說明
 */
function printHelp() {
  console.log(`
部署腳本 - InvestmentLineNotify

用法:
  node scripts/deploy-local.mjs [選項]

選項:
  --rollback, -r          執行回滾到上一個部署版本
  --tag, -t TAG_NAME      指定回滾目標標籤 (需搭配 --rollback)
  --help, -h              顯示此說明

環境變數:
  DEPLOY_PATH             部署根目錄 (預設: 專案根目錄)
  PM2_ECOSYSTEM           PM2 生態配置檔 (預設: ecosystem.config.js)
  WEBAPP_PATH             前端專案目錄 (預設: DEPLOY_PATH/webapp)
  ADMIN_USER_IDS          管理員 Telegram user_id 列表 (逗號分隔)
  TELEGRAM_BOT_TOKEN      Telegram Bot Token (用於失敗通知)

範例:
  # 一般部署
  node scripts/deploy-local.mjs

  # 回滾到上一版本
  node scripts/deploy-local.mjs --rollback

  # 回滾到指定標籤
  node scripts/deploy-local.mjs --rollback --tag deploy-2026-08-11T10-30-00-000Z
`);
}

/**
 * 主程式
 */
async function main() {
  const options = parseArgs();

  // 檢查必要路徑
  if (!existsSync(options.deployPath)) {
    console.error(`❌ 部署路徑不存在: ${options.deployPath}`);
    process.exit(1);
  }

  if (!existsSync(options.webappPath)) {
    console.error(`❌ 前端路徑不存在: ${options.webappPath}`);
    process.exit(1);
  }

  const pm2ConfigPath = resolve(options.deployPath, options.pm2Ecosystem);
  if (!existsSync(pm2ConfigPath)) {
    console.error(`❌ PM2 配置檔不存在: ${pm2ConfigPath}`);
    process.exit(1);
  }

  console.log("🚀 開始部署流程...");
  console.log(`📁 部署路徑: ${options.deployPath}`);
  console.log(`📁 前端路徑: ${options.webappPath}`);
  console.log(`⚙️  PM2 配置: ${options.pm2Ecosystem}`);
  if (options.rollback) {
    console.log(`🔄 回滾模式${options.rollbackTarget ? ` (目標: ${options.rollbackTarget})` : ""}`);
  }

  try {
    // 建立部署任務
    const result = await deploymentExecutor.createDeployJob({
      deployPath: options.deployPath,
      pm2Ecosystem: options.pm2Ecosystem,
      webappPath: options.webappPath,
      rollback: options.rollback,
      rollbackTarget: options.rollbackTarget,
    });

    console.log(`📋 部署任務已建立: ${result.jobId}`);
    console.log(`📊 狀態: ${result.status}`);

    if (result.status === "queued") {
      // 等待部署完成 (輪詢狀態)
      console.log("⏳ 等待部署完成...");

      let completed = false;
      while (!completed) {
        await new Promise(r => setTimeout(r, 2000));
        const state = await deploymentExecutor.getJobState(result.jobId);

        if (state) {
          // 顯示最新日誌
          if (state.logs && state.logs.length > 0) {
            const lastLog = state.logs[state.logs.length - 1];
            if (!lastLog.displayed) {
              console.log(`  [${new Date(lastLog.timestamp).toLocaleTimeString()}] ${lastLog.level.toUpperCase()}: ${lastLog.message}`);
              lastLog.displayed = true;
            }
          }

          if (["completed", "failed", "cancelled"].includes(state.status)) {
            completed = true;
            console.log(`\n${state.status === "completed" ? "✅" : "❌"} 部署${state.status === "completed" ? "成功" : "失敗"}`);
            console.log(`⏱️  耗時: ${Math.round((state.completedAt - state.startedAt) / 1000)} 秒`);

            if (state.error) {
              console.log(`💥 錯誤: ${state.error}`);
            }

            if (state.deployTag) {
              console.log(`🏷️  部署標籤: ${state.deployTag}`);
            }

            process.exit(state.status === "completed" ? 0 : 1);
          }
        }
      }
    } else {
      console.error(`❌ 無法建立部署任務: ${result.message || "佇列中已有任務"}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ 部署過程發生錯誤: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`❌ 未預期的錯誤: ${err.message}`);
  process.exit(1);
});