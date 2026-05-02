---
skill_id: backend-dod-checklist
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @Backend Definition of Done 完整清單 + DoD 自評機制 + 回報格式。
  自 rules/backend.md §s09 搬入（PROPOSAL_502_006 F-2 後 §s09+s10 合併為 §s09）。
referenced_by:
  - rules/backend.md §s09
related_decision: decisions/0013-dod-self-audit.md
---

# Skill: @Backend DoD 完整清單與自評機制

## Definition of Done — 完成確認清單

`@Backend` 在回報「開發完成」前必確認所有項目。

<!-- TEMPLATE_START: Backend DoD Checklist -->

### Backend 完成確認清單

**功能名稱**：<功能簡稱>

#### 程式碼品質

- [ ] 所有非同步操作均有 `try/catch` 錯誤捕捉
- [ ] 無 `console.log` 遺留（正式日誌使用統一 logger）
- [ ] 無硬寫金鑰、Token 或敏感資訊（已使用環境變數）
- [ ] 通過靜態分析工具（依 workspace `TECH_STACK.linter`），無 error 級別警告

#### 測試覆蓋

- [ ] 純函數的單元測試已建立於 `src/test/`（或 workspace 規定位置）
- [ ] API 端點的回應格式測試已建立
- [ ] 測試可獨立執行，不依賴外部服務（已使用 Mock）

#### 文件與規格

- [ ] 若新增/修改 API 端點，已通知 `@Architect` 確認 `docs/api/` 同步
- [ ] 若新增環境變數，已更新 `.env.example`
- [ ] 若排程任務有變更，已更新部署指令清單

#### 部署準備

- [ ] 部署指令清單已產出（依 workspace `DEPLOYMENT_SOP`）
<!-- TEMPLATE_END -->

## DoD 自評機制（回報前置閘道）

通知 `@Lead` 任務完成**之前**，必以下列 6 項自評 Checklist 為前置閘道。**未完成自評即直接回報「任務完成」屬違規行為**。

### 實作自評 Checklist

- [ ] 所有新增函式有對應錯誤處理（`try/catch`）
- [ ] 關鍵業務路徑覆蓋（推送 / 訊號計算 / 資料寫入 / `strategyWeight` 異動 — 對齊 `reviewer.md §系統關鍵路徑錯誤處理 Checklist`）
- [ ] 無 `require()` / 絕對路徑 / 硬寫金鑰
- [ ] 資料異動超 §「HITL 升級條件」門檻者已獲 `@Lead` 授權記錄
- [ ] File-based 寫入有防重複寫入保護（冪等性）
- [ ] 新增套件已確認無安全性已知漏洞（`npm audit` / 等效工具）

### 標準回報格式

依 `skills/templates/dod-audit-template.md` 通用 5 區塊結構（任務 / 自評結果 / 待說明 / 豁免 / 備註）；@Backend 特化區塊標頭：

```
【@Backend DoD 自評】
任務：<任務描述>
自評結果：✅ 全數通過 / ⚠️ <n> 項需說明
待說明項目：<具體描述或「無」>
```

含豁免時加 `豁免編號：EX-YYYYMMDD-NNN（來源：lead.md EXEMPTION_LOG）`。

### 禁止行為（保留於 rule）

- **絕對禁止** 自評有未通過項目時以「待後續修正」直接回報完成
- **絕對禁止** 略過本自評機制直接通知 `@Lead`（略過視同任務未完成）

<!-- END: backend-dod-checklist -->
