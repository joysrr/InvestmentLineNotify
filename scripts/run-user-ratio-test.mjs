import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

// 我們想測試的出清賣出上限
const sellRatios = [0.25, 0.5, 0.75, 1.0];

async function run() {
  console.log(
    "🚀 啟動正式生產機制回測 - 測試出清賣出上限 [25%, 50%, 75%, 100%]...",
  );

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

  for (const ratio of sellRatios) {
    const ratioPercent = ratio * 100;
    process.stdout.write(`⏳ 演算中: 出清賣出上限 ${ratioPercent}% ... `);

    // 初始化 Runner，設定為正常生產模式 (disableGuards: false)，因為使用實盤策略判斷
    const runner = new BacktestRunner({
      name: `賣出上限 ${ratioPercent}%`,
      initialCash: 0,
      monthlyDca: 30000,
      pledgeRatio: 0.6,
      disableGuards: false, // 實盤策略守衛均啟用
      disableLoanGuard: false, // 去槓桿守衛啟用 (維持 0.85 觸發，0.70 還款)
      quiet: true,
    });

    // 繼承 handleDecision 並複寫其 isSell 部分的出清比例
    runner.handleDecision = async function (decision, day, price0050, priceZ2) {
      const signalDir = decision.signalDirection ?? "hold";
      const targetStr = decision.target ?? "";
      const isBuy = signalDir === "long";
      const isSell = signalDir === "short" || targetStr.includes("強制賣出");

      if (isBuy) {
        const availCredit = this.account.getAvailableCredit(price0050);
        const scalingRatio = decision.scalingRatio ?? 1.0;
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
      } else if (isSell) {
        if (this.account.qtyZ2 > 0) {
          // 原本是 qtyZ2 * priceZ2 (100%賣出)
          // 現在依據設定的 ratio 來調整賣出比率
          const sellQty = Math.ceil(this.account.qtyZ2 * ratio);
          const sellValue = sellQty * priceZ2;
          if (sellValue > 0) {
            this.account.executeTrade(
              "00675L.TW",
              -sellValue,
              priceZ2,
              price0050,
              true,
            );
          }
        }
      }
    };

    const sum = await runner.run();

    // 總投入計算
    // DCA 每月 3 萬，17 年 (205個月，以真實資料期為準)
    // 回測資料的時長
    const startDay = new Date(runner.timeline[60].date);
    const endDay = new Date(runner.timeline[runner.timeline.length - 1].date);
    const diffYears = (endDay - startDay) / (1000 * 60 * 60 * 24 * 365.25);

    sum.name = `${ratioPercent}% 賣出上限`;
    sum.mdd = getMDD(runner.results);
    // 真實平均 DCA 累計成本大約為 618 萬以下 (DCA 17.1 年，每月 3萬 => 約 513~600萬)
    // 為了極致精準計算 CAGR (採用起訖日期的實際年數)
    // CAGR = (期末淨值 / 總 DCA 花費加上起始) 的對應計算法，通常年化報酬率在同投入基礎下互比具有絕對意義
    // 我們直接以總 DCA 流入累積進行計算
    // 計算總 DCA 花費
    let totalInvested = 0;
    let lastM = -1;
    for (let idx = 60; idx < runner.timeline.length; idx++) {
      const m = new Date(runner.timeline[idx].date).getMonth();
      if (m !== lastM) {
        totalInvested += 30000;
        lastM = m;
      }
    }

    // 使用總投入金額來反推標準 IRR/CAGR
    // 這邊我們以業界公認的簡單 CAGR 對比 (以總累積投入當作分母的簡化年化計算法，或是用精確的 XIRR)
    // 我們計算簡易 CAGR: (最終淨值 / 總投入) ^ (1 / 年數) - 1
    sum.cagr = (
      (Math.pow(sum.finalNetAsset / totalInvested, 1 / diffYears) - 1) *
      100
    ).toFixed(2);
    sum.totalInvested = totalInvested;
    sum.diffYears = diffYears.toFixed(2);

    // 記下最高借贷維持率以供查核
    let maxUsage = 0;
    for (const snap of runner.results) {
      if (snap.pledgeCap > 0) {
        const u = snap.totalLoan / snap.pledgeCap;
        if (u > maxUsage) maxUsage = u;
      }
    }
    sum.maxUsage = (maxUsage * 100).toFixed(1);

    runResults.push(sum);
    console.log(
      `完成! 最終淨值: ${Math.round(sum.finalNetAsset).toLocaleString()} / MDD: ${sum.mdd}%`,
    );
  }

  console.log(
    "\n=======================================================================================================",
  );
  console.log(
    `📊 生產機制正式對準測試結果 (回測期間: ${runResults[0].diffYears} 年, 總 DCA 投入: NT$${runResults[0].totalInvested.toLocaleString()})`,
  );
  console.log(
    "=======================================================================================================",
  );
  console.table(
    runResults.map((r) => ({
      策略賣出上限: r.name,
      最終淨值: "NT$" + Math.round(r.finalNetAsset).toLocaleString(),
      "年化報酬 (CAGR)": r.cagr + "%",
      "最大回撤 (MDD)": r.mdd + "%",
      最深借貸額度使用率: r.maxUsage + "%",
      "0050 最終持股": Math.round(r.qty0050).toLocaleString() + " 股",
      "00675L 最終持股": Math.round(r.qtyZ2).toLocaleString() + " 股",
    })),
  );
}

run();
