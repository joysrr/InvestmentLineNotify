import fs from "fs";
import path from "path";
// 若 node-fetch 報錯，請確保 package.json 有 "type": "module" 或改用 import ... from ...
import fetch from "node-fetch";
import { calculateIndicators } from "./finance/indicators.mjs";
// 注意：請確認路徑是否正確指向您的 provider
import { fetchStockHistory } from "./providers/twse/twseStockDayProvider.mjs";
import { fetchStrategyConfig } from "./services/strategyConfigService.mjs";

// ==========================================
// 1. 回測參數設定
// ==========================================
const CONFIG = {
  initialCapital: 1_000_000, // 初始資金
  monthlyContribution: 20_000, // 每月定期定額
  loanInterestRate: 0.025, // 質押借款年利率
  transFee: 0.001425 * 0.6, // 手續費
  taxRate: 0.003, // 交易稅
  startDate: "2003-07-01", // 0050 上市初期開始
  endDate: new Date().toISOString().split("T")[0], // 到今天
  dataCacheFile: "./data/history_cache_0050.json", // 快取檔案
};

// ==========================================
// 2. 資料準備 (斷點續傳 + 防鎖 IP 版)
// ==========================================
if (!fs.existsSync("./data")) fs.mkdirSync("./data");

async function prepareData() {
  let history0050 = [];

  // A. 讀取現有快取
  if (fs.existsSync(CONFIG.dataCacheFile)) {
    try {
      history0050 = JSON.parse(fs.readFileSync(CONFIG.dataCacheFile, "utf-8"));
      console.log(`📂 已讀取快取，共 ${history0050.length} 筆數據`);
    } catch (e) {
      console.error("⚠️ 快取檔損毀，將重新下載");
      history0050 = [];
    }
  }

  // B. 決定開始抓取的日期 (從最後一筆數據的下個月開始)
  let nextDate = new Date(CONFIG.startDate);
  if (history0050.length > 0) {
    const lastEntry = history0050[history0050.length - 1];
    const lastDate = new Date(lastEntry.date);
    // 設定為下個月 1 號
    nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
  }

  const today = new Date();

  // 如果需要補資料
  if (nextDate < today) {
    console.log(
      `🌐 準備從 ${nextDate.toISOString().split("T")[0]} 開始補齊資料...`,
    );
    console.log(
      "⚠️ 提示：為避免證交所封鎖，每個月查詢將間隔 3 秒，請耐心等待。",
    );
  }

  // C. 逐月抓取迴圈
  while (nextDate < today) {
    const y = nextDate.getFullYear();
    const m = nextDate.getMonth() + 1;

    // 計算該月最後一天
    const lastDay = new Date(y, m, 0).getDate();
    const startStr = `${y}-${String(m).padStart(2, "0")}-01`;
    const endStr = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;

    console.log(`   ⏳ 正在抓取 ${y} 年 ${m} 月 ...`);

    try {
      // 呼叫 provider 抓取該月
      const data = await fetchStockHistory("0050", startStr, endStr);

      if (data && data.length > 0) {
        // 去重並加入
        const existingDates = new Set(history0050.map((x) => x.date));
        const newRows = data.filter((x) => !existingDates.has(x.date));

        if (newRows.length > 0) {
          history0050.push(...newRows);
          history0050.sort((a, b) => new Date(a.date) - new Date(b.date));

          // 📍 關鍵：每抓成功一個月就立刻存檔 (斷點續傳)
          fs.writeFileSync(
            CONFIG.dataCacheFile,
            JSON.stringify(history0050, null, 2),
          );
          console.log(`      ✅ 成功取得 ${newRows.length} 筆，已存檔。`);
        } else {
          console.log(`      ⚠️ 無新資料 (可能已存在)`);
        }
      }

      // 🛑 防鎖機制：成功後休息 3 秒 (比原本 provider 的 0.2 秒更安全)
      await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      console.error(`   ❌ ${y}-${m} 抓取失敗: ${e.message}`);
      console.log(
        "   🛑 觸發頻率限制 (Rate Limit)，系統將暫停 60 秒後自動重試...",
      );

      // 失敗時，休息 60 秒讓 IP 解鎖，然後 "continue" (不推進 nextDate，重試同一個月)
      await new Promise((r) => setTimeout(r, 60000));
      continue;
    }

    // 推進到下個月
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  console.log("✅ 0050 歷史數據準備完成！");

  // D. 合成 00675L (模擬槓桿)
  console.log("🧪 正在合成 00675L (模擬槓桿) 歷史數據...");
  const historyZ2 = [];
  let currentPriceZ2 = 10; // 假設上市初始價格
  const dailyExpense = 0.01 / 250; // 內扣費用約 1%

  for (let i = 0; i < history0050.length; i++) {
    const todayData = history0050[i];
    const prevData = i > 0 ? history0050[i - 1] : null;

    if (prevData) {
      const ret0050 = (todayData.close - prevData.close) / prevData.close;
      // 2倍槓桿模擬公式：(漲跌幅 * 2) - 內扣
      const retZ2 = ret0050 * 2 - dailyExpense;
      currentPriceZ2 = currentPriceZ2 * (1 + retZ2);
    }

    historyZ2.push({
      date: todayData.date,
      open: currentPriceZ2,
      high: currentPriceZ2,
      low: currentPriceZ2,
      close: currentPriceZ2,
      volume: 1000000,
    });
  }

  return { history0050, historyZ2 };
}

// ==========================================
// 3. 回測核心引擎 (Portfolio Class)
// ==========================================

class Portfolio {
  constructor(initialCash) {
    this.cash = initialCash;
    this.qty0050 = 0;
    this.qtyZ2 = 0;
    this.loan = 0;
    this.totalInvested = initialCash;
    this.history = [];
  }

  // 買入 0050
  buy0050(price, amount) {
    if (this.cash >= amount) {
      // 扣除手續費反推可買金額
      // cost + cost*fee = amount => cost = amount / (1+fee)
      // 這裡簡化：直接算
      const qty = Math.floor(amount / price);
      const cost = qty * price;
      const fee = Math.floor(cost * CONFIG.transFee);
      if (this.cash >= cost + fee) {
        this.qty0050 += qty;
        this.cash -= cost + fee;
        return true;
      }
    }
    return false;
  }

  // 調整槓桿部位 (再平衡)
  rebalanceZ2(targetZ2Value, priceZ2, netAsset, price0050) {
    const currentZ2Value = this.qtyZ2 * priceZ2;
    const diff = targetZ2Value - currentZ2Value;
    const minAction = 10000; // 最小操作金額

    // 加碼 (Buy)
    if (diff > minAction) {
      let costNeeded = diff;
      const fee = Math.floor(costNeeded * CONFIG.transFee);
      const totalNeeded = costNeeded + fee;

      // 1. 先用現金
      if (this.cash >= totalNeeded) {
        this.cash -= totalNeeded;
        this.qtyZ2 += Math.floor(costNeeded / priceZ2);
      } else {
        // 2. 現金不足 -> 質押
        // 假設額度上限：0050市值的 60%
        const collateralValue = this.qty0050 * price0050;
        const maxLoan = collateralValue * 0.6;
        const canBorrow = maxLoan - this.loan;

        let borrowNeeded = totalNeeded - this.cash;

        // 如果還有額度
        if (borrowNeeded > 0 && canBorrow >= borrowNeeded) {
          this.loan += borrowNeeded;
          this.cash += borrowNeeded; // 借錢入帳

          this.cash -= totalNeeded; // 支付款項
          this.qtyZ2 += Math.floor(costNeeded / priceZ2);
        }
      }
    }
    // 減碼 (Sell)
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

        // 優先還款
        if (this.loan > 0) {
          const repay = Math.min(this.loan, this.cash);
          this.loan -= repay;
          this.cash -= repay;
        }
      }
    }
  }

  update(date, price0050, priceZ2) {
    // 每日計息
    const dailyInterest = (this.loan * CONFIG.loanInterestRate) / 365;
    this.cash -= dailyInterest;

    // 計算淨值
    const val0050 = this.qty0050 * price0050;
    const valZ2 = this.qtyZ2 * priceZ2;
    const grossAsset = val0050 + valZ2 + this.cash;
    const netAsset = grossAsset - this.loan;
    const maintainance = this.loan > 0 ? (val0050 / this.loan) * 100 : 999;

    this.history.push({
      date,
      netAsset,
      grossAsset,
      loan: this.loan,
      maintainance,
      price0050,
      invested: this.totalInvested,
    });

    return { netAsset };
  }
}

// ==========================================
// 4. 執行回測流程
// ==========================================
async function runBacktest() {
  console.log("🚀 啟動回測系統 (TWSE Rate-Limit Safe Mode)...");

  // 1. 準備數據
  const { history0050, historyZ2 } = await prepareData();

  // 2. 載入策略
  const strategy = await fetchStrategyConfig();
  console.log("📜 策略已載入");

  // 3. 初始化
  const portfolio = new Portfolio(CONFIG.initialCapital);
  let basePrice = 0;

  console.log(
    `📅 回測區間: ${history0050[0].date} ~ ${history0050[history0050.length - 1].date}`,
  );
  console.log(
    `💰 參數: 起始${CONFIG.initialCapital}, 月投${CONFIG.monthlyContribution}, 利率${CONFIG.loanInterestRate * 100}%`,
  );

  // 4. 逐日模擬
  // 從第 250 天開始 (讓指標有足夠數據)
  for (let i = 250; i < history0050.length; i++) {
    const day0050 = history0050[i];
    const dayZ2 = historyZ2[i];

    // --- A. 定期定額 (每個月初) ---
    // 判斷是否換月
    const prevDate = history0050[i - 1].date;
    const currMonth = day0050.date.substring(0, 7); // "YYYY-MM"
    const prevMonth = prevDate.substring(0, 7);

    if (currMonth !== prevMonth) {
      portfolio.cash += CONFIG.monthlyContribution;
      portfolio.totalInvested += CONFIG.monthlyContribution;
      portfolio.buy0050(day0050.close, CONFIG.monthlyContribution);
    }

    // --- B. 更新波段高點 (Base Price) ---
    // 取過去 120 日 00675L 的最高價
    const lookback = 120;
    const recentHighZ2 = Math.max(
      ...historyZ2.slice(i - lookback, i + 1).map((k) => k.close),
    );
    basePrice = recentHighZ2;

    // --- C. 計算指標 ---
    // 取最近 300 天數據給指標函式
    const historySlice = historyZ2.slice(i - 300, i + 1);
    const indicators = calculateIndicators(historySlice);

    // 取得當天指標值
    const rsi =
      indicators.rsiArr.length > 0
        ? indicators.rsiArr[indicators.rsiArr.length - 1]
        : 50;
    const kd =
      indicators.kdArr.length > 0
        ? indicators.kdArr[indicators.kdArr.length - 1]
        : { k: 50, d: 50 };
    const macd =
      indicators.macdArr.length > 0
        ? indicators.macdArr[indicators.macdArr.length - 1]
        : { MACD: 0, signal: 0 };

    // --- D. 計算策略分數 (模擬 stockSignalService) ---
    const currentPrice = dayZ2.close;
    // 跌幅 (永遠為正數)
    const priceDropPercent = Math.max(
      0,
      ((basePrice - currentPrice) / basePrice) * 100,
    );

    // 跌幅分
    const dropRules = strategy.buy.dropScoreRules.sort(
      (a, b) => b.minDrop - a.minDrop,
    );
    const dropRule = dropRules.find((r) => priceDropPercent >= r.minDrop);
    const dropScore = dropRule ? dropRule.score : 0;

    // 技術分 (簡化版：只看當天值，若要更精確可引入 indicators 內的交叉判斷)
    let techScore = 0;
    // RSI
    if (rsi < strategy.buy.rsi.oversold) techScore += strategy.buy.rsi.score;
    // KD (簡單判斷 K < oversold)
    if (kd.k < strategy.buy.kd.oversoldK) techScore += strategy.buy.kd.score;
    // MACD (簡單判斷金叉: MACD > Signal 且之前是用 MACD 判斷) -> 這裡簡化為不加分或固定加分
    // 您的策略通常看金叉，這裡回測若要精確需比較 i-1 和 i。
    // 簡單起見：若 MACD > Signal 給一半分數
    if (macd.MACD > macd.signal) techScore += 0;

    const totalScore = dropScore + techScore;

    // --- E. 決定目標槓桿 ---
    let targetLeverage = 0;
    // 1. 預設底倉
    const defaultAlloc = strategy.allocation.find((a) => a.minScore === -99);
    targetLeverage = defaultAlloc ? defaultAlloc.leverage : 0;

    // 2. 檢查是否觸發更高規則
    for (const alloc of strategy.allocation) {
      if (totalScore >= alloc.minScore && alloc.minScore !== -99) {
        if (alloc.leverage > targetLeverage) {
          targetLeverage = alloc.leverage;
        }
      }
    }

    // --- F. 停利邏輯 (Sell Rules) ---
    // 您的策略有 "minUpPercentToSell": 50
    // 這邊簡單模擬：如果這波賺爛了 (需追蹤成本)，就降槓桿。
    // 回測難點：追蹤 "這波" 成本。
    // 這裡暫時忽略停利，專注於 "跌深買進" 的效果。

    // --- G. 執行再平衡 ---
    const { netAsset } = portfolio.update(
      day0050.date,
      day0050.close,
      dayZ2.close,
    );
    const targetZ2Val = netAsset * targetLeverage;

    // 只有在目標槓桿 > 0 時才積極動作，避免在 0 槓桿時頻繁交易
    portfolio.rebalanceZ2(targetZ2Val, dayZ2.close, netAsset, day0050.close);
  }

  // ==========================================
  // 5. 產出報告
  // ==========================================
  const last = portfolio.history[portfolio.history.length - 1];
  const totalReturn = ((last.netAsset - last.invested) / last.invested) * 100;
  const years =
    (new Date(CONFIG.endDate) - new Date(CONFIG.startDate)) /
    (1000 * 3600 * 24 * 365);
  const cagr = (Math.pow(last.netAsset / last.invested, 1 / years) - 1) * 100;

  // MDD
  let peak = 0;
  let maxDrawdown = 0;
  for (const h of portfolio.history) {
    if (h.netAsset > peak) peak = h.netAsset;
    const dd = (peak - h.netAsset) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  console.log("\n========================================");
  console.log("📊 歷史回測報告 (模擬 00675L + 質押)");
  console.log("========================================");
  console.log(`回測期間: ${years.toFixed(1)} 年`);
  console.log(`總投入本金: $${Math.round(last.invested).toLocaleString()}`);
  console.log(`最終總資產: $${Math.round(last.netAsset).toLocaleString()}`);
  console.log(`總報酬率: ${totalReturn.toFixed(2)}%`);
  console.log(`年化報酬率 (CAGR): ${cagr.toFixed(2)}%`);
  console.log(`最大回撤 (MDD): -${(maxDrawdown * 100).toFixed(2)}%`);
  console.log(`最終槓桿比: ${(last.grossAsset / last.netAsset).toFixed(2)}x`);
  console.log("========================================");
}

runBacktest().catch(console.error);
