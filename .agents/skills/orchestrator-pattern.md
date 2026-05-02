<!-- MACHINE_READABLE
type: design-pattern
category: F1
id: orchestrator-pattern
related_proposals: [PROPOSAL_20260424_024]
related_decisions: [ADR-0033]
-->

# Skill: Orchestrator + Policies/Core 模式

> 由 PROPOSAL_20260424_024 建立；F1 類（純通用設計模式）。
> 將 InvestmentLineNotify `strategyEngine.mjs` 重構經驗沉澱為 framework 跨專案知識資產。
> 對齊 ADR-0033（**module 層** Hub-and-Spoke 結構；ADR-0027 黑板模式於 **agent 層**的延伸）。

---

## 一、模式定位（何時該用）

### 1.1 決策樹

```
模組是否符合以下任一條件？
 ├─ 預期 ≥ 500 行
 ├─ 包含 ≥ 3 個業務子流程（如：訊號計算 / 風險評估 / 通知派發）
 ├─ 需要單元測試覆蓋率 ≥ 80%
 └─ 多人協作維護
   ↓
 任一 YES → 採用 Orchestrator + Policies/Core 模式
 全 NO → 維持單檔；不過度設計
```

### 1.2 不適用場景（反向決策）

- 純 CRUD（< 200 行；單一資料流）
- 純 utility 函式（無業務狀態）
- Adapter / Wrapper 層（純翻譯）

---

## 二、Orchestrator 職責

### 2.1 調度優先（Dispatch-only）

主引擎（`index.mjs` 或 `<name>.mjs`）**僅包含**：

- `import` 子模組
- `async/await` 調度邏輯
- 上下文（ctx）組裝與傳遞
- 防禦性 return 攔截

**絕對禁止** 主引擎含具體算分 / 狀態判定算法（這些屬 `core/` / `policies/`）。

### 2.2 上下文保護（Context Protection）

調用外部模組前**必須**：

```js
// ✅ 正確：Object.freeze 防止下游 mutate
const frozenCtx = Object.freeze({ ...ctx });
const result = await policies.entryFilter(frozenCtx);

// ✅ 正確：淺拷貝（如需 mutate 局部）
const localCtx = { ...ctx, override: someValue };

// ❌ 錯誤：直接傳 ctx 任由下游修改
const result = await policies.entryFilter(ctx); // 違反鐵律
```

### 2.3 防禦性返回（Defensive Return）

對外部模組返回值優先權攔截：

```js
// ✅ 正確：早期 return 避免後續邏輯誤讀
const filterResult = await policies.entryFilter(frozenCtx);
if (filterResult) return filterResult; // 早返回 / 短路

const rebalanceResult = await policies.rebalance(frozenCtx);
if (rebalanceResult) return rebalanceResult;

return null; // 預設無動作
```

---

## 三、目錄規範

### 3.1 標準結構

```
src/modules/<engine-name>/
├── index.mjs                    # Orchestrator（主入口；< 100 行）
├── core/
│   ├── index.mjs                # 聚合匯出（必）
│   ├── <state-machine>.mjs      # 純計算 / 跨模組共享狀態機
│   ├── <calculator>.mjs         # 無副作用計算
│   └── *.test.mjs               # 對應單元測試
├── policies/
│   ├── index.mjs                # 聚合匯出（必）
│   ├── <policy-name>.mjs        # 可插拔業務政策（可獨立替換）
│   └── *.test.mjs               # 對應單元測試
└── README.md                    # 模組說明（架構圖 + 使用範例）
```

### 3.2 `core/` 規範

- **無副作用**：純 function；無 I/O / 無全域變數修改 / 無 console.log 業務輸出
- **跨模組共享**：被 ≥ 2 個 policies 引用的邏輯放這裡
- **狀態機**：純狀態機（input → output；無 hidden state）

### 3.3 `policies/` 規範

- **業務規則**：含具體業務判斷的政策邏輯
- **可插拔**：每個 policy **可獨立替換**（不耦合其他 policies）
- **單一職責**：一個 policy 一個業務目的（如 `entryFilter` / `rebalance` / `riskAssessment`）

### 3.4 `index.mjs` 聚合匯出（必）

```js
// core/index.mjs
export * from "./state-machine.mjs";
export * from "./calculator.mjs";

// policies/index.mjs
export * from "./entry-filter.mjs";
export * from "./rebalance.mjs";
```

---

## 四、測試要求

### 4.1 單元測試覆蓋

- `core/*.mjs` ≥ 90% line coverage（純計算；測試最簡單）
- `policies/*.mjs` ≥ 80% line coverage（含業務判斷；mock 外部依賴）
- `index.mjs` ≥ 70% line coverage（focus on 調度邏輯 + 防禦性 return）

### 4.2 Decision Trace 驗證（核心）

每個 Orchestrator **必須**支援「決策路徑追蹤」：

```js
// 啟用 trace（測試時）
const result = await engine.run(ctx, { trace: true });
console.log(result.decisionPath);
// 輸出：[
//   { step: 'entryFilter', result: null, durationMs: 12 },
//   { step: 'rebalance', result: { action: 'BUY', ... }, durationMs: 35 },
// ]
```

**測試範例**：

```js
test("engine: 不同輸入路由至預期 policy 分支", async () => {
  // 情境 A：低波動 → 應走 entryFilter 早返回
  const resultA = await engine.run(lowVolatilityCtx, { trace: true });
  assert.equal(resultA.decisionPath[0].step, "entryFilter");
  assert.notEqual(resultA.decisionPath[0].result, null); // 早返回

  // 情境 B：高波動 → 應走至 rebalance
  const resultB = await engine.run(highVolatilityCtx, { trace: true });
  assert.equal(resultB.decisionPath.length, 2);
  assert.equal(resultB.decisionPath[1].step, "rebalance");
});
```

類比 `.agents/docs/Reports/AUDIT_DECISION_LOG.md`：兩者都記錄「決策軌跡」供事後稽核。

---

## 五、反模式（禁止）

### 5.1 主引擎含算分邏輯

```js
// ❌ 錯誤：算分邏輯寫在 Orchestrator
async function run(ctx) {
  const score = ctx.price * 0.6 + ctx.volume * 0.4; // 違反「調度優先」
  if (score > 100) return { action: "BUY" };
  return null;
}

// ✅ 正確：算分搬至 core/
async function run(ctx) {
  const score = core.calculateScore(ctx);
  if (score > 100) return policies.buy(ctx);
  return null;
}
```

### 5.2 直接 mutate ctx

```js
// ❌ 錯誤：mutate 上游傳入的 ctx
async function entryFilter(ctx) {
  ctx.processedAt = Date.now(); // 違反「上下文保護」
  // ...
}

// ✅ 正確：建立局部變數
async function entryFilter(ctx) {
  const localCtx = { ...ctx, processedAt: Date.now() };
  // ...
}
```

### 5.3 core 含業務規則

```js
// ❌ 錯誤：core/ 含業務判斷（應移 policies/）
// core/risk-calculator.mjs
export function calculateRisk(ctx) {
  if (ctx.market === "TW") return ctx.amount * 1.2; // ← 業務規則
  return ctx.amount;
}

// ✅ 正確：core 純計算；業務規則歸 policies
// core/risk-calculator.mjs
export function calculateRisk(amount, multiplier) {
  return amount * multiplier; // 純計算
}
// policies/tw-market-risk.mjs
import { calculateRisk } from "../core/risk-calculator.mjs";
export function twMarketRisk(ctx) {
  return calculateRisk(ctx.amount, 1.2); // 業務規則 + 純計算組合
}
```

---

## 六、與其他 framework 機制的對齊

| 框架機制                                             | 層級          | 對應關係                                            |
| ---------------------------------------------------- | ------------- | --------------------------------------------------- |
| **PROPOSAL_20260422_026 Hub-and-Spoke + Blackboard** | **agent 層**  | 多 Agent 系統的扁平化協作（精神來源；無專屬 ADR）   |
| **ADR-0033 Orchestrator + Policies/Core**            | **module 層** | 單模組內的扁平化結構（本 skill）                    |
| **Decision Trace**                                   | 程式碼層      | 類比 AUDIT_DECISION_LOG（agent 派遣稽核）           |
| **PROPOSAL_023 ROUTING_TICKET**                      | 派發層        | Orchestrator 內呼叫 policies 的「micro ticket」延伸 |

兩層結構**互補**：

- **Agent 層**：@Lead 是 Orchestrator；@Backend / @Frontend 等是 worker（policies/core 的 agent 對應）
- **Module 層**：`index.mjs` 是 Orchestrator；`policies/*.mjs` 是業務政策；`core/*.mjs` 是共享計算

---

## 七、決策來源

來自 InvestmentLineNotify 2026-04 `strategyEngine.mjs` 重構實戰：

- **Before**：1500+ 行單體；單元測試困難；全域變數風險
- **After**：Orchestrator (~80 行) + 5 policies (~200 行 each) + 3 core (~150 行 each)
- **效益**：測試覆蓋率 30% → 85%；新人上手 -40%；極端市況健壯性 +50%

User 2026-04-24 提案將此模式沉澱為 framework 通用知識；對齊 PROPOSAL_023 黑板精神 + ADR-0027。

---

## 八、關聯

- `decisions/0033-orchestrator-policies-pattern.md` — 架構決策紀錄（why + alternatives）
- `proposals/completed/PROPOSAL_20260422_026.md` — Agent 層 Hub-and-Spoke 黑板模式（本模式 agent 對應；精神來源）
- `rules/architect.md` — 架構師於設計 ≥500 行模組時引用
- `rules/backend.md` — 後端於實作 ≥500 行模組時依本結構

---

**維護紀錄**：

- 2026-04-24：PROPOSAL_20260424_024 Phase B 建立（F1 類）
