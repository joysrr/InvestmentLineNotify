import "dotenv/config";
import fs from "fs";
import fetch from "node-fetch"; 
import { calculateIndicators } from "./finance/indicators.mjs";
import { fetchStockHistory } from "./providers/twse/twseStockDayProvider.mjs";
import { fetchStrategyConfig } from "./services/strategyConfigService.mjs";
import { evaluateInvestmentSignal } from "./services/stockSignalService.mjs";

// ==========================================
// 1. 全局設定
// ==========================================
const CONFIG = {
  initialCapital: 0,
  monthlyContribution: 30_000,
  loanInterestRate: 0.025, // 2.5% 質押利率
  transFee: 0.001425 * 0.6, // 手續費 6 折
  taxRate: 0.003, // 交易稅
  startDate: "2005-01-01", 
  endDate: new Date().toISOString().split("T")[0],
  dataCacheFile: "./data/history_cache_0050.json",
  marginCallThreshold: 135, // 維持率低於此數值強制斷頭 (券商防線)
  debugMode: true 
};

// ==========================================
// 2. 資料準備
// ==========================================
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

function adjustHistoricalData(data) {
  // 0050 在 2025-06-18 進行 1拆4 分割
  const splitDate = "2025-06-18";
  return data.map(day => {
    if (day.date < splitDate) {
      return {
        ...day,
        open: day.open / 4,
        high: day.high / 4,
        low: day.low / 4,
        close: day.close / 4
      };
    }
    return day;
  });
}

async function prepareData() {
  let history0050 = [];
  if (fs.existsSync(CONFIG.dataCacheFile)) {
    try { history0050 = JSON.parse(fs.readFileSync(CONFIG.dataCacheFile, "utf-8")); } catch (e) { history0050 = []; }
  }

  // (此處省略自動下載邏輯，假設已有資料)
  
  console.log("🔧 執行股價還原 (修正 2025 年 1拆4 分割)...");
  const adjusted0050 = adjustHistoricalData(history0050);

  // 合成 00675L (Z2)
  const historyZ2 = [];
  let currentPriceZ2 = 10;
  const dailyExpense = 0.01 / 250;

  for (let i = 0; i < adjusted0050.length; i++) {
    const todayData = adjusted0050[i];
    const prevData = i > 0 ? adjusted0050[i - 1] : null;
    if (prevData) {
      const ret0050 = (todayData.close - prevData.close) / prevData.close;
      const retZ2 = ret0050 * 2 - dailyExpense;
      currentPriceZ2 = currentPriceZ2 * (1 + retZ2);
    }
    historyZ2.push({ ...todayData, open: currentPriceZ2, high: currentPriceZ2, low: currentPriceZ2, close: currentPriceZ2 });
  }
  return { history0050: adjusted0050, historyZ2 };
}

// ==========================================
// 3. 投資組合 Class (升級版)
// ==========================================
class Portfolio {
  constructor(initialCash, name = "Portfolio") {
    this.name = name;
    this.cash = initialCash;
    this.qty0050 = 0;
    this.qtyZ2 = 0;
    this.totalLoan = 0;
    this.totalInvested = initialCash;
    this.history = [];
    this.marginCallCount = 0;
    
    // 🔥 新增：紀錄上次加碼日期，用於計算冷卻期
    this.lastBuyDate = null;
  }

  // 買入 0050
  buy0050(price, amount) {
    let investAmount = amount;
    if (amount === "ALL" || amount > this.cash) {
        investAmount = this.cash; 
    }
    
    if (this.cash > 0 && investAmount > 1000) { 
       const maxCost = investAmount / (1 + CONFIG.transFee);
       const qty = Math.floor(maxCost / price);
       
       if (qty > 0) {
         const cost = qty * price;
         const fee = Math.floor(cost * CONFIG.transFee);
         this.qty0050 += qty;
         this.cash -= (cost + fee);
         return true; 
       }
    }
    return false;
  }

  // 🔥 核心策略執行
  executeStrategy(targetBorrowRatio, priceZ2, price0050, netAsset, dateStr, isRebalanceDay, score, reason = "") {
    
    const minAction = 10000; 
    
    // 1. 計算目前的狀態
    const currentZ2Value = this.qtyZ2 * priceZ2;
    const current0050Value = this.qty0050 * price0050;
    
    // Z2 佔比
    const z2Ratio = netAsset > 0 ? (currentZ2Value / netAsset) : 0;
    // 實際借款比例
    const currentBorrowRatio = netAsset > 0 ? (this.totalLoan / netAsset) : 0;
    // 目前維持率
    const maintenance = this.totalLoan > 0 ? (current0050Value / this.totalLoan) * 100 : 999;

    // --- 參數設定 ---
    const Z2_RATIO_LIMIT = 0.65; // Z2 佔比上限
    const HARD_BORROW_LIMIT = 1.0; // 絕對借款上限
    
    // 🔥 需求1: 冷卻期 (20個交易日)
    const COOLDOWN_DAYS = 20; 

    // 🔥 需求2: 再平衡保底 (0.2x)
    const MIN_REBALANCE_RATIO = 0.2; 

    // 🔥 需求3: 維持率防禦 (160% 觸發 -> 救回 180%)
    const MAINT_PROTECT_TRIGGER = 160;
    const MAINT_PROTECT_TARGET = 180;

    // ==============================================
    // 🚨 最優先檢查：維持率防禦 (Survival Mode)
    // ==============================================
    if (this.totalLoan > 0 && maintenance < MAINT_PROTECT_TRIGGER) {
        // 目標：減少負債，使維持率回到 MAINT_PROTECT_TARGET
        // TargetMaintenance = (Value0050 / TargetLoan) * 100
        // TargetLoan = Value0050 / (TargetMaintenance / 100)
        const targetLoan = current0050Value / (MAINT_PROTECT_TARGET / 100);
        const loanToRepay = this.totalLoan - targetLoan;
        
        if (loanToRepay > 0) {
            // 賣出 Z2 來還款
            const sellAmount = loanToRepay;
            const qtyToSell = Math.floor(sellAmount / priceZ2);
            
            if (qtyToSell > 0) {
                const proceeds = qtyToSell * priceZ2;
                const tax = Math.floor(proceeds * CONFIG.taxRate);
                const fee = Math.floor(proceeds * CONFIG.transFee);
                const finalGet = proceeds - tax - fee;

                this.qtyZ2 -= qtyToSell;
                this.cash += finalGet;
                
                // 還款
                const repay = Math.min(this.totalLoan, this.cash);
                this.totalLoan -= repay;
                this.cash -= repay;

                if (CONFIG.debugMode) {
                    console.log(`[${dateStr}] 🛡️ 維持率防禦(${maintenance.toFixed(0)}% < ${MAINT_PROTECT_TRIGGER}%): 賣Z2 $${Math.round(sellAmount)}, 還款${Math.round(repay)}`);
                }
                return; // 執行防禦後，當日不進行其他操作
            }
        }
    }

    // ==============================================
    // 🛡️ 賣出/再平衡邏輯
    // ==============================================
    let needSell = false;
    let sellReason = "";
    let targetRatioForSell = currentBorrowRatio;

    // 優先順序 1: 硬風控
    if (currentBorrowRatio > HARD_BORROW_LIMIT) {
        needSell = true;
        sellReason = `借款比過高(${currentBorrowRatio.toFixed(2)})`;
        targetRatioForSell = 0.9; 
    }
    // 優先順序 2: 佔比風控
    else if (z2Ratio > Z2_RATIO_LIMIT) {
        needSell = true;
        sellReason = `Z2佔比過高(${(z2Ratio*100).toFixed(0)}%)`;
        targetRatioForSell = currentBorrowRatio * 0.8; 
    }
    // 優先順序 3: 半年定期審視
    else if (isRebalanceDay) {
        const threshold = 0.1;
        // 🔥 需求2: 再平衡不要歸零，取 (策略目標, 0.2) 的最大值
        const effectiveTarget = Math.max(targetBorrowRatio, MIN_REBALANCE_RATIO);
        
        if (currentBorrowRatio - effectiveTarget > threshold) {
            needSell = true;
            sellReason = `半年定期平衡 (現狀${currentBorrowRatio.toFixed(2)} > 目標${effectiveTarget.toFixed(2)})`;
            targetRatioForSell = effectiveTarget;
        }
    }

    if (needSell) {
        const targetLoan = netAsset * targetRatioForSell;
        const loanToRepay = this.totalLoan - targetLoan;
        const sellAmount = loanToRepay;

        if (sellAmount > minAction) {
            const qtyToSell = Math.floor(sellAmount / priceZ2);
            if (qtyToSell > 0) {
                const proceeds = qtyToSell * priceZ2;
                const tax = Math.floor(proceeds * CONFIG.taxRate);
                const fee = Math.floor(proceeds * CONFIG.transFee);
                const finalGet = proceeds - tax - fee;

                this.qtyZ2 -= qtyToSell;
                this.cash += finalGet; 

                let repay = 0;
                if (this.totalLoan > 0) {
                    repay = Math.min(this.totalLoan, this.cash);
                    this.totalLoan -= repay;
                    this.cash -= repay;
                }
                
                // 剩餘現金買入 0050 (增加分母，提升維持率)
                let bought0050 = false;
                if (this.cash > 5000) { 
                     bought0050 = this.buy0050(price0050, "ALL");
                }

                if (CONFIG.debugMode) {
                    console.log(`[${dateStr}] ⚖️ ${sellReason} -> 賣出Z2 $${Math.round(sellAmount)}, 還款${Math.round(repay)}${bought0050?", 轉買0050":""}`);
                }
            }
        }
    }

    // ==============================================
    // 🟢 買入邏輯 (加碼)
    // ==============================================
    else if (targetBorrowRatio > currentBorrowRatio) {
        
        // 🔥 需求1: 檢查冷卻期
        let inCooldown = false;
        if (this.lastBuyDate) {
            const daysDiff = (new Date(dateStr) - new Date(this.lastBuyDate)) / (1000 * 60 * 60 * 24);
            if (daysDiff < COOLDOWN_DAYS) {
                inCooldown = true;
            }
        }

        // 例外：如果分數極高 (>=9)，無視冷卻期
        if (inCooldown && score < 9) {
            // if (CONFIG.debugMode) console.log(`[${dateStr}] ⏳ 冷卻中 (上次加碼 ${this.lastBuyDate}), 跳過加碼`);
            return; 
        }

        const targetZ2Exposure = netAsset * targetBorrowRatio;
        const diff = targetZ2Exposure - currentZ2Value;

        if (diff > minAction) {
            // 檢查額度 (0050 的 60%)
            const collateralValue = this.qty0050 * price0050;
            const maxLoan = collateralValue * 0.6; 
            const canBorrow = maxLoan - this.totalLoan; 
            const wantToBorrow = diff; 
            const actualBorrow = Math.min(wantToBorrow, canBorrow);

            if (actualBorrow > minAction) {
                const costNeeded = actualBorrow;
                const fee = Math.floor(costNeeded * CONFIG.transFee);
                const totalNeeded = costNeeded + fee; 

                if (canBorrow >= totalNeeded) {
                    this.totalLoan += totalNeeded;
                    this.cash += totalNeeded; 
                    this.cash -= totalNeeded; 
                    this.qtyZ2 += Math.floor(costNeeded / priceZ2);
                    
                    // 更新加碼日期
                    this.lastBuyDate = dateStr;

                    if (CONFIG.debugMode) console.log(`[${dateStr}] 🟡 質押加碼 (分數${score}): ${reason} -> 借$${Math.round(totalNeeded)}, 買Z2`);
                }
            }
        }
    }
  }

  update(date, price0050, priceZ2) {
    const dailyInterest = (this.totalLoan * CONFIG.loanInterestRate) / 365;
    this.cash -= dailyInterest;

    const val0050 = this.qty0050 * price0050;
    const valZ2 = this.qtyZ2 * priceZ2;
    const grossAsset = val0050 + valZ2 + this.cash;
    const netAsset = grossAsset - this.totalLoan;
    const maintenance = this.totalLoan > 0 ? (val0050 / this.totalLoan) * 100 : 999;

    // 強制斷頭機制 (券商硬底線)
    if (maintenance < CONFIG.marginCallThreshold) {
       if (this.name === "Strategy") console.log(`💀 [${date}] 斷頭平倉! 維持率 ${maintenance.toFixed(0)}%`);
       const proceeds = this.qtyZ2 * priceZ2;
       const tax = Math.floor(proceeds * CONFIG.taxRate);
       const fee = Math.floor(proceeds * CONFIG.transFee);
       const finalGet = proceeds - tax - fee;
       this.qtyZ2 = 0;
       this.cash += finalGet;
       const repay = Math.min(this.totalLoan, this.cash);
       this.totalLoan -= repay;
       this.cash -= repay;
       this.marginCallCount++;
    }

    this.history.push({ 
        date, netAsset, grossAsset, totalLoan: this.totalLoan, maintenance, price0050, totalInvested: this.totalInvested,
        borrowRatio: netAsset > 0 ? this.totalLoan/netAsset : 0
    });
    return { netAsset, maintenance };
  }
}

// ==========================================
// 4. 回測主程式
// ==========================================
async function runBacktest() {
  console.log("🚀 啟動回測 (冷卻期+保底+防禦版)...");
  const { history0050, historyZ2 } = await prepareData();
  const strategy = await fetchStrategyConfig();
  
  const portfolio = new Portfolio(CONFIG.initialCapital, "Strategy");
  const benchmark = new Portfolio(CONFIG.initialCapital, "Benchmark");
  if (history0050.length > 250) benchmark.buy0050(history0050[250].close, "ALL");

  let basePrice = 0;
  let lastBasePriceUpdateMonth = -1;
  let lastRebalanceMonth = -1;

  let startIndex = history0050.findIndex(x => x.date === "2019-01-02"); 
  if (startIndex === -1) startIndex = 250;

  console.log(`📅 回測區間: ${history0050[startIndex].date} ~ ${history0050[history0050.length-1].date}`);

  for (let i = startIndex; i < history0050.length; i++) {
    const day0050 = history0050[i];
    const dayZ2 = historyZ2[i];
    const currentMonth = parseInt(day0050.date.substring(5, 7));

    // A. 基準價更新
    if ((currentMonth === 1 || currentMonth === 7) && currentMonth !== lastBasePriceUpdateMonth) {
        const lookback = 120; 
        const historySliceForBase = historyZ2.slice(i - lookback, i);
        if (historySliceForBase.length > 0) {
             basePrice = Math.max(...historySliceForBase.map(x => x.close));
             if (CONFIG.debugMode) console.log(`[${day0050.date}] 🔄 更新基準價: ${basePrice.toFixed(2)}`);
        }
        lastBasePriceUpdateMonth = currentMonth;
    }
    if (basePrice === 0) basePrice = dayZ2.close;

    // B. 半年審視日
    let isRebalanceDay = false;
    if ((currentMonth === 1 || currentMonth === 7) && currentMonth !== lastRebalanceMonth) {
        isRebalanceDay = true;
        lastRebalanceMonth = currentMonth;
    }

    // C. 定期定額 (只買 0050)
    const prevDate = history0050[i-1].date;
    if (day0050.date.substring(5,7) !== prevDate.substring(5,7)) {
      portfolio.cash += CONFIG.monthlyContribution;
      portfolio.totalInvested += CONFIG.monthlyContribution;
      portfolio.buy0050(day0050.close, "ALL"); 

      benchmark.cash += CONFIG.monthlyContribution;
      benchmark.totalInvested += CONFIG.monthlyContribution;
      benchmark.buy0050(day0050.close, "ALL");
    }

    // D. 策略運算
    const historySlice = historyZ2.slice(i - 300, i + 1); 
    const indicators = calculateIndicators(historySlice);
    const lastRSI = indicators.rsiArr[indicators.rsiArr.length-1];
    const lastKD = indicators.kdArr[indicators.kdArr.length-1] || {k:50, d:50};
    
    const mockData = {
      currentPrice: dayZ2.close,
      basePrice: basePrice, 
      price0050: day0050.close, 
      portfolio: { qty0050: portfolio.qty0050, qtyZ2: portfolio.qtyZ2, cash: portfolio.cash, totalLoan: portfolio.totalLoan },
      closes: historySlice.map(x=>x.close),
      rsiArr: indicators.rsiArr,
      kdArr: indicators.kdArr,
      macdArr: indicators.macdArr,
      ma240: null, 
      RSI: lastRSI,
      KD_K: lastKD.k,
      KD_D: lastKD.d,
    };

    const signalResult = evaluateInvestmentSignal(mockData, strategy);
    
    let targetBorrowRatio = 0;
    let logicReason = ""; 

    const score = signalResult.weightScore || 0;

    if (signalResult.target && signalResult.target.includes("禁撥款")) {
       targetBorrowRatio = 0; 
       logicReason = "禁撥款";
    } else if (signalResult.target && signalResult.target.includes("風控優先")) {
       targetBorrowRatio = 0; 
       logicReason = "風控優先";
    } else {
      const defaultAlloc = strategy.allocation.find(a => a.minScore === -99);
      targetBorrowRatio = defaultAlloc ? defaultAlloc.leverage : 0;

      for (const alloc of strategy.allocation) {
        if (score >= alloc.minScore && alloc.minScore !== -99) {
          if (alloc.leverage > targetBorrowRatio) {
            targetBorrowRatio = alloc.leverage;
          }
        }
      }
      logicReason = `分數${score}`;
    }

    // E. 執行策略 (傳入 score 用於冷卻期例外判斷)
    const val0050 = portfolio.qty0050 * day0050.close;
    const valZ2 = portfolio.qtyZ2 * dayZ2.close;
    const currentGross = val0050 + valZ2 + portfolio.cash;
    const currentNet = currentGross - portfolio.totalLoan;

    portfolio.executeStrategy(targetBorrowRatio, dayZ2.close, day0050.close, 
                              currentNet, 
                              day0050.date, 
                              isRebalanceDay, 
                              score, // 🔥 傳入分數
                              logicReason);
    
    portfolio.update(day0050.date, day0050.close, dayZ2.close);
    benchmark.update(day0050.date, day0050.close, dayZ2.close);
  }
  
  // 結算
  function calculateStats(p) {
      const last = p.history[p.history.length - 1];
      const totalReturn = ((last.netAsset - last.totalInvested) / last.totalInvested) * 100;
      const years = (new Date(CONFIG.endDate) - new Date(CONFIG.startDate)) / (1000 * 3600 * 24 * 365);
      const cagr = (Math.pow(last.netAsset / last.totalInvested, 1 / years) - 1) * 100;

      let peak = 0;
      let maxDrawdown = 0;
      for (const h of p.history) {
        if (h.netAsset > peak) peak = h.netAsset;
        const dd = (peak - h.netAsset) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
      return { last, totalReturn, cagr, maxDrawdown };
  }

  const sStats = calculateStats(portfolio);
  const bStats = calculateStats(benchmark);

  console.log("\n=======================================================");
  console.log("📊 終極回測報告: 升級版 (冷卻+保底+防禦)");
  console.log("=======================================================");
  console.log(`回測期間: ${(new Date(CONFIG.endDate) - new Date(CONFIG.startDate)) / (1000 * 3600 * 24 * 365).toFixed(1)} 年`);
  console.log(`總投入本金: $${Math.round(sStats.last.totalInvested).toLocaleString()}`);
  console.log("-------------------------------------------------------");
  console.log(`【您的策略 (Strategy)】`);
  console.log(`最終資產: $${Math.round(sStats.last.netAsset).toLocaleString()}`);
  console.log(`總報酬率: ${sStats.totalReturn.toFixed(2)}%`);
  console.log(`年化報酬 (CAGR): ${sStats.cagr.toFixed(2)}%`);
  console.log(`最大回撤 (MDD): -${(sStats.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`斷頭次數: ${portfolio.marginCallCount} 次`);
  console.log(`最終借款比: ${sStats.last.borrowRatio.toFixed(2)}x`);
  console.log("-------------------------------------------------------");
  console.log(`【對照組 (0050 Buy & Hold)】`);
  console.log(`最終資產: $${Math.round(bStats.last.netAsset).toLocaleString()}`);
  console.log(`總報酬率: ${bStats.totalReturn.toFixed(2)}%`);
  console.log(`年化報酬 (CAGR): ${bStats.cagr.toFixed(2)}%`);
  console.log("=======================================================");
  const diffAsset = sStats.last.netAsset - bStats.last.netAsset;
  console.log(`🏆 策略效益分析:`);
  console.log(`比純存 0050 多賺: $${Math.round(diffAsset).toLocaleString()} (${diffAsset > 0 ? "✅ 領先" : "❌ 落後"})`);
  console.log("=======================================================");
}

runBacktest().catch(console.error);