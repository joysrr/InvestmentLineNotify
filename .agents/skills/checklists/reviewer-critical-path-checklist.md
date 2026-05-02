---
skill_id: reviewer-critical-path-checklist
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @Reviewer 系統關鍵路徑錯誤處理 Checklist 完整 5 路徑細則。
  自 rules/reviewer.md §s07 搬入。
referenced_by:
  - rules/reviewer.md §s07
  - rules/security.md（移交範疇對照）
related_decision:
  - decisions/0010-parallel-review.md
  - decisions/0011-security-conditional-intervention.md
---

# Skill: @Reviewer 系統關鍵路徑錯誤處理 Checklist

以下關鍵業務路徑在任何涉及對應功能的變更中**必須**有明確錯誤捕捉與處理邏輯；缺失任一項即 🔴 `[BLOCKER]` 退件。

## ⚠️ 資安範疇移交聲明（ADR-0010 + ADR-0011）

5 條路徑中：

- **`strategyWeight` 異動路徑** → 移交 `@Security`（SC-01）
- **Token 時效驗證路徑** → 移交 `@Security`（SC-03）
- **資料寫入路徑「TOCTOU 原子性鐵律」最後一項** → 移交 `@Security`（SC-06）

`@Reviewer` **絕對禁止**審查移交項目；保留條目於本 skill 僅供查閱跨路徑上下文，**不計入** `@Reviewer` 的 BLOCKER 統計。具體分工見 `skills/security-audit.md §2 Checklist` 分類 2 + 5。

## 路徑 1：Telegram 推送路徑（@Reviewer 全責）

- [ ] Telegram Bot API 呼叫有 `try/catch`
- [ ] API 失敗有重試機制（建議 ≤ 3 次，對齊 `tech-stacks/messaging/telegram-bot.md`）
- [ ] 重試失敗後有錯誤日誌寫入
- [ ] 不得因推送失敗導致程序崩潰

## 路徑 2：投資訊號計算路徑（@Reviewer 全責）

- [ ] 計算輸入值有型別驗證
- [ ] 除零、`NaN`、`Infinity` 情況有防護（對齊 `domains/math-quant.md`）
- [ ] 計算異常不得影響其他訊號的正常推送（單點失敗隔離）

## 路徑 3：資料寫入路徑（File-based）（@Reviewer 大部分 + @Security 最後一項）

- [ ] File-based 寫入有 `try/catch`（@Reviewer）
- [ ] 寫入失敗有備援或回滾機制（@Reviewer）
- [ ] 不得在寫入失敗時靜默忽略錯誤（@Reviewer）
- [ ] 批次寫入 ≥ 50 筆或資料刪除操作必須有對應 HITL 授權記錄（@Reviewer；對齊 `backend.md §s06` 量化門檻）
- [ ] **（原子性鐵律 — @Security 審查；SC-06）** 凡涉及檔案 Lock / 共用資源競爭，**必使用** `fs.openSync(path, 'wx')` 獨佔模式或 DB 級別鎖；**絕對禁止** `existsSync` + 後續寫入的 TOCTOU 分段寫法（對齊 `tech-stacks/storage/file-based-storage.md`）

## 路徑 4：`strategyWeight` 異動路徑（@Security 全責；SC-03）

`@Reviewer` **不審**（移交 `@Security`）。完整條款 → `skills/security-audit.md §2 第 5 點` + `skills/checklists/strategyweight-change-checklist.md` 五步驟強制流程。本檔僅標明移交聲明，不重複條目（避免漂移）。

## 路徑 5：Token 時效驗證路徑（@Security 全責；SC-01）

`@Reviewer` **不審**（移交 `@Security`）。完整條款 → `skills/security-audit.md §1 SC-01`（initData / JWT / OAuth state 雙重鐵律：簽章 + 時間戳解析 + 到期檢查 + 401 強制）+ `tech-stacks/messaging/telegram-miniapp-sdk.md` initData 雙重鐵律。本檔僅標明移交聲明。

<!-- END: reviewer-critical-path-checklist -->
