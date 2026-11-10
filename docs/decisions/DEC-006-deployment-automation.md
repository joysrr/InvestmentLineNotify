---
type: explanation
status: archived
completed_date: 2026-08-13
last_updated: 2026-09-10
tags:
  - deployment
  - automation
  - docker
wiki_links:
  - [[Telegram Bot]]
  - [[Operations]]
---

# DEC-006: Phase 4 架構決策 - 部署自動化與 Mini App 遠端部署

**日期**: 2026-08-12  
**狀態**: 📦 已封存 (Archived / 後續生產環境改由 Oracle VM 宿主端獨立部署腳本與 Unix Domain Socket 控管，避免 WebApp 直接暴露高權限執行端口)  
**類別**: 架構/基礎設施/部署  
**相關**: Phase 4.3, DEC-24

## 背景

Phase 4.3 需要實作單機部署自動化：Git pull → npm ci → build → pm2 reload，並提供 Mini App 遠端部署按鈕與回滾功能。

## 決策

採用 **Systemd 服務 + Fastify 部署 API + 前端 DeployButton.vue** 架構：

- **部署執行器**: `src/modules/deployment/executor.mjs` - git pull、npm ci、vite build、pm2 reload、健康檢查
- **部署佇列**: 記憶體佇列支援排隊、狀態追蹤、WebSocket 即時日誌流
- **API 端點**: `/api/deploy/*` - 觸發部署、查詢狀態、取消、回滾、日誌流 (adminGuard 保護)
- **前端組件**: `DeployButton.vue` - 一鍵部署、即時日誌、進度顯示、回滾按鈕
- **Systemd 服務**: `investment-line-notify.service` - 開機自啟、自動重啟、日誌旋轉

## 替代方案評估

| 方案                         | 優點                                | 缺點                         | 決策              |
| ---------------------------- | ----------------------------------- | ---------------------------- | ----------------- |
| A: Systemd + API + Vue       | 完整自動化、Mini App 整合、回滾支援 | 較複雜                       | ✅ 採納           |
| B: 手動腳本 deploy-local.mjs | 簡單、可控                          | 無 Mini App 整合、無即時回饋 | ❌ (保留作為備用) |
| C: GitHub Actions + SSH      | CI/CD 標準                          | 需外部 CI、違反 DEC-24       | ❌                |

## 實作檔案

- `src/modules/deployment/executor.mjs` - 部署執行核心邏輯
- `src/modules/deployment/queue.mjs` - 記憶體佇列與 WebSocket 推送
- `src/api/routes/deployRoutes.mjs` - 部署 API (adminGuard)
- `webapp/src/components/DeployButton.vue` - 前端部署按鈕組件
- `deploy-local.mjs` - CLI 部署腳本 (支援 --rollback)
- `investment-line-notify.service` - Systemd 服務單元

## 影響

- 單機零外部依賴部署
- Mini App 使用者可一鍵部署並即時觀察日誌
- 回滾機制保障部署失敗時快速恢復
