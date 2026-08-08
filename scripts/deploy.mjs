#!/usr/bin/env node
/**
 * 部署腳本 - InvestmentLineNotify
 *
 * 用法:
 *   node scripts/deploy.mjs              # 完整部署 (含 pre-deploy 驗證)
 *   node scripts/deploy.mjs --dry-run    # 只跑 pre-deploy 驗證，不部署
 *   node scripts/deploy.mjs --skip-pre   # 跳過 pre-deploy，直接部署 (緊急時用)
 *
 * 環境變數需求 (本機 .env 或 shell export):
 *   VM_HOST=user@vm-ip
 *   VM_PATH=~/investnotify
 *   DEPLOY_DOMAIN=your-domain.duckdns.org (用於健康檢查)
 */

import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

// ─────────────────────────────────────────────────────────────────────────────
// 設定區 (可透過環境變數覆蓋)
// ─────────────────────────────────────────────────────────────────────────────
const VM_HOST = process.env.VM_HOST || "user@your-vm-ip";
const VM_PATH = process.env.VM_PATH || "~/investnotify";
const DEPLOY_DOMAIN = process.env.DEPLOY_DOMAIN || "your-domain.duckdns.org";
const LOGS_DIR = join(PROJECT_ROOT, "logs");

// ─────────────────────────────────────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────────────────────────────────────
function log(info, type = "info") {
  const prefix =
    { info: "ℹ️", ok: "✅", warn: "⚠️", error: "❌", step: "🔧" }[type] || "ℹ️";
  const msg = `[${new Date().toISOString()}] ${prefix} ${info}`;
  console.log(msg);
  return msg;
}

function runCmd(cmd, opts = {}) {
  const { stdio = "inherit", encoding = "utf8", silent = false } = opts;
  log(`$ ${cmd}`, "step");
  try {
    const result = execSync(cmd, {
      stdio,
      encoding,
      cwd: PROJECT_ROOT,
      ...opts,
    });
    return { ok: true, output: result };
  } catch (e) {
    return { ok: false, error: e.message, stdout: e.stdout, stderr: e.stderr };
  }
}

function runCmdSilent(cmd) {
  return runCmd(cmd, { stdio: "pipe", silent: true });
}

function sshExec(cmd) {
  return runCmd(`ssh ${VM_HOST} "${cmd}"`);
}

function getGitInfo() {
  const hash =
    runCmdSilent("git rev-parse --short HEAD").output?.trim() || "unknown";
  const branch =
    runCmdSilent("git rev-parse --abbrev-ref HEAD").output?.trim() || "unknown";
  const user = runCmdSilent("git config user.name").output?.trim() || "unknown";
  const msg = runCmdSilent("git log -1 --pretty=%s").output?.trim() || "";
  return { hash, branch, user, msg };
}

function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function writeDeployLog(content) {
  ensureLogsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = join(LOGS_DIR, `deploy-${timestamp}.log`);
  writeFileSync(logFile, content);
  log(`部署日誌已寫入: ${logFile}`, "ok");
  return logFile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telegram 系統訊息發送 (使用 TELEGRAM_LOG_API_TOKEN)
// ─────────────────────────────────────────────────────────────────────────────
async function sendTelegramSystemMessage(text) {
  // 動態 import 避免在非執行環境載入失敗
  try {
    const { sendSystemMessage } =
      await import("../src/modules/notifications/transports/telegramClient.mjs");
    await sendSystemMessage(text);
    log("Telegram 系統訊息已發送", "ok");
  } catch (e) {
    log(`Telegram 發送失敗 (不中斷部署): ${e.message}`, "warn");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 部署步驟
// ─────────────────────────────────────────────────────────────────────────────
async function stepPreDeploy() {
  log("執行 pre-deploy 完整驗證...", "step");
  const result = runCmd("npm run pre-deploy");
  if (!result.ok) {
    throw new Error("pre-deploy 驗證失敗，請修正後再部署");
  }
  log("pre-deploy 驗證通過", "ok");
}

function stepGitClean() {
  log("檢查 Git 工作目錄乾淨度...", "step");
  const status = runCmdSilent("git status --porcelain");
  if (status.output?.trim()) {
    throw new Error("工作目錄有未提交變更，請先 commit 或 stash");
  }
  log("Git 工作目錄乾淨", "ok");
}

function stepGitPush() {
  log("推送代碼到 GitHub...", "step");
  const result = runCmd("git push origin HEAD");
  if (!result.ok) {
    throw new Error("git push 失敗");
  }
  log("代碼已推送", "ok");
}

async function stepRemoteDeploy(gitInfo) {
  log("在 VM 上執行部署...", "step");

  const deployScript = `
    set -e
    cd ${VM_PATH}
    echo "📥 拉取最新代碼..."
    git pull
    echo "📦 安裝依賴 (含 dev)..."
    npm ci --include=dev
    echo "🏗️ 建置前端..."
    cd webapp && npm run build
    echo "🔄 重啟 PM2 服務..."
    cd .. && pm2 reload ecosystem.config.cjs --env production
    echo "⏳ 等待服務穩定..."
    sleep 3
    pm2 status
  `;

  const result = sshExec(deployScript);
  if (!result.ok) {
    throw new Error(`VM 部署失敗: ${result.error}`);
  }
  log("VM 部署完成", "ok");
}

async function stepHealthCheck() {
  log("執行健康檢查...", "step");

  // 1. HTTPS 健康檢查端點
  const healthUrl = `https://${DEPLOY_DOMAIN}/health`;
  let healthOk = false;
  for (let i = 0; i < 5; i++) {
    const result = runCmdSilent(`curl -sf --max-time 10 "${healthUrl}"`);
    if (result.ok) {
      healthOk = true;
      break;
    }
    log(`健康檢查重試 ${i + 1}/5...`, "warn");
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!healthOk) {
    throw new Error(`健康檢查失敗: ${healthUrl} 無回應`);
  }
  log(`健康檢查通過: ${healthUrl}`, "ok");

  // 2. PM2 服務狀態
  const pm2Result = sshExec(
    `pm2 list | grep -E 'api-server|bot-daemon' | grep online`,
  );
  if (!pm2Result.ok) {
    throw new Error("PM2 服務非 online 狀態");
  }
  log("PM2 服務正常運行", "ok");

  // 3. API 狀態端點
  const apiResult = runCmdSilent(
    `curl -sf --max-time 10 "https://${DEPLOY_DOMAIN}/api/status"`,
  );
  if (!apiResult.ok) {
    log("API /api/status 檢查失敗 (非阻斷)", "warn");
  } else {
    log("API 狀態端點正常", "ok");
  }
}

async function stepNotifySuccess(gitInfo, duration) {
  const text = [
    "✅ <b>部署成功</b>",
    "",
    `📦 Commit: <code>${gitInfo.hash}</code> (${gitInfo.branch})`,
    `📝 ${gitInfo.msg}`,
    `👤 部署者: ${gitInfo.user}`,
    `⏱️ 耗時: ${duration}s`,
    `🌐 <a href="https://${DEPLOY_DOMAIN}/health">健康檢查</a> 通過`,
    `🔧 PM2 服務正常`,
  ].join("\n");
  await sendTelegramSystemMessage(text);
}

async function stepNotifyFailure(gitInfo, error, duration) {
  const text = [
    "❌ <b>部署失敗</b>",
    "",
    `📦 Commit: <code>${gitInfo.hash}</code> (${gitInfo.branch})`,
    `👤 部署者: ${gitInfo.user}`,
    `⏱️ 已耗時: ${duration}s`,
    `💥 錯誤: ${error.message?.slice(0, 500) || error}`,
    "",
    "🔄 請檢查部署日誌並手動處理",
  ].join("\n");
  await sendTelegramSystemMessage(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipPre = args.includes("--skip-pre");
  const startTime = Date.now();

  const gitInfo = getGitInfo();
  const logLines = [
    `=== 部署開始 ===`,
    `時間: ${new Date().toISOString()}`,
    `Commit: ${gitInfo.hash} (${gitInfo.branch})`,
    `訊息: ${gitInfo.msg}`,
    `部署者: ${gitInfo.user}`,
    `模式: ${dryRun ? "Dry-run (僅驗證)" : skipPre ? "跳過 pre-deploy" : "完整部署"}`,
    `目標 VM: ${VM_HOST}:${VM_PATH}`,
    `健康檢查域名: ${DEPLOY_DOMAIN}`,
    "",
  ];

  try {
    log(`=== 部署開始 === ${dryRun ? "(Dry-run)" : ""}`, "info");
    log(`Commit: ${gitInfo.hash} | ${gitInfo.msg}`, "info");

    // 1. Pre-deploy 驗證
    if (!skipPre) {
      await stepPreDeploy();
      logLines.push("✅ pre-deploy 驗證通過");
    } else {
      logLines.push("⏭️ 跳過 pre-deploy");
    }

    if (dryRun) {
      logLines.push("");
      logLines.push("=== Dry-run 完成，未實際部署 ===");
      log("Dry-run 完成，未實際部署", "ok");
      writeDeployLog(logLines.join("\n"));
      return;
    }

    // 2. Git 檢查與推送
    stepGitClean();
    stepGitPush();
    logLines.push("✅ Git 推送完成");

    // 3. 遠端部署
    await stepRemoteDeploy(gitInfo);
    logLines.push("✅ VM 部署完成");

    // 4. 健康檢查
    await stepHealthCheck();
    logLines.push("✅ 健康檢查通過");

    const duration = Math.round((Date.now() - startTime) / 1000);
    logLines.push("");
    logLines.push(`=== 部署成功 === 總耗時: ${duration}s`);

    await stepNotifySuccess(gitInfo, duration);
    log(`=== 部署成功 === 總耗時: ${duration}s`, "ok");
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    logLines.push("");
    logLines.push(`=== 部署失敗 === 耗時: ${duration}s`);
    logLines.push(`錯誤: ${error.message}`);

    await stepNotifyFailure(gitInfo, error, duration);
    log(`=== 部署失敗 === ${error.message}`, "error");
    process.exitCode = 1;
  } finally {
    writeDeployLog(logLines.join("\n"));
  }
}

main();
