---
type: plan
status: in-progress
last_updated: 2026-09-12
progress: 10%
tags:
  - webapp
  - ux
  - dashboard
  - mobile-rwd
  - macro-regime
wiki_links:
  - "[[Dashboard View]]"
  - "[[Market Snapshot]]"
  - "[[Macro Regime Advanced Spec]]"
---

# Mini App 儀表板三層金字塔整合與 UX 瘦身計畫 (DASHBOARD_UX_PYRAMID_SPEC)

> **目標**: 解決 Mini App 首頁指標過多導致的手機認知負荷與排版擁擠問題。透過「三層金字塔收斂架構」（L1 核心行動卡、L2 雙核心駕駛艙、L3 漸進式抽屜折疊），在不遺失任何專業數據的前提下，讓手機第一屏直觀清晰、零多餘雜訊。

---

## 1. 核心痛點與架構收斂

### 1.1 現有問題

1. **橫向 3 欄擠壓**: `MarketSnapshot.vue` 的 VIX、PB PR、景氣燈號在寬度較小的手機螢幕容易字體換行或貼邊。
2. **風控指標散落**: 維持率、總槓桿率 (Gross Leverage) 與質押借貸額度分開呈現，難以一眼評估「還能耐受幾 % 跌幅」。
3. **因子評分組雜訊**: 4 大因子組（技術、估值、籌碼、極值）直接佔據縱向長空間，日常決策只需看結論。

### 1.2 三層金字塔架構 (Pyramid Architecture)

```text
┌─────────────────────────────────────────────────────────────┐
│ 【L1: 今日核心決策卡】(DecisionHero)                         │
│ • 今日行動建議: 0050 DCA $60,000 / 戰術加碼凍結               │
│ • 當日投資亮點一覽                                          │
├─────────────────────────────────────────────────────────────┤
│ 【L2: 雙核心駕駛艙】(Dual-Core Cockpit)                      │
│ 1. 總經象限卡 (Macro Cockpit):                              │
│    - 象限徽章 (如: 🟢 強趨勢多頭) + 戰術主導方向             │
│    - 點擊卡片 -> 開啟 [市場環境抽屜 L3]                      │
│ 2. 資產安全條 (Portfolio Shield):                           │
│    - 維持率視覺條 + 安全燈號 + 距警戒線耐跌空間 (%)          │
│    - 點擊卡片 -> 開啟 [資產風控抽屜 L3]                      │
├─────────────────────────────────────────────────────────────┤
│ 【L3: 漸進式抽屜與折疊】(Progressive Disclosure)             │
│ • 市場環境 Drawer: VIX, PB PR 分位數, 景氣燈號, 融資增減比  │
│ • 資產風控 Drawer: 總槓桿率, 質押明細, 生命週期推薦上限     │
│ • 因子評分折疊 (Accordion): 4 大組得分、動態權重明細         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 分階段實作路線圖 (Phased Roadmap)

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
