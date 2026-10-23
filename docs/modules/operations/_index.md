---
type: reference
status: current
last_updated: 2026-09-10
last_verified: 2026-09-10
related_code:
  - src/scheduler/newsFetch.mjs
  - src/dailyCheck.mjs
tags:
  - operations
  - deployment
  - scheduling
  - monitoring
wiki_links:
  - [[AI News]]
  - [[Telegram Bot]]
---

# 運維層 (Operations Layer)

> **摘要**: 系統部署、排程、監控與維護

## 模組列表

- [Environment Variables](env_vars.md) - 環境變數設定
- [Schedules](schedules.md) - Cron 排程管理
- [Deployment](deployment_oracle_vm.md) - Oracle VM 部署指南
- [Host Deployment Agent](../../operations/deployment-agent.md) - Unix socket Host 部署代理
- [Production Code Deployment](../../operations/production-code-deploy.md) - 程式碼部署與驗證
- [Automated Deployment Milestone](../../operations/automated-deployment-milestone.md) - 自動化開發與正式部署里程碑

## 概念關係

- [[AI News]] - 依賴排程觸發
- [[Telegram Bot]] - Bot 部署
- [[Strategy Engine]] - 策略排程

---

## 運維架構

```
┌─────────────────────────────────────┐
│           系統架構                    │
├─────────────────────────────────────┤
│                                     │
│  🕐 Cron 排程 (System Crontab)      │
│  - 每日 dailyCheck (07:00)           │
│  - 每 3 小時 newsFetch (07:00-22:00)  │
│  - 每週 weeklyReport (週日)          │
│  - 每月 monthlyReport (月初)         │
│                                     │
│  🤖 Telegram Bot (Long-Polling)     │
│  - 指令處理 /daily, /news, /weekly  │
│  - 手動觸發                        │
│                                     │
│  📊 Langfuse (Observability)        │
│  - Trace, Observation, Score       │
│                                     │
└─────────────────────────────────────┘
```
