---
skill_id: backend-scheduler-rules
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @Backend 排程任務（cron job）開發規範完整細則：日誌 / 冪等 / 失敗通知 /
  超時保護 / 並行防護強制條款。
  自 rules/backend.md §s04 搬入。
referenced_by:
  - rules/backend.md §s04
related_skill:
  - skills/concurrency-guard-pattern.md
---

# Skill: @Backend 排程任務開發規範

所有排程任務（cron job）的實作，**除了**核心行為準則外，必須額外遵守以下規範。

## 必要實作項目

### 1. 執行日誌

每次排程觸發時必記錄：

- 觸發時間 / 執行結果（成功/失敗）/ 處理筆數
- 格式：`[SCHEDULER][<任務名稱>] <狀態> at <時間> | processed: <N> records`

### 2. 冪等性保證

同一排程任務在相同時間視窗內重複觸發，不可重複發送通知。

**實作方式**：使用執行時間戳或 `data/` 下狀態檔記錄「已處理」資料範圍。

### 3. 靜默失敗防護

任務執行完畢後**必主動確認輸出是否符合預期**。

例：Telegram Bot 發送後，確認 API 回應為成功狀態，不可僅依「無例外＝成功」假設。

### 4. 失敗通知

連續失敗 ≥ **2 次** → 必透過 Telegram Bot 向指定聊天室發送告警：

> 🚨 排程任務失敗：`<任務名稱>` 已連續失敗 <N> 次，請檢查系統狀態。

### 5. 超時保護

每個排程任務必設定最大執行時間上限；超時強制中止 + 記錄告警。

## 禁止事項

- 禁止在排程任務中使用全域變數儲存跨次執行狀態（用檔案 / 明確狀態管理）
- 禁止排程任務間直接依賴（A 完成才觸發 B）；應透過獨立狀態檔協調

## 並行防護強制條款

**強制要求**：所有涉及 File 寫入的排程任務**必須**實作 `skills/concurrency-guard-pattern.md` 標準模式之一：

1. 原子鎖（`fs.openSync 'wx'` 模式）
2. 批次寫入原子性（tmp + `renameSync`）
3. Cron job 重入防護（`SCHEDULER_LOCK`）

**違反處理**：

- 未實作並行防護 → `@Reviewer` 標 🔴 `[BLOCKER]`
- `existsSync + writeFileSync` 分段寫法 → 🔴 `[BLOCKER]`（零容忍）
- **絕對禁止** 以「單機執行無並發」為由豁免

> **互引**：`@Reviewer` 對 cron 並行防護的審查條款 → `skills/checklists/reviewer-critical-path-checklist.md` §路徑 3 資料寫入路徑（最後一項 TOCTOU 鐵律已移交 @Security SC-06）

<!-- END: backend-scheduler-policy -->
