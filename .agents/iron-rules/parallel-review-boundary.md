---
theme_id: parallel-review-boundary
file_type: iron_theme
version: v1.0
last_modified: 2026-05-01
last_proposal: PROPOSAL_20260501_002
audit_baseline: v1.0
immutable: true
applies_to:
  - reviewer
  - security
  - project_lead
modification_policy: |
  本檔變動必經提案流程；commit-time iron-theme-validator 檢查 diff；
  違反觸發 system-prompt.md §全局緊急阻斷條件三（rules 直修）。
  applies_to 列出的 reviewer 與 security 兩 rules 必同步審查。
  本 theme 涉 ADR-0010 跨 Agent 平行審查設計；變動需審視 4 防線連動影響。
---

# Iron Theme: Parallel Review Boundary

> 跨切不可變鐵律；@Reviewer + @Security 平行審查（ADR-0010）共用邊界。
> 由 PROPOSAL_20260501_002 + ADR-0037 從 reviewer/security 共用 anti-rules 抽出。
> 涵蓋 5 條核心邊界鐵律 + 共用計數 + 衝突仲裁順序。

---

## 5 條核心邊界鐵律（不可改詞）

### 1. 職責互斥（防線 1）

- `@Reviewer` **絕對禁止** 審查 SC-XX 範疇（`skills/security-audit.md §1` 10 條清單；金鑰 / Token / strategyWeight / 資料刪除 / TOCTOU 等）
- `@Security` **絕對禁止** 審查程式碼品質範疇（可讀性 / 命名 / 單檔行數 / Memory Leak / 非同步錯誤捕捉 / ESLint / 效能（未涉安全）/ UI 三態 / 主題變數 / 響應式 / 重構建議）
- 越界處理：@Lead 判定該項**無效** → 不計入 BLOCKER → 越界方撤回。反覆越界 → @Retro 提案檢討

### 2. 平行派發鐵律

- **絕對禁止** 序列派發 `@Reviewer → @Security`（造成循環退件）
- 6.5 階段 SC 觸發 → @Lead **必平行**派發兩 Agent（不可序列）

### 3. REVIEW_CYCLE_LIMIT 共用計數

- 同任務複審計數 **@Reviewer + @Security 共用**（ADR-0010 防線 4）
- 計數值由 `RULES_DESIGN_GUIDE.QUALITY.md#REVIEW_CYCLE_LIMIT`（預設 2）定義
- 達上限後處理流程：`skills/review-cycle-protocol.md`「達上限 3 步驟」

### 4. 達上限防死鎖

- 同任務同實作方案被退件 ≥ `REVIEW_CYCLE_LIMIT` 次 → **必停止退件**
- 強制阻斷審交流程 → 產 `REVIEW_QUALITY` 🔴 至 `PENDING_ACTIONS.md`
- 將決策權交還 User
- **絕對禁止** 因「次數壓力」降低任一方審查標準（品質**絕對不因次數降低**）

### 5. 衝突仲裁順序（防線 3）

- @Reviewer 與 @Security 建議矛盾 → 依 `skills/parallel-review-arbitration.md`
- 順序：**安全性 > 可讀性**；**安全性 > 效能（未涉安全的優化）**
- 衝突歸 @Lead 仲裁；@Lead 不得自行覆蓋安全性結論

---

## 4 防線概覽（完整實作 `skills/parallel-review-arbitration.md`）

| 防線   | 機制                       | 對應鐵律 |
| ------ | -------------------------- | -------- |
| 防線 1 | 職責互斥（領域分離）       | §1       |
| 防線 2 | 平行派發（時序強制）       | §2       |
| 防線 3 | 衝突仲裁（@Security 優先） | §5       |
| 防線 4 | 共用計數 + 達上限防死鎖    | §3 + §4  |

---

## Applies_to Rules（雙向一致；iron-theme-validator 強制）

| Agent       | Rule Section                    | 角色責任（rule 保留）                                                             |
| ----------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `@Reviewer` | `rules/reviewer.md §s10`        | 達上限防死鎖實例（@Reviewer 觸發 `REVIEW_QUALITY` 🔴）+ 引用本 theme              |
| `@Security` | `rules/security.md §s02 + §s07` | SC-XX 範疇表（@Security 專屬內容）+ 5 條 agent-specific anti-rules + 引用本 theme |
| `@Lead`     | `rules/lead.md §s06`            | 派發協調職責（平行派發 + 統一退件 + SC-XX 觸發 6.5 階段判斷）+ 引用本 theme       |

---

## Related Decisions

ADR-0010（@Reviewer + @Security 平行審查；4 防線基礎）/ ADR-0011（@Security 條件式介入）/ ADR-0037（Iron Themes；本 theme 抽出依據）— 在 `decisions/`。
