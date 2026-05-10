# Framework Known Issues

> 已接受的 exception / 待觀察項統一追蹤檔（依 PROPOSAL_20260502_005 建立）。
>
> **用途**：避免 @Auditor / @Retro 重複「發現」相同已接受問題；@Lead 收編散在 CHANGELOG / 提案內部的 exception 紀錄。
>
> **維護**：每次審計觸發時 @Auditor / @Retro 先讀本檔；命中條目跳過扣分，並核對解除條件是否仍適用。
>
> **解除流程**：審計判定條目可閉合 → @Lead 移除條目 → git commit 引用本檔變更原因。

## 條目格式

| 欄位            | 說明                        |
| --------------- | --------------------------- |
| ID              | `KI-NNN` 連續編號；不可重用 |
| 描述            | 問題客觀現象 + 量化指標     |
| 接受理由 / 狀態 | 為何當前不修；附現有護欄    |
| 解除條件        | 滿足何種條件後本條目移除    |
| 立檔日期        | YYYY-MM-DD                  |
| 來源            | 提案 ID / 審計報告          |

---

## 當前已接受 Issues

| ID     | 描述                                                                          | 影響維度（PROPOSAL_502_016 P-5） | 接受理由 / 狀態                                                                                                      | 解除條件                               | 立檔日期   | 來源                             |
| ------ | ----------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- | -------------------------------- |
| KI-001 | `iron-rules/data-deletion-zero-tolerance.md` 696 tokens > iron_theme warn 600 | dim 2.1 設計密度                 | safety-domain 密度可接受；ADR-0037 typical 範圍 300-700；rule-token-budget-validator 持續 1 warning（非 block 1000） | 再增 +50 tokens → 必立案拆分；現觀察期 | 2026-05-02 | PROPOSAL_502_005 / Phase 4 audit |

<!-- KI-002 已於 PROPOSAL_502_006 解除（2026-05-02）：
     architect.md 1446 → 1303 tokens（-143；剩 197 token headroom）
     backend.md 1426 → 1319 tokens（-107；剩 181 token headroom）
     兩者皆遠低於原 96.3% 警戒；KI-002 條目移除 -->

| KI-003 | PROPOSAL_20260501_004 §九 26 deferred WARNINGs；W-4 + SYSTEM_THRESHOLDS deprecated 子鍵已於 PROPOSAL_502_007 清除；剩餘 hardcoded 數字 / DoD 體例不一仍觀察期 | dim 2.2 設計品質 | 觀察期；待 retro 定期審計排日批次處理剩餘項 | retro 排程立案後本條目轉狀態 IN_PROGRESS；完成後移除 | 2026-05-02 | PROPOSAL_501_004 §九 + PROPOSAL_502_007 部分閉合 |
| KI-004 | 7+ MCP tools 文件列出但無 rule 觸發（`list_wings` / `kg.*` / `log.*` 等）| dim 4.1 操作完備 | 未來成熟期可能用到；標 advanced；不算 gap | 任一 tool 進 rule 觸發點 → 從 advanced → core 重新分類；此條目持續觀察 | 2026-05-02 | PROPOSAL_502_005 / Phase 3 audit |
| KI-005 | C-4 持續🔴 自動歸檔（`assistant.md §s07`）為行為合規規則；無自動 validator 偵測「🔴 持續 > PENDING_RED_EXPIRE 但未寫 drawer」之違反 | dim 4.2 持續改善 | 信任 @Auditor 5 維度評分 + retro 定期審計檢視 baseline 比對；solo-user 風險可接受 | **連續 3 次 @Auditor 評審 dim 4 (operational) 全 ≥ 3.0 + 無 P-15 觸發 + 無實際違反案例**（PROPOSAL_502_016 P-6 明文化解計時停滯）| 2026-05-02 | PROPOSAL_502_009 / Phase C audit |
| KI-006 | GitNexus 接入（外部 MCP）引入兩重豁免：(a) **License**：PolyForm Noncommercial 1.0.0 僅適 user 個人開發；(b) **Node 依賴**：表面違反 v7.0 Python-only milestone（ADR-0040）| dim 2.3 MCP 符合度 + dim 4.1 操作完備 | (a) User 確認 noncommercial 用途（個人開發輔助）；(b) Node 為外部套件原生需求非自寫腳本，ADR-0040 milestone 約束自寫腳本不擴及外部 MCP server；ADR-0041 已釐清 SoT 邊界（mempalace 仍 primary；GitNexus auxiliary cache）；MCP config disabled by default（user 啟用前零行為影響）| User 用途轉商用 → 需重新評估 license（可能購買 akonlabs 商用授權 / 改用 Python 等價物）；或 GitNexus license 變更為 permissive | 2026-05-06 | PROPOSAL_502_033 + ADR-0041 |
| KI-007 | v7.17 Hybrid LLM Classifier（ADR-0042）使 @Lead 派發前可呼叫 inline LLM（haiku 等）做 task_class fallback 判定 | dim 1.4 Token Economy + dim 4.1 操作完備 | 解 closed-list keyword paradigm SPOF（Round 3 主題 R3-A 6 GR）；agent 呼 LLM 屬「框架運行時行為」非「自寫腳本」 → 不違反 ADR-0040 v7.0 Python-only milestone；多數 dispatch 走層 1+2 快車道（80-90%）；僅 10-20% 走 LLM；單 call ~$0.0001；可忽略 | LLM call 成本超預期（>$1/月）→ 退回純 closed-list；或 task_class_source 統計顯示 llm_classifier 比例 <5% → 證明擴充 keyword 已夠 → 可考慮關 LLM fallback | 2026-05-07 | PROPOSAL_502_044 + ADR-0042 |
| KI-008 | P-40 INTEGRATION_WALKTHROUGH_DUE 巡邏需 user 派 @Assistant；無 daemon/cron；user 不在線時 5 倍數事件不主動偵測（Round 7 gov-1）| dim 4.1 操作完備 + dim 6.5 governance feedback loop | framework 為 stateless agent；daemon 屬 runtime infra；目前是被動提醒非主動執行；user 紀律可控；長期累積疲勞債可接受 | v8.0+ LangGraph 遷移時 node-based scheduler 可解；或起 PROPOSAL 加輕量 cron daemon | 2026-05-07 | PROPOSAL_502_049 R7 gov-1 |
| KI-009 | 5 項 governance 組合（ADR-0042 + C-1 + C-2 + C-3 + C-4）無 cross-reference dashboard；user 看「整體治理健康」需翻 5 份報告手動拼裝（Round 7 gov-5）| dim 6.5 governance feedback loop | 治理機制設計面已完整；殘留為 UX 整合問題；不影響運行正確性 | v8.0+ generator 產 `docs/Reports/GOVERNANCE_HEALTH.md` aggregator；自動匯總 C-1/C-2 warn + AUDIT_HISTORY dim6 + KI 累積率 + walkthrough 收斂趨勢 | 2026-05-07 | PROPOSAL_502_049 R7 gov-5 |
| KI-010 | C-1 condition-claim validator 殘留 2 noise warn（PAUSED_TICKET_STALE 條文 vs 實作可能 false positive；supersedes ADR frontmatter 欄位非 validator claim 但 regex 命中）+ C-2 schema-completeness 18 warn 多為 noise（非 ROUTING_TICKET schema 欄位被 grep 命中）| dim 6.1 條文-實作一致性 + dim 6.4 schema completeness | v7.22 軟化門檻接受「真信號 ≤ 3」；2 真信號待補（PAUSED_TICKET_STALE 真 drift；其他多 noise）；不阻塞 milestone v2 凍結 | v8.x validator regex 精準化（更嚴限 ASCII identifier + scope-aware 過濾 frontmatter 欄位）；或 condition-claim 加 noise 白名單 | 2026-05-07 | PROPOSAL_502_049 R7 軟化門檻 |

---

## 引用規範

- `@Auditor` `rules/auditor.md §s03` 第 3 條 baseline 比對：先讀本檔；命中條目不重複扣分
- `@Retro` `rules/retro.md §s_root_cause`：根因分析時排除已 accept 的 KI 條目（防誤判反覆問題）
- `@Lead` 提案立案前比對：避免重立已 KI 的問題

## 禁止行為

- **絕對禁止** 不經 @Lead / @Retro 評估即新增 KI 條目（防 known-issues 變垃圾桶）
- **絕對禁止** 移除 KI 條目時不寫 commit 訊息引用原因（破壞稽核）
- **絕對禁止** 將「未立案問題」混入本檔當避稅手段（必經提案流程）

## 溯源

- 建立提案：PROPOSAL_20260502_005 E-1
- 立檔背景：Phase 1-4 並行 audit 發現多項已接受 exception 散在 CHANGELOG / 提案內，無統一追蹤導致重複發現

## Related Decisions

ADR-0027（Script 漏用防護機制；本檔屬類似 governance 治理層）/ ADR-0036（Rule Decomposition Patterns；token budget 條目）/ ADR-0037（Iron Theme；KI-001 來源）— 在 `decisions/`。
