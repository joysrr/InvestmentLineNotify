import "dotenv/config";
import fs from "fs";
import { calculateIndicators } from "./finance/indicators.mjs";
import { fetchStockHistory } from "./providers/twse/twseStockDayProvider.mjs";
import { fetchStrategyConfig } from "./services/strategyConfigService.mjs";
import { evaluateInvestmentSignal } from "./services/stockSignalService.mjs";

// ==========================================
// 1. 全局設定（只保留系統參數）
// ==========================================
let STRATEGY = null;

const CONFIG = {
  initialCapital: 0,
  monthlyContribution: 30_000,
  startDate: "2005-01-01",
  endDate: new Date().toISOString().split("T")[0],
  dataCacheFile: "./data/history_cache_0050.json",
  debugMode: false,
};

// ==========================================
// 2. 資料準備
// ==========================================
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

function adjustHistoricalData(data) {
  const splitDate = "2025-06-18";
  return data.map((day) => {
    if (day.date < splitDate) {
      return {
        ...day,
        open: day.open / 4,
        high: day.high / 4,
        low: day.low / 4,
        close: day.close / 4,
      };
    }
    return day;
  });
}

async function prepareData() {
  let history0050 = [];

  if (fs.existsSync(CONFIG.dataCacheFile)) {
    try {
      history0050 = JSON.parse(fs.readFileSync(CONFIG.dataCacheFile, "utf-8"));
    } catch (e) {
      history0050 = [];
    }
  }

  if (history0050.length > 0) {
    const cacheStartDate = new Date(history0050[0].date);
    const reqStartDate = new Date(CONFIG.startDate);
    if (cacheStartDate > new Date(reqStartDate.getTime() + 86400000 * 10)) {
      console.log(
        `⚠️ 快取資料起始日 (${history0050[0].date}) 晚於需求日 (${CONFIG.startDate})，將重新下載完整資料...`,
      );
      history0050 = [];
    }
  }

  let nextDate;
  if (history0050.length > 0) {
    const lastDate = new Date(history0050[history0050.length - 1].date);
    nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
  } else {
    nextDate = new Date(CONFIG.startDate);
  }

  const today = new Date();

  if (nextDate < today) {
    console.log(
      `🌐 開始下載歷史資料 (從 ${nextDate.toISOString().split("T")[0]})...`,
    );

    while (nextDate < today) {
      const y = nextDate.getFullYear();
      const m = nextDate.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      const startStr = `${y}-${String(m).padStart(2, "0")}-01`;
      const endStr = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;

      try {
        const data = await fetchStockHistory("0050", startStr, endStr);
        if (data && data.length > 0) {
          const existingDates = new Set(history0050.map((x) => x.date));
          const newRows = data.filter((x) => !existingDates.has(x.date));
          if (newRows.length > 0) {
            history0050.push(...newRows);
            history0050.sort((a, b) => new Date(a.date) - new Date(b.date));
            fs.writeFileSync(
              CONFIG.dataCacheFile,
              JSON.stringify(history0050, null, 2),
            );
          }
        }
        process.stdout.write(".");
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        console.error(`❌ 下載失敗 ${startStr}:`, e.message);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    console.log("\n✅ 資料更新完成");
  }

  console.log("🔧 執行股價還原 (修正 2025 年 1拆4 分割)...");
  const adjusted0050 = adjustHistoricalData(history0050);

  console.log("🧪 合成 2倍槓桿 ETF 模擬數據 (2005-2016 為模擬值)...");
  const historyZ2 = synthesizeZ2(adjusted0050);

  return { history0050: adjusted0050, historyZ2 };
}

function synthesizeZ2(history0050) {
  const historyZ2 = [];
  let currentPriceZ2 = 10;
  const dailyExpense = 0.0103 / 365;
  const LEVERAGE = 2.0;

  for (let i = 0; i < history0050.length; i++) {
    const todayData = history0050[i];
    const prevData = i > 0 ? history0050[i - 1] : null;

    if (prevData) {
      const ret0050 = (todayData.close - prevData.close) / prevData.close;
      const retZ2 = ret0050 * LEVERAGE - dailyExpense;
      const volatilityDrag = Math.pow(ret0050, 2) * (LEVERAGE - 1) * 0.5;
      currentPriceZ2 = currentPriceZ2 * (1 + retZ2 - volatilityDrag);
    }

    const fixedVol = 0.005;
    historyZ2.push({
      date: todayData.date,
      open: currentPriceZ2 * (1 - fixedVol * 0.5),
      high: currentPriceZ2 * (1 + fixedVol),
      low: currentPriceZ2 * (1 - fixedVol),
      close: currentPriceZ2,
      volume: todayData.volume,
    });
  }

  return historyZ2;
}

// ==========================================
// 3. 投資組合 Class（完全從策略檔讀取參數）
// ==========================================
class Portfolio {
  constructor(initialCash, strategy, name = "Portfolio") {
    this.name = name;
    this.strategy = strategy;
    this.cash = initialCash;
    this.qty0050 = 0;
    this.qtyZ2 = 0;
    this.totalLoan = 0;
    this.totalInvested = initialCash;
    this.history = [];
    this.marginCallCount = 0;
    this.lastBuyDate = null;
    this.accumulatedInterest = 0;
    this.rebalanceCount = 0;

    this.reserveCash = 100000;
    this.totalReserveFromSales = 0;
    this.reserveUsageCount = 0;
    this.collateralAddCount = 0;
  }

  buy0050(price, amount) {
    let investAmount = amount;
    if (amount === "ALL" || amount > this.cash) investAmount = this.cash;

    if (this.cash > 0 && investAmount > 1000) {
      const transFee =
        this.strategy.trading.transFee * this.strategy.trading.transFeeDiscount;
      const maxCost = investAmount / (1 + transFee);
      const qty = Math.floor(maxCost / price);
      if (qty > 0) {
        const cost = qty * price;
        const fee = Math.floor(cost * transFee);
        this.qty0050 += qty;
        this.cash -= cost + fee;
        return qty;
      }
    }
    return 0;
  }

  getTargetReserve(netAsset) {
    for (const tier of this.strategy.reserve.tiers) {
      if (netAsset <= tier.maxAsset) {
        return netAsset * tier.ratio;
      }
    }
    return netAsset * 0.04;
  }

  sellZ2AndAllocate(qtyToSell, priceZ2, price0050, netAsset, dateStr, reason) {
    if (qtyToSell <= 0) return { reserved: 0, repaid: 0, bought0050: 0 };

    const proceeds = qtyToSell * priceZ2;
    const transFee =
      this.strategy.trading.transFee * this.strategy.trading.transFeeDiscount;
    const tax = Math.floor(proceeds * this.strategy.trading.taxRate);
    const fee = Math.floor(proceeds * transFee);
    const netProceeds = proceeds - tax - fee;

    this.qtyZ2 -= qtyToSell;
    this.cash += netProceeds;

    const targetReserve = this.getTargetReserve(netAsset);
    const reserveGap = Math.max(0, targetReserve - this.reserveCash);
    const maxReserveAllocation =
      this.cash * this.strategy.reserve.allocationRatio;
    const toReserve = Math.min(reserveGap, maxReserveAllocation);

    if (toReserve > 1000) {
      this.reserveCash += toReserve;
      this.cash -= toReserve;
      this.totalReserveFromSales += toReserve;
    }

    let repaid = 0;
    if (this.totalLoan > 0 && this.cash > 0) {
      repaid = Math.min(this.totalLoan, this.cash);
      this.totalLoan -= repaid;
      this.cash -= repaid;
    }

    const bought0050 = this.buy0050(price0050, "ALL");

    if (CONFIG.debugMode && toReserve > 1000) {
      console.log(
        `[${dateStr}] 💰 ${reason}: ` +
          `預備 $${Math.round(toReserve).toLocaleString()}, ` +
          `還款 $${Math.round(repaid).toLocaleString()}` +
          `${bought0050 > 0 ? `, 買${bought0050}股0050` : ""}`,
      );
    }

    return { reserved: toReserve, repaid, bought0050 };
  }

  defendMaintenance(
    maintenance,
    current0050Value,
    price0050,
    priceZ2,
    netAsset,
    dateStr,
  ) {
    const TRIGGER = this.strategy.maintenance.protectTrigger;
    const TARGET = this.strategy.maintenance.protectTarget;

    if (this.totalLoan <= 0 || maintenance >= TRIGGER) {
      return false;
    }

    const targetLoan = current0050Value / (TARGET / 100);
    const loanGap = this.totalLoan - targetLoan;

    if (loanGap <= 0) return false;

    if (CONFIG.debugMode) {
      console.log(
        `[${dateStr}] 🛡️ 維持率防禦觸發 (${maintenance.toFixed(0)}% < ${TRIGGER}%)`,
      );
    }

    // 策略 1：用預備金買 0050
    if (this.reserveCash > 5000) {
      const needed0050Value = loanGap * (TARGET / 100);
      const maxCanUse = this.reserveCash * 0.8;
      const toUse = Math.min(needed0050Value, maxCanUse);

      this.reserveCash -= toUse;
      this.cash += toUse;

      const qtyBought = this.buy0050(price0050, toUse);

      if (qtyBought > 0) {
        this.collateralAddCount++;
        this.reserveUsageCount++;
        const boughtValue = qtyBought * price0050;
        const newCollateralValue = current0050Value + boughtValue;
        const newMaintenance = (newCollateralValue / this.totalLoan) * 100;

        if (CONFIG.debugMode) {
          console.log(
            `  ✅ 策略1: 動用預備金 $${Math.round(toUse).toLocaleString()}, 買入 ${qtyBought} 股0050`,
          );
          console.log(`  ✅ 維持率提升至 ${newMaintenance.toFixed(0)}%`);
        }

        if (newMaintenance >= TARGET) return true;
      }
    }

    // 策略 2：用現金買 0050
    const remainingGap = this.totalLoan - current0050Value / (TARGET / 100);

    if (this.cash > 5000 && remainingGap > 0) {
      const needed0050Value = remainingGap * (TARGET / 100);
      const maxCanBuy = this.cash * 0.8;
      const toBuy = Math.min(needed0050Value, maxCanBuy);
      const qtyBought = this.buy0050(price0050, toBuy);

      if (qtyBought > 0) {
        this.collateralAddCount++;
        const boughtValue = qtyBought * price0050;
        const newCollateralValue = current0050Value + boughtValue;
        const newMaintenance = (newCollateralValue / this.totalLoan) * 100;

        if (CONFIG.debugMode) {
          console.log(
            `  ✅ 策略2: 用現金 $${Math.round(toBuy).toLocaleString()}, 買入 ${qtyBought} 股0050`,
          );
          console.log(`  ✅ 維持率提升至 ${newMaintenance.toFixed(0)}%`);
        }

        if (newMaintenance >= TARGET) return true;
      }
    }

    // 策略 3：用預備金還款
    const finalGap = this.totalLoan - current0050Value / (TARGET / 100);

    if (this.reserveCash > 1000 && finalGap > 0) {
      const repayFromReserve = Math.min(this.reserveCash, finalGap);
      this.reserveCash -= repayFromReserve;
      this.totalLoan -= repayFromReserve;
      this.reserveUsageCount++;

      const newMaintenance = (current0050Value / this.totalLoan) * 100;

      if (CONFIG.debugMode) {
        console.log(
          `  ✅ 策略3: 預備金還款 $${Math.round(repayFromReserve).toLocaleString()}`,
        );
        console.log(`  ✅ 維持率提升至 ${newMaintenance.toFixed(0)}%`);
      }

      if (newMaintenance >= TARGET) return true;
    }

    // 策略 4：賣出 Z2
    const lastGap = this.totalLoan - current0050Value / (TARGET / 100);

    if (lastGap > 0) {
      const sellAmount = lastGap;
      const qtyToSell = Math.min(Math.floor(sellAmount / priceZ2), this.qtyZ2);

      if (qtyToSell > 0) {
        const result = this.sellZ2AndAllocate(
          qtyToSell,
          priceZ2,
          price0050,
          netAsset,
          dateStr,
          "策略4: 賣Z2",
        );

        if (CONFIG.debugMode) {
          console.log(
            `  ⚠️ 策略4: 賣出 ${qtyToSell} 股Z2, 還款 $${Math.round(result.repaid).toLocaleString()}`,
          );
        }
      }
    }

    return true;
  }

  executeStrategy(
    targetBorrowRatio,
    priceZ2,
    price0050,
    netAsset,
    dateStr,
    isRebalanceDay,
    score,
  ) {
    const currentZ2Value = this.qtyZ2 * priceZ2;
    const current0050Value = this.qty0050 * price0050;
    const z2Ratio = netAsset > 0 ? currentZ2Value / netAsset : 0;
    const currentBorrowRatio = netAsset > 0 ? this.totalLoan / netAsset : 0;
    const maintenance =
      this.totalLoan > 0 ? (current0050Value / this.totalLoan) * 100 : 999;

    // 優先級 1：維持率防禦
    const defended = this.defendMaintenance(
      maintenance,
      current0050Value,
      price0050,
      priceZ2,
      netAsset,
      dateStr,
    );

    if (defended) return;

    // 優先級 2：極端風控
    let needSell = false;
    let sellReason = "";
    let targetRatioForSell = currentBorrowRatio;

    if (currentBorrowRatio > this.strategy.leverage.maxBorrowRatio) {
      needSell = true;
      sellReason = `借款比過高(${(currentBorrowRatio * 100).toFixed(0)}%)`;
      targetRatioForSell = 0.9;
    } else if (z2Ratio > this.strategy.leverage.maxZ2Ratio) {
      needSell = true;
      sellReason = `Z2佔比過高(${(z2Ratio * 100).toFixed(0)}%)`;
      targetRatioForSell = 0.6;
    } else if (isRebalanceDay) {
      if (currentBorrowRatio > this.strategy.leverage.maxBorrowRatio * 0.95) {
        needSell = true;
        sellReason = `半年審視：借款比接近上限`;
        targetRatioForSell = 0.85;
      } else if (z2Ratio > this.strategy.leverage.maxZ2Ratio * 0.95) {
        needSell = true;
        sellReason = `半年審視：Z2佔比接近上限`;
        targetRatioForSell = 0.6;
      }
    }

    if (needSell) {
      const targetLoan = netAsset * targetRatioForSell;
      const loanToRepay = this.totalLoan - targetLoan;
      const sellAmount = loanToRepay;

      if (sellAmount > this.strategy.trading.minAction) {
        const qtyToSell = Math.min(
          Math.floor(sellAmount / priceZ2),
          this.qtyZ2,
        );

        if (qtyToSell > 0) {
          const result = this.sellZ2AndAllocate(
            qtyToSell,
            priceZ2,
            price0050,
            netAsset,
            dateStr,
            sellReason,
          );

          if (isRebalanceDay) this.rebalanceCount++;

          console.log(
            `[${dateStr}] ⚠️ ${sellReason} -> ` +
              `預備 $${Math.round(result.reserved).toLocaleString()}, ` +
              `還款 $${Math.round(result.repaid).toLocaleString()}`,
          );
        }
      }
      return;
    }

    // 買入邏輯（加碼）
    if (targetBorrowRatio > currentBorrowRatio) {
      let inCooldown = false;
      if (this.lastBuyDate) {
        const daysDiff =
          (new Date(dateStr) - new Date(this.lastBuyDate)) /
          (1000 * 60 * 60 * 24);
        if (daysDiff < this.strategy.trading.cooldownDays) inCooldown = true;
      }

      if (inCooldown && score < 9) return;

      const targetZ2Exposure = netAsset * targetBorrowRatio;
      const diff = targetZ2Exposure - currentZ2Value;

      if (diff > this.strategy.trading.minAction) {
        const collateralValue = this.qty0050 * price0050;
        const maxLoan = collateralValue * 0.6;
        const canBorrow = maxLoan - this.totalLoan;

        if (canBorrow > this.strategy.trading.minAction) {
          const wantToBorrow = diff;
          const actualBorrow = Math.min(wantToBorrow, canBorrow);

          const transFee =
            this.strategy.trading.transFee *
            this.strategy.trading.transFeeDiscount;
          const fee = actualBorrow * transFee;
          const netCash = actualBorrow - fee;
          const qtyToBuy = Math.floor(netCash / priceZ2);

          if (qtyToBuy > 0) {
            this.totalLoan += actualBorrow;
            this.qtyZ2 += qtyToBuy;
            this.lastBuyDate = dateStr;

            if (CONFIG.debugMode) {
              console.log(
                `[${dateStr}] 🟡 質押加碼 (分數${score}): 借 $${Math.round(actualBorrow).toLocaleString()}`,
              );
            }
          }
        }
      }
    }
  }

  update(date, price0050, priceZ2) {
    const dailyInterest =
      (this.totalLoan * this.strategy.trading.loanInterestRate) / 365;
    this.accumulatedInterest += dailyInterest;

    const val0050 = this.qty0050 * price0050;
    const valZ2 = this.qtyZ2 * priceZ2;
    const grossAsset = val0050 + valZ2 + this.cash;
    const netAsset = grossAsset - this.totalLoan;
    const maintenance =
      this.totalLoan > 0 ? (val0050 / this.totalLoan) * 100 : 999;

    if (maintenance < this.strategy.maintenance.marginCallThreshold) {
      if (this.name === "Strategy") {
        console.log(`💀 [${date}] 斷頭平倉! 維持率 ${maintenance.toFixed(0)}%`);
      }
      const proceeds = this.qtyZ2 * priceZ2;
      const transFee =
        this.strategy.trading.transFee * this.strategy.trading.transFeeDiscount;
      const tax = Math.floor(proceeds * this.strategy.trading.taxRate);
      const fee = Math.floor(proceeds * transFee);
      const finalGet = proceeds - tax - fee;
      this.qtyZ2 = 0;
      this.cash += finalGet;
      const repay = Math.min(this.totalLoan, Math.max(0, this.cash));
      this.totalLoan -= repay;
      this.cash -= repay;
      this.marginCallCount++;
    }

    const targetReserve = this.getTargetReserve(netAsset);

    this.history.push({
      date,
      netAsset,
      grossAsset,
      totalLoan: this.totalLoan,
      maintenance,
      price0050,
      totalInvested: this.totalInvested,
      borrowRatio: netAsset > 0 ? this.totalLoan / netAsset : 0,
      cash: this.cash,
      accumulatedInterest: this.accumulatedInterest,
      z2Ratio: netAsset > 0 ? (this.qtyZ2 * priceZ2) / netAsset : 0,
      reserveCash: this.reserveCash,
      targetReserve: targetReserve,
      reserveRatio: targetReserve > 0 ? this.reserveCash / targetReserve : 0,
    });

    return { netAsset, maintenance };
  }
}

// ==========================================
// 4. 回測主程式
// ==========================================
async function runBacktest() {
  console.log("🚀 啟動回測 (最終優化版 - 所有參數來自策略檔)...");

  STRATEGY = await fetchStrategyConfig();

  const { history0050, historyZ2 } = await prepareData();

  const portfolio = new Portfolio(CONFIG.initialCapital, STRATEGY, "Strategy");
  const benchmark = new Portfolio(CONFIG.initialCapital, STRATEGY, "Benchmark");

  let basePrice = 0;
  let lastBasePriceUpdateMonth = -1;
  let lastRebalanceMonth = -1;
  let lastInvestMonth = "";

  const targetStartDate = CONFIG.startDate;
  const targetStartIndex = history0050.findIndex(
    (d) => d.date >= targetStartDate,
  );
  const START_INDEX = Math.max(60, targetStartIndex);

  if (history0050.length <= START_INDEX) {
    console.error("資料不足無法回測");
    return;
  }

  console.log(
    `📅 回測區間: ${history0050[START_INDEX].date} ~ ${history0050[history0050.length - 1].date}`,
  );
  console.log(`💰 初始資金: $0 (純定期定額累積)`);
  console.log(`📋 策略版本: ${STRATEGY.version || "N/A"}`);
  console.log(
    `💵 預備金: ${(STRATEGY.reserve.tiers[0].ratio * 100).toFixed(0)}-${(STRATEGY.reserve.tiers[2].ratio * 100).toFixed(0)}%, 保留比例 ${(STRATEGY.reserve.allocationRatio * 100).toFixed(0)}%`,
  );
  console.log(
    `🛡️ 維持率防禦: ${STRATEGY.maintenance.protectTrigger}% → ${STRATEGY.maintenance.protectTarget}%\n`,
  );

  for (let i = START_INDEX; i < history0050.length; i++) {
    const day0050 = history0050[i];
    const dayZ2 = historyZ2[i];
    const currentMonth = day0050.date.substring(0, 7);

    if (currentMonth !== lastInvestMonth) {
      portfolio.cash += CONFIG.monthlyContribution;
      portfolio.totalInvested += CONFIG.monthlyContribution;
      portfolio.buy0050(day0050.close, "ALL");

      benchmark.cash += CONFIG.monthlyContribution;
      benchmark.totalInvested += CONFIG.monthlyContribution;
      benchmark.buy0050(day0050.close, "ALL");

      lastInvestMonth = currentMonth;
    }

    const currentMonthNum = parseInt(day0050.date.substring(5, 7));
    if (
      (currentMonthNum === 1 || currentMonthNum === 7) &&
      currentMonthNum !== lastBasePriceUpdateMonth
    ) {
      const lookback = 120;
      const historySliceForBase = historyZ2.slice(Math.max(0, i - lookback), i);
      if (historySliceForBase.length > 0) {
        basePrice = Math.max(...historySliceForBase.map((x) => x.close));
      }
      lastBasePriceUpdateMonth = currentMonthNum;
    }
    if (basePrice === 0) basePrice = dayZ2.close;

    let isRebalanceDay = false;
    if (
      (currentMonthNum === 1 || currentMonthNum === 7) &&
      currentMonthNum !== lastRebalanceMonth
    ) {
      isRebalanceDay = true;
      lastRebalanceMonth = currentMonthNum;
    }

    const historySlice = historyZ2.slice(Math.max(0, i - 300), i + 1);
    const indicators = calculateIndicators(historySlice);
    const lastRSI = indicators.rsiArr[indicators.rsiArr.length - 1];
    const lastKD = indicators.kdArr[indicators.kdArr.length - 1] || {
      k: 50,
      d: 50,
    };

    const mockData = {
      currentPrice: dayZ2.close,
      basePrice: basePrice,
      price0050: day0050.close,
      portfolio: {
        qty0050: portfolio.qty0050,
        qtyZ2: portfolio.qtyZ2,
        cash: portfolio.cash,
        totalLoan: portfolio.totalLoan,
      },
      closes: historySlice.map((x) => x.close),
      rsiArr: indicators.rsiArr,
      kdArr: indicators.kdArr,
      macdArr: indicators.macdArr,
      ma240: null,
      RSI: lastRSI,
      KD_K: lastKD.k,
      KD_D: lastKD.d,
    };

    const signalResult = evaluateInvestmentSignal(mockData, STRATEGY);

    let targetBorrowRatio = 0;
    const score = signalResult.weightScore || 0;

    if (signalResult.target && signalResult.target.includes("禁撥款")) {
      targetBorrowRatio = 0;
    } else if (
      signalResult.target &&
      signalResult.target.includes("風控優先")
    ) {
      targetBorrowRatio = 0;
    } else {
      const defaultAlloc = STRATEGY.allocation.find((a) => a.minScore === -99);
      targetBorrowRatio = defaultAlloc ? defaultAlloc.leverage : 0;

      for (const alloc of STRATEGY.allocation) {
        if (score >= alloc.minScore && alloc.minScore !== -99) {
          if (alloc.leverage > targetBorrowRatio) {
            targetBorrowRatio = alloc.leverage;
          }
        }
      }
    }

    const val0050 = portfolio.qty0050 * day0050.close;
    const valZ2 = portfolio.qtyZ2 * dayZ2.close;
    const currentGross = val0050 + valZ2 + portfolio.cash;
    const currentNet = currentGross - portfolio.totalLoan;

    portfolio.executeStrategy(
      targetBorrowRatio,
      dayZ2.close,
      day0050.close,
      currentNet,
      day0050.date,
      isRebalanceDay,
      score,
    );

    portfolio.update(day0050.date, day0050.close, dayZ2.close);
    benchmark.update(day0050.date, day0050.close, dayZ2.close);
  }

  // 結算
  function calculateStats(p) {
    if (p.history.length === 0) {
      return {
        last: { netAsset: 0, totalInvested: 0 },
        totalReturn: 0,
        cagr: 0,
        maxDrawdown: 0,
      };
    }

    const first = p.history[0];
    const last = p.history[p.history.length - 1];

    const years =
      (new Date(last.date) - new Date(first.date)) / (1000 * 3600 * 24 * 365);

    const netAssetAfterInterest = last.netAsset - p.accumulatedInterest;

    const totalReturn =
      last.totalInvested > 0
        ? ((netAssetAfterInterest - last.totalInvested) / last.totalInvested) *
          100
        : 0;

    const cagr =
      last.totalInvested > 0 && years > 0
        ? (Math.pow(netAssetAfterInterest / last.totalInvested, 1 / years) -
            1) *
          100
        : 0;

    let peak = 0;
    let maxDrawdown = 0;
    let maxZ2Ratio = 0;
    let avgBorrowRatio = 0;
    let borrowRatioCount = 0;
    let avgReserveRatio = 0;
    let reserveRatioCount = 0;

    for (const h of p.history) {
      const currentNet = h.netAsset;

      if (currentNet > peak) peak = currentNet;

      if (peak > 0 && currentNet > 0) {
        const dd = (peak - currentNet) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      if (h.z2Ratio > maxZ2Ratio) maxZ2Ratio = h.z2Ratio;

      if (h.borrowRatio > 0) {
        avgBorrowRatio += h.borrowRatio;
        borrowRatioCount++;
      }

      if (h.reserveRatio !== undefined) {
        avgReserveRatio += h.reserveRatio;
        reserveRatioCount++;
      }
    }

    avgBorrowRatio =
      borrowRatioCount > 0 ? avgBorrowRatio / borrowRatioCount : 0;
    avgReserveRatio =
      reserveRatioCount > 0 ? avgReserveRatio / reserveRatioCount : 0;

    return {
      last,
      netAssetAfterInterest,
      totalReturn,
      cagr,
      maxDrawdown,
      years,
      maxZ2Ratio,
      avgBorrowRatio,
      avgReserveRatio,
    };
  }

  const sStats = calculateStats(portfolio);
  const bStats = calculateStats(benchmark);

  console.log("\n=======================================================");
  console.log("📊 終極回測報告 (最終優化版)");
  console.log("=======================================================");
  console.log(`策略版本: ${STRATEGY.version || "N/A"}`);
  console.log(`回測期間: ${sStats.years.toFixed(1)} 年`);
  console.log(
    `總投入本金: $${Math.round(sStats.last.totalInvested).toLocaleString()}`,
  );
  console.log("-------------------------------------------------------");
  console.log(`【您的策略 (Strategy)】`);
  console.log(
    `最終資產 (未扣利息): $${Math.round(sStats.last.netAsset).toLocaleString()}`,
  );
  console.log(
    `累積利息支出: $${Math.round(portfolio.accumulatedInterest).toLocaleString()}`,
  );
  console.log(
    `最終淨資產 (扣除利息): $${Math.round(sStats.netAssetAfterInterest).toLocaleString()}`,
  );
  console.log("-------------------------------------------------------");
  console.log(`💵 動態預備金:`);
  console.log(
    `  從賣出累積: $${Math.round(portfolio.totalReserveFromSales).toLocaleString()}`,
  );
  console.log(
    `  當前餘額: $${Math.round(portfolio.reserveCash).toLocaleString()}`,
  );
  console.log(
    `  目標額度: $${Math.round(sStats.last.targetReserve).toLocaleString()} (${((sStats.last.targetReserve / sStats.last.netAsset) * 100).toFixed(1)}%)`,
  );
  console.log(`  達成率: ${(sStats.avgReserveRatio * 100).toFixed(1)}%`);
  console.log(`  使用次數: ${portfolio.reserveUsageCount} 次`);
  console.log("-------------------------------------------------------");
  console.log(`🛡️ 維持率防禦統計:`);
  console.log(`  增加抵押品次數: ${portfolio.collateralAddCount} 次`);
  console.log("-------------------------------------------------------");
  console.log(`總報酬率: ${sStats.totalReturn.toFixed(2)}%`);
  console.log(`年化報酬 (CAGR): ${sStats.cagr.toFixed(2)}%`);
  console.log(`最大回撤 (MDD): -${(sStats.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`斷頭次數: ${portfolio.marginCallCount} 次`);
  console.log(`風控平衡次數: ${portfolio.rebalanceCount} 次`);
  console.log(`最終借款比: ${(sStats.last.borrowRatio * 100).toFixed(0)}%`);
  console.log(`平均借款比: ${(sStats.avgBorrowRatio * 100).toFixed(0)}%`);
  console.log(`最高Z2佔比: ${(sStats.maxZ2Ratio * 100).toFixed(1)}%`);
  console.log("-------------------------------------------------------");
  console.log(`【對照組 (0050 Buy & Hold)】`);
  console.log(
    `最終資產: $${Math.round(bStats.last.netAsset).toLocaleString()}`,
  );
  console.log(`總報酬率: ${bStats.totalReturn.toFixed(2)}%`);
  console.log(`年化報酬 (CAGR): ${bStats.cagr.toFixed(2)}%`);
  console.log(`最大回撤 (MDD): -${(bStats.maxDrawdown * 100).toFixed(2)}%`);
  console.log("=======================================================");
  const diffAsset = sStats.netAssetAfterInterest - bStats.last.netAsset;
  const diffPercent = ((diffAsset / bStats.last.netAsset) * 100).toFixed(1);
  const excessCAGR = sStats.cagr - bStats.cagr;
  console.log(`🏆 策略效益分析:`);
  console.log(
    `比純存 0050 多賺: $${Math.round(diffAsset).toLocaleString()} (${diffPercent > 0 ? "✅ 領先 +" : "❌ 落後"}${diffPercent}%)`,
  );
  console.log(
    `超額年化報酬: +${excessCAGR.toFixed(2)}% (${sStats.cagr.toFixed(2)}% vs ${bStats.cagr.toFixed(2)}%)`,
  );
  console.log("=======================================================");

  try {
    const results = {
      strategy: STRATEGY,
      config: CONFIG,
      performance: {
        ...sStats,
        accumulatedInterest: portfolio.accumulatedInterest,
        rebalanceCount: portfolio.rebalanceCount,
        marginCallCount: portfolio.marginCallCount,
        collateralAddCount: portfolio.collateralAddCount,
        reserveCash: {
          fromSales: portfolio.totalReserveFromSales,
          currentBalance: portfolio.reserveCash,
          usageCount: portfolio.reserveUsageCount,
        },
      },
      benchmark: bStats,
      portfolioHistory: portfolio.history.slice(-365),
      benchmarkHistory: benchmark.history.slice(-365),
    };

    fs.writeFileSync(
      "./data/backtest_results.json",
      JSON.stringify(results, null, 2),
    );
    console.log("\n💾 回測結果已儲存至: ./data/backtest_results.json");
  } catch (e) {
    console.error("❌ 儲存結果失敗:", e.message);
  }
}

runBacktest().catch(console.error);
