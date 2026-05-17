import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

// 完全使用原生架構，不用任何攔截魔法
const plans = [
  {
    name: "[控制組] A. v2.8",
    buyTactical: 4.0,
    buyTacticalBullish: 1.5,
    scaling: { tier1: 0.4, tier2: 0.7, tier3: 1.0 },
    triggerRatio: 0.85,
    targetRatio: 0.7,
  },
  {
    name: "[溫和積極] B. 放寬守衛",
    // 只動守衛：容許熊市跌得更深才賣，減少被洗掉的機率
    buyTactical: 4.0,
    buyTacticalBullish: 1.5,
    scaling: { tier1: 0.4, tier2: 0.7, tier3: 1.0 },
    triggerRatio: 0.95,
    targetRatio: 0.8,
  },
  {
    name: "[進攻模式] C. 倍率加倍 + 放寬守衛",
    // 增加牛市賺錢能力 (tier1 0.4 -> 0.7)
    buyTactical: 4.0,
    buyTacticalBullish: 1.5,
    scaling: { tier1: 0.7, tier2: 1.0, tier3: 1.0 },
    triggerRatio: 0.95,
    targetRatio: 0.8,
  },
  {
    name: "[終極 Lifecycle] D. 降門檻 + 滿倍率 + 放寬守衛",
    // 牛市容易進，一進就滿，能撐多久撐多久
    buyTactical: 3.0,
    buyTacticalBullish: 0.5,
    scaling: { tier1: 1.0, tier2: 1.0, tier3: 1.0 },
    triggerRatio: 0.98,
    targetRatio: 0.85,
  },
];

// 我們唯一需要覆寫的是「讓跑回測時能夠讀到我們這局想要設定的 scaling 倍率及去槓桿守衛」
// 由於原本的 BacktestRunner 是透過 Strategy.json 讀 scaling 倍率，
// 去槓桿參數是寫死在 code 裡，這裡用 Object 屬性直接覆寫：

const originDeleverage = BacktestRunner.prototype.handleDecision;

async function run() {
  console.log("🚀 啟動【生命週期投資 (Lifecycle Investing)】精算分析...");

  // MDD 計算
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

    const runner = new BacktestRunner({
      name: p.name,
      initialCash: 0,
      monthlyDca: 30000,
      pledgeRatio: 0.6,
      buyTactical: p.buyTactical,
      buyTacticalBullish: p.buyTacticalBullish,
      disableGuards: false,
      disableLoanGuard: true, // 先關閉原本的定值守衛，由下面重新執行
      quiet: true,
    });

    // 綁架 handleDecision 來做兩件事：
    // 1. 覆寫決策算出來的 scalingRatio
    // 2. 在每天執行完後呼叫我們自訂的 deleverage
    runner.handleDecision = async function (decision, day, price0050, priceZ2) {
      // (1) 換掉倍率
      if (decision.signalDirection === "long") {
        const score = decision.finalScore || 0;
        if (score >= 6.0) decision.scalingRatio = p.scaling.tier3;
        else if (score >= 3.5) decision.scalingRatio = p.scaling.tier2;
        else decision.scalingRatio = p.scaling.tier1;
      }

      // 原始邏輯 (裡面 disableLoanGuard 是 true 不會做去槓桿)
      await originDeleverage.call(this, decision, day, price0050, priceZ2);

      // (2) 自訂參數去槓桿
      if (priceZ2 > 0) {
        this.account.deleverage(price0050, priceZ2, {
          triggerRatio: p.triggerRatio,
          targetRatio: p.targetRatio,
          quiet: true,
        });
      }
    };

    const sum = await runner.run();

    sum.name = p.name;
    sum.mdd = getMDD(runner.results);
    sum.cagr = (
      (Math.pow(sum.finalNetAsset / 6180000, 1 / 17.1) - 1) *
      100
    ).toFixed(2);

    let maxUsage = 0;
    for (const snap of runner.results) {
      if (snap.pledgeCap > 0) {
        const u = snap.totalLoan / snap.pledgeCap;
        if (u > maxUsage) maxUsage = u;
      }
    }
    sum.maxUsage = (maxUsage * 100).toFixed(1);
    sum.qtyZ2 = runner.results.at(-1)?.qtyZ2 || 0;
    sum.qty0050 = runner.results.at(-1)?.qty0050 || 0;

    runResults.push(sum);
    console.log(
      `完成! 最終淨值: ${Math.round(sum.finalNetAsset).toLocaleString()} / MDD: ${sum.mdd}%`,
    );
  }

  console.log(
    "\n==================================================================================================================",
  );
  console.log("📊 生命週期投資 (Lifecycle Investing) 最佳化方案對比");
  console.log(
    "==================================================================================================================",
  );
  console.table(
    runResults.map((r) => ({
      策略方案: r.name,
      最終淨值: "NT$" + Math.round(r.finalNetAsset).toLocaleString(),
      年化報酬: r.cagr + "%",
      最大回撤: r.mdd + "%",
      "最深借貸%": r.maxUsage + "%",
      Z2部位大小: r.qtyZ2 + " 股",
    })),
  );
}

run();
