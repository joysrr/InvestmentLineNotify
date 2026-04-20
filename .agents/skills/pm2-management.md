# Skill: PM2 & Infrastructure Management

## 核心限制
本專案運行於資源受限的 Oracle VM (Free Tier)。操作 PM2 服務時必須注意記憶體與 CPU 的消耗，避免觸發 OOM (Out of Memory) 導致系統當機。

## PM2 標準操作指令
- **檢視狀態**：`pm2 status` 或 `pm2 list`
- **檢視即時日誌**：`pm2 logs <app_name> --lines 100` (必須限制行數，避免輸出過載)
- **重啟服務**：`pm2 restart <app_name>` (若修改了環境變數，需使用 `pm2 restart <app_name> --update-env`)
- **監控資源**：`pm2 monit`

## 專案服務配置
請對照專案根目錄的 `ecosystem.config.cjs` (若有) 進行操作。
- 排程任務 (Cron Jobs) 通常以獨立進程或透過內部 Runner 啟動，請確保 `runDailyCheck`, `bot.mjs` 等核心進程處於 `online` 狀態。

## 錯誤排查 (Troubleshooting)
若發現服務處於 `errored` 或不斷重啟 (Crash Loop)：
1. 立即使用 `pm2 logs <app_name> --err` 抓取錯誤堆疊 (Error Stack)。
2. 檢查是否為 Port 衝突或 File-based JSON 被破壞導致無法解析 (`SyntaxError: Unexpected token`)。