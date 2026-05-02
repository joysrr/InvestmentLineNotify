---
adr_id: ADR-0031
title: Tech-Stacks Catalog 架構（分類 + MANIFEST + 選擇性搬運）
status: Accepted
date: 2026-04-24
supersedes: []
superseded_by: []
extends: [ADR-0015]
related_proposals:
  - PROPOSAL_20260423_017
referenced_by:
  - RULES_DESIGN_GUIDE.SCOPE §十六
  - tech-stacks/MANIFEST.yaml
  - scripts/tech-stack-manage.mjs
  - scripts/init-workspace.mjs
  - skills/tech-stack-onboarding.md
  - tests/tech-stack-validator.mjs
---

# ADR-0031: Tech-Stacks Catalog 架構（分類 + MANIFEST + 選擇性搬運）

## Status

**Accepted** (2026-04-24)

## Context

ADR-0015 確立 tech-stacks 純淨 + 6 鐵律 + 扁平命名，原設計假設「幾份」。
2026-04-24 User 討論新 Avalonia 專案 onboarding 時發現：

- **無選擇性搬運機制**：`cp -r .agents/` 帶所有 stacks，新專案僅需 2-3 份卻被迫帶入 8 份
- **無 MANIFEST**：沒有「stack 目錄索引」的 SSOT；安裝狀態無記憶機制
- **init-workspace 不詢問 stack**：使用者須手動編 `TECH_STACK` 欄位
- **擴展預估**：半年 15-20 份 / 1 年 25-40 份（扁平已接近極限）
- **vendor 文件無安全準則**：引用外部 docs 有 prompt injection 風險

ADR-0015 §十六.D 僅預留「≥ 5 份同前綴強制子目錄」，但缺乏跨類別分類 + 選擇性搬運 + vendor 安全準則。

## Decision

採用 **分類子目錄 + MANIFEST 索引 + 選擇性搬運** 三位一體架構，擴充（非推翻）ADR-0015：

### 1. 分類子目錄（Category Directories）

`tech-stacks/` 下 6 個類別：`core/` / `web-backend/` / `web-frontend/` / `desktop/` / `messaging/` / `storage/`

每個 stack **必**歸入某一類（MANIFEST `category` 欄位強制）。同類 stack 可再用扁平命名或前綴分組（沿用 ADR-0015）。

### 2. MANIFEST.yaml（Single Source of Truth）

`tech-stacks/MANIFEST.yaml` 為 Catalog 索引 SSOT，含：

- `version` / `schema_version`
- `categories: {<name>: {description, priority}}`
- `stacks: [{name, category, class, file|folder, depends_on, installed, platforms, extends_base?, vendor_source?, vendor_last_vetted?}]`

**記憶機制**：移除的 stack 不刪 MANIFEST entry；改設 `installed: false`（保留可 restore 能力）。

### 3. 建立模式（單檔 vs 資料夾）

- **單檔模式**：`category/name.md` — 規範 < 200 行 + 無需引用 vendor 原文
- **資料夾模式**：`category/name/` — 規範 ≥ 200 行 OR 需引用 vendor 原文
  - 必含：`README.md`（我方規範唯一權威）+ `SOURCE.md`（audit trail）
  - 選配：`upstream/`（vendor 原文隔離區）+ `adapted/`（我方補充）+ `CHANGELOG.md`

### 4. 選擇性搬運（CLI + init-workspace）

- `scripts/tech-stack-manage.mjs`：`list / info / install / remove / restore` 五指令
  - `install` DFS 解析依賴；`remove` 檢查反向依賴
  - `remove` 保留 MANIFEST entry（installed=false），檔案 `git rm`
  - `restore` 從 git history 取回已移除的檔案
- `scripts/init-workspace.mjs` 新增 Step 6.5：互動選擇保留 stacks
  - 模式 1：刪檔 + `installed: false`
  - 模式 2：保留檔 + `installed: false`
  - `keep`：不變更

### 5. Vendor 內容安全準則（防 Prompt Injection）

資料夾模式強制執行（`skills/tech-stack-onboarding.md §5`）：

- **信任層級**：我方 README.md > User 口述 > upstream/ 原文 > Web Search
- **硬規則**：
  - LLM 只讀 README.md / `name.md`；`upstream/` 不得被 rules / skills 引用
  - 移植 vendor 內容時**抽取結構而非複製段落**（避免嵌入隱藏指令）
  - 所有 vendor 來源必填 `SOURCE.md`（URL + commit + 日期 + 審核人）
  - MANIFEST `vendor_last_vetted` 同步填日期；未填時 validator 發警告
- **可疑內容辨識**：偽 "Instruction" / "忽略上文" / 命令誘導 / 語言混雜 → 保留 upstream 但不引用

### 6. Validation（11 個 validator）

新增 `tests/tech-stack-validator.mjs`（runner 第 10 個）：

1. MANIFEST 可解析；categories 合法
2. 每 stack `category` 屬已定義
3. `installed: true` → 路徑存在
4. 實體檔案 ↔ MANIFEST 雙向對應
5. `depends_on` 合法性 + 循環依賴（DFS 三色）
6. F2 class 檔案含 workspace.\* / 專案特化 / Fallback 關鍵字
7. 資料夾模式必含 README.md（SOURCE.md 警告級）
8. `vendor_source` 有但 `vendor_last_vetted` 空 → 警告

## Consequences

### 正面

- 新專案搬運後 tech-stacks 檔數：8 → 3-5（僅需要）
- 新專案 init 步驟數：8（含手動編 TECH_STACK）→ 5（CLI 互動完成）
- 依賴自動解析（DFS）→ 避免手動補齊
- 記憶已移除 stack（MANIFEST `installed: false`）→ 可 restore
- vendor 文件處理流程明文化（SOURCE.md + upstream/ 隔離）→ 防 prompt injection
- 為 1 年內 25-40 份 tech-stacks 擴展鋪路

### 負面 / Tradeoffs

- MANIFEST 作為 SSOT → 新增 stack 多一步註冊（被 validator 強制）
- 資料夾模式結構較複雜（5 檔：README + SOURCE + CHANGELOG + upstream/ + adapted/）
- tech-stack-manage CLI 新增工具鏈（零依賴 Node.js）

### 中性

- 既存 8 份 stacks 已遷移至分類目錄（Phase A）；路徑更新 19 檔
- 扁平命名規則（ADR-0015）於同類內仍適用

## Alternatives Considered

### Alternative A: Monolithic（維持扁平 + 無 MANIFEST）

**為何不採用**：擴展至 25+ 份時噪音 / 搬運膨脹明顯；無記憶移除能力。

### Alternative B: Submodule（每 stack 一 git repo）

**為何不採用**：與 ADR-0024（零依賴 + Node.js / Bash only）衝突；新增 stack 成本高。

### Alternative C: 外部套件 registry（npm / cargo 類）

**為何不採用**：增加 runtime 相依；與 ADR-0024 零依賴精神衝突；tech-stacks 性質非傳統套件。

### Alternative D: 僅分類不加 MANIFEST

**為何不採用**：選擇性搬運無機械化依據；記憶機制缺失；CLI 無法程式化操作。

## Related Proposals

- PROPOSAL_20260422_022（ADR-0015 原提案：tech-stacks 純淨分離）— Extends
- PROPOSAL_20260423_001（ADR-0016：F1/F2/F3 分類）— 互補
- PROPOSAL_20260423_016（ADR Pattern 導入）— 前置基礎
- PROPOSAL_20260423_017（本 ADR 原提案）

## Referenced By

- `RULES_DESIGN_GUIDE.SCOPE §十六`（補充分類 + MANIFEST 規範）
- `tech-stacks/MANIFEST.yaml`（本 ADR 產物 SSOT）
- `scripts/tech-stack-manage.mjs`（CLI 實作）
- `scripts/init-workspace.mjs`（Step 6.5 互動選擇）
- `skills/tech-stack-onboarding.md`（新增 SOP + vendor 準則）
- `tests/tech-stack-validator.mjs`（驗證器；run-all.sh 第 10 個）

## Notes

- 與 ADR-0024（零依賴）相容：全程 Node.js 內建 + Bash + git
- 與 ADR-0002（workspace 注入）一致：MANIFEST 是框架層，workspace 負責 installed 子集
- 與 ADR-0015 關係為 **extends** 而非 **supersedes**：6 鐵律 + 純淨原則仍完全有效；本 ADR 只補充 Catalog 層
- `installed: false` 預設對 **新 Avalonia 專案引入 Semi.Avalonia 時**設計；其他既存 stacks 仍 `true` 以維持現專案相容
- **Pre-skeleton WebFetch 補遺**（PROPOSAL_20260424_019 F-4；2026-04-24）：`skills/tech-stack-onboarding.md §4.2 Step 0` 明文規定資料夾模式在建 `upstream/` / `README.md` 骨架前**必須** WebFetch vendor 官方 repo 確認定位（元件庫 / 主題 / 工具）+ license + 分類合理性；發現性質不符即停並與 User 確認。此為 017 Phase F.2 → F.3（React vs Avalonia 二次工作）的事後退火
