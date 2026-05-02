---
task_id: pending-actions-recovery
file_type: workflow
owner: "@Assistant + @Lead"
version: v1.0
last_modified: 2026-05-01
last_proposal: PROPOSAL_20260501_004
purpose: |
  PENDING_ACTIONS.md 損毀 / 缺失 / 格式無效時的恢復流程；確保 @Lead stateless routing
  狀態錨點不致永久失效（對齊 ADR-0001 三鐵律 + system-prompt §條件 2 損毀恢復補充）。
referenced_by:
  - rules/system-prompt.md
  - rules/assistant.md
  - rules/lead.md
related_decisions:
  - ADR-0001 # Stateless Routing；本任務為其錨點檔災後復原
---

# Task: PENDING_ACTIONS.md Recovery

## 觸發條件

任一發生時啟動本流程：

1. **不存在**：`PENDING_ACTIONS.md` 檔案缺失（@Lead 派發前讀檔失敗）
2. **格式無效**：YAML / 結構不合 schema（schema 偵測失敗）
3. **計數不一致**：與 ROUTING_TICKET.md 或最近對話歷史明顯漂移
4. **手動觸發**：User 下令「修復 PENDING_ACTIONS」

## 恢復策略（依優先序）

### 策略 A：從 .bak 還原（首選）

@Assistant 巡邏寫入 PENDING_ACTIONS.md 前**必先寫 backup**：`PENDING_ACTIONS.md.bak`（覆蓋舊 .bak）。

恢復步驟：

1. @Assistant 偵測損毀 → 自動產 🔴 `PENDING_ACTIONS_CORRUPTED`（巡邏 P-25）
2. @Lead 收到 → 確認 `.bak` 存在 + 時間戳合理（< 1 工作對話）
3. 提示 User：「PENDING_ACTIONS.md 損毀；建議從 `.bak`（時間戳 X）還原。確認嗎？」
4. User 確認 → `cp PENDING_ACTIONS.md.bak PENDING_ACTIONS.md`
5. @Lead 重讀 §🎯 [CURRENT_STAGE] → 確認狀態錨點 → 恢復 Workflow

**禁止**：未經 User 確認自動還原（避免覆蓋 User 手動編輯）。

### 策略 B：從 ROUTING_TICKET 重建（次選）

`.bak` 不存在 / 過期時：

1. @Lead 讀最近 `ROUTING_TICKET.md`（若存在）取得 `[CURRENT_STAGE]`
2. @Lead 讀最近 N=10 工作對話歷史，由 grep 抽取以下信號重建 PENDING_ACTIONS：
   - 🔴 / ❌ 通知（從 @Assistant / sub-agents 回報）
   - Gate Check 通過/退件記錄
   - 豁免記錄（EXEMPTION_LOG 引用）
3. 產草案 `PENDING_ACTIONS.md.recovered` → User review
4. User 修正 → 確認後 mv 為 PENDING_ACTIONS.md
5. @Assistant 寫入新 .bak

**注意**：重建必丟失部分歷史；User 必明確接受此資訊損失。

### 策略 C：完全重建（最後手段）

`.bak` + `ROUTING_TICKET` 皆無：

1. @Lead 切回對話初始狀態（無 stage anchor）
2. 通知 User：「狀態錨點完全遺失；需從頭重啟工作流」
3. User 重新下達需求 → @Lead 走 Stage 1 入口
4. 跳過所有歷史豁免 / 退件計數（重置）

**警示**：策略 C 等同**狀態完全重置**；@Retro 需事後審計觸發此情境的根因（屬重大事件）。

## 流程圖

```
PENDING_ACTIONS.md 損毀偵測
        │
        ▼
.bak 存在 + 時間戳合理？
        │
   ┌────┴────┐
  YES        NO
   │          │
   ▼          ▼
策略 A    ROUTING_TICKET 存在？
還原          │
         ┌────┴────┐
        YES        NO
         │          │
         ▼          ▼
       策略 B     策略 C
       重建       完全重建
```

## 預防措施（不依賴恢復）

@Assistant 巡邏每次寫 PENDING_ACTIONS.md 前必：

```bash
# 1. 寫 backup（覆蓋舊 .bak）
cp PENDING_ACTIONS.md PENDING_ACTIONS.md.bak

# 2. 寫新內容（atomic：先 /tmp 再 mv）
cat > /tmp/PENDING_ACTIONS.new.md
mv /tmp/PENDING_ACTIONS.new.md PENDING_ACTIONS.md
```

**.bak 保留期限**：1 工作對話（每次寫入覆蓋）；超過則視為過期（策略 A 不可用）。

## DoD（恢復完成後）

- [ ] `PENDING_ACTIONS.md` 結構合 schema（@Lead 驗證 §🎯 5 欄位齊全）
- [ ] `[CURRENT_STAGE]` 對齊最近 ROUTING_TICKET.md（若存）
- [ ] 通知 User 「狀態恢復完成；採策略 A/B/C」
- [ ] 寫 `EXEMPTION_LOG` 一條（即使非豁免；視為災後審計記錄）
- [ ] @Retro 標 P-XX `PENDING_RECOVERY_DONE` 通知（巡邏自動生）

## 絕對禁止

- **絕對禁止** 未經 User 確認自動執行任何策略（即使 .bak 完美）
- **絕對禁止** 跳過 EXEMPTION_LOG 記錄（災後審計依據）
- **絕對禁止** 策略 C（完全重建）不通知 User 而靜默重置

## Related Decisions

ADR-0001（Stateless Routing 三鐵律；本流程為其災難恢復補充）/ ADR-0008（Hotfix 雙軌；本任務不屬 Hotfix 但可平行觸發）— 在 `decisions/`。
