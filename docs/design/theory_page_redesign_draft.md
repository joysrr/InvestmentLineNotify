---
type: report
status: current
last_updated: 2026-10-29
tags:
  - theory-page
  - ui-redesign
  - design-draft
  - phase-5-4
wiki_links:
  - investment-theories-current-system-guide
---

# 投資理論頁面重新設計草擬

本文件為 Phase 5.4 Stage C 的重新設計方案，針對用戶回饋：

1. Phase C 新增區塊與原先理論頁面內容部分重複
2. 詳細頁面內容未依照各自指標描述（仍有模板化痕跡）
3. 需重新分析 Human Capital、True Exposure、Crash Tolerance、Laplace、Tobin 分離 五個理論的呈現方式
4. 需確認後端 `/api/report/latest-theoretical` 接口是否完整實作
5. 需避免前端頁面風格不一致、後端資料串接不完全

---

## 1. 目前頁面現狀分析

### 1.1 現有 7 個卡片與 Detail 對應

| #   | 理論                        | 摘要卡片              | Detail 頁面          | 後端欄位                     | 狀態            |
| --- | --------------------------- | --------------------- | -------------------- | ---------------------------- | --------------- |
| 1   | 凱莉公式 (Kelly)            | KellyLeverageSummary  | KellyLeverageDetail  | kellyLeverage.*              | ✅ 現有         |
| 2   | 市場曝險 (Exposure)         | ExposureSummary       | ExposureDetail       | grossExposure, exposureRatio | ✅ 現有         |
| 3   | 生命週期 (Lifecycle)        | LifecycleSummary      | LifecycleDetail      | lifecycleAllocation          | ✅ 現有         |
| 4   | 輸入數據 (InputData)        | InputDataSummary      | InputDataDetail      | mappedInputs.inputs          | ✅ 現有         |
| 5   | 人力資本 (HumanCapital)     | HumanCapitalSummary   | HumanCapitalDetail   | humanCapital.*               | ⚠️ Phase C 新增 |
| 6   | 真實曝險 (TrueExposure)     | TrueExposureSummary   | TrueExposureDetail   | trueExposure.*               | ⚠️ Phase C 新增 |
| 7   | 崩盤耐受度 (CrashTolerance) | CrashToleranceSummary | CrashToleranceDetail | crashTolerance.*             | ⚠️ Phase C 新增 |

### 1.2 已識別問題

| 問題                                               | 說明                                                                             | 嚴重度 |
| -------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| Tobin 分離無獨立卡片                               | 僅嵌在 ExposureDetail 內一小段文字，無獨立摘要卡片                               | 高     |
| Laplace 完全缺失                                   | 無卡片、無 Detail、無後端欄位組裝                                                | 高     |
| 5 個 Phase C Detail 內容模板化                     | Zone 區間、公式區塊結構相同，文字雖不同但缺乏各指標特色深度                      | 中     |
| Human Capital / True Exposure 與 Exposure 邊界模糊 | 容易讓使用者混淆「市場曝險」vs「真實曝險（納入人力資本）」                       | 中     |
| 後端 laplaceCriterion / tobinSeparation 未組裝     | `dailyCheckTheoreticalAdapter` 未將這兩個函數結果寫入 `theoreticalShadow.theory` | 高     |

---

## 2. 重新設計後的頁面佈局

### 2.1 摘要視圖 (Summary View)

```
┌─────────────────────────────────────────────────────┐
│ 🎯 投資健康度儀表板                                  │
│ 📊 理論分析（截至 YYYY-MM-DD 收盤）                  │
├─────────────────────────────────────────────────────┤
│ [卡1 凱莉] [卡2 曝險] [卡3 生命週期] [卡4 輸入數據]  │  Row 1
│ [卡5 人力資本] [卡6 真實曝險] [卡7 崩盤耐受度]       │  Row 2
│ [卡8 拉普拉斯] [卡9 托賓分離]                        │  Row 3 (2 cards)
├─────────────────────────────────────────────────────┤
│ ⚠️ 免責聲明 (統一卡片，底部)                         │
└─────────────────────────────────────────────────────┘
```

每個摘要卡片統一結構：

- 標題：圖標 + 理論名稱 (例如 `💼 人力資本 (Human Capital)`)
- 關鍵指標行：1-2 行最重要數值 (例如 `人力資本金額: 3,000,000 TWD`)
- 狀態標籤：OK / ESTIMATED / UNAVAILABLE (使用 theme CSS 變數)
- 按鈕：`🔍 查看詳情` → 觸發 `view-detail` 事件
- UNAVAILABLE 狀態：顯示原因提示，不顯示 `--`

### 2.2 詳情視圖 (Detail View)

```
┌─────────────────────────────────────────────────────┐
│ ← 返回  📋 XXXX詳細分析                              │
├─────────────────────────────────────────────────────┤
│ ●●●● 當前狀態 (狀態網格，3-4 個指標項)             │
├─────────────────────────────────────────────────────┤
│ 📖 理論說明                                          │
│   ┌─────────────────────────────────────────────┐   │
│   │ 理論子標題 (例如: 人力資本 Human Capital)     │   │
│   │ 理論文字說明 (針對該指標撰寫獨立內容)          │   │
│   │ 公式區塊: HC = Σ (收入 ÷ (1+折現率)^t)         │   │
│   │ 關鍵參數列表                                    │   │
│   └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ ⚖️ 區間判斷 (Zone 卡片: 安全/適度/風險，各自客製化)   │
├─────────────────────────────────────────────────────┤
│ 🔢 計算參數與數據來源 (溯源資訊)                     │
├─────────────────────────────────────────────────────┤
│ ⚠️ 免責聲明 (統一元件，複用)                         │
└─────────────────────────────────────────────────────┘
```

---

## 3. 五個重新分析理論的呈現方案

### 3.1 人力資本 (Human Capital)

**定位**：衡量「未來勞動收入現值」，與金融資本並列，是風險承受上限的參考基準。

**摘要卡片**：

- 關鍵指標：人力資本金額 (TWD)、人資佔比 (%)
- 狀態：OK / ESTIMATED / UNAVAILABLE

**Detail 區塊**：

1. **當前狀態**：人力資本金額、計算狀態、數據時間點
2. **理論說明**：人力資本 = 未來勞動收入的現值，是投資組合中除金融資本外的另一大資本來源。人力資本隨年齡遞減，退休後趨近於零。人資佔比越高，代表未來收入依賴度越大，理論上可承受較高投資風險。
3. **計算公式**：`HC = Σ (年收入 ÷ (1 + 折現率)^t)`，參數：年收入 120 萬、退休年限 25 年、折現率 3% (目前為固定暫定值)
4. **區間判斷**：人力資本 > 金融資本 (充足區) / ≈ (適度區) / < (偏低區)
5. **與投資決策關聯**：僅供參考，P0 DCA 綠色無條件執行不受影響

### 3.2 真實曝險 (True Exposure)

**定位**：納入人力資本後的「真實風險曝險比例」，區別於單純看財務資本的市場曝險。

**摘要卡片**：

- 關鍵指標：真實曝險比例 (%)、總曝險金額 (TWD)
- 狀態：OK / ESTIMATED / UNAVAILABLE

**Detail 區塊**：

1. **當前狀態**：真實曝險比例、總曝險、財務資本、人力資本
2. **理論說明**：真實曝險 = 總曝險 ÷ (財務資本 + 人力資本)。區別於「市場曝險 = 總曝險 ÷ 財務資本」，納入人力資本後分母變大，曝險比例更保守、更真實。
3. **計算公式**：`True Exposure = Gross Exposure ÷ (Financial Capital + Human Capital)`
4. **區間判斷**：< 1.0 (保守) / 1.0-1.5 (適度) / > 1.5 (積極)
5. **與 Exposure 的區別說明**：Exposure 只看財務資本；True Exposure 納入人力資本後更完整

### 3.3 崩盤耐受度 (Crash Tolerance)

**定位**：衡量在極端市場下跌前，距離強制平倉 (爆倉) 的緩衝空間。

**摘要卡片**：

- 關鍵指標：崩盤耐受度 (%)、距離爆倉的下跌空間 (%)
- 狀態：OK / ESTIMATED / UNAVAILABLE

**Detail 區塊**：

1. **當前狀態**：崩盤耐受度、目前維繫率、目標維繫率 (30%)
2. **理論說明**：崩盤耐受度 = 1 - 目標維繫率 / 目前維繫率。代表市場可下跌多少百分比後觸發補保或強制平倉。數值越高，緩衝空間越大。
3. **計算公式**：`Crash Tolerance = 1 - Target Maintenance ÷ Current Maintenance`
4. **區間判斷**：> 50% (安全) / 30-50% (觀察) / < 30% (危險)
5. **風險提示**：低於閾值時需減槓桿，但 P0 DCA 繼續執行

### 3.4 拉普拉斯準則 (Laplace Criterion) — 新增

**定位**：極端情景下的最壞結果評估，用於壓力測試參考，採 Minimax 原則。

**摘要卡片**：

- 關鍵指標：最壞情景損失 (%)、情景樣本數
- 狀態：OK / ESTIMATED / UNAVAILABLE

**Detail 區塊**：

1. **當前狀態**：最壞情景損失、樣本數、數據時間點
2. **理論說明**：Laplace 準則 = 在所有可能情景中，選擇「最壞結果最小」的策略。適用於數據不足、不確定性高時的保守決策參考。
3. **計算公式**：`Minimax = min( max(各情景損失) )`
4. **情景列表**：COVID 熔斷、熊市震盪、閃崩、估值回歸 (4 種壓力情境)
5. **註記**：僅供研究參考，不影響 P0 DCA 執行

### 3.5 托賓分離定理 (Tobin Separation) — 新增獨立卡片

**定位**：將「風險資產配置」與「融資決策」分離，明確風險資產與無風險資產的比例。

**摘要卡片**：

- 關鍵指標：風險資產比例 (%)、無風險資產比例 (%)
- 狀態：OK / ESTIMATED / UNAVAILABLE

**Detail 區塊**：

1. **當前狀態**：風險資產金額、無風險資產金額、風險資產比例
2. **理論說明**：托賓分離定理 = 投資決策可分為兩步：(a) 確定最佳風險資產組合 (與個人風險偏好無關)，(b) 根據風險偏好決定風險資產與無風險資產的配比。分離後，風險資產組合對所有投資者相同，只調整風險/無風險比例。
3. **計算公式**：風險資產比例 = 風險資產價值 ÷ 總資產
4. **與 Exposure 的區別**：Exposure 只看總曝險金額；Tobin 分離進一步區分「風險資產」vs「無風險資產」
5. **與 Kelly 的關係**：Kelly 給出槓桿上限；Tobin 給出資產類別配比

---

## 4. 內容重複性分析與避免方案

| 重複項目         | 目前狀態                            | 避免方案                                                                                       |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| 狀態網格結構     | 7 個 Detail 都有相同 HTML 結構      | 統一 CSS 類名，但每個 Detail 顯示各自指標的數據與標籤                                          |
| Zone 區間判斷    | 每個 Detail 都有 zone-item          | 每個 Detail 的 zone 名稱、範圍、描述必須針對該指標**客製化寫死**，不可複製其他指標的 zone 文字 |
| 免責聲明         | 每個 Detail 都有獨立 disclaimer-box | 建立統一 `DisclaimerCard.vue` 元件，所有 Detail 複用                                           |
| 公式區塊         | 每個 Detail 都有 formula-box        | 每個 Detail 顯示該指標專屬公式，嚴禁複製 Kelly 公式 (currentLeverage, halfKelly 等)            |
| 「理論說明」文字 | 有模板化痕跡                        | 每個 Detail 的 `theory-text` 必須針對該指標撰寫**獨立內容**，禁止複製貼上                      |

---

## 5. 風格統一規範 (Design System)

| 項目             | 規範                                       | 備註                     |
| ---------------- | ------------------------------------------ | ------------------------ |
| 卡片標題         | `theory-card-title`，圖標 + 文字           | 所有卡片相同             |
| 狀態標籤         | `var(--tg-theme-text-color)` + `rgba` 背景 | **禁止硬編碼 hex 色碼**  |
| 關鍵指標行       | `exposure-row` (標籤 + 數值)               | 所有卡片相同             |
| 詳情按鈕         | `🔍 查看詳情`，觸發 `view-detail`          | 所有卡片相同             |
| UNAVAILABLE 狀態 | 顯示原因提示，不顯示 `--`                  | 所有卡片相同             |
| Detail 導航      | 返回按鈕 + 標題，`detail-header`           | 所有 Detail 相同         |
| Detail 區塊      | `detail-section` + `section-title`         | 所有 Detail 相同         |
| 免責聲明         | 複用 `DisclaimerCard.vue`                  | 所有 Detail 複用同一元件 |

---

## 6. 後端 API 驗證清單

### 6.1 接口確認

| 項目         | 路徑                             | 方法 | 狀態      | 檔案                                      |
| ------------ | -------------------------------- | ---- | --------- | ----------------------------------------- |
| 理論數據查詢 | `/api/report/latest-theoretical` | GET  | ✅ 已實作 | `src/api/routes/reports.mjs`              |
| 前端數據獲取 | `useTheoryData()`                | -    | ✅ 已實作 | `webapp/src/composables/useTheoryData.js` |

### 6.2 後端理論欄位完整性檢查

`dailyCheckTheoreticalAdapter.mjs` 組裝的 `theoreticalShadow.theory` 欄位：

| 欄位                 | 對應理論       | 來源函數                      | 狀態            |
| -------------------- | -------------- | ----------------------------- | --------------- |
| grossExposure        | Exposure       | calculateGrossExposure        | ✅              |
| currentLeverage      | Kelly          | calculateKellyLeverage        | ✅              |
| accountNetAsset      | 所有           | mappedInputs.inputs           | ✅              |
| estimatedMaintenance | CrashTolerance | calculateEstimatedMaintenance | ✅              |
| kellyLimits          | Kelly          | calculateKellyLimits          | ✅              |
| humanCapital         | HumanCapital   | calculateHumanCapital         | ✅ (固定暫定值) |
| trueExposure         | TrueExposure   | calculateTrueExposure         | ✅              |
| crashTolerance       | CrashTolerance | calculateCrashTolerance       | ✅              |
| marketRegime         | Kelly/Laplace  | calculateMuSigma              | ✅              |
| laplaceCriterion     | **Laplace**    | calculateLaplaceCriterion     | ❌ **未組裝**   |
| tobinSeparation      | **Tobin**      | calculateTobinSeparation      | ❌ **未組裝**   |

### 6.3 需後端補強的項目

1. **`dailyCheckTheoreticalAdapter.mjs`**：加入 `calculateLaplaceCriterion` 與 `calculateTobinSeparation` 的調用，將結果寫入 `theory.laplaceCriterion` 與 `theory.tobinSeparation`
2. **`calculateHumanCapital`**：目前使用固定值 (年收入 120 萬、退休 25 年、折現率 3%)，需在註解標註為「暫定值，待用戶設定檔實作後可配置」

---

## 7. 詳細實作計畫 (階段式 TDD)

### Phase 1: 後端 API 驗證與補強 (預估 2-3 小時)

- [ ] 驗證 `/api/report/latest-theoretical` 回傳所有現有 7 個理論欄位
- [ ] 在 `dailyCheckTheoreticalAdapter.mjs` 加入 `calculateLaplaceCriterion` 與 `calculateTobinSeparation` 調用
- [ ] 撰寫後端測試確認新欄位正確回傳 (TDD: RED → GREEN)
- [ ] Commit + 更新計畫文件

### Phase 2: 新增 Laplace 與 Tobin 卡片與 Detail (預估 4-6 小時)

- [ ] 建立 `LaplaceSummary.vue` + `LaplaceDetail.vue` (TDD: 先寫測試)
- [ ] 建立 `TobinSeparationSummary.vue` + `TobinSeparationDetail.vue` (TDD: 先寫測試)
- [ ] 註冊到 `TheoryView.vue` (7 → 9 個卡片，detailType 擴充)
- [ ] Commit + 更新計畫文件

### Phase 3: 重新設計現有 5 個 Detail 內容 (預估 4-6 小時)

- [ ] `HumanCapitalDetail.vue`：重寫理論說明、公式、區間判斷 (針對人力資本特性)
- [ ] `TrueExposureDetail.vue`：重寫理論說明、與 Exposure 的區別說明
- [ ] `CrashToleranceDetail.vue`：重寫理論說明、維繫率關聯
- [ ] `ExposureDetail.vue`：移出 Tobin 分離內容 (避免與新 Tobin 卡片重複)
- [ ] `KellyLeverageDetail.vue`：確認無重複，僅微調
- [ ] Commit + 更新計畫文件

### Phase 4: 風格統一與風險檢查 (預估 2 小時)

- [ ] 檢查所有卡片/Detail 使用 `var(--tg-theme-*)`，無硬編碼 hex
- [ ] 檢查各 Detail 內容無互相複製 (特別是 Zone 文字與公式)
- [ ] 前端完整測試 (67/67 files, 420+ tests pass)
- [ ] 後端完整測試 (187/188 files, 1899+ tests pass)
- [ ] Commit + 更新計畫文件

### Phase 5: 部署驗證 (用戶手動執行)

- [ ] 前端 `npm run build --mode production` (在 webapp/)
- [ ] PM2 重啟相關服務
- [ ] 確認 9 個卡片皆正常顯示，數據非 `--`

---

## 8. 風險與假設

| 項目       | 說明                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| **假設**   | 用戶授權在理論頁面增加 Laplace 與 Tobin 兩個新卡片 (總計 9 個)                               |
| **風險**   | Laplace 與 Tobin 後端計算函數可能需要額外輸入參數，需確認 `theoreticalEngine.mjs` 的函數簽名 |
| **原則 1** | 所有理論值皆為 SHADOW_ONLY，不影響交易決策                                                   |
| **原則 2** | P0 DCA 綠色無條件執行，不受任何理論頁面影響                                                  |
| **原則 3** | TDD 強制：先寫測試 (RED)，再寫實作 (GREEN)，最後 Commit                                      |

---

## 9. 待用戶確認事項

請確認以下內容後，我將開始 Phase 1 實作：

1. **9 個卡片編排** (凱莉、曝險、生命週期、輸入數據、人力資本、真實曝險、崩盤耐受度、拉普拉斯、托賓分離) 是否合適？
2. **五個重新分析理論的呈現內容**是否符合預期？有無需要調整的區塊？
3. **後端補強項目** (Laplace、Tobin 欄位組裝) 是否需要立即實作？
4. **實作計畫的階段劃分**是否可接受？

確認後，我將依照 TDD 流程從 Phase 1 開始實作。
