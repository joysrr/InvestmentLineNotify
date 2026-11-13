---
type: plan
status: phase-2-completed
last_updated: 2026-11-13
tags:
  - webapp
  - refactor
  - phase-2
wiki_links: []
---

# WebApp 重構總覽計畫

文件位置：docs/webapp-refactor-plan.md
適用範圍：webapp/ 前端子專案

## 一、計畫總覽

| 階段 | 名稱                          | 狀態                     | 說明                                                                                         |
| ---- | ----------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| 一   | 工程基礎與設計令牌            | 已完成（main @ a505650） | 詳見 `docs/refactor/phase-1-foundation.md`                                                   |
| 二   | 通用卡片組件提取與 Emoji 清理 | 已完成（main @ c65e2dd） | 詳見 `docs/refactor/phase-2-foundation.md` 與 `docs/refactor/phase-2-migration-inventory.md` |

**階段二狀態**：已完成（main @ c65e2dd 之後）。
子項目：

- 2.1 通用卡片組件提取（ContentCard/StatCard）—— 已完成，21/21 卡片遷移
- 2.2 圖標系統與 Emoji 清理 —— 已完成，Icon.vue 擴展，Emoji→Icon 遷移
- 2.3 可摺疊區段組件（CollapsibleSection）—— 已完成，所有 ad-hoc pattern 遷移
- 2.4 Phase 2 補做計畫（B1–B12）—— 已完成，詳見 `docs/refactor/phase-2-remediation.md`

## 二、子計畫清單

- 1.1 工程基礎與啟動效能（已完成）
- 1.2 設計令牌與 Telegram 主題對齊（已完成）

**階段三至七說明**：階段三至七視 Phase 2 補做完成後再制定，時間表不急（單一開發者，舊版生產版本仍運行中）。 2.1 通用卡片組件提取完成後，才會展開階段三至七（資訊架構／重複內容／逐頁精修／平台特性／驗證機制）。目前僅規劃至階段二，階段三至七內容留待後續補充，非誤刪。
