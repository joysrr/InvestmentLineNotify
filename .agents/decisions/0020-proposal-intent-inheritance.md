---
adr_id: ADR-0020
title: 提案意圖繼承機制（§🔗）
status: Accepted
date: 2026-04-22
supersedes: []
superseded_by: []
related_proposals:
  - PROPOSAL_20260422_006
  - PROPOSAL_20260422_007
referenced_by:
  - proposals/PROPOSAL_INDEX.md §🔗 提案意圖繼承關係
  - rules/retro.md §歷史比對機制
  - skills/templates/proposal-integration-analysis-template.md
---

# ADR-0020: 提案意圖繼承機制（§🔗）

## Status

**Accepted** (2026-04-22)

## Context

新提案可能改寫既有規則方向：

- **善意擴充**：PROPOSAL_A 設計某機制；PROPOSAL_B 擴充之
- **修正範圍**：PROPOSAL_C 設計過廣；PROPOSAL_D 縮窄適用範圍
- **設計回退**：PROPOSAL_E 推翻 PROPOSAL_F 的決策

若無記錄繼承關係，易發生「設計意圖漂移」（新提案不自覺違背舊提案設計初衷）。

## Decision

建立 **§🔗 提案意圖繼承關係表**（於 `PROPOSAL_INDEX.md` 文末）：

```markdown
| 歷史提案   | 原意圖       | 繼承提案   | 繼承方式                          | 說明   |
| ---------- | ------------ | ---------- | --------------------------------- | ------ |
| PROPOSAL_A | <原設計意圖> | PROPOSAL_B | 擴充 / 修正範圍 / 語意恢復 / 推翻 | <說明> |
```

**四種繼承方式**：

- **擴充**：新提案延伸舊提案；不改變核心意圖
- **修正範圍**：縮窄 / 擴寬舊提案適用條件；核心意圖保留
- **語意恢復**：回到更早版本的設計（如 ADR-0008 light 路徑恢復初版 3 步）
- **推翻**：完全取代舊提案決策（罕見）

**強制觸發**：`@Retro` 起草新提案時必執行「設計意圖衝突偵測」：

1. 讀取 §🔗 表
2. 比對新提案改寫方向與歷史 DONE 提案的設計意圖
3. 若相關 → 新提案 §七 備註必標注意圖繼承，並於 §🔗 新增條目

**違規處置**：提案執行後 §🔗 未新增繼承條目 → 🔴 `PROPOSAL_INTENT_REGRESSION` 通知（@Assistant 巡邏 P-14）。

## Consequences

### 正面

- 設計演進有追溯軌跡
- 避免「新人提案不自覺違背舊設計」
- §🔗 成為跨提案關係圖譜
- Workspace PROPOSAL_INDEX 亦可套用（獨立 §🔗）

### 負面 / Tradeoffs

- 每份提案撰寫時多一個 §🔗 同步步驟
- 繼承方式判定有主觀性（「擴充」vs「修正範圍」邊界）
- P-14 違規偵測依賴巡邏週期（非即時）

## Alternatives Considered

### Alternative A: 靠 git log 追蹤

**為何不採用**：commit 訊息不保證記錄意圖繼承；難結構化查詢。

### Alternative B: 直接在提案 frontmatter 加 `supersedes` 欄位

**為何不採用**：設計已部分採納（`related_proposals` 欄位）；§🔗 表補完整圖譜。

## Related Proposals

- PROPOSAL_20260422_006（PROPOSAL-011 意圖繼承修補；原始意圖機制）
- PROPOSAL_20260422_007（提案整合性分析機制；擴充至「設計衝突偵測」）

## Referenced By

- `proposals/PROPOSAL_INDEX.md §🔗 提案意圖繼承關係`（主索引）
- `rules/retro.md §歷史比對機制 + 設計意圖衝突偵測`
- `skills/templates/proposal-integration-analysis-template.md`
- `@Assistant` 巡邏 P-14 `PROPOSAL_INTENT_REGRESSION`

## Notes

- ADR-0008（Hotfix 分軌）本身即「修正範圍」繼承範例（修 003 過廣為分層）
- §🔗 與 ADR（本目錄）互補：ADR 記錄決策本身；§🔗 記錄提案間意圖演進
