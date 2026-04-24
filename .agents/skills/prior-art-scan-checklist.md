# Skill: Prior Art Scan Checklist（套件生態掃描檢核表）

> 對齊 §十六.F F2 類格式（含 §專案特化參照 + MACHINE_READABLE anchor）。

## 一、掃描觸發條件複查

開始掃描前，再次確認任一觸發條件滿足（`RULES_DESIGN_GUIDE §十八.A`）：

- [ ] **C1**：功能標記為 `feature`（新增）或 `major_enhancement`（User Story AC ≥ 5 條 / 跨 ≥ 3 個 `domains/` 或 `tech-stacks/`）
- [ ] **C2**：預估 LOC > 500
- [ ] **C3**：User 指令含「改版」/「重構」/「refactor」/「redesign」/「major upgrade」

**排除條件**（任一滿足即不觸發 → 🟢 跳過本流程；於 API Spec 備註「Prior Art Scan 非必要（排除條件 X）」）：
- `bugfix` / `hotfix` / `style` / `doc` / `typo` / `rename` / `refactor-minor`
- 單檔 < **100 LOC** 異動
- 純文件 / 純測試調整

## 二、檢索關鍵字模板

依功能性質從下表選取（可組合；建議最少檢索 **3 組關鍵字**避免單一盲區）：

| 功能類型 | 檢索關鍵字範例 |
|---------|-------------|
| UI 元件（Vue3）| `vue3 [feature] component`、`element-plus [feature]`、`naive-ui [feature]` |
| 表單驗證 | `schema validation [language]`、`zod`、`yup`、`joi`、`vee-validate` |
| 日期時間 | `date picker [framework]`、`dayjs`、`date-fns`、`luxon` |
| 圖表可視化 | `chart library [framework]`、`echarts`、`chart.js`、`d3` |
| 狀態管理 | `state management [framework]`、`pinia`、`zustand`、`jotai` |
| 排程 / Cron | `cron [language]`、`node-cron`、`bullmq`、`agenda` |
| API 整合 | `[platform] sdk [language]`、`axios interceptor` |
| 金融計算 | `decimal [language]`、`big.js`、`bignumber.js` |
| Telegram 相關 | `telegraf`、`grammy`、`telegram-bot-api`、`@telegram-apps/sdk` |
| 測試工具 | `testing framework [language]`、`vitest`、`jest`、`playwright` |
| 檔案處理 | `file lock [language]`、`proper-lockfile`、`lockfile`、`fs-extra` |

**檢索管道**（User 執行；Agent 協助提示）：
- NPM：`https://www.npmjs.com/search?q=<keyword>`
- PyPI：`https://pypi.org/search/?q=<keyword>`
- GitHub Trending：`https://github.com/trending/<language>?since=monthly`
- Awesome Lists：`awesome-<topic>` 搜索
- Stack Overflow：`what [feature] [framework] best library`

## 三、評估矩陣（強制填寫）

每候選方案依 5 維度評分（1-5 分；5 最佳）：

| 維度 | 判定方法 | 權重 |
|-----|---------|-----|
| **維護活躍度** | GitHub 最近 commit < 90 天 = 5；< 180 天 = 4；< 365 天 = 3；> 365 天 = 2；> 2 年 = 1 | 25% |
| **社群規模** | GitHub stars：> 10k = 5；> 3k = 4；> 1k = 3；> 300 = 2；< 300 = 1 | 20% |
| **License 相容** | 與專案 `BUSINESS_RULES.license_preference` 欄位比對（預設 MIT / Apache 2.0 = 5；BSD = 5；LGPL = 4；GPL = 2；專有 = 1）| 15% |
| **依賴衝突** | 新增依賴數 < 5 = 5；5-10 = 4；10-20 = 3；20-50 = 2；> 50 = 1 | 20% |
| **客製成本** | 開箱即用 = 5；少量 wrapper = 4；中等客製 = 3；大幅客製 = 2；幾乎重寫 = 1 | 20% |

**總評公式**：`(活躍度 × 0.25) + (社群 × 0.20) + (License × 0.15) + (依賴 × 0.20) + (客製 × 0.20)`

- 總評 ≥ **4.0** → 🟢 強烈推薦
- 總評 **3.0 ~ 4.0** → 🟡 可採納但需評估客製
- 總評 < **3.0** → 🔴 不建議

## 四、禁用套件清單（專案特化）

參照 workspace `BUSINESS_RULES.forbidden_packages`（若有定義）；常見跨專案禁用類型：
- **License 不相容**（如商業專案禁用 GPL）
- **已知安全漏洞未修復**（> 90 天）
- **作者已宣告停止維護**
- **已被官方 deprecated / archived**

## 五、自建 vs 採納套件 決策樹

```
┌─ 功能核心業務邏輯（專案差異化）？
│ ├─ 是 → 偏向自建（保留彈性）；但仍需考慮「部分組件採套件」
│ └─ 否 → 優先採納套件
│
├─ 評估矩陣最高分 ≥ 4.0？
│ ├─ 是 → 採納
│ └─ 否 → 重新檢索 or 自建
│
├─ 客製成本 < 自建成本 × 0.5？
│ ├─ 是 → 採納（後續客製）
│ └─ 否 → 自建
│
└─ License 與商業目標相容？
 ├─ 是 → 依上述
 └─ 否 → 排除該候選
```

## 六、產出物

完成後產出 `docs/plans/prior-art/<功能名稱>.md`（格式參照 `.agents/skills/prior-art-report-template.md`）。

**命名規則**：功能名稱採 kebab-case；對齊 `docs/plans/draft_features.md` 中的條目標識。

## 七、溯源

- 建立提案：PROPOSAL_20260423_002
- 對齐：`RULES_DESIGN_GUIDE §十八`（Prior Art Scan 強制程序）
- 搭配產出物模板：`skills/prior-art-report-template.md`
- 搭配 workspace 欄位：`EVALUATED_PACKAGES` / `BUSINESS_RULES.license_preference` / `BUSINESS_RULES.forbidden_packages`

**修訂方式**：透過 `RULE_UPDATE_PROPOSAL`。

---

<!-- MACHINE_READABLE
type: project-specific-references
schema_version: v1.0
category: F2
skill_or_task: prior-art-scan-checklist
-->

## 🔗 專案特化參照 (Project-Specific References)

> 本 skill 描述**通用生態掃描方法論**；專案特定快取、License 偏好、禁用套件清單由 workspace 注入。
> 請參照 `.agents/workspaces/<CURRENT_WORKSPACE>.md` 對應欄位。

| 通用概念 | Workspace 欄位 | Fallback 行為 |
|---|---|---|
| 已評估套件快取 | `EVALUATED_PACKAGES` | 略過（首次執行；Scan 完成後 append）|
| License 偏好 | `BUSINESS_RULES.license_preference` | 預設 `[MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause]`（商業友善）|
| 禁用套件清單 | `BUSINESS_RULES.forbidden_packages` | 略過（無限制；但仍適用通用禁用規則：棄維護 / 已 archived / 已知漏洞）|

---

## Related Decisions

- [ADR-0014](../decisions/0014-prior-art-scan.md) — Prior Art Scan 強制程序
