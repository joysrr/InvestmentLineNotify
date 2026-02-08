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
  initialCapital: 1_000_000,
  monthlyContribution: 20_000,
  loanInterestRate: 0.025, // 2.5% 質押利率
  transFee: 0.001425 * 0.6, // 手續費 6 折
  taxRate: 0.003, // 交易稅
  startDate: "2010-01-01", 
  endDate: new Date().toISOString().split("T")[0],
  dataCacheFile: "./data/history_cache_0050.json",
  basePriceLookback: 120, 
  marginCallThreshold: 135 // 維持率低於此數值強制斷頭 (模擬券商行為)
};

// ==========================================
// 2. 資料準備 
// ==========================================
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

async function prepareData() {
  let history0050 = [];

  // A. 讀取/下載 0050
  if (fs.existsSync(CONFIG.dataCacheFile)) {
    try {
      history0050 = JSON.parse(fs.readFileSync(CONFIG.dataCacheFile, "utf-8"));
    } catch (e) {
      history0050 = [];
    }
  }

  let nextDate = new Date(CONFIG.startDate);
  if (history0050.length > 0) {
    const lastDate = new Date(history0050[history0050.length - 1].date);
    nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
  }
  const today = new Date();

  if (nextDate < today) {
    console.log("🌐 檢查並更新歷史資料...");
    while (nextDate < today) {
      const y = nextDate.getFullYear();
      const m = nextDate.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      const startStr = `${y}-${String(m).padStart(2, "0")}-01`;
      const endStr = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
      
      try {
        const data = await fetchStockHistory("0050", startStr, endStr);
        if (data && data.length > 0) {
          const existingDates = new Set(history0050.map(x => x.date));
          const newRows = data.filter(x => !existingDates.has(x.date));
          if (newRows.length > 0) {
            history0050.push(...newRows);
            history0050.sort((a, b) => new Date(a.date) - new Date(b.date));
            fs.writeFileSync(CONFIG.dataCacheFile, JSON.stringify(history0050, null, 2));
          }
        }
        await new Promise(r => setTimeout(r, 2000)); 
      } catch (e) {
        await new Promise(r => setTimeout(r, 60000)); // 失敗等 60s
        continue;
      }
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
  }

  // B. 合成 00675L (Z2)
  const historyZ2 = [];
  let currentPriceZ2 = 10;
  const dailyExpense = 0.01 / 250;

  for (let i = 0; i < history0050.length; i++) {
    const todayData = history0050[i];
    const prevData = i > 0 ? history0050[i - 1] : null;

    if (prevData) {
      const ret0050 = (todayData.close - prevData.close) / prevData.close;
      const retZ2 = ret0050 * 2 - dailyExpense;
      currentPriceZ2 = currentPriceZ2 * (1 + retZ2);
    }
    historyZ2.push({ ...todayData, open: currentPriceZ2, high: currentPriceZ2, low: currentPriceZ2, close: currentPriceZ2 });
  }

  return { history0050, historyZ2 };
}

// ==========================================
// 3. 投資組合 (修復 NaN 與 增加日誌)
// ==========================================
class Portfolio {
  constructor(initialCash) {
    this.cash = initialCash;
    this.qty0050 = 0;
    this.qtyZ2 = 0;
    this.totalLoan = 0;
    this.totalInvested = initialCash;
    this.history = [];
    this.marginCallCount = 0;
  }

  buy0050(price, amount) {
    if (this.cash >= amount) {
      const qty = Math.floor(amount / price);
      const cost = qty * price;
      const fee = Math.floor(cost * CONFIG.transFee);
      if (this.cash >= cost + fee) {
        this.qty0050 += qty;
        this.cash -= (cost + fee);
      }
    }
  }

  executeStrategy(targetLeverage, priceZ2, price0050, netAsset, dateStr) {
    const targetZ2Value = netAsset * targetLeverage;
    const currentZ2Value = this.qtyZ2 * priceZ2;
    const diff = targetZ2Value - currentZ2Value;
    const minAction = 10000; 

    if (diff > minAction) {
      const costNeeded = diff;
      const fee = Math.floor(costNeeded * CONFIG.transFee);
      const totalNeeded = costNeeded + fee;

      if (this.cash >= totalNeeded) {
        this.cash -= totalNeeded;
        this.qtyZ2 += Math.floor(costNeeded / priceZ2);
        // console.log(`[${dateStr}] 加碼: 現金買入 Z2`);
      } else {
        const collateralValue = this.qty0050 * price0050;
        const maxLoan = collateralValue * 0.6; // 最高借 6 成
        const canBorrow = maxLoan - this.totalLoan;
        const borrowNeeded = totalNeeded - this.cash;
        
        if (borrowNeeded > 0 && canBorrow >= borrowNeeded) {
          this.totalLoan += borrowNeeded;
          this.cash += borrowNeeded;
          this.cash -= totalNeeded;
          this.qtyZ2 += Math.floor(costNeeded / priceZ2);
          // console.log(`[${dateStr}] 加碼: 質押借出 ${Math.round(borrowNeeded)} 買入 Z2`);
        }
      }
    }
    else if (diff < -minAction) {
      const sellVal = Math.abs(diff);
      const qtyToSell = Math.floor(sellVal / priceZ2);
      
      if (qtyToSell > 0 && this.qtyZ2 >= qtyToSell) {
        const proceeds = qtyToSell * priceZ2;
        const tax = Math.floor(proceeds * CONFIG.taxRate);
        const fee = Math.floor(proceeds * CONFIG.transFee);
        const finalGet = proceeds - tax - fee;

        this.qtyZ2 -= qtyToSell;
        this.cash += finalGet;

        if (this.totalLoan > 0) {
          const repay = Math.min(this.totalLoan, this.cash);
          this.totalLoan -= repay;
          this.cash -= repay;
          // console.log(`[${dateStr}] 減碼: 賣出 Z2 並還款`);
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

    // 🔥 強制斷頭機制 (模擬券商 margin call)
    if (maintenance < CONFIG.marginCallThreshold) {
       console.log(`💀 [${date}] 斷頭警報！維持率 ${maintenance.toFixed(1)}% < ${CONFIG.marginCallThreshold}%`);
       console.log(`   -> 強制賣出所有 00675L ($${Math.round(valZ2)}) 償還債務`);
       
       // 賣出所有 Z2
       const proceeds = this.qtyZ2 * priceZ2;
       const tax = Math.floor(proceeds * CONFIG.taxRate);
       const fee = Math.floor(proceeds * CONFIG.transFee);
       const finalGet = proceeds - tax - fee;
       
       this.qtyZ2 = 0;
       this.cash += finalGet;
       
       // 強制還款
       const repay = Math.min(this.totalLoan, this.cash);
       this.totalLoan -= repay;
       this.cash -= repay;
       
       this.marginCallCount++;
    }

    this.history.push({ 
        date, 
        netAsset, 
        grossAsset, 
        totalLoan: this.totalLoan, 
        maintenance, 
        price0050,
        totalInvested: this.totalInvested // ✅ 修正：加入這個欄位解決 NaN
    });
    return { netAsset, maintenance };
  }
}

// ==========================================
// 4. 回測主程式
// ==========================================
async function runBacktest() {
  console.log("🚀 啟動真．策略回測 (整合 stockSignalService)...");

  const { history0050, historyZ2 } = await prepareData();
  const strategy = await fetchStrategyConfig();
  console.log("📜 策略配置檔已載入");

  const portfolio = new Portfolio(CONFIG.initialCapital);
  let basePrice = 0;

  console.log(`📅 回測開始: ${history0050[250].date} ~ ${history0050[history0050.length-1].date}`);

  for (let i = 250; i < history0050.length; i++) {
    const day0050 = history0050[i];
    const dayZ2 = historyZ2[i];

    // 1. 定期定額
    const prevDate = history0050[i-1].date;
    if (day0050.date.substring(5,7) !== prevDate.substring(5,7)) {
      portfolio.cash += CONFIG.monthlyContribution;
      portfolio.totalInvested += CONFIG.monthlyContribution;
      portfolio.buy0050(day0050.close, CONFIG.monthlyContribution);
    }

    // 2. 更新 Base Price
    const historySlice = historyZ2.slice(i - 300, i + 1); 
    const recentZ2Closes = historySlice.slice(-CONFIG.basePriceLookback).map(x=>x.close);
    basePrice = Math.max(...recentZ2Closes);

    // 3. 準備 Mock Data
    const indicators = calculateIndicators(historySlice);
    const lastRSI = indicators.rsiArr[indicators.rsiArr.length-1];
    const lastKD = indicators.kdArr[indicators.kdArr.length-1] || {k:50, d:50};
    
    const mockData = {
      currentPrice: dayZ2.close,
      basePrice: basePrice,
      price0050: day0050.close, 
      portfolio: {
        qty0050: portfolio.qty0050,
        qtyZ2: portfolio.qtyZ2,
        cash: portfolio.cash,
        totalLoan: portfolio.totalLoan
      },
      closes: historySlice.map(x=>x.close),
      rsiArr: indicators.rsiArr,
      kdArr: indicators.kdArr,
      macdArr: indicators.macdArr,
      ma240: null, // 簡化
      RSI: lastRSI,
      KD_K: lastKD.k,
      KD_D: lastKD.d,
    };

    // 4. 呼叫策略
    const signalResult = evaluateInvestmentSignal(mockData, strategy);
    
    let targetLeverage = 0;
    
    // 處理特殊回傳
    if (signalResult.target && signalResult.target.includes("禁撥款")) {
       const currentNet = portfolio.update(day0050.date, day0050.close, dayZ2.close).netAsset;
       const currentLev = (portfolio.qtyZ2 * dayZ2.close) / currentNet;
       targetLeverage = currentLev; // 維持現狀
    }
    else if (signalResult.target && signalResult.target.includes("風控優先")) {
       targetLeverage = 0; 
    } 
    else {
      // 根據分數找 Target
      const score = signalResult.weightScore || 0;
      const defaultAlloc = strategy.allocation.find(a => a.minScore === -99);
      targetLeverage = defaultAlloc ? defaultAlloc.leverage : 0;

      for (const alloc of strategy.allocation) {
        if (score >= alloc.minScore && alloc.minScore !== -99) {
          if (alloc.leverage > targetLeverage) {
            targetLeverage = alloc.leverage;
          }
        }
      }
      
      // 停利
      if (signalResult.postAllocation) {
        targetLeverage = signalResult.postAllocation.leverage;
      }
    }

    // 5. 執行
    // 注意：update 已經在 "禁撥款" 邏輯裡呼叫過一次，避免重複呼叫，這裡要小心
    // 我們統一在 loop 結尾呼叫一次 update 即可。
    // 為了簡單，剛剛禁撥款裡呼叫 update 只是為了算淨值，不影響 history 重複 push (因為 update 會 push)
    // -> 修正：我們不應該在 if 裡面呼叫 update。
    
    // 重算淨值給 executeStrategy 用
    const val0050 = portfolio.qty0050 * day0050.close;
    const valZ2 = portfolio.qtyZ2 * dayZ2.close;
    const gross = val0050 + valZ2 + portfolio.cash;
    const net = gross - portfolio.totalLoan;
    
    portfolio.executeStrategy(targetLeverage, dayZ2.close, day0050.close, net, day0050.date);
    
    // 每日結算與紀錄
    portfolio.update(day0050.date, day0050.close, dayZ2.close);
  }

  // ==========================================
  // 5. 結算
  // ==========================================
  const last = portfolio.history[portfolio.history.length - 1];
  const totalReturn = ((last.netAsset - last.totalInvested) / last.totalInvested) * 100;
  const years = (new Date(CONFIG.endDate) - new Date(CONFIG.startDate)) / (1000 * 3600 * 24 * 365);
  const cagr = (Math.pow(last.netAsset / last.totalInvested, 1 / years) - 1) * 100;

  let peak = 0;
  let maxDrawdown = 0;
  for (const h of portfolio.history) {
    if (h.netAsset > peak) peak = h.netAsset;
    const dd = (peak - h.netAsset) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  console.log("\n========================================");
  console.log("📊 真．策略回測報告 (修復版)");
  console.log("========================================");
  console.log(`回測期間: ${years.toFixed(1)} 年`);
  console.log(`總投入本金: $${Math.round(last.totalInvested).toLocaleString()}`);
  console.log(`最終總資產: $${Math.round(last.netAsset).toLocaleString()}`);
  console.log(`總報酬率: ${totalReturn.toFixed(2)}%`);
  console.log(`年化報酬率 (CAGR): ${cagr.toFixed(2)}%`);
  console.log(`最大回撤 (MDD): -${(maxDrawdown * 100).toFixed(2)}%`);
  console.log(`斷頭次數: ${portfolio.marginCallCount} 次`);
  console.log("========================================");
}

runBacktest().catch(console.error);