import fs from "fs/promises";
import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

// 基於生命週期投資法的方案（這一次直接傳入策略覆蓋參數，完美使用原廠決策核心）
const plans = [
  {
    name: "[控制組] v2.8 (當前保守)",
    // 門檻維持，倍率維持
    buyTactical: 4.0,
    buyTacticalBullish: 1.5,
    scaling: { tier1: 0.4, tier2: 0.7, tier3: 1.0 },
    // 守衛：85% 降回 70%
    triggerRatio: 0.85,
    targetRatio: 0.7,
  },
  {
    name: "[積極 1] 動能追放 (降門檻)",
    // 更容易進場
    buyTactical: 3.0,
    buyTacticalBullish: 1.0,
    scaling: { tier1: 0.5, tier2: 0.8, tier3: 1.0 },
    // 守衛：容忍到 90% (不浪費牛市微幅回檔) 才降回 75%
    triggerRatio: 0.9,
    targetRatio: 0.75,
  },
  {
    name: "[積極 2] 資產極大化 (提高倍率)",
    // 門檻維持 v2.8 的穩定，但一旦確認是牛市，借更多
    buyTactical: 4.0,
    buyTacticalBullish: 1.5,
    scaling: { tier1: 0.7, tier2: 0.9, tier3: 1.0 }, // 幾乎全推
    triggerRatio: 0.95,
    targetRatio: 0.8, // 容忍到 95%
  },
  {
    name: "[積極 3] 終極暴風 (雙開大)",
    // 易進場 + 深倍率
    buyTactical: 2.5,
    buyTacticalBullish: 0.5,
    scaling: { tier1: 0.8, tier2: 1.0, tier3: 1.0 },
    triggerRatio: 0.95,
    targetRatio: 0.85,
  },
];

class LifecycleRunner extends BacktestRunner {
  constructor(p) {
    super({
      name: p.name,
      initialCash: 0,
      monthlyDca: 30000,
      pledgeRatio: 0.6,
      // 這裡傳入 Runner 控制的參數
      buyTactical: p.buyTactical,
      buyTacticalBullish: p.buyTacticalBullish,
      disableGuards: false,
      disableLoanGuard: false,
      quiet: true,
    });
    this.p = p;
  }

  // 攔截並覆寫策略引擎算出的加碼倍率
  async handleDecision(decision, day, price0050, priceZ2) {
    // 動態覆寫決策物件裡的 scalingRatio，讓它讀我們自訂的方案
    if (decision.signalDirection === "long") {
      const score = decision.finalScore || 0;
      if (score >= 6.0) decision.scalingRatio = this.p.scaling.tier3;
      else if (score >= 3.5) decision.scalingRatio = this.p.scaling.tier2;
      else decision.scalingRatio = this.p.scaling.tier1;
    }

    await super.handleDecision(decision, day, price0050, priceZ2);

    // 手動覆寫去槓桿守衛（取代 super 裡的呼叫）
    // 因為 super 有一個自己的 85% 守衛，所以我們先關掉它?
    // 其實不用，我們在建構子把 disableLoanGuard 保持預設，然後我們再多呼叫一次，
    // 或者直接改寫它
  }
}

// override 原廠的 runner 的 loop，這比較乾淨
BacktestRunner.prototype.runDeleverage = function (
  price0050,
  priceZ2,
  trigger,
  target,
) {
  if (!this.config.disableLoanGuard && priceZ2 > 0) {
    this.account.deleverage(price0050, priceZ2, {
      triggerRatio: trigger,
      targetRatio: target,
      quiet: this.config.quiet,
    });
  }
};

// 攔截原本的 deleverage，取消預設參數，用參數傳
const originHandle = BacktestRunner.prototype.handleDecision;
LifecycleRunner.prototype.handleDecision = async function (
  decision,
  day,
  price0050,
  priceZ2,
) {
  if (decision.signalDirection === "long") {
    const score = decision.finalScore || 0;
    if (score >= 6.0) decision.scalingRatio = this.p.scaling.tier3;
    else if (score >= 3.5) decision.scalingRatio = this.p.scaling.tier2;
    else decision.scalingRatio = this.p.scaling.tier1;
  }

  // 只執行原始買賣邏輯，我們在外面自己呼叫去槓桿
  this.config.disableLoanGuard = true;
  await originHandle.call(this, decision, day, price0050, priceZ2);

  // 自訂去槓桿
  if (priceZ2 > 0) {
    this.account.deleverage(price0050, priceZ2, {
      triggerRatio: this.p.triggerRatio,
      targetRatio: this.p.targetRatio,
      quiet: true,
    });
  }
};

async function run() {
  console.log("🚀 啟動【Lifecycle 積極生命週期】完全對齊原廠引擎超級回測...");

  const getMDD = (results) => {
    let peak = -Infinity,
      worstDd = 0;
    for (const r of results) {
      if (r.netAsset > peak) peak = r.netAsset;
      const dd = (r.netAsset - peak) / peak;
      if (dd < worstDd) worstDd = dd;
    }
    return (worstDd * 100).toFixed(2);
  };

  const runResults = [];
  for (const p of plans) {
    process.stdout.write(`⏳ 演算中: ${p.name} ... `);
    const r = new LifecycleRunner(p);
    const sum = await r.run();

    sum.mdd = getMDD(r.results);
    sum.cagr = (
      (Math.pow(sum.finalNetAsset / 6180000, 1 / 17.1) - 1) *
      100
    ).toFixed(2);

    let maxUsage = 0;
    for (const snap of r.results) {
      if (snap.pledgeCap > 0) {
        const u = snap.totalLoan / snap.pledgeCap;
        if (u > maxUsage) maxUsage = u;
      }
    }
    sum.maxUsage = (maxUsage * 100).toFixed(1);
    sum.name = p.name;

    runResults.push(sum);
    console.log(
      `完成! 最終淨值: ${Math.round(sum.finalNetAsset).toLocaleString()} / MDD: ${sum.mdd}%`,
    );
  }

  console.log(
    "\n===============================================================================================================",
  );
  console.log("📊 生命週期投資 (Lifecycle Investing) 最佳化方案對比");
  console.log(
    "===============================================================================================================",
  );
  console.table(
    runResults.map((r) => ({
      策略方案: r.name,
      最終淨值: "NT$" + Math.round(r.finalNetAsset).toLocaleString(),
      年化報酬: r.cagr + "%",
      最大回撤: r.mdd + "%",
      "最高質押%": r.maxUsage + "%",
      最終部位結構: `現金:${Math.round(r.finalNetAsset - r.value0050 - r.valueZ2)} / 0050:${r.qty0050}股 / Z2:${r.qtyZ2}股`,
    })),
  );
}

run();
