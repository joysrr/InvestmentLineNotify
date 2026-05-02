---
skill_id: frontend-dod-checklist
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @Frontend Definition of Done 8 條完整清單 + DoD 自評 6 條 Checklist + 標準回報格式。
  自 rules/frontend.md §s07 + §s08 搬入。
referenced_by:
  - rules/frontend.md §s07 §s08
related_decision: decisions/0013-dod-self-audit.md
---

# Skill: @Frontend DoD 完整清單與自評機制

## Definition of Done — 8 條（回報「開發完成」前必逐項確認）

- [ ] **UI 三態完整性**：Loading / Success / Error 均有實作（含 Empty State）；缺一視為未完成
- [ ] **主題變數強制使用**（依 workspace `TECH_STACK.frontend`；如 Telegram Mini App ThemeParams `var(--tg-theme-*)`）：所有顏色用 CSS 變數；hardcoded 顏色零容忍
- [ ] **目標環境合規**（依 workspace 注入；如 `tech-stacks/messaging/telegram-miniapp.md`）：合規 Checklist 全數通過方為完成
- [ ] **認證驗證已實作**（如 Mini App `initData` / OAuth）：啟動時執行驗證；所有 API 請求帶入對應認證 Header
- [ ] **API 規格與 `@Architect` 確認版本一致**：`docs/api/` 最新版已讀取；無規格落差
- [ ] **響應式佈局適配**：Mobile 視窗（依 workspace 規定，如 375px）正常顯示；長列表（> 50 筆）有虛擬滾動或分頁；圖表資料（> 500 筆）有抽樣
- [ ] **錯誤訊息使用者可讀**：非技術性 Error Code；長時間操作有進度回饋
- [ ] **所有 AC 均已通過**：以 `docs/plans/draft_features.md` 為唯一依據；每條 AC 均有對應實作與測試

**回報格式**：通知 `@Lead` 時必附本 8 條自評結果；全通過才算完成。任一條未通過必說明原因與後續處理計畫。

## DoD 自評機制（回報前置閘道）

通知 `@Lead` 任務完成**之前**必執行 6 項自評。**未完成自評即直接回報「任務完成」屬違規**。

### 6 項 Checklist

- [ ] 所有 UI 元件使用主題變數（對齊 §「核心行為準則/零容忍」）
- [ ] **無直接呼叫後端 API** — 所有通訊透過 SDK 中繼（依 workspace 注入；如 Telegram WebApp SDK）
- [ ] 視窗尺寸適配已確認（非全螢幕 / 內嵌視窗相容 / Mobile 可用）
- [ ] 互動操作有 Loading 狀態與錯誤提示（對齊 8 DoD UI 三態）
- [ ] 無引入需額外安裝的原生套件（限 Web 標準技術；除非 workspace 明文允許）
- [ ] 關鍵業務資料顯示值與後端資料來源一致（資料雙向驗證；如 `strategyWeight`）

### 標準回報格式

```
【@Frontend DoD 自評】
任務：<任務描述>
自評結果：✅ 全數通過 / ⚠️ <n> 項需說明
待說明項目：<具體描述或「無」>
```

### 禁止行為（保留於 rule）

- **絕對禁止** 未在目標環境（或模擬環境）確認基本渲染正常前回報完成
- **絕對禁止** 自評有未通過項目時以「待後續修正」直接回報完成
- **絕對禁止** 略過本自評機制直接通知 `@Lead`（視同任務未完成）

<!-- END: frontend-dod-checklist -->
