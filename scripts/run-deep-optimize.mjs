import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

const plans = [
  {
    name: "🔴 Baseline 原廠設定 (重左側)",
    configOverride: {}, // 沿用現有 strategy.json
  },
  {
    name: "🟢 方案 A: 雙引擎 (降左側, 提升均線/MACD)",
    configOverride: {
      scoringMatrix: {
        categories: {
          technicalTrend: { cap: 6, weights: { macd: 3, ma60Slope: 4 } },
          valuationValue: { cap: 6, weights: { priceDrop: 5 } },
          flowOfFunds: { cap: 4, weights: { institutional: 5, sentiment: 3 } },
          extremeOscillation: { cap: 2, weights: { rsi: 2, kd: 2 } },
        },
        thresholds: {
          buyTactical: 4,
          buyTacticalBullish: 3,
          sellTactical: -4,
          hysteresisExit: 1,
        },
      },
    },
  },
  {
    name: "🔵 方案 B: 籌碼順風車 (重外資)",
    configOverride: {
      scoringMatrix: {
        categories: {
          technicalTrend: { cap: 4, weights: { macd: 2, ma60Slope: 1.5 } },
          valuationValue: { cap: 6, weights: { priceDrop: 6 } },
          flowOfFunds: { cap: 8, weights: { institutional: 8, sentiment: 4 } },
          extremeOscillation: { cap: 2, weights: { rsi: 2, kd: 2 } },
        },
        thresholds: {
          buyTactical: 4.5,
          buyTacticalBullish: 3.5,
          sellTactical: -4,
          hysteresisExit: 1,
        },
      },
    },
  },
  {
    name: "🟣 方案 C: 趨勢動態度 (門檻雙標 + 抱得住)",
    configOverride: {
      scoringMatrix: {
        categories: {
          // 維持原廠配比
          technicalTrend: { cap: 4, weights: { macd: 2, ma60Slope: 1.5 } },
          valuationValue: { cap: 8, weights: { priceDrop: 8 } },
          flowOfFunds: { cap: 4, weights: { institutional: 5, sentiment: 3 } },
          extremeOscillation: { cap: 2, weights: { rsi: 2, kd: 2 } },
        },
        thresholds: {
          buyTactical: 5.0, // 震盪市需重挫才買
          buyTacticalBullish: 2.0, // 牛市只要點頭就買
          sellTactical: -5, // 延後賣出
          hysteresisExit: -1, // <--- 關鍵！低於 -1 才會退出，解決「賺一點就跑」的毛病
        },
      },
    },
  },
];

// 重寫 BacktestRunner 子類別以支援 Config 深度覆蓋
class AdvancedRunner extends BacktestRunner {
  constructor(plan) {
    super({ quiet: true });
    this.plan = plan;
  }

  async setup() {
    await super.setup();

    // 深度覆蓋 Strategy
    if (this.plan.configOverride.scoringMatrix) {
      const sm = this.plan.configOverride.scoringMatrix;
      this.strategy.scoringMatrix.categories = sm.categories;
      this.strategy.scoringMatrix.thresholds = {
        ...this.strategy.scoringMatrix.thresholds,
        ...sm.thresholds,
      };
    }
  }

  getSummary() {
    const sum = super.getSummary();
    if (sum) sum.name = this.plan.name;
    return sum;
  }
}

async function runOptimization() {
  console.log("🚀 開始 [權重再平衡] 深度優化分析...");
  console.log(
    "目標：尋找未來二三十年的長治久安之策，打破「牛市不買、買了太早賣」的窘境。\\n",
  );
  const results = [];

  for (const plan of plans) {
    process.stdout.write(`⏳ 演算中: ${plan.name} ... `);
    const runner = new AdvancedRunner(plan);
    const summary = await runner.run();
    // 計算年化與波動率等（這裡簡化）
    results.push(summary);
    console.log(
      `完成! 最終淨值: ${Math.round(summary.finalNetAsset).toLocaleString()}`,
    );
  }

  console.log(
    "\n==========================================================================================",
  );
  console.log("📊 策略優化分析報告 (核心權重重構模組)");
  console.log(
    "==========================================================================================",
  );

  console.table(
    results.map((r) => ({
      策略方案: r.name,
      "總報酬率 (%)": r.returnPct.toFixed(2) + "%",
      最終淨值: "$" + Math.round(r.finalNetAsset).toLocaleString(),
      "00675L 持股": r.qtyZ2 + " 股",
      最低維持金: r.minMm === 999 ? "無貸款" : r.minMm.toFixed(1) + "%",
    })),
  );
}

runOptimization().catch(console.error);
