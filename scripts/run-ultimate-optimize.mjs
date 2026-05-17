// scripts/run-ultimate-optimize.mjs
import fs from "fs/promises";
import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

const plans = [
  {
    name: "方案 0 (Baseline 原廠)",
    bt: 4.0,
    btb: 4.0,
    amt: 100000,
    scale: false,
  },
  {
    name: "方案 1 (動能雙軌 Trend Rider)",
    bt: 4.0,
    btb: 1.5,
    amt: 100000,
    scale: false,
  },
  {
    name: "方案 2 (積極微量試單 Micro-DCA)",
    bt: 0.8,
    btb: 0.8,
    amt: 20000,
    scale: false, // 將單筆買入降到極低，即使被洗也不會痛
  },
  {
    name: "方案 3 (動態部位縮放 Scaling)",
    bt: 1.2,
    btb: 1.2,
    amt: 50000,
    scale: true,
  },
];

// 我們攔截 handleDecision 動態竄改分數，因為內部的 ma60Slope 一直是 0，導致滿分從 18 變成 8 分（因為籌碼跟斜率缺件）
// 所以我們把真正的『及格標準』依比例對半砍 (例如原本 4.0 滿分 18，現在滿分剩 8，門檻應該降到 1.5 左右)

class UltimateRunner extends BacktestRunner {
  constructor(p) {
    super({ quiet: true });
    this.p = p;
  }

  async handleDecision(decision, day) {
    const price = day.price00675L || day.price0050 * 2.5;
    let currentTarget = decision.target;

    // 【核心魔法】：既然原廠計分矩陣少了籌碼與均線分數（約 -10 分），我們利用現有的短線指標 MACD 與 RSI 重建發動機
    let simulatedScore = decision.finalScore;
    const macdScore =
      decision.categoryResults?.technicalTrend?.details?.find(
        (d) => d.factor === "macd",
      )?.score || 0;

    // 如果 MACD 強勢且大盤正在漲，強迫給予補貼動能 2.0 分
    if (macdScore > 0.5 && this.account.qty0050 > 0) {
      simulatedScore += 2.0;
    }

    // 動態判斷門檻
    const isBullish = macdScore > 0;
    const threshold = isBullish ? this.p.btb : this.p.bt;

    if (simulatedScore >= threshold) {
      currentTarget = "⚡ 撥款加碼 (Override)";
      decision.scalingRatio = Math.max(
        0.2,
        Math.min(1.0, simulatedScore / 4.0),
      ); // 動態計算縮放比例
    } else if (simulatedScore <= -2.0) {
      // 放寬賣出條件到 -2.0 以下
      currentTarget = "強制賣出 (Override)";
    }

    if (currentTarget.includes("加碼")) {
      const finalAmt = this.p.scale
        ? this.p.amt * decision.scalingRatio
        : this.p.amt;
      this.account.executeTrade("00675L.TW", finalAmt, price, true);
    } else if (currentTarget.includes("賣出")) {
      if (this.account.qtyZ2 > 0) {
        const sellQty = Math.min(this.account.qtyZ2, this.p.scale ? 500 : 1000);
        this.account.executeTrade("00675L.TW", -(sellQty * price), price, true);
      }
    }
  }
}

async function run() {
  console.log("🚀 啟動【雙軌動能補償】超級優化回測...");
  const results = [];
  for (const p of plans) {
    process.stdout.write(`⏳ 演算中: ${p.name} ... `);
    const r = new UltimateRunner(p);
    const sum = await r.run();
    sum.name = p.name;
    results.push(sum);
    console.log(
      `完成! 最終淨值: ${Math.round(sum.finalNetAsset).toLocaleString()}`,
    );
  }

  console.log(
    "\n==========================================================================================",
  );
  console.log("📊 新世代策略優化分析報告 (雙軌動能補償)");
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

run();
