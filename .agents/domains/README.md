# .agents/domains/ — 領域知識索引（Domain Knowledge Index）

> 由 PROPOSAL_20260422_011 建立、PROPOSAL_20260430_005 補完。
> 領域知識檔案由 `@Lead` 依 `skills/lead-context-mappings.md §動態注入決策矩陣` 派發給 `@Consultant` / `@Reviewer` / `@Security` / `@QA`。

---

## 索引矩陣

| Domain                  | 適用情境                                        | 主要 Audience                    | 觸發關鍵詞                                |
| ----------------------- | ----------------------------------------------- | -------------------------------- | ----------------------------------------- |
| `finance-left-side.md`  | 破底建倉、乖離率觸發網、分批攤平                | Consultant / Reviewer            | 乖離率、破底建倉、價值回歸、分批攤平      |
| `finance-lifecycle.md`  | 長線資金配置、槓桿 ETF、質押維持率              | Consultant / Reviewer            | 生命週期、槓桿 ETF、質押維持率、預算攔截  |
| `finance-technical.md`  | KD/MACD/RSI、ATR Trailing Stop、均線排列        | Consultant / Reviewer            | KD、MACD、RSI、均線、ATR、技術面          |
| `math-quant.md`         | 公式驗證、評分矩陣、共線性檢查、蒙地卡羅        | Consultant / Reviewer / QA       | 蒙地卡羅、Z-Score、共線性、肥尾、評分矩陣 |
| `privacy-compliance.md` | PII 儲存/處理、刪除權、保留期 TTL、72h 外洩通知 | Consultant / Security / Reviewer | PII、GDPR、個資法、刪除權、保留期         |

---

## Finance 三檔 SSOT 矩陣（PROPOSAL_20260430_005 D-6）

> 三個 finance domain 各自負責不同投資哲學，組合使用時必區分主從關係，避免衝突仲裁時抖動。

| Domain                 | 哲學                | 適用部位                       | 主要 SSOT 欄位                                | 與其他 domain 衝突仲裁                                                                                         |
| ---------------------- | ------------------- | ------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `finance-left-side.md` | 價值回歸 / 越跌越買 | **核心部位**（破底建倉）       | 乖離率閾值、最大買入檔數、資金間隔            | 與 `finance-technical.md` 衝突時：左側建倉**不看**技術面支撐（支撐通常會被跌破）；技術面僅作為「右側確認濾網」 |
| `finance-lifecycle.md` | 時間分散 / 動態槓桿 | **長線核心部位**（年齡導向）   | 槓桿倍數、維持率安全邊際、預算攔截條件        | 與 `finance-technical.md` 衝突時：對長線核心應以生命週期法為主；技術面僅應用於「衛星部位」或「延遲建倉」濾網   |
| `finance-technical.md` | 動能 / 背離 / 順勢  | **衛星部位**或**右側確認濾網** | KD/MACD/RSI/ATR 公式、鈍化處理、Trailing Stop | 與左側衝突 → 降級為濾網；與生命週期衝突 → 降級為衛星部位工具                                                   |

**組合注入規則**（由 `@Lead` 判斷）：

- 同時涉及左側 + 技術面 → 兩者皆注入；`@Consultant` 報告中**必標**主從關係（核心 vs 濾網）
- 同時涉及生命週期 + 技術面 → 兩者皆注入；明標「核心走 lifecycle、衛星走 technical」
- 三者都涉及 → 全注入；`@Consultant` 須先輸出「**衝突仲裁卡片**」再進入計畫評論
- 涉及任一 finance domain + `math-quant.md` → math-quant 視為**橫切防護**（除零 / NaN / 共線性 / 蒙地卡羅）；不影響上述主從關係

---

## 動態注入流程

由 `@Lead` 依 `lead-context-mappings.md §76-79` 矩陣判斷需注入哪些 domain：

```
User 需求 → @Lead 解析關鍵詞 → 匹配 trigger_keywords
                                ↓
              注入 1-N 個 domains/*.md 給對應 Agent
                                ↓
        Agent 回覆中**必標**「依據領域」段落（domain_id 全部列出）
```

詳見 `rules/consultant.md §44, 55, 65, 102` + `skills/lead-context-mappings.md §76-79`。

## 缺失處理

若 User 需求觸及 trigger_keywords 不在上表的領域（例如「選擇權定價」「總經分析」）：

- `@Lead` 暫停派發；指示 User 補建對應 `domains/<新檔名>.md`
- 範本參考：本目錄任一檔案的 frontmatter + 4 章結構（核心哲學 / 戰略審查重點 / 衝突仲裁提示 / 缺失處理）
- 補完後 `@Lead` 重啟派發

---

## Frontmatter Schema

每份 domain 檔案 frontmatter 必填欄位：

```yaml
---
domain_id: <kebab-case>
file_type: domain
version: v1.0
last_modified: YYYY-MM-DD
last_proposal: PROPOSAL_<id>
scope: framework
domain_name: "<人類可讀名稱>"
purpose: |
  <一句話：何時注入、審什麼>
audience:
  - <Agent 名單>
referenced_by:
  - <被誰引用>
trigger_keywords:
  - <用於 @Lead 匹配>
---
```

新增 domain 後須同步：

1. 本 README §索引矩陣
2. `skills/lead-context-mappings.md §76-79` 注入決策矩陣
3. workspaces 對應專案的 `BUSINESS_DOMAINS` 欄位（若該專案使用）

## 與既有提案的關係

- PROPOSAL_20260422_011 — 建立 5 個初始 domain
- PROPOSAL_20260430_005 — 補 frontmatter + 本 README 索引（與 skills/tasks 對齊）
