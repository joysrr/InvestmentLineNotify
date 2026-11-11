---
type: plan
status: completed
last_updated: 2026-09-12
last_verified: 2026-11-11
progress: 100%
tags:
  - webapp
  - ux
  - dashboard
  - mobile-rwd
  - macro-regime
  - "[[Dashboard View]]"
  - "[[Market Snapshot]]"
  - "[[Macro Regime Advanced Spec]]"
summary: "Mini App 三層金字塔 UX 架構設計規格"
related_code:
  - scripts/analyze-docs-health.mjs
related_docs:
  - docs/modules/presentation/_index.md
wiki_links:
  - [[UX]]
  - [[Mini App]]
---

# Mini App 儀表板三層金字塔整合與 UX 瘦身計畫 (DASHBOARD_UX_PYRAMID_SPEC)

> **目標**: 解決 Mini App 首頁指標過多導致的手機認知負荷與排版擁擠問題。透過「三層金字塔收斂架構」（L1 核心行動卡、L2 雙核心駕駛艙、L3 漸進式抽屜折疊），在不遺失任何專業數據的前提下，讓手機第一屏直觀清晰、零多餘雜訊。

---

## 1. 主流行動理財最佳實踐調研 (Robinhood, Apple Stocks, Binance)

綜合 Robinhood、Apple Stocks 等主流產品的手機設計規範，歸納出行動理財最佳模式：

1. **單手拇指熱區 (Thumb Zone)**：次級數據明細一律採用 **底層滑出抽屜 (Bottom Sheet)**，高度設定在 `70%~85%`，向下滑動即關閉，避免頂部點擊負擔。
2. **階梯漸進呈現 (Progressive Disclosure)**：
   - 第一屏：只給「決策燈號」與「兩大核心狀態」。
   - 點擊互動：卡片本身即是可觸控按鈕（附微小的 `chevron-right` 提示）。
3. **高對比度緊湊資訊卡 (Compact Glanceable Cards)**：
   - 避免 3 張窄欄硬排。改採**垂直全寬堆疊卡（Full-width Cards）**，確保 360px 窄螢幕下大字體不折行、數字與說明清晰。

---

## 2. 三層金字塔收斂架構 (Pyramid Architecture)

```text
┌─────────────────────────────────────────────────────────────┐
│ 【L1: 今日核心決策卡】(DecisionHero)                         │
│ • 今日行動建議: 0050 DCA $60,000 / 戰術加碼凍結               │
│ • 當日投資亮點一覽                                          │
├─────────────────────────────────────────────────────────────┤
│ 【L2: 雙核心駕駛艙】(Dual-Core Cockpit)                      │
│ 1. 總經象限卡 (Macro Cockpit Card):                         │
│    - 左側：🟢 強趨勢多頭 徽章 + 動能 70% 順勢進攻            │
│    - 右側：VIX 14.2 數值 + [明細 ❯] (點擊彈出 L3 抽屜)        │
│ 2. 資產安全條 (Portfolio Shield Card):                      │
│    - 左側：🛡️ 285% 維持率 (安全)                            │
│    - 右側：耐跌緩衝 38% + [風控 ❯] (點擊彈出 L3 抽屜)        │
├─────────────────────────────────────────────────────────────┤
│ 【L3: 漸進式抽屜與折疊】(Progressive Disclosure)             │
│ • 市場環境 Drawer (Bottom Sheet):                           │
│   - VIX 恐慌指數、PB 歷史分位數 (PR)、景氣燈號、大盤融資增減比 │
│ • 資產風控 Drawer (Bottom Sheet):                           │
│   - 總槓桿率 (Gross Leverage)、生命週期上限、質押與債券壓艙石│
│ • 策略狀態折疊 (Accordion): 預設收合，點開看各因子加減分明細 │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 分階段實作路線圖 (Phased Roadmap)

### Phase 1: 視覺整合組件設計與 Props 重構

- 設計 `MacroCockpitCard.vue` (整併 VIX, 四象限狀態, 趨勢提示)。
- 設計 `PortfolioShieldCard.vue` (整併維持率、槓桿率、耐跌緩衝進度條)。
- 建立對應單元測試，驗證邊界值（極端高估、恐慌崩盤、斷頭維持率）狀態燈號顯示。

### Phase 2: L3 漸進式抽屜 (Drawers) 與評分折疊實作

- 實作 `MarketDetailDrawer.vue`：呈現 VIX 走勢、PB 歷史分位數、景氣燈號歷史、大盤融資熱度。
- 實作 `RiskDetailDrawer.vue`：呈現總槓桿率 (Gross Leverage) 階梯、動態去槓桿閥值、債券壓艙石配比。
- 首頁評分矩陣收斂為可展開/折疊的手風琴結構 (`el-collapse`)，預設收合。

### Phase 3: 首頁 `DashboardView.vue` 佈局重構與 RWD 驗證

- 替換舊版分散的卡片排版，套用雙核心駕駛艙。
- 手機直式 (寬度 360px ~ 430px) 響應式排版測試，確保無橫向滾動條、內邊距舒適。
- 保持深淺色主題 (Telegram WebApp Theme Params) 變數相容。

### Phase 4: E2E 流程驗證與打包上線

- 運行 Playwright E2E 驗證首頁掛載、抽屜展開關閉、手風琴切換流暢度。
- 前端 `npm run build` 產物大小與打包驗證。
- 更新 Wiki 索引與完成封存。
