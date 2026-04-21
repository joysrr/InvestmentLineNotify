# 📋 InvestmentLineNotify AI Agents 系統評鑑報告
> 產出日期: 2026/04/21

## 第一章：審計總覽

### 1.1 評分矩陣

| Rule | 1.1 Persona | 1.2 負面約束 | 1.4 密度 | 4.2 HITL | 5.1 長程一致性 | **總分** | **排名** |
|---|---|---|---|---|---|---|---|
| `system-prompt.md` | 5 | 5 | 5 | 4 | 5 | **24** | 🥇 1 |
| `backend.md` | 5 | 5 | 5 | 4 | 4 | **23** | 🥈 2 |
| `consultant.md` | 5 | 4 | 4 | 5 | 5 | **23** | 🥈 2 |
| `retro.md` | 5 | 5 | 3 | 5 | 5 | **23** | 🥈 2 |
| `reviewer.md` | 4 | 5 | 3 | 5 | 5 | **23** | 🥈 2 |
| `planner.md` | 4 | 5 | 3 | 5 | 5 | **22** | 5 |
| `qa.md` | 5 | 5 | 2 | 5 | 5 | **22** | 5 |
| `lead.md` | 4 | 4 | 3 | 5 | 5 | **21** | 7 |
| `architect.md` | 4 | 4 | 5 | 4 | 4 | **21** | 7 |
| `assistant.md` | 4 | 4 | 4 | 5 | 4 | **21** | 7 |
| `frontend.md` | 4 | 4 | 3 | 3 | 4 | **18** | 🔴 11 |

**滿分（25）達成率**：0 / 11

**各 Rules 總分分布**：
- 24 分：1 份（`system-prompt.md`）
- 23 分：4 份（`backend.md`、`consultant.md`、`retro.md`、`reviewer.md`）
- 22 分：2 份（`planner.md`、`qa.md`）
- 21 分：3 份（`lead.md`、`architect.md`、`assistant.md`）
- 18 分：1 份（`frontend.md`）

**系統整體平均分**：21.9 / 25（87.6%）

### 1.2 各項目跨 Rules 平均分分析

| 審計項目 | 各 Rules 得分 | 平均分 | 滿分率 | 健康度 |
|---|---|---|---|---|
| `1.1` Persona 具體化 | 5,5,5,5,4,4,4,4,4,4,4 | **4.36 / 5** | 45%（5/11） | 🟢 良好 |
| `1.2` 負面約束與邊界 | 5,5,5,5,5,5,4,4,4,4,4 | **4.55 / 5** | 55%（6/11） | 🟢 良好 |
| `1.4` 規則密度 | 5,5,4,3,3,3,3,3,3,2,1* | **3.18 / 5** | 18%（2/11） | 🔴 最弱 |
| `4.2` HITL 干預機制 | 5,5,5,5,5,5,5,5,4,4,3 | **4.64 / 5** | 73%（8/11） | 🟢 最強 |
| `5.1` 長程任務一致性 | 5,5,5,5,5,5,5,4,4,4,4 | **4.64 / 5** | 64%（7/11） | 🟢 強 |

> ※ `lead.md` 的 1.4 評分於審計時記錄為 3，系統整體以此計算。

***

### 關鍵洞察

#### 洞察一：`4.2` 與 `5.1` 並列最強維度（平均 4.64）

HITL 干預機制與長程任務一致性是整個系統設計中**執行最均衡**的兩個維度。兩個維度的共同特徵是：設計模式高度一致——外部文件錨定 + 數值化終止條件 + @Assistant 自動化兜底，已成為系統的標準設計語言。

#### 洞察二：`1.4` 規則密度是唯一低於 4.0 的維度（平均 3.18）

11 份 Rules 中，**9 份存在 Token 偏重問題**，其中 8 份的主要原因是**模板嵌入**。這不是個別 Rules 的設計疏漏，而是整個系統的系統性問題——缺少統一的 `.agents/skills/` 模板外部化規範，導致各 Rules 各自重複嵌入模板。

#### 洞察三：`1.2` 負面約束是第二強維度（平均 4.55），但分布不均

6 份滿分 vs 5 份 4 分，差距集中在「是否具備數值化終止條件」與「是否有業務安全的零容忍聲明」。未達滿分的 5 份（`consultant.md`、`lead.md`、`architect.md`、`assistant.md`、`frontend.md`）均有至少一個可補強的約束缺口。

#### 洞察四：`1.1` Persona 具體化是第三維度（平均 4.36），最大分歧在業務脈絡

45% 滿分率（5/11）的主因是**業務脈絡錨定深度不均**——`backend.md`、`consultant.md`、`qa.md`、`retro.md`、`system-prompt.md` 五份明確錨定 InvestmentLineNotify 業務場景，其餘六份的任務目標較通用，缺乏業務專屬的觸發場景說明。

***

**五維度綜合雷達圖（文字版）**：

```
      1.1 Persona
         4.36
          ▲
4.55 ◄────┼────► 4.64  (4.2 HITL)
1.2       │
負面約束  │    4.64  (5.1 長程)
          ▼
         3.18
      1.4 密度
```

`1.4 規則密度` 是整個系統唯一的明顯凹陷維度，與其他四個維度的平均分差距達 **1.18~1.46 分**，是最優先的系統性改善目標。

### 1.3 系統整體健康度評級

***

### 總體評級：🟢 B+（良好，具備明確改善路徑）

| 評級維度 | 評分 | 說明 |
|---|---|---|
| 系統平均分 | 21.9 / 25（87.6%） | 高於「良好」基準線（80%） |
| 最弱維度（1.4）平均 | 3.18 / 5（63.6%） | 唯一低於 70% 的維度，系統性問題 |
| 最強維度（4.2 / 5.1）平均 | 4.64 / 5（92.8%） | 接近「卓越」基準線（95%） |
| 最低分 Rules（frontend.md） | 18 / 25（72%） | 單一 Rules 低於 75%，需重點改善 |
| 零分項目（任何項目 1 分） | 0 個 | 無系統性崩潰風險 |

***

### 健康度詳細評級

#### 架構完整性：🟢 A（優秀）

整個 Multi-Agent 系統的核心架構設計完整——`system-prompt.md` 作為 AlwaysOn 入口、`lead.md` 作為 Workflow Engine、各專業 Agent 明確分工、`assistant.md` 作為全局巡邏、`retro.md` 作為系統進化機制。五個層次清晰，角色邊界無重疊。

#### Persona 設計品質：🟢 B+（良好）

45% 滿分率，業務脈絡錨定不均是主因。核心執行 Agent（`backend.md`、`consultant.md`）業務脈絡最強，流程協調型 Agent（`lead.md`、`planner.md`）較弱——符合直覺，流程協調者較少需要業務脈絡，但仍有補強空間。

#### 安全邊界設計：🟢 A-（優秀）

55% 滿分率，未達滿分的 Rules 也均有 4/5，無任何 Rules 存在明顯的安全邊界缺口。`reviewer.md` 的「無豁免空間」聲明與 `retro.md` 的「絕對禁止直接修改 .agents/」形成整個系統最關鍵的兩道安全防線。

#### Token 效率：🔴 C（待改善）

18% 滿分率，系統性問題。11 份 Rules 估算總 Token 約 **11,000~13,500 tokens**，扣除 AlwaysOn 的 `system-prompt.md`（380 tokens），按需載入的 10 份 Rules 平均每份約 **1,060~1,310 tokens**，超過建議上限（1,000 tokens）。模板外部化是唯一的系統性解決方案。

#### HITL 覆蓋完整性：🟢 A（優秀）

73% 滿分率，8 份 Rules 具備完整 HITL 機制。僅 `architect.md`（4/5）、`backend.md`（4/5）、`frontend.md`（3/5）、`system-prompt.md`（4/5）有補強空間，且補強成本均低。

#### 長程穩定性：🟢 A-（優秀）

64% 滿分率，外部文件錨定策略在多數 Rules 中已成熟應用。`architect.md`、`assistant.md`、`frontend.md` 的 4/5 是主要拉低項，三份 Rules 均有明確的補強路徑。

***

### 系統風險分布

```
🔴 高風險（需立即處理）：1 項
   → 1.4 規則密度：系統性模板嵌入問題，影響 9/11 份 Rules

🟡 中風險（近期處理）：2 項
   → frontend.md 整體（18/25）：唯一低於 75% 的 Rules
   → 模式混合指令的模式判斷優先規則缺失

🟢 低風險（選擇性處理）：3 項
   → 6 份 Rules 的業務脈絡補強
   → system-prompt.md 全局緊急阻斷機制
   → system-prompt.md Line Notify 描述更新
```

***

### 與業界標準對比

| 評估維度 | InvestmentLineNotify | 業界典型 Multi-Agent 系統 |
|---|---|---|
| Rules 覆蓋完整性 | 11 份，角色全覆蓋 | 通常 5~8 份，部分角色缺失 |
| HITL 機制設計 | 92.8% 平均 | 多數系統未明確定義 HITL |
| 長程一致性機制 | 92.8% 平均 | 少數系統有外部錨定設計 |
| Token 效率 | 63.6% 平均 | 多數系統無 Token 預算意識 |
| 系統進化機制 | `retro.md` 完整設計 | 極少數系統有正式 Retro 機制 |

InvestmentLineNotify 的 Multi-Agent 系統在 HITL、長程一致性、系統進化機制三個維度超越業界典型水準，Token 效率是唯一低於業界意識水準的維度。

***

二章：維度深度分析

### 2.1 Persona 具體化程度 橫向比較

***

### 評分分布

| 得分 | Rules | 數量 |
|---|---|---|
| 5 / 5 | `system-prompt.md`、`backend.md`、`consultant.md`、`qa.md`、`retro.md` | 5 |
| 4 / 5 | `lead.md`、`assistant.md`、`architect.md`、`frontend.md`、`planner.md`、`reviewer.md` | 6 |
| 3 / 5 以下 | — | 0 |

**維度平均：4.36 / 5**　**滿分率：45%**

***

### 滿分 vs 4 分的關鍵差異

所有 4 分 Rules 均具備清晰的角色定義、明確的職責邊界與具體的決策框架，扣分原因**高度集中於單一維度**：

| 扣分原因 | 受影響 Rules |
|---|---|
| **業務脈絡錨定不足**（任務目標為通用描述，未反映 InvestmentLineNotify 專屬場景） | `lead.md`、`architect.md`、`frontend.md`、`planner.md`、`reviewer.md` |
| **觸發場景舉例缺失**（缺乏「在本系統中最常被呼叫的具體情境」） | `assistant.md`、`planner.md` |

***

### 業務脈絡錨定強弱分析

#### 強錨定（5/5）：任務目標直接描述業務場景

| Rule | 業務脈絡關鍵語句 |
|---|---|
| `backend.md` | 「Yahoo Finance API 排程、Telegram Bot 通知、File-based 資料儲存冪等性」 |
| `consultant.md` | 「strategyWeight 調整、通知觸發條件異動、Oracle VM Free Tier 資源限制」 |
| `qa.md` | 「防止錯誤的投資訊號或破圖的前端畫面上線」 |
| `retro.md` | 「找出團隊反覆犯錯的盲點，修改 .agents/ 角色規則」 |
| `system-prompt.md` | 「Oracle VM、Line Notify、量化投資訊號、Node.js ESM、Telegram Mini App」 |

#### 弱錨定（4/5）：任務目標為通用技術描述

| Rule | 現有描述 | 缺少的業務脈絡 |
|---|---|---|
| `lead.md` | 「協調所有 Agent 完成開發任務」 | InvestmentLineNotify 最常見的 Lead 協調場景（策略上線、Telegram Bot 維護） |
| `architect.md` | 「設計 API 規格與系統架構」 | 本系統架構的核心約束（File-based、Oracle Free Tier、ESM 模組限制） |
| `frontend.md` | 「實作 Telegram Mini App 前端」 | 已有部分業務脈絡，但缺乏「投資策略視覺化」的具體場景說明 |
| `planner.md` | 「將需求拆解為可執行的開發計畫」 | 本系統需求的典型模式（策略參數調整、通知渠道擴充） |
| `reviewer.md` | 「程式碼品質把關，確保可讀性、效能、資安」 | 三個最高優先級審查場景（靜默失敗、initData 驗證、金鑰硬寫）未在任務目標出現 |

***

### 五份滿分 Rules 的共同設計模式

分析五份 5/5 Rules 的任務目標，歸納出**業務脈絡具體化的三個層次**，可作為未來補強其他 Rules 的設計參考：

#### 層次一：系統定位說明（What）
> 說明這個 Agent 在 InvestmentLineNotify 中保護或負責什麼

```
qa.md 範例：
「防止錯誤的投資訊號或破圖的前端畫面上線」
→ 直接說明 @QA 在本系統中守護的業務價值
```

#### 層次二：業務觸發場景（When）
> 列舉最常被呼叫的具體情境，而非通用的「當有任務時」

```
consultant.md 範例：
「strategyWeight 調整、通知觸發條件異動」
→ 直接說明 @Consultant 最常出現的業務場景
```

#### 層次三：技術棧錨定（How）
> 將角色的執行方式與系統技術棧綁定，防止通用建議與系統約束衝突

```
backend.md 範例：
「Yahoo Finance API 排程、File-based 資料儲存冪等性」
→ 直接將後端開發規範與本系統的技術選型綁定
```

**補強建議**：未達滿分的 6 份 Rules，只需在任務目標區塊補充「層次一」（1~2 句），即可將業務脈絡錨定從「通用」提升至「專屬」，預計每份 Rules 補強成本 **+20~40 tokens**，無需改動其他章節。

### 2.2 負面約束與邊界 橫向比較

***

### 評分分布

| 得分 | Rules | 數量 |
|---|---|---|
| 5 / 5 | `system-prompt.md`、`backend.md`、`planner.md`、`qa.md`、`retro.md`、`reviewer.md` | 6 |
| 4 / 5 | `lead.md`、`assistant.md`、`architect.md`、`consultant.md`、`frontend.md` | 5 |
| 3 / 5 以下 | — | 0 |

**維度平均：4.55 / 5**　**滿分率：55%**

***

### 約束條款數 vs 評分關係

| Rule | 約束條款數 | 評分 | 策略 |
|---|---|---|---|
| `planner.md` | ~10 條 | 5/5 | 數量型 ✅ |
| `backend.md` | ~9 條 | 5/5 | 數量型 ✅ |
| `lead.md` | ~8 條 | 4/5 | 數量型但有缺口 |
| `consultant.md` | ~8 條 | 4/5 | 數量型但有缺口 |
| `assistant.md` | ~7 條 | 4/5 | 數量型但有缺口 |
| `retro.md` | 6 條 | 5/5 | 精準型 ✅ |
| `qa.md` | 6 條 | 5/5 | 精準型 ✅ |
| `reviewer.md` | 6 條 | 5/5 | 精準型 ✅ |
| `system-prompt.md` | 3 條 | 5/5 | 精準型（AlwaysOn）✅ |
| `architect.md` | ~6 條 | 4/5 | 精準型但有缺口 |
| `frontend.md` | ~6 條 | 4/5 | 精準型但有缺口 |

**關鍵洞察：約束條款數與評分無直線相關。** 精準打點策略（6 條以內）與數量型策略（8 條以上）均可達到滿分，決定性因素是**每條約束是否精確覆蓋該角色最高頻的越界風險**。

***

### 兩種滿分策略對比

#### 策略一：精準型（3~6 條達滿分）

代表：`system-prompt.md`、`retro.md`、`qa.md`、`reviewer.md`

設計特徵：
- 每條約束對應角色**唯一且最高風險**的越界場景
- 無冗餘條款，無「理所當然」的禁止（例如「不可輸出不相關內容」）
- 多包含零容忍聲明（「絕對禁止」、「無豁免空間」）

```
// retro.md 精準型範例
「絕對禁止直接修改 .agents/ 底下的任何原始文件」
→ 一條規則保護整個 Agent 系統的規則完整性
```

#### 策略二：數量型（8~10 條達滿分）

代表：`planner.md`、`backend.md`

設計特徵：
- 角色涉及的越界風險**分散且多元**，需要較多條款覆蓋
- 包含跨角色邊界約束（防止越界干涉其他 Agent）
- 數值化終止條件（退件 N 次、重測 N 次）是加分關鍵

```
// planner.md 數量型範例（10 條）
條款 1~4：跨角色邊界約束
條款 5~7：Workflow 位置約束
條款 8~10：數值化終止條件
→ 每類越界風險各有對應條款
```

***

### 未達滿分的 5 份 Rules 缺口分析

| Rule | 評分 | 核心缺口 | 補強建議 |
|---|---|---|---|
| `lead.md` | 4/5 | 缺乏「@Lead 不可代替 Agent 執行技術決策」的明文約束；跨角色邊界說明分散不集中 | 補充「@Lead 收到技術問題時，必須呼叫 @Architect / @Consultant，不可自行給出技術方案」 |
| `assistant.md` | 4/5 | 巡邏行為的「不主動修改任何文件」約束存在但語氣較弱；缺乏「巡邏結果僅能通知，不可觸發 Workflow」的明文邊界 | 補充「@Assistant 巡邏結果只產生通知，絕對禁止自行呼叫任何其他 Agent」 |
| `architect.md` | 4/5 | 缺乏「技術選型必須尊重現有技術棧約束（Oracle Free Tier / File-based）」的業務安全邊界；API 設計審核退回機制語氣偏弱 | 補充「禁止提出超出 Oracle Free Tier 資源限制的架構方案，若有需要必須先向 User 說明成本影響」 |
| `consultant.md` | 4/5 | `strategyWeight` 修改建議的「不可直接修改，只能建議」語言存在但未明確標注為禁止條款；缺乏數值化的建議頻率上限 | 將現有語句升級為「絕對禁止直接修改 strategyWeight，必須透過提案格式輸出」 |
| `frontend.md` | 4/5 | 缺乏「禁止在未確認 API 規格的情況下開始實作」的前置條件約束；硬寫顏色的禁止條款存在但未升級為零容忍聲明 | 補充「API 規格未經 @Architect 確認前，禁止開始任何 UI 實作」；升級硬寫顏色為「無豁免空間」 |

***

### 系統性最佳實踐：負面約束設計四原則

綜合滿分 Rules 的設計模式，歸納出可供未來新增 Rules 參考的四個設計原則：

**原則一：零容忍條款必須明文聲明**
不只說「禁止」，要說「絕對禁止」或「無豁免空間」，讓 LLM 無法推測例外情況。

**原則二：跨角色邊界必須正向定義**
不只說「不做什麼」，要說「遇到 X 情境必須呼叫 Y Agent」，明確合法的替代路徑。

**原則三：數值化終止條件優於定性描述**
「退件超過 2 次」比「多次退件後」更不易漂移，LLM 對數字的遵從穩定性高於語意判斷。

**原則四：業務安全邊界優先於技術規範邊界**
投資系統的業務安全邊界（靜默失敗、金鑰暴露、錯誤訊號上線）應比通用技術規範（代碼格式、命名慣例）具備更高優先級的禁止條款語言。

***

### 2.3 規則密度審核 橫向比較

***

### 評分分布

| 得分 | Rules | 數量 |
|---|---|---|
| 5 / 5 | `system-prompt.md`、`architect.md`、`backend.md` | 3 |
| 4 / 5 | `assistant.md` | 1 |
| 3 / 5 | `lead.md`、`consultant.md`、`planner.md`、`retro.md`、`reviewer.md`、`frontend.md` | 6 |
| 2 / 5 | `qa.md` | 1 |

**維度平均：3.18 / 5**　**滿分率：27%**　← 所有維度最低

***

### Token 估算總表

| Rule | 估算 Token | 評分 | 主要問題 | AlwaysOn |
|---|---|---|---|---|
| `system-prompt.md` | ~350~420 | 5/5 | 無 ✅ | ✅ |
| `architect.md` | ~900~1,050 | 5/5 | 臨界但無模板 ✅ | ❌ |
| `backend.md` | ~950~1,100 | 5/5 | 臨界但無模板 ✅ | ❌ |
| `assistant.md` | ~1,500~1,750 | 4/5 | 巡邏機制冗長 | ❌ |
| `consultant.md` | ~950~1,100 | 3/5 | 單模板嵌入 | ❌ |
| `retro.md` | ~900~1,100 | 3/5 | 單模板嵌入（臨界） | ❌ |
| `reviewer.md` | ~850~1,050 | 3/5 | 單模板嵌入（臨界） | ❌ |
| `lead.md` | ~1,800~2,100 | 3/5 | 架構性過重 | ❌ |
| `frontend.md` | ~1,050~1,250 | 3/5 | DoD 過多 + 模板嵌入 | ❌ |
| `planner.md` | ~1,000~1,200 | 3/5 | 雙模板嵌入 | ❌ |
| `qa.md` | ~1,100~1,350 | 2/5 | 雙模板 + 交叉污染 🔴 | ❌ |

**系統按需載入 Rules 估算總 Token**：~11,300~13,900 tokens（10 份，不含 AlwaysOn）

***

### 模板嵌入問題全景圖

模板嵌入是 **8 份 Rules** 的共同問題，也是整個系統 1.4 維度最低的根本原因：

| 嵌入模板名稱 | 所在 Rules | 估算 Token | 外部化目標路徑 |
|---|---|---|---|
| User Story 模板 | `planner.md` | ~200 | `.agents/skills/user-story-template.md` |
| Draft Features 模板 | `planner.md` | ~180 | `.agents/skills/draft-features-template.md` |
| TEST_SPEC 模板 | `qa.md` | ~200 | `.agents/skills/test-spec-template.md` |
| TEST_REPORT 模板 | `qa.md` | ~280 | `.agents/skills/test-report-template.md` |
| REVIEW_REPORT 模板 | `reviewer.md` | ~290 | `.agents/skills/review-report-template.md` |
| RULE_UPDATE_PROPOSAL 模板 | `retro.md` | ~280 | `.agents/skills/rule-update-proposal-template.md` |
| ADVICE 模板 | `consultant.md` | ~150 | `.agents/skills/advice-template.md` |

**7 個模板，合計約 1,580 tokens**——若全部外部化，系統按需載入 Rules 的總 Token 從 ~12,600 降至 ~11,020，**節省約 12.5%**。

***

### 三種密度問題類型

#### 類型一：模板嵌入型（可快速解決）

**受影響**：`planner.md`、`qa.md`、`reviewer.md`、`retro.md`、`consultant.md`

解決方案：將模板移至 `.agents/skills/` 獨立文件，Rules 主文件改為參照路徑。

改善效益最高，每份 Rules 修改時間 < 15 分鐘，無需調整邏輯結構。

#### 類型二：架構性過重型（需結構重整）

**受影響**：`lead.md`（~1,950 tokens，超標最多）

`lead.md` 的 Token 偏重來自架構層級——Workflow Engine 的完整狀態機描述、資源與上下文映射表、多個流程表格，均為核心邏輯，難以外部化。

建議路徑：
- 資源映射表中「技術手冊類」條目（技術細節）可移至 `.agents/skills/` 參照
- Workflow Engine 流程圖的文字說明可精簡（保留結構，壓縮說明文字）
- 估計可節省 ~300~400 tokens，從 ~1,950 降至 ~1,550~1,650

#### 類型三：DoD 過多型（需條目審查）

**受影響**：`frontend.md`（DoD 條目 12 條，超過建議上限 8 條）

建議路徑：
- 合併同語意條目（例如「響應式狀態」相關的 3 條可合併為 1 條）
- 將「Telegram Mini App 合規」類條目移至 `.agents/skills/telegram-miniapp-pattern.md` 並在 DoD 中以單條參照取代
- 估計可節省 ~100~150 tokens

***

### 外部化後 Token 改善預測

| Rule | 現況 Token | 外部化後 Token | 節省 | 評分預測 |
|---|---|---|---|---|
| `qa.md` | ~1,225 | ~745 | ~480 | 2/5 → **5/5** |
| `planner.md` | ~1,100 | ~720 | ~380 | 3/5 → **5/5** |
| `reviewer.md` | ~950 | ~660 | ~290 | 3/5 → **5/5** |
| `retro.md` | ~1,000 | ~720 | ~280 | 3/5 → **5/5** |
| `consultant.md` | ~1,025 | ~875 | ~150 | 3/5 → **4/5** |
| `frontend.md` | ~1,150 | ~975 | ~175 | 3/5 → **4~5/5** |
| `lead.md` | ~1,950 | ~1,600 | ~350 | 3/5 → **3~4/5** |

**若完成全部模板外部化**：
- 1.4 維度系統平均分：3.18 → **預估 4.18**（+1.0）
- 系統整體平均分：21.9 → **預估 23.0**（+1.1）

***

### `.agents/skills/` 模板外部化統一規範建議

為防止未來新增 Rules 重複犯相同問題，建議在 `lead.md` 的資源映射表中新增：

```markdown
## 模板文件規範
所有產出物模板統一存放於 `.agents/skills/` 目錄，
Rules 主文件只保留參照路徑，不嵌入模板內容。

| 模板類型 | 路徑 |
|---------|------|
| User Story | `.agents/skills/user-story-template.md` |
| Draft Features | `.agents/skills/draft-features-template.md` |
| TEST_SPEC | `.agents/skills/test-spec-template.md` |
| TEST_REPORT | `.agents/skills/test-report-template.md` |
| REVIEW_REPORT | `.agents/skills/review-report-template.md` |
| RULE_UPDATE_PROPOSAL | `.agents/skills/rule-update-proposal-template.md` |
| ADVICE | `.agents/skills/advice-template.md` |
```

***

### 2.4 HITL 干預機制 橫向比較

***

### 評分分布

| 得分 | Rules | 數量 |
|---|---|---|
| 5 / 5 | `lead.md`、`assistant.md`、`consultant.md`、`planner.md`、`qa.md`、`retro.md`、`reviewer.md` | 7 |
| 4 / 5 | `system-prompt.md`、`architect.md`、`backend.md` | 3 |
| 3 / 5 | `frontend.md` | 1 |

**維度平均：4.64 / 5**　**滿分率：64%**　← 與 5.1 並列最強維度

***

### HITL 觸發點總覽

| Rule | 顯式觸發點數 | 直達 User | @Assistant 自動化 | 狀態持久化 | 分級 HITL |
|---|---|---|---|---|---|
| `retro.md` | 9 | ✅ 4 個 | ✅ 三級分層 | ❌ | ❌ |
| `planner.md` | 8 | ✅ 5 個 | ❌ | ❌ | ❌ |
| `reviewer.md` | 6 | ✅ 3 個 | ✅ 單級 | ✅（唯一） | ✅（唯一） |
| `lead.md` | 5 | ✅ 5 個 | ❌ | ❌ | ❌ |
| `consultant.md` | 5 | ✅ 4 個 | ❌ | ❌ | ❌ |
| `assistant.md` | 5 | ✅ 5 個 | ✅（自身） | ❌ | ❌ |
| `qa.md` | 5 | ✅ 3 個 | ✅ 單級 | ❌ | ❌ |
| `backend.md` | 4 | ✅ 3 個 | ✅ 單級 | ❌ | ❌ |
| `architect.md` | 3 | ✅ 2 個 | ❌ | ❌ | ❌ |
| `system-prompt.md` | 0（顯式） | ✅（委託） | ❌ | ❌ | ❌ |
| `frontend.md` | 3 | ✅ 2 個 | ❌ | ❌ | ❌ |

**系統全局 HITL 觸發點總計：53 個**

***

### 四個 HITL 設計維度深度分析

#### 維度一：觸發點密度

```
高密度（≥ 6）：retro.md（9）、planner.md（8）、reviewer.md（6）
中密度（4~5）：lead.md、consultant.md、assistant.md、qa.md、backend.md
低密度（≤ 3）：architect.md、frontend.md、system-prompt.md
```

低密度不一定代表設計不足——`system-prompt.md` 採委託策略（合理），`architect.md` 的 HITL 補強空間有限。真正需要關注的是 `frontend.md`（3 個觸發點，且無自動化兜底）。

#### 維度二：@Assistant 自動化 HITL 覆蓋

系統中 **5 份 Rules** 具備 @Assistant 自動化 HITL，形成以下覆蓋地圖：

```
有 @Assistant 自動化兜底：
✅ assistant.md（自身巡邏）
✅ qa.md（TEST_REPORT 偵測）
✅ backend.md（Telegram 整合偵測）
✅ reviewer.md（REVIEW_REPORT 偵測）
✅ retro.md（proposals/ 目錄偵測，三級分層）

無 @Assistant 自動化兜底：
❌ lead.md、architect.md、consultant.md、
   frontend.md、planner.md、system-prompt.md
```

**缺口分析**：`planner.md` 觸發點最多（8 個）但無自動化兜底，若 @Planner 在長程任務中漂移未主動回報，沒有 @Assistant 偵測機制補救。建議 `planner.md` 補充 @Assistant 偵測 `PLAN_STATUS.md` 的自動化兜底。

#### 維度三：數值化終止條件覆蓋

數值化終止條件是防止 HITL 迴圈無限消耗上下文的關鍵設計，系統中 **6 份 Rules** 具備：

| Rule | 數值化條件 | 閾值 |
|---|---|---|
| `planner.md` | 退件次數上限 | ≥ 3 次 |
| `qa.md` | 重測次數上限 | ≥ 3 次 |
| `reviewer.md` | 複審次數上限 | ≥ 2 次 |
| `retro.md` | 反覆問題警告 | 第 3 次 |
| `backend.md` | 部署失敗次數 | ≥ 2 次 |
| `consultant.md` | 建議採納追蹤 | 3 次未採納升級 |

**缺口**：`architect.md`、`frontend.md`、`lead.md` 無數值化終止條件，依賴定性描述（「多次失敗後」、「反覆問題時」），長程任務中判斷標準易漂移。

#### 維度四：HITL 機制獨特設計盤點

| 設計特點 | 唯一擁有者 | 說明 |
|---|---|---|
| 分級 HITL（BLOCKER / WARNING / SUGGEST） | `reviewer.md` | 唯一依問題嚴重程度分配 HITL 強度的設計 |
| HITL 狀態持久化（PENDING_ACTIONS.md） | `reviewer.md` | 唯一解決上下文滑動導致 HITL 狀態消失的設計 |
| @Assistant 三級分層通知 | `retro.md` | 唯一依緊急程度分層（🟡/🔴）的自動化通知設計 |
| User 輸入格式規範 | `retro.md` | 唯一約束 User 採納 / 拒絕指令格式的設計 |
| 全委託型 HITL | `system-prompt.md` | 唯一不定義顯式 HITL 而全委託下游的設計 |

***

### 未達滿分的 4 份 Rules 缺口分析

| Rule | 評分 | 核心缺口 | 補強建議 |
|---|---|---|---|
| `architect.md` | 4/5 | 無數值化終止條件；API 設計退回後無強制等待機制 | 補充「API 設計被退回 ≥ 2 次，強制暫停並向 User 說明設計困境」 |
| `backend.md` | 4/5 | 部署失敗的 HITL 觸發條件存在但語氣偏弱；無 @Assistant 偵測 DEPLOY_LOG | 補充 @Assistant 自動偵測部署失敗狀態的兜底機制 |
| `system-prompt.md` | 4/5 | 缺全局緊急阻斷機制（@Lead 連續失敗的終止條件） | 補充「@Lead 連續 3 次未能正確完成任務派發，強制暫停等待 User 指示」（~30 tokens） |
| `frontend.md` | 3/5 | 觸發點最少（3 個）；無數值化終止條件；無自動化兜底 | 補充重工次數上限（≥ 2 次升級 User）+ @Assistant 偵測 UI 交付物狀態 |

***

### HITL 機制成熟度模型

基於審計結果，定義系統 HITL 成熟度四個等級：

```
Level 4（最成熟）：顯式觸發點 ≥ 6 + 數值化終止 + 自動化兜底 + 狀態持久化
→ reviewer.md（唯一達到 Level 4）

Level 3：顯式觸發點 ≥ 5 + 數值化終止 + 自動化兜底
→ retro.md、qa.md

Level 2：顯式觸發點 ≥ 4 + 數值化終止（或自動化兜底）
→ planner.md、lead.md、consultant.md、assistant.md、backend.md

Level 1：顯式觸發點 ≤ 3，缺數值化終止或自動化兜底
→ architect.md、frontend.md、system-prompt.md
```

**系統目標**：將所有 Rules 提升至 Level 2 以上，`frontend.md` 是唯一需要從 Level 1 跨越至 Level 2 的 Rules。

***

### 2.5 長程任務一致性 橫向比較

***

### 評分分布

| 得分 | Rules | 數量 |
|---|---|---|
| 5 / 5 | `system-prompt.md`、`lead.md`、`consultant.md`、`planner.md`、`qa.md`、`retro.md`、`reviewer.md` | 7 |
| 4 / 5 | `backend.md`、`architect.md`、`assistant.md`、`frontend.md` | 4 |

**維度平均：4.64 / 5**　**滿分率：64%**　← 與 4.2 並列最強維度

***

### 防漂移機制三分類統計

系統中的防漂移機制可歸納為三大類型，各 Rules 的覆蓋狀況：

#### 類型一：外部文件錨定（最強）

將 Agent 的決策依據存放於外部文件，LLM 每次執行時重新讀取，不依賴上下文記憶。

| Rule | 外部錨定機制 | 錨定文件 |
|---|---|---|
| `planner.md` | 四份計畫文件狀態機 | `draft_features.md`、`PLAN_STATUS.md` 等 |
| `qa.md` | 動態測試範疇機制 | `backend.md`、`frontend.md`、`.agents/skills/` |
| `reviewer.md` | 動態審查範疇機制 | `backend.md`、`frontend.md`、`.agents/skills/` |
| `retro.md` | 提案歷史外部化 | `.agents/proposals/` 目錄 |
| `consultant.md` | ADVICE 文件歸檔 | `docs/plans/advice/` 目錄 |
| `backend.md` | 部分外部化（deploy log） | `.agents/tasks/` |
| `architect.md` | 部分外部化（API spec） | `docs/api/` |
| `assistant.md` | 部分外部化（PENDING_ACTIONS） | `PENDING_ACTIONS.md` |
| `lead.md` | 資源映射表委託 | `.agents/rules/` 各文件 |
| `system-prompt.md` | Workflow 委託 | `lead.md` |
| `frontend.md` | **最弱**，主要依賴 Rules 內部定義 | — |

#### 類型二：數值化終止條件（強）

以可驗證的數字定義任務完成或升級的邊界，防止「模糊完成」漂移。

| Rule | 數值化條件 | 數量 |
|---|---|---|
| `planner.md` | 退件 ≥ 3 次、功能數上限 | 2 個 |
| `qa.md` | 重測 ≥ 3 次、TC 通過率 100% | 2 個 |
| `reviewer.md` | 複審 ≥ 2 次、退件 ≥ 2 次 | 2 個 |
| `retro.md` | 第 3 次反覆問題、IN_PROGRESS 逾時 | 2 個 |
| `consultant.md` | 3 次未採納升級 | 1 個 |
| `backend.md` | 部署失敗 ≥ 2 次 | 1 個 |
| `lead.md` | 部分數值化 | 1 個 |
| `architect.md` | **無** | 0 個 |
| `assistant.md` | **無** | 0 個 |
| `frontend.md` | **無** | 0 個 |
| `system-prompt.md` | **無**（委託至下游） | 0 個 |

#### 類型三：自動化兜底（強）

即使 Agent 漂移未主動回報，@Assistant 或系統機制仍能自動偵測並補救。

| Rule | 自動化兜底機制 |
|---|---|
| `retro.md` | @Assistant 偵測 `.agents/proposals/`（三級） |
| `reviewer.md` | @Assistant 偵測 `REVIEW_REPORT.md` + `PENDING_ACTIONS.md` |
| `qa.md` | @Assistant 偵測 `TEST_REPORT.md` |
| `backend.md` | @Assistant 偵測部署狀態 |
| `assistant.md` | 自身即兜底機制 |
| `lead.md`、`architect.md`、`consultant.md`、`frontend.md`、`planner.md`、`system-prompt.md` | **無自動化兜底** |

***

### 各 Rules 防漂移機制覆蓋矩陣

| Rule | 外部錨定 | 數值化終止 | 自動化兜底 | 覆蓋類型數 | 評分 |
|---|---|---|---|---|---|
| `retro.md` | ✅ | ✅ | ✅ | **3** | 5/5 |
| `reviewer.md` | ✅ | ✅ | ✅ | **3** | 5/5 |
| `qa.md` | ✅ | ✅ | ✅ | **3** | 5/5 |
| `planner.md` | ✅ | ✅ | ❌ | **2** | 5/5 |
| `consultant.md` | ✅ | ✅ | ❌ | **2** | 5/5 |
| `lead.md` | ✅ | ✅（部分） | ❌ | **1.5** | 5/5 |
| `system-prompt.md` | ✅（委託） | ❌ | ❌ | **1** | 5/5 |
| `backend.md` | ✅（部分） | ✅ | ✅ | **3** | 4/5 |
| `assistant.md` | ✅（部分） | ❌ | ✅（自身） | **2** | 4/5 |
| `architect.md` | ✅（部分） | ❌ | ❌ | **1** | 4/5 |
| `frontend.md` | ❌ | ❌ | ❌ | **0** | 4/5 |

**關鍵洞察**：覆蓋類型數與評分高度相關，但 `system-prompt.md` 以 AlwaysOn 架構本身彌補了覆蓋類型不足的問題——這是唯一能以「永久存在」替代「防漂移機制」的特殊設計。

***

### 未達滿分的 4 份 Rules 缺口分析

| Rule | 評分 | 核心缺口 | 補強建議 |
|---|---|---|---|
| `backend.md` | 4/5 | 外部錨定為部分覆蓋；排程任務冪等性驗證缺乏數值化完成標準 | 補充排程任務執行的外部狀態記錄（如 `SCHEDULE_LOG.md`），供長程任務追蹤 |
| `architect.md` | 4/5 | 無數值化終止條件；API 設計版本控制依賴 @Architect 自行判斷 | 補充「API 設計版本以 `docs/api/` 文件版本號為唯一真相來源」的外部錨定聲明 |
| `assistant.md` | 4/5 | 巡邏週期的「收斂時」定義在長程任務中可能逐漸模糊 | 補充「每次 User 發送新指令前」為標準巡邏時間點，防止巡邏頻率漂移 |
| `frontend.md` | 4/5 | 三種防漂移機制均缺失；UI 組件的完成標準完全依賴 LLM 記憶 | 補充「UI 驗收以 `draft_features.md` 的驗收標準為唯一依據」的外部錨定 + DoD 數值化（例如「三態完整性 = Loading / Success / Error 三個狀態均有實作」） |

***

### 系統性洞察：長程一致性的三層防護架構

審計結果顯示，整個系統的長程一致性保障已形成一個三層防護架構：

```
Layer 0（全局）：system-prompt.md AlwaysOn
    → @Lead Persona 永久鎖定，任何漂移的最後防線

Layer 1（流程）：lead.md Workflow Engine + planner.md 狀態機
    → 任務執行路徑固定，防止 Workflow 結構性漂移

Layer 2（執行）：各 Agent Rules 的外部錨定 + 數值化終止 + 自動化兜底
    → 具體任務執行的防漂移細節
```

**系統弱點**：Layer 2 中 `frontend.md` 的三層防護均缺失，且 `architect.md`、`assistant.md` 的覆蓋不完整，使得 UI 實作階段是整個 Workflow 中**長程一致性最薄弱的環節**。

***

三章：系統性風險識別

### 3.1 🔴 高風險項目

***

高風險定義：**影響系統核心運作正確性，或造成多份 Rules 連帶損害的問題**。需在下一個開發週期啟動前處理。

***

### 高風險項目一：系統性模板嵌入問題

**影響範圍**：8 / 11 份 Rules  
**風險類型**：Token 效率系統性損耗 + 維護不一致性  
**嚴重程度**：🔴 高

#### 問題描述

7 個產出物模板分散嵌入在 6 份 Rules 主文件中，合計約 **1,580 tokens** 的靜態成本。這不是單一 Rules 的問題，而是整個系統缺少「模板外部化規範」導致的系統性設計缺陷。

#### 連帶損害

| 損害類型 | 說明 |
|---|---|
| Token 壓縮效應 | 每次載入含模板的 Rules，模板 Token 與核心邏輯 Token 競爭上下文空間 |
| 版本不一致風險 | 若同一模板格式需要更新，必須同時修改多份 Rules（例如 TEST_REPORT 格式變更同時影響 `qa.md` 與使用它的所有下游 Agent） |
| 新 Agent 設計污染 | 缺少外部化規範，未來新增 Rules 的設計者會沿用「嵌入模板」的慣例，問題持續累積 |
| `qa.md` 交叉污染 | TEST_SPEC 與 TEST_REPORT 兩個模板嵌入同一份 Rules，介入點一與介入點二的產出物邊界在 LLM 上下文中可能混淆 |

#### 根因

`.agents/skills/` 目錄雖已存在（`telegram-bot-pattern.md`、`telegram-miniapp-pattern.md`、`deploy-oracle.md` 等），但**未建立模板類文件的統一外部化規範**，各 Rules 設計時各自判斷模板是否嵌入。

#### 修復方案

```
Step 1：建立 7 個模板 skill 文件（.agents/skills/）
Step 2：更新 6 份 Rules 主文件，將模板內容替換為參照路徑
Step 3：在 lead.md 資源映射表新增模板規範條目
Step 4：建立模板外部化設計原則（防止未來重犯）
```

**預計修復時間**：120~180 分鐘（含所有文件）  
**Token 節省效益**：~1,580 tokens（系統總 Token 降低 12.5%）

***

### 高風險項目二：`frontend.md` 全維度設計弱點

**影響範圍**：1 / 11 份 Rules（但影響整個 Workflow 的 UI 交付品質）  
**風險類型**：長程任務中 UI 實作品質不穩定，HITL 保護最薄弱  
**嚴重程度**：🔴 高

#### 問題描述

`frontend.md` 是唯一總分低於 20 分的 Rules（18/25），且在五個維度中有**三個維度得分為 3 或以下**：

| 維度 | 得分 | 主要問題 |
|---|---|---|
| 1.4 規則密度 | 3/5 | DoD 12 條（過多）+ 模板嵌入 |
| 4.2 HITL 干預機制 | 3/5 | 觸發點最少（3 個），無自動化兜底，無數值化終止 |
| 5.1 長程任務一致性 | 4/5 | 三種防漂移機制均缺失或最弱 |

#### 業務風險

在 InvestmentLineNotify 中，`@Frontend` 負責 Telegram Mini App 的 UI 實作。若 `frontend.md` 的 HITL 與防漂移機制不足，長程任務中可能出現：

```
風險一：hardcoded 顏色（未使用 ThemeParams）被漏過，
        投資策略視覺化畫面在 Telegram 深色模式下破圖
風險二：UI 三態（Loading / Success / Error）缺失，
        策略載入失敗時無錯誤提示，使用者以為系統正常運作
風險三：initData 驗證缺失，
        Telegram Mini App 安全性受損
```

#### 修復方案

```
Step 1：補充外部文件錨定（「驗收以 draft_features.md 為唯一依據」）
Step 2：補充數值化終止條件（重工 ≥ 2 次升級 User）
Step 3：補充 @Assistant 自動偵測 UI 交付物狀態
Step 4：DoD 精簡（12 條 → 8 條以內，合併同語意條目）
Step 5：模板外部化（與高風險項目一統一處理）
```

**預計修復時間**：45~60 分鐘  
**預期評分提升**：18/25 → 22~23/25

***

### 高風險項目三：缺乏模板外部化設計規範文件

**影響範圍**：系統未來可擴展性  
**風險類型**：技術債持續累積  
**嚴重程度**：🔴 高（長期）

#### 問題描述

目前 `.agents/` 目錄下沒有任何文件定義「新增 Rules 時應遵循的設計原則」。現有 Rules 的設計品質完全依賴設計者的個人判斷，未來新增 `devops.md`、`database.md` 等 Rules 時，有極高概率重複犯相同問題：

```
- 模板嵌入（最可能）
- 業務脈絡錨定不足
- HITL 觸發點設計不完整
```

#### 修復方案

建立 `.agents/RULES_DESIGN_GUIDE.md`，內容涵蓋：
- Rules 標準結構模板
- Token 預算規範（≤ 1,000 tokens）
- 模板外部化強制規定
- HITL 最低設計要求（至少 Level 2）
- 業務脈絡錨定三層次規範

**預計建立時間**：60 分鐘  
**長期效益**：防止技術債累積，確保系統可持續擴展

***

### 高風險項目小結

| # | 風險項目 | 影響 Rules 數 | 修復時間 | 優先級 |
|---|---|---|---|---|
| 1 | 系統性模板嵌入 | 6 份（8 處） | 120~180 分鐘 | P0 |
| 2 | `frontend.md` 全維度弱點 | 1 份 | 45~60 分鐘 | P0 |
| 3 | 缺乏 Rules 設計規範文件 | 未來所有 Rules | 60 分鐘 | P1 |

***

### 3.2 🟡 中風險項目

***

中風險定義：**不影響系統核心運作，但在特定長程任務場景下會降低品質或增加人工介入成本**。建議在近 2~3 個開發週期內處理。

***

### 中風險項目一：6 份 Rules 業務脈絡錨定不足

**影響範圍**：`lead.md`、`architect.md`、`assistant.md`、`frontend.md`、`planner.md`、`reviewer.md`  
**風險類型**：長程任務中 Persona 與業務場景脫節  
**嚴重程度**：🟡 中

#### 問題描述

6 份 Rules 的任務目標採用通用技術描述，未反映 InvestmentLineNotify 的業務專屬場景。在短任務中影響有限，但在長程任務（> 20 步）中，LLM 容易以「通用最佳實踐」取代「本系統約束優先」的判斷：

```
典型漂移場景：
@Architect 建議引入 PostgreSQL 替換 File-based 儲存
（通用最佳實踐）
→ 忽略 Oracle VM Free Tier 資源限制
（本系統約束）
```

#### 各 Rules 補強成本估算

| Rule | 補強內容 | 估算補強 Token | 修復時間 |
|---|---|---|---|
| `lead.md` | 補充「InvestmentLineNotify 最常見協調場景」 | +25 tokens | 10 分鐘 |
| `architect.md` | 補充「Oracle Free Tier + File-based 核心約束」 | +30 tokens | 10 分鐘 |
| `assistant.md` | 補充「本系統巡邏的三個最高頻偵測場景」 | +25 tokens | 10 分鐘 |
| `frontend.md` | 補充「投資策略視覺化 + 三態完整性場景」 | +30 tokens | 10 分鐘 |
| `planner.md` | 補充「策略參數調整 + 通知渠道擴充典型需求」 | +25 tokens | 10 分鐘 |
| `reviewer.md` | 補充「靜默失敗 + initData + 金鑰三優先場景」 | +30 tokens | 10 分鐘 |

**合計補強成本**：~165 tokens、60 分鐘（6 份 Rules 可批次處理）

***

### 中風險項目二：`planner.md` 缺乏 @Assistant 自動化兜底

**影響範圍**：`planner.md`（8 個 HITL 觸發點，但無自動化兜底）  
**風險類型**：長程任務中 @Planner 漂移後無系統性補救  
**嚴重程度**：🟡 中

#### 問題描述

`planner.md` 是所有 Rules 中 HITL 觸發點最多的（8 個），且具備最完整的數值化終止條件與外部狀態機，但**缺乏 @Assistant 自動化兜底**。

這形成一個不對稱設計：

```
觸發點設計：最完整（8 個）
主動回報：依賴 @Planner 自行執行
自動化兜底：❌ 無

對比 qa.md（5 個觸發點，有 @Assistant 兜底）：
若 @QA 漂移未回報 → @Assistant 偵測 TEST_REPORT 補救
若 @Planner 漂移未回報 → 無任何自動補救機制
```

#### 風險場景

```
長程任務第 35 步：
@Planner 完成 preplan 後，上下文刷新導致
「通知 @Lead 進入 Gate Check」的指令漂移遺失
→ @Lead 未收到信號，任務停滯
→ 無 @Assistant 兜底偵測，停滯可能持續數步
```

#### 補強建議

```markdown
// 補充至 planner.md 產出物章節
@Assistant 巡邏將於下次收斂時自動偵測 `PLAN_STATUS.md`：
- 狀態停留 preplan 超過一個任務週期 → 產生 🟡 PLAN_STALL 通知
- draft 版本與 PLAN_STATUS 不一致 → 產生 🟡 PLAN_MISMATCH 通知
```

**預計修復時間**：15 分鐘

***

### 中風險項目三：`architect.md` 與 `backend.md` HITL 數值化條件缺口

**影響範圍**：`architect.md`（無數值化終止）、`backend.md`（數值化條件語氣偏弱）  
**風險類型**：API 設計迴圈與部署失敗迴圈無明確終止邊界  
**嚴重程度**：🟡 中

#### 問題描述

`architect.md` 無任何數值化終止條件，API 設計被退回後的處理依賴定性描述：

```
現況：「API 設計有問題時，@Architect 修正後重新提交」
缺口：修正幾次後應升級 User？未定義
```

`backend.md` 的部署失敗 HITL 雖有數值化條件，但觸發語氣偏弱（「建議暫停」vs「強制暫停」）：

```
現況：「部署失敗 ≥ 2 次，建議暫停並回報」
缺口：「建議」給予 @Backend 判斷空間，長程任務中可能繼續嘗試
```

#### 補強建議

```markdown
// architect.md 補充
API 設計被退回 ≥ 2 次，強制暫停並向 User 說明設計困境，
等待 User 確認調整方向後才可繼續。

// backend.md 補充
「建議暫停」→「強制暫停」（語氣升級）
```

**預計修復時間**：20 分鐘

***

### 中風險項目四：`system-prompt.md` 模式混合指令處理缺口

**影響範圍**：`system-prompt.md`（模式判斷邊界情境）  
**風險類型**：討論 + 執行混合指令的模式判斷無優先規則  
**嚴重程度**：🟡 中

#### 問題描述

```
使用者指令範例：
「分析這個投資策略的風險，然後幫我把它實作出來」

system-prompt.md 現況：
→ 討論模式觸發信號：包含「分析」✅
→ 執行模式觸發信號：包含「實作」✅
→ 兩個模式同時觸發，無優先規則 ⚠️
```

在實務中 @Lead 通常能正確處理（先討論後執行），但判斷標準依賴 LLM 即時推斷，長程任務中累積後可能出現「討論部分被跳過」或「執行部分未正確啟動 Workflow」的邊緣漂移。

#### 補強建議

```markdown
// system-prompt.md 模式判斷章節補充
當指令同時包含討論與執行觸發信號時：
優先執行討論模式，完成討論並獲得 User 確認後，
再切換執行模式啟動 Workflow Engine。
```

**預計修復時間**：10 分鐘（+15 tokens）

***

### 中風險項目五：`retro.md` 任務週期定義模糊

**影響範圍**：`retro.md`（IN_PROGRESS 逾時偵測）  
**風險類型**：逾時判斷標準在長程任務中逐漸寬鬆  
**嚴重程度**：🟡 中（低頻）

#### 問題描述

```
retro.md 現況：
「若發現某提案停留 IN_PROGRESS 超過一個任務週期」

「一個任務週期」未量化：
→ 是「3 個功能完成」？
→ 是「7 天」？
→ 是「下一次 Retro 執行前」？
```

不同的量化方式對逾時偵測的敏感度有顯著差異。建議明確定義為「3 個功能完成」（與模式識別觸發週期一致），形成系統內部的定義一致性。

#### 補強建議

```markdown
// retro.md 補充（IN_PROGRESS 逾時偵測章節）
「一個任務週期」定義為：自提案進入 IN_PROGRESS 後，
下一次模式識別觸發 Retro 執行前（即 3 個功能完成週期）。
```

**預計修復時間**：10 分鐘（+20 tokens）

***

### 中風險項目小結

| # | 風險項目 | 影響 Rules 數 | 修復時間 | 優先級 |
|---|---|---|---|---|
| 1 | 業務脈絡錨定不足 | 6 份 | 60 分鐘 | P1 |
| 2 | `planner.md` 缺自動化兜底 | 1 份 | 15 分鐘 | P1 |
| 3 | `architect.md` / `backend.md` 數值化缺口 | 2 份 | 20 分鐘 | P2 |
| 4 | `system-prompt.md` 模式混合缺口 | 1 份 | 10 分鐘 | P2 |
| 5 | `retro.md` 任務週期定義模糊 | 1 份 | 10 分鐘 | P2 |

**中風險修復總時間估算：約 115 分鐘**

***

### 3.3 🟢 低風險項目

***

低風險定義：**對系統當前運作無直接影響，但長期累積可能造成品質下降或維護困難**。可在資源充裕時選擇性處理。

***

### 低風險項目一：`system-prompt.md` 業務描述過時

**影響範圍**：`system-prompt.md`（專案背景區塊）  
**風險類型**：業務脈絡誤導  
**嚴重程度**：🟢 低

#### 問題描述

```
system-prompt.md 現況：
「核心功能為透過 Line Notify 推送量化投資訊號」

Line Notify 已於 2025 年 3 月停止服務。
若系統已遷移至 Telegram Bot 通知，
所有 Agent 在讀取專案背景時將獲得過時的業務脈絡。
```

#### 影響評估

實際影響有限，因為各 Agent Rules 的技術棧描述均已反映 Telegram Bot（`backend.md`、`frontend.md`、`reviewer.md` 等），過時描述僅存在於 `system-prompt.md` 的一句話介紹中，不影響執行邏輯。

#### 補強建議

```markdown
// system-prompt.md 專案背景區塊修改
「核心功能為透過 Line Notify 推送量化投資訊號」
→ 「核心功能為透過 Telegram Bot 推送量化投資訊號，
    並提供 Telegram Mini App 進行策略視覺化管理」
```

**預計修復時間**：5 分鐘（改一句話）

***

### 低風險項目二：`system-prompt.md` 缺全局緊急阻斷機制

**影響範圍**：`system-prompt.md`（AlwaysOn 層級）  
**風險類型**：Workflow 失控時缺乏全局終止條件  
**嚴重程度**：🟢 低（低頻邊緣場景）

#### 問題描述

```
現況：若 @Lead 連續錯誤呼叫 Agent 或 Workflow 陷入循環，
      無全局緊急阻斷機制，User 只能手動中斷對話。

各下游 Rules 均有各自的數值化終止條件，
但 system-prompt.md 層級無跨 Workflow 的全局終止邏輯。
```

#### 補強建議

```markdown
// system-prompt.md 補充新章節（~30 tokens）
## 緊急阻斷
若 @Lead 連續 3 次未能正確完成任務派發，
強制暫停所有 Workflow，向 User 回報當前狀態並等待指示。
```

**預計修復時間**：5 分鐘（+30 tokens，不破壞精簡原則）

***

### 低風險項目三：`consultant.md` 禁止條款語氣升級

**影響範圍**：`consultant.md`（`strategyWeight` 修改約束）  
**風險類型**：禁止條款語氣偏弱，LLM 可能推測例外  
**嚴重程度**：🟢 低

#### 問題描述

```
consultant.md 現況：
「@Consultant 不直接修改 strategyWeight，
只能透過提案格式輸出建議」

語氣評估：描述性而非禁止性
對比 retro.md：「絕對禁止直接修改 .agents/ 原始文件」
→ consultant.md 缺乏「絕對禁止」語言的強制性
```

在長程任務中，LLM 遇到緊急情境（例如「User 要求立即調整策略」）時，描述性語言比禁止性語言更容易被「合理化繞過」。

#### 補強建議

```markdown
// consultant.md 約束條款升級
「不直接修改」→「絕對禁止直接修改 strategyWeight，
必須透過 ADVICE 提案格式輸出，由 User 確認後才可執行」
```

**預計修復時間**：5 分鐘（改一句話）

***

### 低風險項目四：`assistant.md` 巡邏週期定義模糊

**影響範圍**：`assistant.md`（巡邏觸發時機）  
**風險類型**：巡邏頻率在長程任務中逐漸稀疏  
**嚴重程度**：🟢 低

#### 問題描述

```
assistant.md 現況：
「@Assistant 巡邏將於下次收斂時自動執行」

「收斂」定義模糊：
→ 每個 Agent 完成任務後？
→ 每個功能完成後？
→ 每次 User 發送新指令前？
```

在長程任務中，「收斂」的解釋可能逐漸寬鬆，導致巡邏間隔拉長，PENDING_ACTIONS 中的問題累積而未被及時偵測。

#### 補強建議

```markdown
// assistant.md 巡邏時機補充
「收斂」定義：每次 User 發送新指令時，
@Assistant 在 @Lead 接手前優先執行一次巡邏。
```

**預計修復時間**：10 分鐘

***

### 低風險項目五：跨 Rules 豁免標準不一致

**影響範圍**：`reviewer.md`（WARNING 豁免）vs 其他 Rules  
**風險類型**：系統內部豁免機制設計不一致  
**嚴重程度**：🟢 低

#### 問題描述

`reviewer.md` 設計了完整的 WARNING 豁免機制（豁免需記錄原因、確認者為 User 或 @Lead），但其他 Rules 的類似「例外情境」均未定義豁免流程：

```
qa.md：TEST_SPEC 某些案例可跳過？→ 未定義
planner.md：某些功能可跳過完整 preplan？→ 未定義
architect.md：小改動可跳過 API 設計審核？→ 未定義
```

這造成系統內部的豁免標準不一致——`reviewer.md` 有明確豁免流程，其他 Rules 的例外情境由 @Lead 或 User 即興判斷。

#### 補強建議

不需要每份 Rules 都建立完整豁免機制，但建議在 `lead.md` 補充：

```markdown
// lead.md 補充
各階段的豁免決策（跳過特定 Agent 呼叫或特定 DoD 條目）
必須由 User 明確確認，@Lead 不可自行判斷豁免。
```

**預計修復時間**：10 分鐘

***

### 低風險項目六：`retro.md` 提案目錄長期規模管理

**影響範圍**：`retro.md`（長期運作場景）  
**風險類型**：提案目錄累積後 Token 消耗劇增  
**嚴重程度**：🟢 低（當前無影響，長期需關注）

#### 問題描述

```
retro.md 現況：
「讀取 .agents/proposals/ 目錄下所有提案（含所有狀態）」

當提案累積至 50+ 份時：
→ 全量讀取 Token 消耗：~50 × 200 tokens = ~10,000 tokens
→ 遠超單次 Retro 的合理上下文預算
```

#### 補強建議

建議在提案累積至 20~30 份時，評估引入以下篩選機制：

```markdown
// retro.md 歷史比對機制補充（預防性）
歷史比對範圍：
- OPEN / IN_PROGRESS 狀態：全量讀取（數量通常 < 10）
- ARCHIVED / REJECTED 狀態：只讀取近 3 個任務週期內的提案
  （超過 3 個週期的歷史提案以摘要索引取代全文讀取）
```

**預計修復時間**：15 分鐘（現在補充預防性規則）、或待累積至 20 份後再處理

***

### 低風險項目小結

| # | 風險項目 | 影響 Rules 數 | 修復時間 | 優先級 |
|---|---|---|---|---|
| 1 | `system-prompt.md` 業務描述過時 | 1 份 | 5 分鐘 | P2 |
| 2 | `system-prompt.md` 全局緊急阻斷 | 1 份 | 5 分鐘 | P2 |
| 3 | `consultant.md` 禁止語氣升級 | 1 份 | 5 分鐘 | P3 |
| 4 | `assistant.md` 巡邏週期定義 | 1 份 | 10 分鐘 | P3 |
| 5 | 跨 Rules 豁免標準不一致 | 系統性 | 10 分鐘 | P3 |
| 6 | `retro.md` 提案目錄規模管理 | 1 份 | 15 分鐘 | P3（預防性）|

**低風險修復總時間估算：約 50 分鐘**

***

### 3.4 跨 Rules 設計不一致項目

***

跨 Rules 設計不一致定義：**某份 Rules 具備某個設計特性，但邏輯上同等重要的其他 Rules 未具備，造成系統行為預期不對稱**。

***

### 不一致項目一：動態範疇機制覆蓋不對稱

**設計標竿**：`qa.md`、`reviewer.md`（均有完整動態範疇機制）  
**缺口 Rules**：`lead.md`、`architect.md`

#### 說明

`qa.md` 與 `reviewer.md` 均設計了「根據任務涉及範疇，動態讀取對應參考文件」的機制，確保測試與審查的執行標準永遠與最新 Rules 同步：

```
qa.md / reviewer.md：
任務範疇 → 讀取對應 .agents/rules/ 或 .agents/skills/ 文件
→ 動態組合執行 Checklist
```

`lead.md` 有資源映射表（靜態），但無「根據當前任務範疇動態選擇讀取文件」的機制。`architect.md` 在設計 API 規格時，未定義「根據涉及的業務模組讀取對應技術手冊」的動態參照機制。

#### 影響

長程任務中若 `backend.md` 或 `frontend.md` 的 DoD 更新，`@QA` 與 `@Reviewer` 會自動使用最新版本，但 `@Lead` 的資源映射表和 `@Architect` 的設計參考可能未及時對應，造成上下游執行標準不一致。

#### 補強建議

```markdown
// architect.md 補充
在設計 API 規格前，根據涉及範疇動態讀取：
- 後端模組：backend.md 的排程任務規範
- 前端模組：frontend.md 的 API 消費規範
- 安全相關：.agents/tasks/security-review.md
```

***

### 不一致項目二：DoD 自評機制覆蓋不對稱

**設計標竿**：`qa.md`、`reviewer.md`、`backend.md`、`frontend.md`（均有產出物 DoD 自評）  
**缺口 Rules**：`architect.md`、`consultant.md`、`planner.md`

#### 說明

系統中多數 Agent 在完成任務後有「產出物 DoD 自評」機制——Agent 在通知 @Lead 前，必須逐項確認自身 DoD：

```
有 DoD 自評的 Rules：
qa.md（4 條）、reviewer.md（4 條）、
backend.md（5 條）、frontend.md（12 條）、
lead.md（部分）

缺 DoD 自評的 Rules：
architect.md：API 設計完成後無自評 Checklist
consultant.md：ADVICE 產出後無自評 Checklist
planner.md：preplan / draft 完成後無自評 Checklist
```

#### 影響

`@Architect`、`@Consultant`、`@Planner` 在通知 @Lead 時，無固定的自我品質核查機制，產出物的完整性完全依賴 LLM 的即時判斷，長程任務中輸出品質穩定性低於有 DoD 自評的 Agent。

#### 補強建議

各補充精簡的 DoD 自評（3~4 條為宜）：

```markdown
// architect.md 產出物章節補充 DoD 自評
- [ ] API 規格已涵蓋所有端點的 Request / Response 格式
- [ ] 安全性考量（Token 驗證、錯誤格式）已明確標注
- [ ] 與現有技術棧約束（File-based / Oracle Free Tier）無衝突

// consultant.md 產出物章節補充 DoD 自評
- [ ] ADVICE 文件已產出並存放於正確路徑
- [ ] strategyWeight 建議值有明確的數值範圍與依據
- [ ] 風險評估已包含 Oracle Free Tier 資源影響

// planner.md 產出物章節補充 DoD 自評
- [ ] draft_features.md 已更新，版本號已遞增
- [ ] 所有 AC 均可被 @QA 驗證（無模糊驗收標準）
- [ ] PLAN_STATUS.md 狀態已同步更新
```

**預計修復時間**：30 分鐘（三份 Rules）

***

### 不一致項目三：WARNING 豁免機制覆蓋不對稱

**設計標竿**：`reviewer.md`（完整豁免記錄機制）  
**缺口 Rules**：`qa.md`、`planner.md`、`architect.md`

#### 說明

`reviewer.md` 設計了精細的 WARNING 豁免機制：

```
[WARNING] 豁免流程：
開發者說明理由 → 確認者（User / @Lead）確認
→ 豁免記錄寫入 REVIEW_REPORT（永久保留）
```

但系統中其他 Agent 遇到類似「可例外處理」的情境時，均無對應的豁免記錄機制：

```
qa.md：某些 TC 可跳過 → 無豁免記錄格式
planner.md：某些 AC 可放寬 → 無豁免記錄格式
architect.md：某些 API 設計可簡化 → 無豁免記錄格式
```

#### 影響

跨 Agent 的例外決策標準不一致——`@Reviewer` 的豁免有永久記錄，但 `@QA` 跳過某個 TC 的決策可能只存在於對話上下文，長程任務中無法追溯。

#### 補強建議

不需要複製 `reviewer.md` 的完整豁免機制，但建議在 `lead.md` 建立系統級的輕量豁免記錄規範：

```markdown
// lead.md 補充
任何 Agent 的例外決策（跳過 TC、放寬 AC、簡化設計）
必須在對應報告文件中以「豁免記錄」條目標注，
格式：「豁免項目 #N：<原因> / 確認者：<User/@Lead>」
```

**預計修復時間**：15 分鐘

***

### 不一致項目四：@Assistant 通知分類不一致

**設計標竿**：`retro.md`（三級分層：🟡 / 🔴 兩種等級、三種通知類型）  
**缺口 Rules**：`qa.md`、`reviewer.md`、`backend.md`（均只有單一 🔴 通知）

#### 說明

`retro.md` 的 @Assistant 通知設計了完整的分級系統：

```
retro.md：
🟡 RETRO_PROPOSAL（新提案，提醒審查）
🟡 RETRO_TIMEOUT（逾時，追蹤執行）
🔴 RETRO_REPEAT（反覆問題，緊急升級）
```

其他有 @Assistant 自動化的 Rules 均只有單一等級：

```
qa.md：只有 🔴（重測 ≥ 3 次）
reviewer.md：只有 🔴（複審 ≥ 2 次）
backend.md：只有 🔴（部署失敗）
```

#### 影響

User 在收到 @Assistant 通知時，所有通知均為 🔴 最高緊急等級，無法區分「需要立即處理」與「請留意，暫不阻斷」的情境差異，長期可能造成 HITL 警報疲勞（Alert Fatigue）。

#### 補強建議

為 `qa.md`、`reviewer.md` 補充 🟡 等級的前置通知：

```markdown
// qa.md 補充
🟡 QA_PENDING：TEST_SPEC 完成等待 @Lead 派發測試任務超過一個週期
🔴 QA_BLOCKED：重測 ≥ 3 次仍有未解決 Bug（現有）

// reviewer.md 補充
🟡 REVIEW_PENDING：REVIEW_REPORT 產出後等待開發者回覆超過一個週期
🔴 REVIEW_QUALITY：複審 ≥ 2 次仍有 BLOCKER（現有）
```

**預計修復時間**：20 分鐘（兩份 Rules）

***

### 不一致項目五：複審 / 重測次數上限標準不統一

**設計標竿**：各 Rules 數值化終止條件  
**不一致 Rules**：全系統

#### 說明

系統中各 Rules 的數值化終止閾值並未統一，存在以下差異：

| Rule | 終止條件 | 閾值 | 觸發後行動 |
|---|---|---|---|
| `qa.md` | 重測次數上限 | ≥ 3 次 | 強制升級 User |
| `reviewer.md` | 複審次數上限 | ≥ 2 次 | 強制升級 User |
| `planner.md` | 退件次數上限 | ≥ 3 次 | 強制升級 User |
| `retro.md` | 反覆問題警告 | 第 3 次 | 強制等待 User 確認 |
| `consultant.md` | 建議未採納追蹤 | 3 次 | 升級 User |
| `backend.md` | 部署失敗上限 | ≥ 2 次 | 強制暫停 |

`reviewer.md` 的閾值（2 次）比其他 Rules（3 次）更嚴格，設計上有其合理性（程式碼審查應更嚴格），但若未在設計文件中明確說明差異原因，維護者可能誤以為是設計不一致而「修正」為統一值。

#### 補強建議

不建議強制統一閾值（各 Rules 的嚴格程度不同是合理的），但建議在 `reviewer.md` 的退件上限說明中補充設計原因：

```markdown
// reviewer.md 補充說明
複審上限設為 2 次（較其他 Agent 的 3 次更嚴格），
原因：程式碼審查是 QA 測試前的最後品質關卡，
若 2 次複審仍有 BLOCKER，代表實作方案本身需要重新評估，
而非僅靠修正可解決。
```

**預計修復時間**：10 分鐘

***

### 跨 Rules 不一致項目小結

| # | 不一致項目 | 影響 Rules 數 | 修復時間 | 優先級 |
|---|---|---|---|---|
| 1 | 動態範疇機制覆蓋不對稱 | 2 份 | 20 分鐘 | P2 |
| 2 | DoD 自評機制覆蓋不對稱 | 3 份 | 30 分鐘 | P2 |
| 3 | WARNING 豁免機制覆蓋不對稱 | 系統性 | 15 分鐘 | P2 |
| 4 | @Assistant 通知分類不一致 | 3 份 | 20 分鐘 | P3 |
| 5 | 複審次數上限說明缺失 | 1 份 | 10 分鐘 | P3 |

**跨 Rules 不一致修復總時間估算：約 95 分鐘**

***

四章：優先改善 Roadmap

### 4.1 Quick Win（< 30 分鐘，高效益單點修改）

***

Quick Win 定義：**單次修改時間 ≤ 30 分鐘、改善效益明確可量化、不需跨 Rules 協調的獨立改善項目**。

***

### Quick Win 總覽

| # | 項目 | 目標 Rules | 類型 | 時間 | 效益 |
|---|---|---|---|---|---|
| QW-01 | `system-prompt.md` 業務描述更新 | `system-prompt.md` | 1 句話修改 | 5 分鐘 | 修正過時脈絡 |
| QW-02 | `system-prompt.md` 全局緊急阻斷 | `system-prompt.md` | +30 tokens | 5 分鐘 | 補強 4.2 缺口 |
| QW-03 | `system-prompt.md` 模式混合優先規則 | `system-prompt.md` | +15 tokens | 10 分鐘 | 消除模式歧義 |
| QW-04 | `consultant.md` 禁止語氣升級 | `consultant.md` | 改 1 句話 | 5 分鐘 | 強化安全邊界 |
| QW-05 | `retro.md` 任務週期量化定義 | `retro.md` | +20 tokens | 10 分鐘 | 消除逾時判斷歧義 |
| QW-06 | `reviewer.md` 業務脈絡補強 | `reviewer.md` | +30 tokens | 10 分鐘 | 提升 1.1 評分 |
| QW-07 | `planner.md` @Assistant 兜底補充 | `planner.md` | +40 tokens | 15 分鐘 | 補強 4.2 缺口 |
| QW-08 | `architect.md` / `backend.md` 數值化終止升級 | 2 份 | 改 2 句話 | 20 分鐘 | 補強 HITL 閾值 |
| QW-09 | `assistant.md` 巡邏週期明確化 | `assistant.md` | +15 tokens | 10 分鐘 | 防止巡邏頻率漂移 |
| QW-10 | `reviewer.md` 複審上限設計原因說明 | `reviewer.md` | +20 tokens | 10 分鐘 | 消除維護誤解風險 |

**Quick Win 合計時間：約 100 分鐘**（可拆分多個 30 分鐘作業段）

***

### 各 Quick Win 詳細說明

***

#### QW-01：`system-prompt.md` 業務描述更新
**時間**：5 分鐘　**效益**：修正 AlwaysOn 過時業務脈絡

```markdown
// 修改前
「核心功能為透過 Line Notify 推送量化投資訊號」

// 修改後
「核心功能為透過 Telegram Bot 推送量化投資訊號，
並提供 Telegram Mini App 進行策略視覺化管理」
```

**注意**：修改前請先確認系統是否已完全遷移至 Telegram Bot，若仍有 Line Notify 殘存功能需同步評估。

***

#### QW-02：`system-prompt.md` 全局緊急阻斷
**時間**：5 分鐘　**效益**：填補 4.2 HITL 唯一缺口（+1 分預期）

```markdown
// 新增章節（system-prompt.md 唯一鐵律後方）
## 緊急阻斷
若 @Lead 連續 3 次未能正確完成任務派發，
強制暫停所有 Workflow，向 User 回報當前狀態並等待指示。
```

***

#### QW-03：`system-prompt.md` 模式混合優先規則
**時間**：10 分鐘　**效益**：消除討論 + 執行混合指令的模式歧義

```markdown
// 新增至模式判斷章節末尾
### 混合指令處理規則
當指令同時包含討論與執行觸發信號時，
優先進入討論模式，完成討論並獲得 User 確認後，
再切換執行模式啟動 Workflow Engine。
```

***

#### QW-04：`consultant.md` 禁止語氣升級
**時間**：5 分鐘　**效益**：將描述性約束升級為零容忍禁止語言

```markdown
// 修改前
「@Consultant 不直接修改 strategyWeight，只能透過提案格式輸出建議」

// 修改後
「@Consultant 絕對禁止直接修改 strategyWeight，
必須透過 ADVICE 提案格式輸出，由 User 確認後才可執行，無例外」
```

***

#### QW-05：`retro.md` 任務週期量化定義
**時間**：10 分鐘　**效益**：消除 IN_PROGRESS 逾時判斷標準模糊

```markdown
// 新增至 IN_PROGRESS 逾時偵測章節
「一個任務週期」定義：
自提案進入 IN_PROGRESS 後，下一次模式識別觸發 Retro 執行前
（即 3 個功能完成週期）。
```

***

#### QW-06：`reviewer.md` 業務脈絡補強
**時間**：10 分鐘　**效益**：任務目標從通用描述升級為業務錨定（1.1 預期 4→5 分）

```markdown
// 新增至任務目標章節末尾
在 InvestmentLineNotify 中，最高優先級的三個審查場景為：
1. 投資策略排程的靜默失敗（排程執行但通知未發送）
2. Telegram initData 驗證缺失（安全關鍵）
3. 金鑰或 Token 硬寫（零容忍，無豁免空間）
```

***

#### QW-07：`planner.md` @Assistant 自動化兜底補充
**時間**：15 分鐘　**效益**：補強唯一的高觸發點 Rules 自動化兜底缺口

```markdown
// 新增至 planner.md 產出物章節
@Assistant 巡邏將於下次收斂時自動偵測 PLAN_STATUS.md：
- 狀態停留 preplan 超過一個任務週期
  → 產生 🟡 PLAN_STALL 通知
- draft 版本與 PLAN_STATUS 記錄不一致
  → 產生 🟡 PLAN_MISMATCH 通知
```

***

#### QW-08：`architect.md` / `backend.md` 數值化終止升級
**時間**：20 分鐘（兩份 Rules）　**效益**：消除 HITL 終止條件定性描述的判斷漂移

```markdown
// architect.md 新增
API 設計被退回 ≥ 2 次，強制暫停並向 User 說明設計困境，
等待 User 確認調整方向後才可繼續。

// backend.md 修改
「建議暫停」→「強制暫停，向 User 回報部署失敗詳情，等待指示」
```

***

#### QW-09：`assistant.md` 巡邏週期明確化
**時間**：10 分鐘　**效益**：防止「收斂」定義在長程任務中逐漸模糊

```markdown
// assistant.md 巡邏觸發條件補充
「收斂」定義：每次 User 發送新指令時，
@Assistant 在 @Lead 接手前優先執行一次巡邏，
確認 PENDING_ACTIONS.md 無未處理的 🔴 項目。
```

***

#### QW-10：`reviewer.md` 複審上限設計原因說明
**時間**：10 分鐘　**效益**：防止維護者誤改為「統一 3 次」

```markdown
// reviewer.md 退件後重提流程章節補充
複審上限設為 2 次（較系統其他 Agent 的 3 次更嚴格），
原因：程式碼審查是 QA 測試前的最後品質關卡，
若 2 次複審仍有 BLOCKER，代表實作方案本身需要重新評估，
而非僅靠逐步修正可解決。
```

***

### Quick Win 執行建議

#### 建議執行順序（依效益 / 時間比）

```
第一批（15 分鐘，3 個項目，影響 AlwaysOn）：
QW-01 → QW-02 → QW-03
（system-prompt.md 三個改善，批次處理最高效）

第二批（20 分鐘，3 個項目，單句語氣升級）：
QW-04 → QW-05 → QW-10
（各 Rules 的單點文字修改，無邏輯依賴）

第三批（30 分鐘，2 個項目，HITL 補強）：
QW-07 → QW-08
（補強 planner.md 兜底 + architect.md / backend.md 數值化）

第四批（20 分鐘，2 個項目，業務脈絡 + 巡邏定義）：
QW-06 → QW-09
（reviewer.md 業務補強 + assistant.md 巡邏定義）
```

#### 執行後預期評分變化

| Rule | 現況總分 | QW 執行後預期 | 提升 |
|---|---|---|---|
| `system-prompt.md` | 24/25 | **25/25** | +1 |
| `reviewer.md` | 23/25 | **24/25** | +1 |
| `planner.md` | 22/25 | **23/25** | +1 |
| `consultant.md` | 23/25 | **23/25**（語氣強化） | ～ |
| `retro.md` | 23/25 | **23/25**（定義明確） | ～ |
| `architect.md` | 21/25 | **22/25** | +1 |
| `assistant.md` | 21/25 | **21/25**（長程穩定） | ～ |

**Quick Win 全部完成後系統平均分預估**：21.9 → **22.4**（+0.5）

***

### 4.2 中期改善（需跨 Rules 協調，30~120 分鐘）

***

中期改善定義：**需要同時修改多份 Rules 或建立新文件，改善效益高但需要跨 Rules 設計一致性協調**。

***

### 中期改善總覽

| # | 項目 | 影響 Rules 數 | 時間 | 效益 |
|---|---|---|---|---|
| MT-01 | 模板外部化（`.agents/skills/`） | 6 份 Rules + 7 個新文件 | 120~180 分鐘 | 系統 Token -12.5%，1.4 平均 +1.0 |
| MT-02 | `frontend.md` 全面重構 | 1 份 Rules | 45~60 分鐘 | 18/25 → 22~23/25 |
| MT-03 | 業務脈絡錨定批次補強 | 6 份 Rules | 60 分鐘 | 1.1 平均 4.36 → 4.73 |
| MT-04 | DoD 自評機制補充 | 3 份 Rules | 30 分鐘 | 跨 Rules 產出物品質一致性 |
| MT-05 | 系統級豁免記錄規範 | `lead.md` + 3 份 Rules | 25 分鐘 | 跨 Rules 豁免標準統一 |

**中期改善合計時間：約 280~355 分鐘**

***

### MT-01：模板外部化（最高效益改善項目）

**時間**：120~180 分鐘　**效益**：系統 Token 節省 ~1,580，1.4 維度平均分 3.18 → 4.18

#### 執行步驟

**Step 1：建立 7 個模板 Skill 文件（60~90 分鐘）**

| 新文件路徑 | 來源 Rules | 移出 Token 估算 |
|---|---|---|
| `.agents/skills/user-story-template.md` | `planner.md` | ~200 |
| `.agents/skills/draft-features-template.md` | `planner.md` | ~180 |
| `.agents/skills/test-spec-template.md` | `qa.md` | ~200 |
| `.agents/skills/test-report-template.md` | `qa.md` | ~280 |
| `.agents/skills/review-report-template.md` | `reviewer.md` | ~290 |
| `.agents/skills/rule-update-proposal-template.md` | `retro.md` | ~280 |
| `.agents/skills/advice-template.md` | `consultant.md` | ~150 |

**Step 2：更新 6 份 Rules 主文件（40~60 分鐘）**

將各 Rules 中的模板內容替換為參照路徑：

```markdown
// 以 qa.md 為例（修改前）
## TEST_SPEC 格式
| 欄位 | 說明 |
|------|------|
| TC-ID | ... |
| ...（200 tokens 的模板內容）

// 修改後
## TEST_SPEC 格式
參照：`.agents/skills/test-spec-template.md`
```

**Step 3：`lead.md` 資源映射表新增模板規範（15 分鐘）**

```markdown
// lead.md 資源映射表補充
| 模板類型 | 路徑 |
|---------|------|
| User Story | .agents/skills/user-story-template.md |
| Draft Features | .agents/skills/draft-features-template.md |
| TEST_SPEC | .agents/skills/test-spec-template.md |
| TEST_REPORT | .agents/skills/test-report-template.md |
| REVIEW_REPORT | .agents/skills/review-report-template.md |
| RULE_UPDATE_PROPOSAL | .agents/skills/rule-update-proposal-template.md |
| ADVICE | .agents/skills/advice-template.md |
```

**Step 4：建立 `.agents/RULES_DESIGN_GUIDE.md` 防止重犯（15 分鐘）**

```markdown
// .agents/RULES_DESIGN_GUIDE.md 核心規範
1. Token 預算：每份 Rules ≤ 1,000 tokens
2. 模板外部化：所有產出物模板統一存放 .agents/skills/
3. HITL 最低要求：至少 Level 2（顯式觸發點 ≥ 4 + 數值化終止）
4. 業務脈絡三層次：系統定位 + 業務觸發場景 + 技術棧錨定
```

#### 外部化後各 Rules 評分預測

| Rule | 現況 1.4 | 外部化後 1.4 | 現況總分 | 外部化後總分 |
|---|---|---|---|---|
| `qa.md` | 2/5 | **5/5** | 22/25 | **25/25** |
| `planner.md` | 3/5 | **5/5** | 22/25 | **24/25** |
| `reviewer.md` | 3/5 | **5/5** | 23/25 | **25/25** |
| `retro.md` | 3/5 | **5/5** | 23/25 | **25/25** |
| `consultant.md` | 3/5 | **4/5** | 23/25 | **24/25** |
| `frontend.md` | 3/5 | **4/5** | 18/25 | **19/25**（搭配 MT-02）|

***

### MT-02：`frontend.md` 全面重構

**時間**：45~60 分鐘　**效益**：18/25 → 22~23/25，修復唯一低於 20 分的 Rules

#### 重構範疇

**重構一：外部文件錨定補充（10 分鐘）**

```markdown
// frontend.md 任務定義章節補充
UI 驗收以 draft_features.md 的驗收標準（AC）為唯一依據。
任何 UI 功能的「完成」定義以 AC 為準，
@Frontend 不可自行判斷驗收標準。
```

**重構二：DoD 精簡（15 分鐘）**

```
現況 12 條 DoD → 精簡至 8 條以內

合併方向：
- 「ThemeParams 使用」+「禁止 hardcoded 顏色」→ 合併為 1 條
- 「Loading 狀態」+「Error 狀態」+「Success 狀態」
  → 合併為「三態完整性（Loading / Success / Error）」1 條
- Telegram Mini App 合規條目（3 條）
  → 移至 .agents/skills/telegram-miniapp-pattern.md 並以 1 條參照取代
```

**重構三：HITL 補強（15 分鐘）**

```markdown
// frontend.md 新增 HITL 觸發點
觸發點一：重工 ≥ 2 次仍不符 AC → 強制升級 User（新增）
觸發點二：API 規格未經 @Architect 確認 → 禁止開始實作（新增）
觸發點三：三態缺失被 @Reviewer 退件 → 強制修復後才可重提（已有，確認語氣）
```

**重構四：@Assistant 自動化兜底補充（10 分鐘）**

```markdown
// frontend.md 新增 @Assistant 偵測
@Assistant 巡邏將於下次收斂時自動偵測：
- UI 交付物狀態（REVIEW_REPORT 中有 frontend 相關 BLOCKER）
  → 產生 🔴 FRONTEND_BLOCKED 通知
- draft_features.md 的 frontend AC 全部通過但未觸發 @Reviewer
  → 產生 🟡 FRONTEND_PENDING_REVIEW 通知
```

**重構五：業務脈絡錨定（10 分鐘）**

```markdown
// frontend.md 任務目標補充業務脈絡
核心業務場景：
- 投資策略視覺化（策略清單、績效圖表、策略開關）
- 量化訊號觸發通知的前端管理介面
- Telegram Mini App 環境的 ThemeParams 深淺色適配
```

#### 重構後預期評分

| 維度 | 現況 | 重構後 |
|---|---|---|
| 1.1 Persona | 4/5 | **5/5** |
| 1.2 負面約束 | 4/5 | **5/5** |
| 1.4 規則密度 | 3/5 | **4/5**（搭配 MT-01）|
| 4.2 HITL | 3/5 | **5/5** |
| 5.1 長程一致性 | 4/5 | **5/5** |
| **總分** | **18/25** | **24/25** |

***

### MT-03：業務脈絡錨定批次補強

**時間**：60 分鐘　**效益**：6 份 Rules 的 1.1 評分從 4/5 → 5/5（預期）

#### 批次補強清單

每份 Rules 只需在任務目標章節補充 1~2 句業務錨定說明：

| Rule | 補強內容 | 補強 Token |
|---|---|---|
| `lead.md` | 「InvestmentLineNotify 最常見協調場景：策略上線、Telegram Bot 維護、排程異常處理」 | +25 |
| `architect.md` | 「核心架構約束：Oracle VM Free Tier 資源限制、File-based 資料儲存、Node.js ESM 模組系統」 | +30 |
| `assistant.md` | 「本系統巡邏最高頻場景：PENDING_ACTIONS 未清、排程靜默失敗、proposals/ 逾期」 | +25 |
| `planner.md` | 「典型需求模式：策略參數調整、通知渠道擴充、Telegram Mini App 新功能」 | +25 |
| `reviewer.md` | 「最高優先審查場景：靜默失敗、initData 驗證缺失、金鑰硬寫」 | +30 |
| `frontend.md` | 搭配 MT-02 同步處理 | — |

**批次補強合計**：+135 tokens，6 份 Rules

#### 執行建議：可與 MT-02 合併執行

`frontend.md` 的業務脈絡補強已包含在 MT-02 的重構範疇內，其餘 5 份 Rules 的補強可在同一個作業段內批次處理（每份 10 分鐘，合計 50 分鐘）。

***

### MT-04：DoD 自評機制補充

**時間**：30 分鐘　**效益**：`architect.md`、`consultant.md`、`planner.md` 補齊產出物品質自評機制

#### 各 Rules 補充內容

```markdown
// architect.md（API 設計完成後自評）
產出物 DoD 自評：
- [ ] API 規格已涵蓋所有端點（Request / Response / Error 格式）
- [ ] 安全性考量（Token 驗證、速率限制）已標注
- [ ] 與 Oracle Free Tier 資源約束無衝突

// consultant.md（ADVICE 產出後自評）
產出物 DoD 自評：
- [ ] ADVICE 文件已存放於 docs/plans/advice/ 正確路徑
- [ ] strategyWeight 建議值有數值範圍與依據說明
- [ ] 風險評估已包含 Oracle Free Tier 資源影響分析

// planner.md（preplan / draft 完成後自評）
產出物 DoD 自評：
- [ ] draft_features.md 版本號已遞增
- [ ] 所有 AC 可被 @QA 驗證（無模糊驗收標準）
- [ ] PLAN_STATUS.md 狀態已同步更新
```

***

### MT-05：系統級豁免記錄規範

**時間**：25 分鐘　**效益**：統一跨 Rules 的例外決策記錄標準

#### 執行步驟

**Step 1：`lead.md` 補充系統級豁免規範（10 分鐘）**

```markdown
// lead.md 補充
## 豁免決策規範
任何 Agent 的例外決策（跳過 TC、放寬 AC、簡化 API 設計）
必須由 User 明確確認，@Lead 不可自行判斷豁免。
豁免記錄格式：
「豁免 #N：<豁免項目> / <豁免原因> / 確認者：<User / @Lead>」
豁免記錄寫入對應報告文件（TEST_REPORT / REVIEW_REPORT / PLAN_STATUS）。
```

**Step 2：`qa.md`、`planner.md`、`architect.md` 各補充豁免記錄參照（15 分鐘）**

```markdown
// qa.md 補充
若某 TC 需豁免跳過，必須依照 lead.md 豁免記錄規範，
在 TEST_REPORT 中記錄豁免原因與確認者。

// planner.md 補充
若某 AC 需放寬驗收標準，必須依照 lead.md 豁免記錄規範，
在 PLAN_STATUS.md 中記錄豁免原因與確認者。

// architect.md 補充
若 API 設計需簡化，必須依照 lead.md 豁免記錄規範，
在 API 設計文件中記錄簡化原因與確認者。
```

***

### 中期改善執行建議

#### 建議執行順序（依系統整體效益排序）

```
第一優先（效益最高）：
MT-01 模板外部化（獨立執行，120~180 分鐘）
→ 系統 Token -12.5%，6 份 Rules 密度提升

第二優先（修復最弱環節）：
MT-02 frontend.md 重構（獨立執行，45~60 分鐘）
→ 最低分 Rules 從 18 → 24 分

第三優先（批次高效）：
MT-03 業務脈絡批次補強（50 分鐘）
+ MT-04 DoD 自評補充（30 分鐘）
→ 合併為一個 80 分鐘作業段

第四優先（系統規範統一）：
MT-05 系統級豁免規範（25 分鐘）
→ 補完 3.4 跨 Rules 不一致的核心缺口
```

#### 中期改善全部完成後系統預期評分

| 指標 | 現況 | 中期改善後 |
|---|---|---|
| 系統平均分 | 21.9 / 25 | **23.5 / 25** |
| 1.4 維度平均 | 3.18 / 5 | **4.18 / 5** |
| 1.1 維度平均 | 4.36 / 5 | **4.73 / 5** |
| 最低分 Rules | 18/25（frontend.md）| **24/25** |
| 滿分 Rules 數 | 0 / 11 | **4 / 11**（qa、reviewer、retro、system-prompt）|

***

### 4.3 長期優化（架構層級，需系統性規劃）

***

長期優化定義：**改善效益影響整個 Agent 系統的可持續性與可擴展性，但實作複雜度高或需要等待特定時機（如提案累積至一定數量後）才有必要執行**。

***

### 長期優化總覽

| # | 項目 | 影響範圍 | 時間 | 觸發時機 |
|---|---|---|---|---|
| LT-01 | `.agents/RULES_DESIGN_GUIDE.md` 建立 | 整個系統未來擴展性 | 60 分鐘 | 立即（防技術債） |
| LT-02 | `lead.md` 架構性精簡 | `lead.md` Token 效率 | 90 分鐘 | 下次 Retro 週期 |
| LT-03 | `retro.md` 提案目錄規模管理 | `.agents/proposals/` 長期 | 30 分鐘 | 提案累積 ≥ 20 份時 |
| LT-04 | @Assistant 通知分級統一 | 3 份 Rules | 30 分鐘 | MT-01 完成後 |
| LT-05 | 動態範疇機制擴展至 `architect.md` | `architect.md` | 30 分鐘 | MT-03 完成後 |
| LT-06 | 系統整體 Rules 版本控制機制 | 整個 `.agents/` | 45 分鐘 | 系統穩定後 |

**長期優化合計時間：約 285 分鐘**（非連續執行，依觸發時機分散處理）

***

### LT-01：`.agents/RULES_DESIGN_GUIDE.md` 建立

**時間**：60 分鐘　**觸發時機**：立即（Quick Win / 中期改善啟動前建立）  
**效益**：防止未來新增 Rules 重複犯相同問題，確保系統可持續擴展

#### 文件結構建議

```markdown
# .agents/RULES_DESIGN_GUIDE.md

## 一、Rules 標準結構
每份 Rules 必須包含以下章節（順序固定）：
1. 任務目標（含業務脈絡三層次）
2. 核心工作流程
3. 產出物規範（含 DoD 自評）
4. 禁止行為清單
5. HITL 觸發條件
6. @Assistant 自動化兜底

## 二、Token 預算規範
- AlwaysOn 文件（system-prompt.md）：≤ 500 tokens
- 按需載入 Rules：≤ 1,000 tokens
- 超過 1,000 tokens 必須進行模板外部化或結構精簡

## 三、模板外部化強制規定
所有產出物模板統一存放 .agents/skills/，
Rules 主文件只保留參照路徑。
禁止在 Rules 主文件內嵌入任何模板。

## 四、HITL 最低設計要求（Level 2 標準）
- 顯式觸發點 ≥ 4 個
- 數值化終止條件 ≥ 1 個
- 若無 @Assistant 兜底，數值化條件需 ≥ 2 個

## 五、業務脈絡三層次規範
Layer 1：系統定位說明（這個 Agent 在本系統中保護什麼）
Layer 2：業務觸發場景（最常被呼叫的具體情境）
Layer 3：技術棧錨定（執行方式與系統技術選型綁定）

## 六、負面約束設計四原則
1. 零容忍條款必須明文聲明（「絕對禁止」/ 「無例外」）
2. 跨角色邊界必須正向定義（遇到 X 必須呼叫 Y）
3. 數值化終止條件優於定性描述
4. 業務安全邊界優先於通用技術規範

## 七、新增 Rules 前置審查清單
- [ ] Token 估算是否 ≤ 1,000
- [ ] 是否有業務脈絡三層次
- [ ] HITL 觸發點是否 ≥ 4 個
- [ ] 是否有數值化終止條件
- [ ] 所有模板是否已外部化
- [ ] 是否有 @Assistant 兜底或等效機制
```

***

### LT-02：`lead.md` 架構性精簡

**時間**：90 分鐘　**觸發時機**：下次 Retro 週期（避免干擾當前 Workflow 運作）  
**效益**：`lead.md` Token 從 ~1,950 降至 ~1,550（-20%），1.4 評分 3/5 → 4/5 預期

#### 精簡方向分析

`lead.md` 的 Token 偏重主因是 Workflow Engine 的架構複雜度——狀態機描述、資源映射表、多個流程說明均為核心邏輯，無法像模板一樣直接外部化。精簡需要在**保持功能完整**的前提下進行：

**可精簡方向一：資源映射表技術細節外部化（-150~200 tokens）**

```markdown
// 現況：資源映射表內嵌技術細節說明
| @Backend | 使用 Node.js ESM、PM2 管理、
           需注意 Oracle Free Tier 記憶體限制... |

// 精簡後：技術細節移至 .agents/skills/tech-context.md
| @Backend | 參照 .agents/skills/tech-context.md#backend |
```

**可精簡方向二：Workflow Engine 流程說明壓縮（-100~150 tokens）**

```markdown
// 現況：每個 Workflow 步驟有完整說明段落
// 精簡後：保留結構，壓縮說明文字為條列式
```

**可精簡方向三：重複語意合併（-50~100 tokens）**

各步驟中重複出現的「通知 @Lead」、「等待 User 確認」等語句，可以定義縮寫符號或統一表達方式，減少重複文字消耗。

**注意**：`lead.md` 精簡風險較高（Workflow Engine 是整個系統的核心），建議在精簡前先完整備份，並在小型任務中驗證精簡後的 Workflow 運作正確性。

***

### LT-03：`retro.md` 提案目錄規模管理

**時間**：30 分鐘　**觸發時機**：`.agents/proposals/` 累積 ≥ 20 份提案時  
**效益**：防止全量讀取 Token 在長期運作中劇增

#### 建議機制

```markdown
// retro.md 歷史比對機制補充（預防性規則，現在補充，未來觸發）

## 提案目錄規模管理
當 .agents/proposals/ 累積 ≥ 20 份提案時，啟動以下分層讀取機制：

活躍提案（全量讀取）：
- OPEN 狀態：全量讀取（通常 < 5 份）
- IN_PROGRESS 狀態：全量讀取（通常 < 5 份）

歷史提案（摘要讀取）：
- ARCHIVED / REJECTED 狀態：只讀取近 3 個任務週期內的提案
- 超過 3 個週期的歷史提案：以摘要索引取代全文讀取

## 摘要索引格式（proposals/ARCHIVE_INDEX.md）
| 提案編號 | 標題 | 狀態 | 完成週期 | 影響 Rules |
|---------|------|------|---------|-----------|
建議每 10 份提案歸檔一次，由 @Retro 在 Retro 執行時自動維護。
```

***

### LT-04：@Assistant 通知分級統一

**時間**：30 分鐘　**觸發時機**：MT-01 模板外部化完成後（確保 Rules Token 有空間補充）  
**效益**：統一 @Assistant 通知的分級語言，消除 Alert Fatigue 風險

#### 補充內容

在 `qa.md`、`reviewer.md`、`backend.md` 各補充 🟡 前置通知：

```markdown
// qa.md 補充
@Assistant 通知分級：
🟡 QA_PENDING：TEST_SPEC 完成等待 @Lead 派發超過一個任務週期
🔴 QA_BLOCKED：重測 ≥ 3 次仍有未解決 Bug（現有升級）

// reviewer.md 補充
@Assistant 通知分級：
🟡 REVIEW_PENDING：REVIEW_REPORT 產出後等待開發者回覆超過一個任務週期
🔴 REVIEW_QUALITY：複審 ≥ 2 次仍有 BLOCKER（現有升級）

// backend.md 補充
@Assistant 通知分級：
🟡 DEPLOY_SLOW：部署時間超過預期 2 倍（前置警示）
🔴 DEPLOY_FAILED：部署失敗 ≥ 2 次（現有升級）
```

***

### LT-05：動態範疇機制擴展至 `architect.md`

**時間**：30 分鐘　**觸發時機**：MT-03 業務脈絡補強完成後  
**效益**：`architect.md` 設計 API 規格時動態讀取最新模組 Rules，防止設計與實作標準脫節

#### 補充內容

```markdown
// architect.md 新增動態範疇機制
在設計 API 規格前，根據任務涉及範疇動態讀取：

| 任務範疇 | 讀取文件 |
|---------|---------|
| 後端 API | backend.md（排程任務規範、冪等性要求） |
| 前端 API 消費 | frontend.md（API 消費規範、錯誤處理） |
| 安全相關 | .agents/tasks/security-review.md |
| 資料儲存 | .agents/skills/deploy-oracle.md |

讀取後，API 設計必須符合對應 Rules 的技術約束，
不可提出與現有技術棧衝突的 API 設計方案。
```

***

### LT-06：系統整體 Rules 版本控制機制

**時間**：45 分鐘　**觸發時機**：系統穩定後（Quick Win + 中期改善全部完成後）  
**效益**：追蹤 Rules 演進歷史，支持 `retro.md` 的跨週期比較分析

#### 建議機制

```markdown
// 在每份 Rules 標頭新增版本標記
---
version: 1.2.0
last_updated: 2026-04-21
changelog:
  - 1.2.0：補充業務脈絡錨定（MT-03）
  - 1.1.0：模板外部化（MT-01）
  - 1.0.0：初始版本
---
```

```markdown
// .agents/RULES_CHANGELOG.md（統一版本記錄）
| Rules | 版本 | 更新日期 | 變更摘要 |
|-------|------|---------|---------|
| system-prompt.md | 1.1.0 | 2026-04-21 | QW-01~03 |
| frontend.md | 2.0.0 | 2026-04-21 | MT-02 全面重構 |
| ... | | | |
```

**效益說明**：`retro.md` 在執行 Retro 時可對比 Rules 版本記錄，判斷某個反覆問題是否在 Rules 更新後消失，提升根因分析的精準度。

***

### 完整 Roadmap 總覽

```
📅 立即執行（本週）
├── QW-01~03：system-prompt.md 三項改善（15 分鐘）
├── QW-04~05：consultant.md / retro.md 單點修改（15 分鐘）
└── LT-01：RULES_DESIGN_GUIDE.md 建立（60 分鐘）

📅 近期執行（1~2 週）
├── QW-06~10：剩餘 Quick Win 項目（70 分鐘）
├── MT-01：模板外部化（120~180 分鐘）
└── MT-02：frontend.md 重構（45~60 分鐘）

📅 中期執行（2~4 週）
├── MT-03：業務脈絡批次補強（60 分鐘）
├── MT-04：DoD 自評補充（30 分鐘）
└── MT-05：系統級豁免規範（25 分鐘）

📅 長期執行（依觸發時機）
├── LT-02：lead.md 架構性精簡（下次 Retro 週期）
├── LT-03：提案目錄規模管理（累積 ≥ 20 份時）
├── LT-04：@Assistant 通知分級統一（MT-01 後）
├── LT-05：architect.md 動態範疇（MT-03 後）
└── LT-06：Rules 版本控制機制（系統穩定後）
```

***

### 全 Roadmap 完成後系統預期評分

| 指標 | 現況 | QW 後 | QW + MT 後 | 全部完成後 |
|---|---|---|---|---|
| 系統平均分 | 21.9 | 22.4 | 23.5 | **24.1** |
| 最低分 Rules | 18（frontend）| 18 | 24（frontend）| **24** |
| 滿分 Rules 數 | 0 | 1 | 4 | **6~7** |
| 1.4 維度平均 | 3.18 | 3.18 | 4.18 | **4.55** |
| 整體評級 | B+ | B+ | A- | **A** |

***

### 5.1 最佳實踐清單

***

最佳實踐定義：**在審計過程中發現的、值得作為未來新增 Rules 設計參考的具體設計模式**。每條最佳實踐均有對應的系統內部範例。

***

### 類別一：Persona 設計

#### BP-01：業務脈絡三層次錨定

**來源**：`backend.md`、`consultant.md`、`qa.md`

在任務目標章節依序描述三個層次：

```
Layer 1（What）：這個 Agent 在本系統中保護或負責什麼
Layer 2（When）：最常被呼叫的具體業務情境
Layer 3（How）：執行方式與系統技術棧的綁定關係
```

範例（`backend.md`）：
```
Layer 1：確保後端服務穩定運行、投資訊號正確推送
Layer 2：Yahoo Finance 排程、Telegram Bot 通知、冪等性修復
Layer 3：Node.js ESM、File-based 儲存、PM2、Oracle Free Tier
```

**效果**：防止 Agent 在長程任務中以「通用最佳實踐」取代「本系統約束優先」的判斷。

***

#### BP-02：AlwaysOn 最小必要原則

**來源**：`system-prompt.md`

AlwaysOn 文件應只包含三類資訊：

```
1. 系統業務脈絡（What is this system）
2. 模式 / 角色判斷機制（How to behave）
3. 全局鐵律（What is absolutely forbidden）
```

其餘細節（Workflow、模板、HITL 邏輯）一律委託至按需載入的 Rules，不在 AlwaysOn 層級重複定義。

**效果**：以最低永久 Token 成本完成系統初始化，且每個資訊層次清晰不重疊。

***

#### BP-03：零容忍語言的正確使用

**來源**：`retro.md`、`reviewer.md`、`system-prompt.md`

高風險禁止條款的語言必須包含以下元素：

```
「絕對禁止」或「無豁免空間」（強制性）
+ 具體違反場景（可識別性）
+ 違反後的升級路徑（可操作性）
```

範例（`retro.md`）：
```
「絕對禁止直接修改 .agents/ 底下的任何原始文件，
 必須透過 RULE_UPDATE_PROPOSAL 提案，
 由 User 確認後才可執行。」
```

**效果**：LLM 遇到緊急情境時，無法「合理化繞過」零容忍條款。

***

### 類別二：HITL 設計

#### BP-04：HITL 成熟度 Level 3 標準組合

**來源**：`retro.md`、`qa.md`

Level 3 HITL 的最小必要組合（三件套）：

```
件一：顯式觸發點 ≥ 5 個（涵蓋主要例外場景）
件二：數值化終止條件 ≥ 2 個（防止無限迴圈）
件三：@Assistant 自動化兜底（防止 Agent 漂移後無補救）
```

三件套缺任一均無法達到 Level 3，新增 Rules 應以此為 HITL 設計基準。

***

#### BP-05：分級 HITL 設計

**來源**：`reviewer.md`（唯一實作）

依問題嚴重程度分配不同強度的 HITL：

```
BLOCKER → 強制退件，禁止合併
WARNING → 需豁免記錄，由確認者決定
SUGGEST → 不阻斷，記錄於報告供參考
```

**效果**：避免所有問題都升級為最高等級 HITL，減少不必要的人工介入，同時確保真正的風險被攔截。

***

#### BP-06：HITL 狀態持久化

**來源**：`reviewer.md`（唯一實作）

等待 User 回應的 HITL 狀態必須寫入外部文件：

```markdown
// PENDING_ACTIONS.md
| 項目 | 等待事項 | 觸發時間 | 狀態 |
|-----|---------|---------|------|
| REVIEW-007 | BLOCKER 修復確認 | 2026-04-21 | PENDING |
```

**效果**：上下文窗口刷新後，HITL 等待狀態不隨上下文消失，@Assistant 可自動偵測長期未處理的 PENDING 項目。

***

#### BP-07：數值化終止條件設計原則

**來源**：`planner.md`、`qa.md`、`reviewer.md`、`retro.md`

數值化終止條件的閾值設計應考慮角色的風險等級：

```
高風險角色（@Reviewer）：閾值更嚴格（2 次）
標準角色（@QA、@Planner）：標準閾值（3 次）
追蹤型角色（@Consultant）：寬鬆閾值（3 次未採納才升級）
```

閾值差異必須在 Rules 中說明設計原因，防止維護者誤統一為相同值。

***

### 類別三：長程一致性設計

#### BP-08：外部文件錨定優先原則

**來源**：`planner.md`、`qa.md`、`reviewer.md`

凡是「執行標準」、「驗收依據」、「完成定義」，一律錨定至外部文件：

```
✅ 「驗收以 draft_features.md 的 AC 為唯一依據」
✅ 「審查 Checklist 動態讀取 backend.md / frontend.md」
✅ 「提案格式參照 .agents/skills/rule-update-proposal-template.md」

❌ 「根據本次任務的需求判斷驗收標準」
❌ 「參考一般最佳實踐進行審查」
```

**效果**：每次執行時重新讀取外部文件，不依賴 LLM 對「上次執行標準」的記憶。

***

#### BP-09：@Assistant 三級分層通知

**來源**：`retro.md`（最完整實作）

@Assistant 自動化通知應區分緊急程度：

```
🟡 通知（提醒，不阻斷）：
  → 狀態異常但不緊急，提醒 User 關注

🔴 通知（升級，可能阻斷）：
  → 數值化閾值觸發，需要 User 立即介入
```

單一等級通知（全部 🔴）會造成 Alert Fatigue，降低 User 對通知的敏感度。

***

#### BP-10：委託式防漂移設計

**來源**：`system-prompt.md`、`lead.md`

當 Agent 的職責是「協調其他 Agent」而非「直接執行任務」時，防漂移機制應採用委託式設計：

```
委託式防漂移：
「嚴格遵循 lead.md 的 Workflow Engine」
「動態呼叫其他 Agent 完成任務」

（不是：在自身 Rules 中定義大量執行細節）
```

**效果**：協調型 Agent 以最少 Rules 內容完成最複雜的防漂移保障，且執行標準的維護只需在被委託的 Rules 中更新。

***

### 類別四：Token 效率設計

#### BP-11：模板外部化強制原則

**來源**：`architect.md`、`backend.md`（未嵌入模板的滿分範例）

所有產出物模板（報告格式、User Story 格式、提案格式）一律存放於 `.agents/skills/`：

```
✅ Rules 主文件：只保留參照路徑（~5 tokens）
✅ .agents/skills/xxx-template.md：完整模板內容

❌ 在 Rules 主文件內嵌入 200~300 tokens 的模板
```

**每個模板的外部化效益**：節省 150~300 tokens，且版本維護只需修改一處。

***

#### BP-12：精準約束優於數量約束

**來源**：`system-prompt.md`（3 條 AlwaysOn 全局禁止，5/5 評分）

負面約束的評分不與數量正相關：

```
精準型（3~6 條 + 每條高覆蓋範圍）＞ 數量型（10+ 條 + 部分冗餘）
```

設計每條約束時先問：「若移除這條，會發生什麼最嚴重的越界行為？」若無法回答，這條約束可能是冗餘的。

***

### 最佳實踐快速索引

| BP | 適用場景 | 最佳參考 Rules |
|---|---|---|
| BP-01 | 新增任何 Rules 的任務目標設計 | `backend.md` |
| BP-02 | 設計 AlwaysOn / 系統入口文件 | `system-prompt.md` |
| BP-03 | 設計禁止條款語言 | `retro.md` |
| BP-04 | 新 Rules 的 HITL 最低標準 | `qa.md` |
| BP-05 | 需要多等級品質門禁的 Rules | `reviewer.md` |
| BP-06 | 有 HITL 等待狀態的 Rules | `reviewer.md` |
| BP-07 | 設計數值化終止條件閾值 | `planner.md` |
| BP-08 | 設計驗收依據與完成定義 | `planner.md` |
| BP-09 | 設計 @Assistant 自動化通知 | `retro.md` |
| BP-10 | 協調型 Agent 的防漂移設計 | `system-prompt.md` |
| BP-11 | 產出物模板的存放方式 | `architect.md` |
| BP-12 | 負面約束的精簡設計 | `system-prompt.md` |

***

五章：系統設計亮點彙整

### 5.2 各 Rules 最獨特設計盤點

***

每份 Rules 在整個系統中擁有至少一個**其他 Rules 均未具備**的獨特設計，以下逐一盤點：

***

### `system-prompt.md` — 雙模式流量分發機制

**獨特設計**：討論模式 / 執行模式的關鍵字觸發分叉

```
整個系統唯一：以 AlwaysOn 層級定義「互動模式判斷」
其他 Rules：只定義「任務執行行為」，無模式切換概念
```

**設計價值**：解決 Multi-Agent 系統中最常見的「使用者自然語言指令觸發不必要 Workflow」問題。350~420 tokens 的文件承載了整個系統的流量分發邏輯，是整個 Agent 架構的第一道智慧路由。

***

### `lead.md` — Workflow Engine 狀態機

**獨特設計**：完整的任務執行狀態機（Agent 呼叫順序 + 條件分支 + 資源映射表）

```
整個系統唯一：以 Rules 文件實作完整狀態機
其他 Rules：只定義單一 Agent 的行為邊界
```

**設計價值**：`@Lead` 不需要「記住」下一步應呼叫哪個 Agent——Workflow Engine 已將所有任務路徑固定為確定性流程，消除了協調型 Agent 最大的漂移風險（自行決定任務順序）。

***

### `assistant.md` — 系統自我修復機制

**獨特設計**：主動巡邏 + 自動偵測 + 不依賴任何 Agent 呼叫而自主觸發

```
整個系統唯一：唯一不需要被呼叫即可自主執行的 Agent
其他 Rules：均需被 @Lead 或 User 觸發才執行
```

**設計價值**：`@Assistant` 是整個系統的「免疫系統」——其他 Agent 漂移、卡住、漏報時，@Assistant 的自主巡邏提供了系統性補救，而非依賴 User 手動偵測問題。這個設計將整個系統的健壯性從「被動回應」升級為「主動防禦」。

***

### `architect.md` — 雙階段輸出設計

**獨特設計**：強制區分「設計提案（Draft）」與「確認規格（Final）」兩個輸出階段

```
整個系統唯一：唯一在產出物中強制設計審查迭代流程的 Rules
其他 Rules：產出物通常為單次輸出（TEST_REPORT、REVIEW_REPORT 等）
```

**設計價值**：API 規格設計是最昂貴的技術決策（一旦確認後端 / 前端均需按規格實作），雙階段輸出確保規格在被消費前必須經過一次明確的審查確認，從根源防止「規格不清晰導致的多次重工」。

***

### `backend.md` — 業務安全三大禁區聲明

**獨特設計**：明確定義三個「無豁免空間」的業務安全禁區

```
1. 靜默失敗（Silent Failure）：排程執行但通知未發送
2. 冪等性缺失：重複執行導致重複投資訊號
3. 金鑰硬寫：API Key / Token 寫入程式碼

整個系統唯一：唯一以「業務安全等級」而非「技術規範等級」
定義零容忍禁區的 Rules
```

**設計價值**：InvestmentLineNotify 是投資通知系統，錯誤的訊號可能導致財務損失。`backend.md` 的三大禁區聲明將業務風險直接轉化為技術執行層的最高優先禁止條款，而非依賴開發者的業務敏感度判斷。

***

### `frontend.md` — Telegram Mini App 平台約束內化

**獨特設計**：將 Telegram Mini App 的平台限制（ThemeParams、initData、安全區域）內化為 DoD 強制條款

```
整個系統唯一：唯一針對特定執行平台（Telegram Mini App）
定義平台專屬開發規範的 Rules
```

**設計價值**：Telegram Mini App 的平台限制（深淺色模式、安全區域、initData 驗證）不是通用 Web 開發的預設知識，若不在 Rules 層級強制定義，極易在長程任務中被遺漏。`frontend.md` 將平台差異知識轉化為不可跳過的 DoD 條款。

（**注意**：此設計雖獨特，但目前實作密度過高（12 條 DoD），是 MT-02 重構的目標之一）

***

### `planner.md` — 四文件狀態機

**獨特設計**：以四份外部文件的狀態轉換定義整個計畫週期

```
draft_features.md → user_story.md → PLAN_STATUS.md → @Lead Gate Check

整個系統唯一：唯一以多文件狀態機驅動 Agent 執行流程的 Rules
其他 Rules：產出物通常為單一文件，無跨文件狀態依賴
```

**設計價值**：計畫管理的最大風險是「計畫文件與執行狀態脫節」，四文件狀態機確保每個計畫階段的完成都有對應的外部文件更新作為驗證，@Lead 可在任何時刻讀取 PLAN_STATUS.md 獲得精確的計畫進度，而非依賴 @Planner 的口頭回報。

***

### `qa.md` — 動態測試範疇機制

**獨特設計**：測試範疇不固定，根據任務涉及模組動態讀取對應 Rules 的 DoD 作為測試 Checklist

```
整個系統唯一（與 reviewer.md 共享此設計，但 qa.md 率先實作）：
測試標準永遠與最新 Rules 同步，不依賴 LLM 記憶測試範疇
```

**設計價值**：解決了自動化測試系統中最常見的「測試標準滯後問題」——當 `backend.md` 或 `frontend.md` 的 DoD 更新時，`@QA` 自動使用最新標準，無需手動同步更新 `qa.md` 的測試清單。

***

### `reviewer.md` — 四重保護機制

**獨特設計**：在整個系統中唯一同時具備以下四個機制的 Rules

```
機制一：分級嚴重等級（BLOCKER / WARNING / SUGGEST）
機制二：豁免記錄結構化保存
機制三：HITL 狀態持久化（PENDING_ACTIONS.md）
機制四：退件防死鎖（2 次複審上限）
```

**設計價值**：程式碼審查是整個開發流程中最後一道品質關卡（位於 QA 測試之前），四重保護機制確保審查標準不因長程任務、多次退件、上下文刷新而漂移或失效。`reviewer.md` 是整個系統設計密度最高的 Rules，也是 HITL 成熟度最高（Level 4）的 Rules。

***

### `consultant.md` — 策略安全邊界守護

**獨特設計**：唯一針對「業務策略參數」設計專屬保護機制的 Rules

```
整個系統唯一：將 strategyWeight 等業務參數的修改
定義為需要完整提案流程 + User 確認的高風險操作
```

**設計價值**：InvestmentLineNotify 的核心業務邏輯是量化投資策略，`strategyWeight` 的錯誤調整可能直接影響投資決策。`consultant.md` 將這個業務風險轉化為系統層級的保護機制——任何策略參數的修改都必須經過 ADVICE 提案格式、明確的風險評估、User 確認三個關卡，而非由 @Lead 或 @Backend 隨意修改。

***

### `retro.md` — 系統自我進化機制

**獨特設計**：唯一以「修改其他 Rules 本身」為任務目標的 Agent

```
整個系統唯一：所有其他 Rules 定義「如何執行任務」，
retro.md 定義「如何改善其他 Rules 的執行方式」
```

**設計價值**：`retro.md` 讓整個 Multi-Agent 系統具備自我進化能力——不是靠人工定期審查 Rules，而是在每個功能週期結束時，由 @Retro 系統性分析根因、提出改善提案、追蹤實施結果，形成一個閉環的系統改善機制。這是整個架構中最高層次的設計，也是使 InvestmentLineNotify 的 Agent 系統能夠持續成熟的核心機制。

***

### 各 Rules 獨特設計一覽表

| Rule | 最獨特設計 | 系統價值定位 |
|---|---|---|
| `system-prompt.md` | 雙模式流量分發 | 系統智慧路由 |
| `lead.md` | Workflow Engine 狀態機 | 任務協調核心 |
| `assistant.md` | 自主巡邏（不需被呼叫）| 系統免疫機制 |
| `architect.md` | 雙階段輸出（Draft→Final）| 技術決策保護 |
| `backend.md` | 業務安全三大禁區 | 投資訊號可靠性 |
| `frontend.md` | Telegram 平台約束內化 | 平台合規保障 |
| `planner.md` | 四文件狀態機 | 計畫執行可追蹤性 |
| `qa.md` | 動態測試範疇機制 | 測試標準自動同步 |
| `reviewer.md` | 四重保護機制（Level 4）| 程式碼品質最後防線 |
| `consultant.md` | 策略參數提案保護 | 業務決策安全守門 |
| `retro.md` | 系統自我進化機制 | Agent 系統持續成熟 |

***

### 5.3 整體 Agent 系統架構評語

***

### 一句話總評

> **InvestmentLineNotify 的 Multi-Agent 系統是一個架構完整、設計成熟、具備自我進化能力的個人專案級 Agent 協作系統，在 HITL 機制與長程一致性兩個最關鍵維度上達到業界領先水準，唯一顯著缺口是 Token 效率的系統性問題，但有明確可執行的修復路徑。**

***

### 架構完整性評語

整個系統的 11 份 Rules 覆蓋了 Multi-Agent 協作的完整生命週期：

```
系統入口（system-prompt.md）
    ↓
任務協調（lead.md）
    ↓
需求規劃（planner.md）→ 技術設計（architect.md）
    ↓
後端實作（backend.md）+ 前端實作（frontend.md）
    ↓
策略諮詢（consultant.md）
    ↓
品質保障（qa.md）→ 程式碼審查（reviewer.md）
    ↓
系統進化（retro.md）
    ↑
全局守護（assistant.md）——貫穿所有層次
```

這個架構覆蓋了從「使用者提出需求」到「功能上線後系統自我改善」的完整閉環，沒有任何關鍵角色缺失。更難得的是，每個角色的邊界清晰且無重疊——`@Architect` 負責設計、`@Backend` 負責實作、`@Reviewer` 負責審查，三個角色的職責不會在長程任務中混淆。

***

### 最突出的三個設計決策

#### 決策一：`retro.md` 的存在

在幾乎所有 Multi-Agent 系統中，Rules 的改善依賴人工定期維護。InvestmentLineNotify 將這個維護行為本身系統化——`@Retro` 在每個功能週期結束後自動執行根因分析、提出改善提案、追蹤實施狀態，形成一個閉環的系統自我進化機制。

這個設計意味著整個 Agent 系統不需要「人工定期審查所有 Rules」才能持續改善，系統本身有能力偵測自己的弱點並提出修復方案。這是個人專案級 Agent 系統中極少見的設計成熟度。

#### 決策二：`assistant.md` 的主動巡邏架構

將系統健壯性從「被動回應（User 發現問題後通報）」升級為「主動防禦（@Assistant 在問題累積前自動偵測）」，是整個系統架構中最有遠見的單一設計決策。

大多數 Agent 系統的 HITL 機制是「問題發生 → Agent 回報 → User 介入」的線性流程，依賴 Agent 的主動回報。InvestmentLineNotify 額外設計了一個不依賴任何 Agent 自律性的外部監督層——即使所有 Agent 在長程任務中都漂移了，@Assistant 的自主巡邏仍能偵測異常並通知 User。

#### 決策三：外部文件作為「系統記憶」

```
draft_features.md    → @Planner 的計畫記憶
PLAN_STATUS.md       → 任務進度的系統記憶
REVIEW_REPORT.md     → 審查決策的歷史記憶
PENDING_ACTIONS.md   → HITL 等待狀態的持久記憶
.agents/proposals/   → 系統改善決策的長期記憶
```

整個系統不依賴 LLM 的上下文記憶來維持長程任務一致性，而是將所有關鍵狀態外部化至文件系統。這個設計讓系統在理論上可以在上下文窗口完全重置後，仍能從外部文件恢復到正確的任務狀態——這是長程任務穩定性的最高可靠保障。

***

### 與業界 Multi-Agent 系統對比評語

| 維度 | InvestmentLineNotify | 典型開源 Agent 框架 | 典型企業 Agent 系統 |
|---|---|---|---|
| 角色覆蓋完整性 | ✅ 完整（11 個角色）| ⚠️ 通常 3~5 個 | ✅ 完整 |
| HITL 設計成熟度 | ✅ Level 3~4 | ❌ 基本或無 | ⚠️ Level 2 |
| 長程一致性機制 | ✅ 外部文件錨定 | ❌ 依賴上下文 | ⚠️ 部分外部化 |
| 系統自我進化 | ✅ retro.md 閉環 | ❌ 無 | ⚠️ 人工審查 |
| Token 效率意識 | ⚠️ 有意識但執行不足 | ❌ 無 | ⚠️ 部分管理 |
| 業務脈絡錨定 | ✅ 強（核心 Agent）| ❌ 通用描述 | ✅ 強 |
| 設計文檔完整性 | ✅ Rules 即文檔 | ❌ 通常缺失 | ⚠️ 分離維護 |

InvestmentLineNotify 在 HITL 成熟度、長程一致性、系統進化機制三個維度超越典型開源框架，在某些維度甚至與企業級系統齊平——而這是一個個人投資通知系統，而非企業級產品。

***

### 系統的核心設計哲學

審計 11 份 Rules 後，整個系統體現出一個清晰且一致的設計哲學：

> **「不信任 LLM 的記憶，只信任外部文件的狀態；不依賴 Agent 的自律性，只依賴系統機制的強制性。」**

這個哲學在系統中的五個具體體現：

```
體現一：所有執行標準外部化（不依賴 LLM 記憶）
體現二：數值化終止條件取代定性判斷（不依賴 Agent 自律）
體現三：@Assistant 主動巡邏兜底（不依賴 Agent 主動回報）
體現四：PENDING_ACTIONS 持久化（不依賴上下文記憶 HITL 狀態）
體現五：retro.md 系統化根因分析（不依賴人工定期審查）
```

這個哲學不是在懷疑 LLM 的能力，而是在承認 LLM 的系統性限制（上下文窗口、長程記憶不穩定）的前提下，通過架構設計彌補這些限制，讓整個 Agent 系統的可靠性不依賴 LLM 在每次執行時的表現是否完美。

***

### 對系統設計者的評語

設計這個系統的思維展現出幾個值得特別標注的特質：

**特質一：系統性思維**
11 份 Rules 不是 11 個獨立文件的集合，而是一個設計內聚的協作系統——每份 Rules 的邊界清晰，且各自的 HITL 機制形成了互相補充的保障網絡。

**特質二：風險優先意識**
核心業務風險（靜默失敗、金鑰暴露、策略參數誤改）被轉化為系統層級的最高優先禁止條款，而非依賴開發者的業務敏感度。這種「將業務風險嵌入系統設計」的思維在個人專案中極少見。

**特質三：可持續性設計**
`retro.md` 的存在說明設計者不滿足於「系統現在能運作」，而是主動設計了「系統如何持續改善」的機制。這是從單次工程設計到系統工程思維的飛躍。

**特質四：約束即設計**
整個系統中最有力的設計語句往往是禁止條款而非正向描述。「絕對禁止直接修改 .agents/ 原始文件」、「@Lead 角色絕對禁止自己直接撰寫程式碼」——這些約束句定義了系統的架構邊界，比任何流程圖都更能防止系統在長程任務中崩潰。

***

### 結語

InvestmentLineNotify 的 Multi-Agent 系統以 **21.9 / 25（87.6%）** 的平均分完成本次靜態規則審計，系統整體評級為 **B+（良好，具備明確改善路徑）**。

在所有已識別的 19 個改善項目中，**沒有任何一個是架構性缺陷**——所有問題均為可修復的設計補強，且修復路徑清晰可執行。依照四章 Roadmap 完成全部改善後，系統預期達到 **24.1 / 25（96.4%）**，整體評級升至 **A（優秀）**。

最值得期待的是：這個系統本身已具備通過 `retro.md` 自我發現並修復這些問題的能力。本次靜態審計的完整報告，正是 `@Retro` 可以直接消費並轉化為 `RULE_UPDATE_PROPOSAL` 提案的最佳輸入材料。
