# v7.15 Stabilization Round 3 模擬報告（觸及重大決策點）

> 由 4 並行 simulation agents 對 v7.15 用**第三輪參數調整**（不同 stack/口語化指令/邊界 LOC/polyglot 同 root/N→1 merge/probe 混合失敗/tier 升級鏈）做設計層 walkthrough。
>
> **基準版本**：framework v7.15（PROPOSAL_502_042 完成；commit d7c9ed8）
> **報告版本**：Round 3 — 2026-05-07
> **三輪比較**：48 → 32 → **33** GR；**修補有效性持平 → 觸及結構性盲點**

---

## §1 三輪 GR 趨勢分析（重要！）

| Round | 基準      | 識別 GR | 高嚴重度 | 修補有效率                                        |
| ----- | --------- | ------- | -------- | ------------------------------------------------- |
| 1     | v7.7      | 48      | 15       | —                                                 |
| 2     | v7.11     | 32      | 9        | 56%（修 27/48）                                   |
| **3** | **v7.15** | **33**  | **13**   | **不收斂**（v7.12-v7.15 修 ~50%；新 GR 等量浮現） |

**關鍵訊號**：GR 數量 32 → 33 持平 + 高嚴重度 9 → 13 反升 → **closed-list keyword paradigm + 「條文寫了實作空轉」結構性問題已達邊際效益遞減**。

---

## §2 Round 3 GR 分主題 (33 GR；13 高 / 16 中 / 4 低)

### 主題 R3-A：Closed-list Keyword Paradigm SPOF（結構性；6 GR）

| GR    | 描述                                                                   | 嚴重  | 屬於           |
| ----- | ---------------------------------------------------------------------- | ----- | -------------- |
| R3-A1 | task_class priority 4 缺「加/新增/補上」additive 動詞                  | 🔴 高 | v7.15 仍未根治 |
| R3-A2 | §6.3.1 priority 3 vs §C.5 refactor-keyword fallback 雙軌不同步         | 🔴 高 | v7.15 新引入   |
| R3-A3 | onboarding priority 1 closed-list（「弄成可以管理」/「整理一下」miss） | 🔴 高 | v7.15 仍未根治 |
| R3-A4 | 「砍掉/混在一起/不對勁」極口語動詞無覆蓋                               | 🟡 中 | v7.15 仍未根治 |
| R3-A5 | heuristic「統一」單字 false positive（「全部統一改 config」誤命中）    | 🟡 中 | 邊界暴露       |
| R3-A6 | URL-shaped identifier suggested_query 抽取漏                           | 🟢 低 | v7.15 新引入   |

**結構性結論**：每補一個關鍵字 → user 又能想出 10 種口語表達；keyword grep 永遠追不上中文/口語/業務命名變體。

### 主題 R3-B：規則寫了實作層空轉（10 GR）

| GR     | 描述                                                                                        | 嚴重  | 屬於                          |
| ------ | ------------------------------------------------------------------------------------------- | ----- | ----------------------------- |
| R3-B1  | hotfix-heavy autonomy default：lead.md §s07 vs routing-ticket-protocol §3.4 雙文件不一致    | 🔴 高 | v7.12 修補但未對齊            |
| R3-B2  | 「自動降級」P-34 條文寫了，但 lead.md §s_complexity_lane 沒加「P-34 🔴 active → skip hint」 | 🔴 高 | v7.12 補規則但未對齊 lead     |
| R3-B3  | timeout 5s 純 schema 註解；無實作層（無 setTimeout 樣板；依賴 MCP RPC default 60s）         | 🟡 中 | v7.12 schema 補但未實作       |
| R3-B4  | §3.6 append 無 atomic tool（Write/Edit 不適合；無 helper script）                           | 🔴 高 | v7.12 規則寫了但無 affordance |
| R3-B5  | validator 觸發點與 archive lifecycle 衝突（commit hook 跑時 root 已 idle）                  | 🔴 高 | v7.12 validator 加但邏輯失效  |
| R3-B6  | reset 規則 (b) @Assistant 巡邏 grep 樣板缺                                                  | 🟡 中 | v7.12 文字寫但實作模糊        |
| R3-B7  | reset 規則 (c) cross-dispatch vs carry-over 語意混淆                                        | 🟢 低 | v7.12 新引入                  |
| R3-B8  | §3.6 step 2 「確認尾部無既有 block」grep 手段未明文                                         | 🟡 中 | v7.12 邊界                    |
| R3-B9  | prior_ticket_id chain 跨 read 未強制（§3.2 子 agent 讀取時機未列 superseded）               | 🟡 中 | v7.13 新引入                  |
| R3-B10 | hotfix-light telemetry 全省 vs P-34 跨 ticket 累計衝突                                      | 🟢 低 | 邊界                          |

**結構性結論**：許多 v7.12-v7.15 修補是「補 schema 欄位 / 條文一行 / catalog 規則」**沒有同步檢查 agent 工具層 affordance + 跨檔規範對齊 + lifecycle interaction**。設計層對齊度高，執行面空轉。

### 主題 R3-C：Schema 欄位 type/語意未明文（4 GR）

| GR    | 描述                                                                                                              | 嚴重  | 屬於                      |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ----- | ------------------------- |
| R3-C1 | `merged_from` / `split_into` 元素 type 未明文（symbol vs drawer_id）                                              | 🔴 高 | v7.14 補欄位但未定 schema |
| R3-C2 | 跨 wing/room 性質不同 drawer 共用 supersede 指針不合理（debug_graveyard 不該被 architecture 新 drawer supersede） | 🔴 高 | v7.14 仍未根治            |
| R3-C3 | P-35 三維度 aliases 比對未 wire 起來（v7.15 加 aliases 但 P-35 沒對應規則）                                       | 🟡 中 | v7.15 新引入              |
| R3-C4 | in_flight_changes status enum modified 含糊（git unstaged + staged 兩態混為一）                                   | 🟡 中 | v7.13 仍未根治            |

### 主題 R3-D：Hotfix Tier 升級邊界 + 通知（5 GR）

| GR    | 描述                                                                     | 嚴重  | 屬於                   |
| ----- | ------------------------------------------------------------------------ | ----- | ---------------------- |
| R3-D1 | revert_safe heuristic 缺失（技術可逆 vs 業務影響混為一）                 | 🔴 高 | v7.13 仍未根治         |
| R3-D2 | paused 無主動偵測 trigger（P-X 標「新建可選」=未實作）                   | 🔴 高 | v7.13 機制設計但未實作 |
| R3-D3 | revert_safe=true 自動 cancel vs hotfix「事故 user 必知」精神衝突；無通知 | 🟡 中 | v7.13 自動化太積極     |
| R3-D4 | revert_safe=false PENDING 孤兒（無 pending_group 歸屬）                  | 🟡 中 | v7.13 邊界             |
| R3-D5 | context_carryover_summary 1 行容量不足                                   | 🟢 低 | v7.13 設計過簡         |

### 主題 R3-E：Polyglot/路徑/邊界（5 GR）

| GR    | 描述                                                                           | 嚴重  | 屬於               |
| ----- | ------------------------------------------------------------------------------ | ----- | ------------------ |
| R3-E1 | polyglot「同 root 多語言」（PyO3/FFI binding）未覆蓋                           | 🔴 高 | v7.14 規則覆蓋不足 |
| R3-E2 | path 白名單仍字面詞表（business-domain Acme.Accounting/ + bi-dashboard/ miss） | 🟡 中 | v7.15 仍未根治     |
| R3-E3 | polyglot scope 缺 FFI/binding caveat                                           | 🟡 中 | v7.14 邊界         |
| R3-E4 | caller > 10 硬閾值脫離業務直覺（10+cross-stack 高風險仍不寫）                  | 🟡 中 | v7.14 邊界         |
| R3-E5 | caller_count_at_write 雙快照 sync 時點未定                                     | 🟢 低 | v7.15 新引入       |

### 主題 R3-F：跨檔規範未同步（3 GR）

| GR    | 描述                                                                               | 嚴重   | 屬於       |
| ----- | ---------------------------------------------------------------------------------- | ------ | ---------- |
| R3-F1 | pending_group_inherited_from=null 場景未明文（hotfix-light → heavy 升級時舊無 pg） | 🟡 中  | v7.13 邊界 |
| R3-F2 | hotfix-heavy lead.md vs §3.4 雙文件不一致（已列 R3-B1；跨主題重複）                | (重複) | —          |
| R3-F3 | 「自動降級」未對齊 lead.md（已列 R3-B2；跨主題重複）                               | (重複) | —          |

---

## §3 結構性盲點分析

### 3.1 Closed-list Keyword Paradigm 永遠追不上

R3-A 6 個 GR 中 4 個是「list 補了仍 miss」：

- 「加/新增」中文 additive 動詞（R3-A1）
- 「弄成可以管理/整理一下」口語 onboarding（R3-A3）
- 「砍掉/混在一起/不對勁」極口語 refactor（R3-A4）
- 「統一」單字過寬 false positive（R3-A5）

每補一個關鍵字 → user 又能想出 10 種變體。**這是哲學層問題**，不是 patch 層問題。

### 3.2 「條文寫了實作空轉」普遍模式

R3-B 10 個 GR；典型 pattern：

```
PROPOSAL 寫 ADR/schema/skill 條文 → 該 fix
            ↓
   但 agent 實作層需要的工具/規範對齊/lifecycle 銜接 不存在
            ↓
   實際運行時 fix 不生效（規則寫了但無人能執行）
```

具體例：

- R3-B2 「P-34 🔴 → skip hint」寫在 catalog 但 lead.md 沒對應條文 → @Lead 看不到此規則
- R3-B4 「§3.6 append」鐵律寫了但 Claude Code 工具集無 atomic append → sub-agent 只能用 Edit 找 anchor → 易 fail
- R3-B5 validator 加 telemetry mandate 但 commit hook 跑時 root 已 archive → 永遠不觸發
- R3-B3 timeout 5s 寫 schema 但無 setTimeout 樣板 → 等 60s

### 3.3 Round 1 SPOF 仍存在

從 Round 1 → v7.15 兩輪 stabilization 後：

- task_class detection（GR-E1 from Round 2）→ R3-A3 仍是 SPOF
- closed-list refactor-keyword（GR-A1 from Round 2）→ R3-A4 仍 miss 極口語
- path 白名單字面詞表（GR-A2 from Round 2）→ R3-E2 仍是字面詞表

→ **靠 patch closed-list 不是長久之計**。

---

## §4 ⚠️ 觸及重大決策點

### 4.1 為何此時觸及

- GR 數量 48 → 32 → 33 不收斂；高嚴重度 15 → 9 → 13 反升
- 33 GR 中 ~10 個（主題 R3-A + R3-B 部分）屬「不可工程化 patch」結構性問題
- 繼續 Round 4 patch closed-list 補 5 個關鍵字 → Round 5 又 miss 10 個新口語 → 邊際效益遞減

### 4.2 三個策略選項（需 user 決策）

#### 選項 A：接受結構性盲點 + 漸進 patch（保守）

- 繼續 patch closed-list；user 撞到才補
- Round 4 修可工程化的 ~23 GR（R3-B/C/D/E/F）
- 結構性 SPOF（R3-A）保留為 KI（KNOWN_ISSUES）
- **優點**：低風險；不變架構
- **缺點**：framework 永遠對中文/口語/業務命名 fragile

#### 選項 B：引入 LLM-based Intent Classifier（重大架構變更）

- task_class detection 改為「@Lead 派發前呼叫 haiku 分類」
- B-1 refactor-keyword 改為 LLM 評估指令意圖
- onboarding 偵測改為結構訊號（無 CURRENT_WORKSPACE + repo 結構新 → 強制 onboarding）
- **優點**：根治 R3-A 6 GR + 部分 R3-D
- **缺點**：每 dispatch +1 LLM call 成本；需重寫 §6.3.1 + §C.5；違反 v7.0 Python-only milestone（agent 框架要呼 LLM API）

#### 選項 C：Hybrid（推薦）

- closed-list keyword 保留為快車道（fast-path；無 LLM 呼叫）
- closed-list miss → fallback LLM classifier（slow-path）
- 結構訊號優先（無 CURRENT_WORKSPACE → 強制問「是否 onboarding」）
- **優點**：常見場景仍 keyword 即可；極口語/業務命名走 LLM
- **缺點**：兩套機制需維護；複雜度上升

### 4.3 已可工程化修補（不需重大決策）

23 GR 屬「補條文/補 schema/補實作樣板」可繼續 patch：

- R3-B1/B2 規範跨檔對齊（lead.md 加 P-34 / autonomy default 同步）
- R3-B3 timeout setTimeout 樣板
- R3-B4 §3.6 append helper script（破例 .sh / .py）
- R3-B5 validator 觸發點改 archive 前
- R3-B6/B7/B8/B9/B10 reset 規則細化
- R3-C1/C2/C3/C4 schema type/語意明文
- R3-D1/D2/D3/D4/D5 hotfix tier 邊界補
- R3-E1/E3 polyglot 同 root + FFI caveat
- R3-E4 caller 雙閾值（>10 OR cross-stack≥3）
- R3-E5 caller_count sync 時點
- R3-F1 pending_group=null 場景

預估 ~150 LOC，1 個 PROPOSAL_502_043 即可。

---

## §5 推薦下一步

### 5.1 立即（無需 user 決策）

→ 起 **PROPOSAL_502_043**（v7.15 → v7.16）：

- 修可工程化的 23 GR（主題 R3-B + R3-C + R3-D + R3-E + R3-F）
- 預估 ~150 LOC
- 重點：lead.md/§3.4 hotfix default 對齊、P-34 互斥句寫進 lead、§C.3 setTimeout、validator 改 archive 前、merged_from type、caller 雙閾值

### 5.2 需 user 決策（結構性）

→ 主題 R3-A 6 GR：選 A/B/C 中之一

- A：接受 + KI 登記（v7.16 內）
- B：引入 LLM classifier（獨立 PROPOSAL_502_044；重大架構變更；新 ADR-0042）
- C：Hybrid（PROPOSAL_502_044；中等成本）

### 5.3 v7.16 後 Round 4 模擬決定凍結

- v7.16 修畢 → Round 4 模擬（再次調整參數）
- 若 GR 顯著下降（例 < 15 + 高 < 5）→ 凍結 v7.17 為 stabilization milestone v2
- 若仍持平 → user 決策 5.2 選項

---

## §6 結論

**v7.15 stabilization 整體成果評估**：⭐⭐⭐ — schema 層對齊度高（5/7 GR 命中）；機制元件齊全；但**設計層 vs 實作層落差顯著**（R3-B 主題 10 GR）。

**關鍵發現**：

1. closed-list keyword paradigm 已達邊際效益遞減（趨勢 48→32→33 不收斂）
2. 「條文寫了實作空轉」是 v7.12-v7.15 普遍模式（10/33 GR）
3. Round 1 SPOF 仍存在（onboarding/refactor/路徑三大白名單）

**行動方案**：

- 立即執行 PROPOSAL_502_043（修 23 工程化 GR；~150 LOC；無需 user 決策）
- 同時 user 決策主題 R3-A（選項 A/B/C）→ 決定 v7.16+ 是否需 LLM classifier 重大架構變更

**Round 4 預測**：若僅執行 PROPOSAL_502_043 不解 R3-A → Round 4 預估仍 ~25-30 GR（主題 A 6 + 工程化遺漏 + 新引入）；若加 LLM classifier → Round 4 預估 < 15 GR 顯著收斂。

---

**報告完成**：2026-05-07（Round 3）
**參與 agents**：4 並行
**情境覆蓋**：A3/B3/C3/D3/E3/F3/G3/H3/I3 共 9 個
**識別 GR**：33 個（13 高 / 16 中 / 4 低）
**v7.15 修補有效性**：~50%（不收斂）
**下一步**：等待 user 決策（A/B/C）+ 並行執行 PROPOSAL_502_043
