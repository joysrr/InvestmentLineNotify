---
title: P8-02 色彩守護與死代碼清理完成報告
status: current
type: reference
last_updated: 2026-11-15
last_verified: 2026-11-15
tags: [p8, color-guard, dead-code, completed]
summary: P8-02 色彩守護與死代碼清理的完成報告，包含所有階段驗收結果。
related_code: []
related_docs: []
---

狀態：已完成　建立日期：2026-11-15　前置：階段一至五已完成（710/710、Initial 104.2 KB）　P8-01～P8-05 已全部驗收通過

一、目標與範圍

目標：把「設計令牌是唯一色彩來源」從口號變成可執行的 CI 強制規則，並清除路由重構後留下的死代碼與壞連結。

範圍內（5 張卡）：

1. 色彩守衛升級為含 rgba/rgb/hsl 的統一規則
2. rgba 存量清理 + 補齊暗色覆寫令牌
3. 死代碼清除（2 個視圖 + 孤兒元件盤點）
4. 路由／連結一致性修復
5. 回歸驗證與文件對齊

明確不做（沿用 project-wrap-up.md 的單人自用定位）：

· 不改任何視覺設計、不調色
· 不動 theory/ 組件的預存色（Class C 保留政策不變）
· 不加 Storybook、不加視覺回歸、不加多寬度測試
· 不重構 AccountView 結構（只修 panel=strategy 壞點）

預估總工作量：2.5–3.5 人日（前端 2.5、測試 0.5、文件 0.5）

---

二、CARD P8-01 · 色彩守衛統一（P0，0.5 日）

現狀盤點

· 涉及檔案：webapp/scripts/check-no-hex.mjs、webapp/package.json（lint script）、hex-audit-guard.test.js
· 現有實作：HEX_RE = /#[0-9a-fA-F]{3,8}\b/g，只走 .vue，只比對 <style> 區塊
· 依賴：npm run lint = eslint . && node scripts/check-no-hex.mjs

問題清單

☐ rgba/rgb/hsl 完全不受約束（高，規則漏洞根因）
☐ .js/.mjs 不掃描，icon-registry.js、tabsConfig.js 若有色值無法攔（中）
☐ 三套門檻並存（零容忍 / 50 / Class C 白名單），新人無法判斷哪個是準則（中）

改善方案

· 新增 webapp/scripts/check-no-raw-color.mjs，取代 check-no-hex.mjs：
· 正則涵蓋 #hex、rgb(、rgba(、hsl(、hsla(
· 掃描範圍擴為 src/**/\*.{vue,js,mjs}
· .vue 只看 <style>；.js/.mjs 排除 src/test/**
· 行內白名單註解：/* iln-color-allow: canvas */，用於 ECharts 與 canvas 必需場景
· 檔案白名單：src/styles/tokens.css（唯一令牌定義處）
· package.json 的 lint 改呼叫新腳本；舊腳本保留一版並標 @deprecated，下張卡移除
· 統一門檻：CI 零容忍；hex-audit-guard.test.js 的 50 門檻廢除，改為「新腳本 exit 0」單一判準

驗收標準

☐ npm run lint 在當前 main 上必然失敗，並列出全部 rgba 違規（作為基線清單）
☐ 白名單註解生效：加註解的檔案通過、未加註解的失敗
☐ tokens.css 不被判為違規
☐ 新腳本自身有單元測試（3 個 case：hex、rgba、白名單）

風險與回滾

風險：若直接掛進 CI，會讓 main 立即變紅。做法：P8-01 只交付腳本 + 產生基線清單，不掛進 CI；等 P8-02 清完才切換。回滾 = 改回舊 lint script。

---

三、CARD P8-02 · rgba 存量清理與暗色令牌補齊（P0，1 日）

現狀盤點

· FloatingPill.vue :global(.dark)：rgba(255,255,255,0.1)（邊框）、rgba(0,0,0,0.4)（陰影）
· MarketRadarView.vue：5 處（gradient / box-shadow）
· tokens.css 已有 --iln-border-subtle/default/strong 的暗色覆寫（rgba(255,255,255,0.08/0.12/0.18)），但 FloatingPill 沒用它
· --iln-shadow-3 有定義，但 FloatingPill 暗色塊另寫死陰影

問題清單

☐ FloatingPill 暗色塊硬寫 rgba，與 --iln-border-subtle、--iln-shadow-3 職責重疊（高，且是「令牌已存在卻不用」的典型）
☐ MarketRadar 5 處無對應令牌（中）

改善方案

· FloatingPill：刪除整個 :global(.dark) .floating-pill 規則，改用既有令牌；若 --iln-shadow-3 暗色下視覺不足，在 tokens.css 的暗色段新增 --iln-shadow-3 覆寫（在令牌層解決，不在組件層寫死）
· MarketRadar：逐處評估
· 屬陰影 → 收斂到 --iln-shadow-*
· 屬漸層 → 在 tokens.css 新增 --iln-gradient-* 語義令牌
· 若確為業務語義 → 依既有政策加 /* 業務語義色：... _/ + /_ iln-color-allow: business */ 雙註解
· 每處修改前後截圖比對（手動，不引入視覺回歸工具）

驗收標準

☐ P8-01 新腳本在 src/** 零違規（白名單與行內允許註解除外）
☐ tokens.css 新增令牌皆具暗色覆寫（若該令牌用於可切換主題處）
☐ 360px 下 FloatingPill 與 MarketRadar 外觀與改前一致（截圖佐證）
☐ 710 測試全綠、lint 0/0、bundle 不增（Initial ≤ 104.5 KB、Total ≤ 362 KB）

風險與回滾

暗色下陰影變淡是可預期副作用；以令牌層調整而非組件層繞過。回滾 = 單檔 git revert，無跨檔依賴。

---

四、CARD P8-03 · 死代碼清除（P1，0.5 日）

現狀盤點

· views/TechnicalView.vue（16.6 KB）：路由無引用；ChartView 用 components/chart/TechnicalPanel.vue
· views/TheoryView.vue（9.2 KB）：路由無引用；內容已入 AccountView 關於區
· 未確認：components/theory/*（ExposureDetail、ExposureSummary、KellyLeverageSummary、LifecycleDetail）是否仍被任何存活檔案引用

問題清單

☐ 兩個孤兒視圖（中，不進 bundle 但嚴重誤導後續維護與 AI 判斷）
☐ theory/ 元件可能連帶成孤兒（未知，需盤點）

改善方案

按以下順序執行，每步先驗證再刪：

```bash
cd webapp
# 1. 確認 TechnicalView 無引用
grep -rn "TechnicalView" src/ --include='*.vue' --include='*.js' | grep -v "TechnicalView.vue:"
# 2. 確認 TheoryView 無引用
grep -rn "TheoryView" src/ --include='*.vue' --include='*.js' | grep -v "TheoryView.vue:"
# 3. 確認 theory/ 元件引用來源
grep -rn "components/theory\|@/components/theory" src/ --include='*.vue' --include='*.js'
```

· 若第 3 步顯示只有 TheoryView.vue 引用 → components/theory/* 一併列入孤兒清單
· 刪除前先跑一次 npm run build，記錄 baseline bundle 數字
· 刪除後再跑 npm run build，確認 bundle 不變（證明確實不在圖中）
· 若 theory/* 需保留（例如 Class C 色彩政策指定不動），則移入 src/components/theory/legacy/ 並在 docs/design/README.md 加一行說明

驗收標準

☐ 兩個視圖檔案已刪除或移入 legacy/
☐ 刪除前後 bundle 數字完全一致（或下降）
☐ npm run test 710 全綠（若有測試直接測這兩個視圖，需同步移除並說明）
☐ grep -rn "TechnicalView\|TheoryView" webapp/src 回傳 0 筆（或僅 legacy 註解）
☐ 在 project-wrap-up.md 第七節技術債表加一行記錄本次清理

風險與回滾

風險：測試檔可能直接 import 這兩個視圖。做法：先跑 grep -rn "views/TechnicalView\|views/TheoryView" src/test，若有則一併評估（保留測試但改測 TechnicalPanel？或刪除）。回滾 = git revert。

---

五、CARD P8-04 · 路由與連結一致性（P1，0.5 日）

現狀盤點

· AccountView.vue：<router-link to="/account?panel=strategy">開啟策略編輯器</router-link>
· AccountView script：只處理 panel=about，無 panel=strategy 分支
· router/index.js：/strategy-config 為獨立路由，不在 5 個一級入口內
· App.vue rootPaths：["/", "/dashboard", "/radar", "/news", "/theory", "/account"]，其中 /radar、/theory 已是 redirect

問題清單

☐ ?panel=strategy 是壞連結，點擊無反應（高，使用者可見的功能壞點）
☐ App.vue rootPaths 含已 redirect 路徑，語義過時（低）
☐ AccountView 註解「4 組」與實際 3 組不符（低）

改善方案

· panel=strategy 二選一（需開發者決策，建議 A）：
· A（建議）：改為 <router-link to="/strategy-config">，語義直接，不動 AccountView 結構
· B：在 AccountView 補 watch(route.query.panel) 展開對應分組並嵌入 StrategyConfigEditor
· 選擇理由：A 成本最低且 /strategy-config 已是可用路由；B 會讓 AccountView 從「設定頁」變成「設定 + 編輯器」，違反 5.5 已定的職責邊界
· App.vue rootPaths 改為 ["/dashboard", "/insights", "/chart", "/news", "/account"]，與 5 個一級入口一致
· AccountView 註解修正為「3 組」

驗收標準

☐ 從 AccountView 點「開啟策略編輯器」實際跳轉成功（Playwright 或手動截圖）
☐ rootPaths 與 router 的 5 個一級入口一致（可加一個單元測試斷言兩者相等）
☐ 710 測試全綠

風險與回滾

選 A 幾乎零風險。若先前有書籤指向 ?panel=strategy，加一條 redirect 或忽略（單人自用，無外部使用者）。

---

六、CARD P8-05 · 回歸驗證與文件對齊（P0，0.5 日）

內容

1. 切換 package.json 的 lint 為 check-no-raw-color.mjs，移除舊腳本
2. 刪除或改寫 hex-audit-guard.test.js 的 50 門檻，統一為新腳本判準
3. 修正 docs/webapp-refactor-plan.md frontmatter：status: project-completed、last_updated: 2026-11-15
4. 在 docs/design/HEX_AUDIT_2026-11-12.md 末尾加「2026-11-15 規則升級」段，說明 rgba 已納管、三套門檻已統一
5. docs/design/DESIGN_PRINCIPLES.md 補一節「色彩的允許與禁止」，取代散落的三份文件口徑

驗收標準

☐ npm run lint 通過且只有一套色彩判準
☐ 故意在 .vue style 加一行 color: rgba(0,0,0,.5) → lint 失敗；加 /* iln-color-allow: test */ → 通過（手動驗證規則真的生效）
☐ npm run test 710 全綠
☐ npm run build → Initial ≤ 104.5 KB、Total ≤ 362 KB
☐ npx playwright test --grep "360" 8/8 通過
☐ 母計畫 frontmatter 與內文狀態一致

---

七、推進順序

```
P8-01（腳本 + 基線清單，不掛 CI）
  → P8-02（清 rgba，新腳本轉綠）
  → P8-05 步驟 1–2（切換 CI、統一門檻）   ← 到這裡規則才真正生效
  → P8-03（死代碼）∥ P8-04（路由一致性）  ← 可並行，互不依賴
  → P8-05 步驟 3–5（文件對齊）
```

關鍵順序約束：P8-05 的 CI 切換必須在 P8-02 之後，否則 main 會紅。

---

八、完成定義

· 新增一行 rgba，CI 會擋下來（不是靠人記得）
· webapp/src/ 內找不到 TechnicalView、TheoryView
· AccountView 的「開啟策略編輯器」真的能開
· 色彩規則在 repo 內只有一種說法
· 710/710、lint 0/0、bundle 在預算內、360px E2E 8/8

不在完成定義內：Class C 業務語義色是否該 token 化（維持既有政策）、theory 組件色彩、深色模式完整審計（階段六已取消）。
