---
type: reference
status: current
last_updated: 2026-11-10
tags:
  - documentation
  - index
  - architecture
  - navigation
wiki_links:
  - [[Architecture]]
  - [[Operations]]
  - [[Strategy Engine]]
  - [[AI Pipeline]]
---

# InvestmentLineNotify 文件庫導航中樞 (Documentation Hub)

歡迎查閱 InvestmentLineNotify 技術與架構文件庫。本文件為全專案文件的**導航中樞與核心真理定錨點**。

---

## 🏛️ 單一真理之源 (Single Sources of Truth)

在進行任何功能開發、除錯或架構調整前，請先確認以下核心真理，嚴禁參考已封存或過時之歷史草稿：

1. **API 規格真理之源**：
   - 唯一的後端 HTTP API 規格為 [`docs/api/openapi.json`](./api/openapi.json)（OpenAPI 3.0 規範，共 51 個端點）。
   - 根目錄之 `swagger.json` 僅為早期遺留產物，非現行規格。

2. **資金與資產配置真理**：
   - **投資視野**：20-30 年長期投資，目標 55 歲退休。
   - **核心配置**：0050 (1x 槓桿) 只買不賣；P0 固定定期定額（3 萬/月）為最高執行紀律，無條件執行。
   - **衛星配置**：00675L (2x 槓桿) 逢低加碼、80% 停利；00740B 美債作為利息現金流防禦錨點。
   - **房屋增貸現況**：增貸 150 萬元已於 2026-11 **全數投入完畢**（105 萬元投入 0050，45 萬元投入 00740B 配對利息現金流）。增貸子彈已歸零，`portfolio.cash` 為純自有現金儲備。
   - **行動建議分級**：嚴格區分「P0 固定 DCA（綠色無條件執行）」與「現金驅動曝險建議（手動操作參考，非自動加碼）」。

3. **系統運維與架構原則**：
   - **排程獨立**：每日計算排程（`dailyCheck`）由主機系統層 System Cron 獨立排定執行，非 Agent 內部排程。
   - **完全內聚自給自足**：專案全面採用 Node.js 原生 ESM（`.mjs`），嚴格禁止混雜 Python 腳本或執行跨專案指令。
   - **路徑動態相對化**：嚴禁硬編碼絕對路徑，所有檔案與儲存路徑均採動態相對解析，完全相容於容器與本機 VM 環境。
   - **正式主機隔離**：在取得並驗證正式主機路徑前，嚴禁假設 production/PM2 目錄或宣稱完成正式部署。

---

## 📂 文件庫目錄導航地圖

```
docs/
├── README.md                      # [本文件] 文件庫導航中樞與真理源
├── API_CONTRACT.md                # API 契約管理與 Contract-First 開發規範
├── DEPLOYMENT_CHECKLIST.md        # 生產環境部署與驗收檢查清單
├── E2E_TESTING_GUIDE.md           # Playwright E2E 測試指南與最佳實踐
├── TECHNICAL_INDICATORS_SPEC.md   # 技術指標（RSI, KD, MACD）與訊號判讀規格
├── TESTING.md                     # Vitest 單元測試與整合測試指南
├── TEST_TROUBLESHOOTING.md        # 測試疑難排解指南
├── useApiRequest-guide.md         # 前端 API 請求 Composable 指南
│
├── api/                           # API 規格定義
│   └── openapi.json               # OpenAPI 3.0 真理之源 (51 paths)
│
├── architecture/                  # 架構決策與理論框架
│   ├── theoretical-framework.md   # 五大投資理論框架與公式定義
│   ├── DEC-005-monitoring-alerting.md # 監控與告警架構決策
│   ├── DEC-006-deployment-automation.md # 部署自動化決策
│   └── README.md                  # 架構決策 (ADR/DEC) 索引
│
├── decisions/                     # 重大技術問題決策紀錄
│   └── DEC-016-vitest-worker-crash.md # Vitest Worker Crash 除錯與解決方案
│
├── design/                        # 系統設計與 UI/UX 規範
│   └── BUDGET_PRIORITY_DESIGN.md  # 預算優先級與分層策略設計
│
├── modules/                       # 核心子模組技術規格
│   ├── infrastructure/            # 基礎設施層（儲存、歷史數據、快取）
│   ├── strategy/                  # 策略引擎、指標雷達、生命週期健康診斷
│   ├── presentation/              # 前端 Mini App 與 API 對接規格
│   ├── operations/                # 運維環境變數與排程說明
│   └── ai_news/                   # AI 新聞分析、Langfuse 觀測與提示詞管理
│
├── operations/                    # 運維操作手冊
│   ├── security-policy.md         # 專案安全政策與 SSH Key 輪換 SOP
│   ├── production-code-deploy.md  # 正式環境代碼部署標準程序
│   ├── production-artifact-sync.md# 正式環境資料同步規範
│   └── deployment-agent.md        # 部署 Agent 自動化規格
│
├── plans/                         # 實作計畫管理
│   ├── active/                    # 正在執行中的計畫（限當前進行中任務）
│   └── completed/                 # 已完成驗收之實作計畫封存
│
├── research/                      # 投資量化研究報告
│   ├── investment-theories-current-system-guide.md # 投資理論實作指南
│   └── leveraged-etf-kelly-dynamic-leverage-review.md # 槓桿 ETF 凱利公式評估
│
├── verification/                  # 邏輯驗證與資料契約核實報告
│   ├── STRATEGY_ENGINE_VERIFICATION_REPORT.md # 策略引擎驗證報告
│   ├── theoretical-framework-validation-v2.md # 理論架構二期驗證
│   ├── hardcoded-parameters-inventory.md     # 硬編碼參數盤點報告
│   ├── personalized-design-inventory.md      # 用戶個人化設計盤點清單
│   └── personalized-design-system-impact-summary.md # 個人化設計架構影響摘要
│
└── meta/                          # 文件庫健康度與 Wiki 索引維護
    ├── documentation-standards.md # 文件寫作規範與 YAML Frontmatter 定義
    └── maintenance-schedule.md    # 定期維護行程
```

---

## 🛠️ 維護與檢驗工具

在修改或新增任何 `docs/` 內的 Markdown 文件後，必須執行以下驗證腳本，確保知識圖譜完整且通過 pre-commit 檢查：

```bash
# 1. 檢查 YAML Frontmatter 格式規範
node scripts/pre-commit-docs-check.mjs

# 2. 重新掃描全庫並生成 Wiki 索引
node scripts/generate-wiki-index.mjs

# 3. 驗證 Wiki 索引無斷鏈且概念映射完整
node scripts/validate-wiki-index.mjs

# 4. 分析文件庫健康度評分
node scripts/analyze-docs-health.mjs
```
