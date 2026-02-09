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
  startDate: "2005-01-01", // 🔥 修改：從 2005 年開始 (含金融海嘯)
  endDate: new Date().toISOString().split("T")[0],
  dataCacheFile: "./data/history_cache_0050.json",
  marginCallThreshold: 135, // 券商斷頭線
  debugMode: true 
};

// ==========================================
// 2. 資料準備 (自動補全歷史資料)
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
  
  // 1. 嘗試讀取快取
  if (fs.existsSync(CONFIG.dataCacheFile)) {
    try { 
        history0050 = JSON.parse(fs.readFileSync(CONFIG.dataCacheFile, "utf-8")); 
    } catch (e) { 
        history0050 = []; 
    }
  }

  // 2. 檢查快取資料是否夠舊 (是否包含 2005 年)
  // 如果快取的第一筆資料比 CONFIG.startDate 還要晚，代表缺前面的資料，需重抓
  if (history0050.length > 0) {
      const cacheStartDate = new Date(history0050[0].date);
      const reqStartDate = new Date(CONFIG.startDate);
      // 容許 10 天誤差
      if (cacheStartDate > new Date(reqStartDate.getTime() + 86400000 * 10)) {
          console.log(`⚠️ 快取資料起始日 (${history0050[0].date}) 晚於需求日 (${CONFIG.startDate})，將重新下載完整資料...`);
          history0050 = []; // 清空，強制重抓
      }
  }

  // 3. 補齊資料 (包含從頭下載 或 補齊尾段)
  let nextDate;
  if (history0050.length > 0) {
    const lastDate = new Date(history0050[history0050.length - 1].date);
    nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
  } else {
    nextDate = new Date(CONFIG.startDate);
  }

  const today = new Date();
  
  // 如果需要下載
  if (nextDate < today) {
    console.log(`🌐 開始下載歷史資料 (從 ${nextDate.toISOString().split('T')[0]})...`);
    
    while (nextDate < today) {
      const y = nextDate.getFullYear();
      const m = nextDate.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      const startStr = `${y}-${String(m).padStart(2, "0")}-01`;
      const endStr = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
      
      try {
        const data = await fetchStockHistory("0050", startStr, endStr);
        if (data && data.length > 0) {
          // 過濾重複
          const existingDates = new Set(history0050.map(x => x.date));
          const newRows = data.filter(x => !existingDates.has(x.date));
          if (newRows.length > 0) {
            history0050.push(...newRows);
            // 排序並存檔
            history0050.sort((a, b) => new Date(a.date) - new Date(b.date));
            fs.writeFileSync(CONFIG.dataCacheFile, JSON.stringify(history0050, null, 2));
          }
        }
        process.stdout.write("."); // 進度條
        await new Promise(r => setTimeout(r, 1500)); // 避免 API 限制
      } catch (e) {
        console.error(`❌ 下載失敗 ${startStr}:`, e.message);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    console.log("\n✅ 資料更新完成");
  }

  console.log("🔧 執行股價還原 (修正 2025 年 1拆4 分割)...");
  const adjusted0050 = adjustHistoricalData(history0050);

  // 合成 00675L (Z2)
  // 注意：2016 以前 00675L 尚未上市，這裡是模擬數據
  console.log("🧪 合成 2倍槓桿 ETF 模擬數據 (2005-2016 為模擬值)...");
  const historyZ2 = [];
  let currentPriceZ2 = 10; // 假設初始價格
  const dailyExpense = 0.01 / 250; // 內扣費用

  for (let i = 0; i < adjusted0050.length; i++) {
    const todayData = adjusted0050[i];
    const prevData = i > 0 ? adjusted0050[i - 1] : null;

    if (prevData) {
      const ret0050 = (todayData.close - prevData.close) / prevData.close;
      // 模擬 2倍槓桿行為：2倍漲跌幅 - 費用
      const retZ2 = ret0050 * 2 - dailyExpense;
      currentPriceZ2 = currentPriceZ2 * (1 + retZ2);
    }
    historyZ2.push({ ...todayData, open: currentPriceZ2, high: currentPriceZ2, low: currentPriceZ2, close: currentPriceZ2 });
  }

  return { history0050: adjusted0050, historyZ2 };
}

// ==========================================
// 3. 投資組合 Class (最終升級版)
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
    this.lastBuyDate = null; // 冷卻期用
  }

  buy0050(price, amount) {
    let investAmount = amount;
    if (amount === "ALL" || amount > this.cash) investAmount = this.cash;
    
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

  // 核心策略執行
  executeStrategy(targetBorrowRatio, priceZ2, price0050, netAsset, dateStr, isRebalanceDay, score, reason = "") {
    
    const minAction = 10000; 
    
    const currentZ2Value = this.qtyZ2 * priceZ2;
    const current0050Value = this.qty0050 * price0050;
    const z2Ratio = netAsset > 0 ? (currentZ2Value / netAsset) : 0;
    const currentBorrowRatio = netAsset > 0 ? (this.totalLoan / netAsset) : 0;
    const maintenance = this.totalLoan > 0 ? (current0050Value / this.totalLoan) * 100 : 999;

    // --- 參數設定 ---
    const Z2_RATIO_LIMIT = 0.65; 
    const HARD_BORROW_LIMIT = 1.0; 
    const COOLDOWN_DAYS = 20; 
    const MIN_REBALANCE_RATIO = 0.2; 
    const MAINT_PROTECT_TRIGGER = 160;
    const MAINT_PROTECT_TARGET = 180;

    // ==============================================
    // 🚨 優先檢查：維持率防禦 (Survival Mode)
    // ==============================================
    if (this.totalLoan > 0 && maintenance < MAINT_PROTECT_TRIGGER) {
        const targetLoan = current0050Value / (MAINT_PROTECT_TARGET / 100);
        const loanToRepay = this.totalLoan - targetLoan;
        
        if (loanToRepay > 0) {
            const sellAmount = loanToRepay;
            const qtyToSell = Math.floor(sellAmount / priceZ2);
            
            if (qtyToSell > 0) {
                const proceeds = qtyToSell * priceZ2;
                const tax = Math.floor(proceeds * CONFIG.taxRate);
                const fee = Math.floor(proceeds * CONFIG.transFee);
                const finalGet = proceeds - tax - fee;

                this.qtyZ2 -= qtyToSell;
                this.cash += finalGet;
                
                const repay = Math.min(this.totalLoan, this.cash);
                this.totalLoan -= repay;
                this.cash -= repay;

                if (CONFIG.debugMode) {
                    console.log(`[${dateStr}] 🛡️ 維持率防禦(${maintenance.toFixed(0)}% < ${MAINT_PROTECT_TRIGGER}%): 賣Z2 $${Math.round(sellAmount)}, 還款${Math.round(repay)}`);
                }
                return; // 防禦優先，不做其他操作
            }
        }
    }

    // ==============================================
    // 🛡️ 賣出/再平衡邏輯
    // ==============================================
    let needSell = false;
    let sellReason = "";
    let targetRatioForSell = currentBorrowRatio;

    if (currentBorrowRatio > HARD_BORROW_LIMIT) {
        needSell = true;
        sellReason = `借款比過高(${currentBorrowRatio.toFixed(2)})`;
        targetRatioForSell = 0.9; 
    }
    else if (z2Ratio > Z2_RATIO_LIMIT) {
        needSell = true;
        sellReason = `Z2佔比過高(${(z2Ratio*100).toFixed(0)}%)`;
        targetRatioForSell = currentBorrowRatio * 0.8; 
    }
    else if (isRebalanceDay) {
        const threshold = 0.1;
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
                
                let bought0050 = false;
                if (this.cash > 5000) bought0050 = this.buy0050(price0050, "ALL");

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
        
        let inCooldown = false;
        if (this.lastBuyDate) {
            const daysDiff = (new Date(dateStr) - new Date(this.lastBuyDate)) / (1000 * 60 * 60 * 24);
            if (daysDiff < COOLDOWN_DAYS) inCooldown = true;
        }

        // 冷卻期檢查 (分數 < 9 且在冷卻期內 -> 不加碼)
        if (inCooldown && score < 9) return; 

        const targetZ2Exposure = netAsset * targetBorrowRatio;
        const diff = targetZ2Exposure - currentZ2Value;

        if (diff > minAction) {
            const collateralValue = this.qty0050 * price0050;
            const maxLoan = collateralValue * 0.6; 
            const canBorrow = maxLoan - this.totalLoan; 
            const wantToBorrow = diff; 
            
            // 🔥 額度限制檢查
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
                    
                    this.lastBuyDate = dateStr; // 更新加碼日

                    if (CONFIG.debugMode) console.log(`[${dateStr}] 🟡 質押加碼 (分數${score}): ${reason} -> 抵押0050借$${Math.round(totalNeeded)}, 買Z2`);
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
  console.log("🚀 啟動回測 (2005-Present 超長週期 + 完整風控)...");
  const { history0050, historyZ2 } = await prepareData();
  const strategy = await fetchStrategyConfig();
  
  const portfolio = new Portfolio(CONFIG.initialCapital, "Strategy");
  const benchmark = new Portfolio(CONFIG.initialCapital, "Benchmark");
  
  // 讓對照組有 250 天的暖身後才開始買，確保對比公平
  // 或者直接從數據開始就買 (這裡選擇從數據開始)
  // benchmark.buy0050(history0050[0].close, "ALL"); 
  // ↑ 不對，因為定期定額是 loop 內處理，這裡初始化資金若要買滿，需確保有價格
  
  let basePrice = 0;
  let lastBasePriceUpdateMonth = -1;
  let lastRebalanceMonth = -1;

  // 🔥 修改：從數據第 300 筆開始 (確保有足夠指標數據)，不再硬性規定 2019
  const START_INDEX = 300;
  if (history0050.length <= START_INDEX) {
      console.error("資料不足無法回測");
      return;
  }
  
  // 初始化對照組 (在 START_INDEX 當天，把初始本金買入)
  benchmark.buy0050(history0050[START_INDEX].close, "ALL");
  portfolio.buy0050(history0050[START_INDEX].close, "ALL"); // 策略組初始本金也買入 0050

  console.log(`📅 回測區間: ${history0050[START_INDEX].date} ~ ${history0050[history0050.length-1].date}`);

  for (let i = START_INDEX; i < history0050.length; i++) {
    const day0050 = history0050[i];
    const dayZ2 = historyZ2[i];
    const currentMonth = parseInt(day0050.date.substring(5, 7));

    // A. 基準價更新
    if ((currentMonth === 1 || currentMonth === 7) && currentMonth !== lastBasePriceUpdateMonth) {
        const lookback = 120; 
        const historySliceForBase = historyZ2.slice(i - lookback, i);
        if (historySliceForBase.length > 0) {
             basePrice = Math.max(...historySliceForBase.map(x => x.close));
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

    // C. 定期定額 (每月)
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

    // E. 執行策略 (傳入 NetAsset)
    const val0050 = portfolio.qty0050 * day0050.close;
    const valZ2 = portfolio.qtyZ2 * dayZ2.close;
    const currentGross = val0050 + valZ2 + portfolio.cash;
    const currentNet = currentGross - portfolio.totalLoan;

    portfolio.executeStrategy(targetBorrowRatio, dayZ2.close, day0050.close, 
                              currentNet, 
                              day0050.date, 
                              isRebalanceDay, 
                              score, 
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
  console.log("📊 終極回測報告: 2005-Present (含冷卻+防禦)");
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