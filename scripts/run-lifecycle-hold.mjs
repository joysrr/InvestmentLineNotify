import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

const plans = [
  {
    name: "[控制組] A. 熊市全數出清 (傳統 v2.8)",
    sellRatio: 1.0, // 賣出時 100% 清空
    triggerRatio: 0.95,
    targetRatio: 0.8, // 採用剛才驗證最好的守衛
  },
  {
    name: "[改良組] B. 熊市半數減碼 (賣出 50%)",
    sellRatio: 0.5, // 賣出時只賣 50%部位
    triggerRatio: 0.95,
    targetRatio: 0.8,
  },
  {
    name: "[激進組] C. 熊市微減碼 (賣出 25%)",
    sellRatio: 0.25, // 賣出時只賣 25%部位
    triggerRatio: 0.95,
    targetRatio: 0.8,
  },
  {
    name: "[死忠組] D. 永不賣出 (依靠去槓桿守衛保命)",
    sellRatio: 0.0, // 策略叫我賣我都不賣，完全交給 deleverage 守衛防斷頭
    triggerRatio: 0.95,
    targetRatio: 0.8,
  },
];

const originDeleverage = BacktestRunner.prototype.handleDecision;

async function run() {
  console.log("🚀 啟動【Lifecycle 降槓桿取代出清】核心回測...");

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
      buyTactical: 4.0,
      buyTacticalBullish: 1.5, // 維持保守進場確保勝率
      disableGuards: false,
      disableLoanGuard: true, // 自己決定去槓桿
      quiet: true,
    });

    runner.handleDecision = async function (decision, day, price0050, priceZ2) {
      const signalDir = decision.signalDirection ?? "hold";
      const targetStr = decision.target ?? "";
      const isBuy = signalDir === "long";
      const isSell = signalDir === "short" || targetStr.includes("強制賣出");

      // --- 買入邏輯 (維持原廠倍率) ---
      if (isBuy) {
        let scalingRatio = 0.4;
        const score = decision.finalScore || 0;
        if (score >= 6.0) scalingRatio = 1.0;
        else if (score >= 3.5) scalingRatio = 0.7;

        const availCredit = this.account.getAvailableCredit(price0050);
        const buyAmount = availCredit * scalingRatio;
        if (buyAmount > priceZ2) {
          this.account.executeTrade(
            "00675L.TW",
            buyAmount,
            priceZ2,
            price0050,
            true,
          );
        }
      }
      // --- 賣出邏輯 (改為局部減碼) ---
      else if (isSell) {
        if (this.account.qtyZ2 > 0 && p.sellRatio > 0) {
          const sellQty = Math.ceil(this.account.qtyZ2 * p.sellRatio);
          const sellValue = sellQty * priceZ2;
          this.account.executeTrade(
            "00675L.TW",
            -sellValue,
            priceZ2,
            price0050,
            true,
          );
        }
      }

      // --- 每日防斷頭守衛 ---
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
  console.log("📊 生命週期投資：降槓桿取代清空 (Lifecycle Drawdown Control)");
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
      Z2部位數量: r.qtyZ2 + " 股",
    })),
  );
}

run();
