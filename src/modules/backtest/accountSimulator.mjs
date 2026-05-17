// src/modules/backtest/accountSimulator.mjs
//
// 職責：回測環境下的帳戶模擬（Virtual Broker）
//
// ══════════════════════════════════════════════════════════════════
// 資金架構（對齊生產策略設計）
// ──────────────────────────────────────────────────────────────────
//   0050 底倉：只進不出，每月 DCA 固定金額，是質押品的本體
//   質押額度  ＝ qty0050 × price0050 × pledgeRatio（預設 0.6）
//   totalLoan ：已借出用於買 00675L 的借款，計日利息
//   00675L    ：戰術部位，用借款買入；賣出時優先還款
//   現金      ：DCA 入帳後、買 0050 前的暫存；及賣 00675L 還款後的剩餘
// ══════════════════════════════════════════════════════════════════

import logger from "../../utils/logger.mjs";

export class AccountSimulator {
  constructor(initialConfig = {}) {
    this.cash = initialConfig.cash ?? 0;
    this.qty0050 = initialConfig.qty0050 ?? 0;
    this.qtyZ2 = initialConfig.qtyZ2 ?? 0;
    this.totalLoan = initialConfig.totalLoan ?? 0;

    // 質押折數（券商給的融資成數，預設 60%）
    this.pledgeRatio = initialConfig.pledgeRatio ?? 0.6;
    // 質押利率（年化，預設 2.2%）
    this.interestRate = initialConfig.interestRate ?? 0.022;
    // 交易稅 & 手續費
    this.taxRateZ2 = 0.001; // 槓桿 ETF 賣出交易稅 0.1%
    this.feeRate = 0.0001425 * 0.28; // 折讓後電子單手續費

    this.history = [];
  }

  // ──────────────────────────────────────────────────────────────
  // 質押可借額度（以當日 0050 市值為基準）
  // ──────────────────────────────────────────────────────────────
  getPledgeCapacity(price0050) {
    return this.qty0050 * price0050 * this.pledgeRatio;
  }

  // 目前剩餘可借空間
  getAvailableCredit(price0050) {
    return Math.max(0, this.getPledgeCapacity(price0050) - this.totalLoan);
  }

  // ──────────────────────────────────────────────────────────────
  // 每日利息結算（應在每日迴圈最後呼叫）
  // ──────────────────────────────────────────────────────────────
  accrueInterest() {
    if (this.totalLoan > 0) {
      const dailyInterest = (this.totalLoan * this.interestRate) / 365;
      this.totalLoan += dailyInterest;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 執行交易
  //   symbol ：'0050.TW' 或 '00675L.TW'
  //   amount ：交易金額（正=買入、負=賣出）
  //   price  ：當時成交價
  //   price0050：當日 0050 價（用於質押守衛檢查）
  // ──────────────────────────────────────────────────────────────
  executeTrade(symbol, amount, price, price0050 = null, quiet = false) {
    if (amount === 0 || price <= 0) return;

    const isBuy = amount > 0;

    // ── 00675L 買入：資金來源一定是質押借款，必須在剩餘額度內 ──
    if (isBuy && symbol === "00675L.TW") {
      if (price0050 === null) {
        if (!quiet)
          logger.warn(
            "[Backtest] 買入 00675L 需要 price0050 以計算質押額度，跳過",
          );
        return;
      }
      const available = this.getAvailableCredit(price0050);
      if (available < price) {
        // 剩餘質押空間不足一股
        if (!quiet)
          logger.info(
            `[Backtest] 質押空間不足 (可借:${available.toFixed(0)})，跳過 00675L 買入`,
          );
        return;
      }
      // 實際買入金額不超過剩餘可借額度
      amount = Math.min(amount, available);
    }

    const qty = Math.floor(Math.abs(amount) / price);
    if (qty === 0) return;
    const actualTotal = qty * price;
    const fee = actualTotal * this.feeRate;
    const tax =
      !isBuy && symbol === "00675L.TW" ? actualTotal * this.taxRateZ2 : 0;

    if (isBuy) {
      const cost = actualTotal + fee;

      if (symbol === "0050.TW") {
        // 0050 DCA：直接用現金買，現金不足則跳過（不借款買 0050）
        if (this.cash >= cost) {
          this.cash -= cost;
          this.qty0050 += qty;
          if (!quiet)
            logger.info(
              `[Backtest] DCA 0050 買入 ${qty} 股 @ ${price}，花費 ${cost.toFixed(0)}，現金剩 ${this.cash.toFixed(0)}`,
            );
        } else {
          // 現金不足：買得起幾股就買幾股（零頭留著）
          const affordQty = Math.floor(this.cash / price);
          if (affordQty > 0) {
            const affordCost = affordQty * price * (1 + this.feeRate);
            this.cash -= affordCost;
            this.qty0050 += affordQty;
            if (!quiet)
              logger.info(
                `[Backtest] DCA 0050 現金不足，縮減買入 ${affordQty} 股 @ ${price}`,
              );
          }
        }
      } else if (symbol === "00675L.TW") {
        // 00675L：全額借款（質押操作，不動現金）
        this.totalLoan += cost;
        this.qtyZ2 += qty;
        if (!quiet)
          logger.info(
            `[Backtest] 質押借款 買入 ${qty} 股 00675L @ ${price}，借款增加 ${cost.toFixed(0)}，totalLoan=${this.totalLoan.toFixed(0)}`,
          );
      }
    } else {
      // 賣出
      const gain = actualTotal - fee - tax;

      if (symbol === "0050.TW") {
        // 回測中 0050 底倉永遠不賣
        if (!quiet)
          logger.warn("[Backtest] 回測模式：0050 底倉不允許賣出，忽略");
        return;
      } else if (symbol === "00675L.TW") {
        this.qtyZ2 -= qty;
        // 優先還款，剩餘才進現金
        const repay = Math.min(gain, this.totalLoan);
        this.totalLoan -= repay;
        this.cash += gain - repay;
        if (!quiet)
          logger.info(
            `[Backtest] 賣出 ${qty} 股 00675L @ ${price}，還款 ${repay.toFixed(0)}，totalLoan=${this.totalLoan.toFixed(0)}`,
          );
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 動態去槓桿守衛
  //   當 totalLoan / pledgeCap 超過 triggerRatio（如 0.85）時，
  //   自動賣出足夠的 00675L 讓借款比率降回 targetRatio（如 0.70）
  //   返回：已賣出股數（0 表示無需操作）
  // ──────────────────────────────────────────────────────────────
  deleverage(
    price0050,
    priceZ2,
    { triggerRatio = 0.85, targetRatio = 0.7, quiet = false } = {},
  ) {
    if (this.totalLoan <= 0 || this.qtyZ2 <= 0) return 0;
    const pledgeCap = this.getPledgeCapacity(price0050);
    if (pledgeCap <= 0) return 0;

    const usageRatio = this.totalLoan / pledgeCap;
    if (usageRatio <= triggerRatio) return 0; // 未觸發，無需操作

    // 計算目標借款金額
    const targetLoan = pledgeCap * targetRatio;
    const loanToRepay = Math.max(0, this.totalLoan - targetLoan);

    // 需要賣多少 00675L 才能還 loanToRepay（含稅費）
    const netPerShare = priceZ2 * (1 - this.feeRate - this.taxRateZ2);
    const sharesToSell = Math.min(
      this.qtyZ2,
      Math.ceil(loanToRepay / netPerShare),
    );
    if (sharesToSell <= 0) return 0;

    const actualNet = sharesToSell * netPerShare;
    const repay = Math.min(actualNet, this.totalLoan);
    this.qtyZ2 -= sharesToSell;
    this.totalLoan -= repay;
    this.cash += actualNet - repay;

    if (!quiet)
      logger.info(
        `[Backtest][去槓桿] 使用率 ${(usageRatio * 100).toFixed(0)}% > ${(triggerRatio * 100).toFixed(0)}%，` +
          `賣出 ${sharesToSell} 股 00675L @ ${priceZ2.toFixed(2)}，還款 ${repay.toFixed(0)}，` +
          `totalLoan=${this.totalLoan.toFixed(0)}（使用率 → ${((this.totalLoan / pledgeCap) * 100).toFixed(0)}%）`,
      );
    return sharesToSell;
  }

  // ──────────────────────────────────────────────────────────────
  // 處理 0050 股票分割 (1拆4)
  // ──────────────────────────────────────────────────────────────
  processStockSplit(date, quiet = false) {
    if (date === "2025-06-18" && !this._splitProcessed_20250618) {
      this.qty0050 = this.qty0050 * 4;
      this._splitProcessed_20250618 = true;
      if (!quiet)
        logger.info(
          `[Backtest] 執行 0050 股票分割 (1拆4)，庫存變為 ${this.qty0050} 股`,
        );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 每日快照
  // ──────────────────────────────────────────────────────────────
  getSnapshot(price0050, priceZ2) {
    const value0050 = this.qty0050 * price0050;
    const valueZ2 = this.qtyZ2 * priceZ2;
    const grossAsset = value0050 + valueZ2 + this.cash;
    const netAsset = Math.max(1, grossAsset - this.totalLoan);
    const pledgeCap = this.getPledgeCapacity(price0050);
    const availCredit = Math.max(0, pledgeCap - this.totalLoan);

    // 維持率：抵押品市值 / 借款（無借款時填 999）
    const mm =
      this.totalLoan > 0 ? ((value0050 + valueZ2) / this.totalLoan) * 100 : 999;

    // 槓桿：以 00675L 實際曝險（×2）估算
    const leverage =
      netAsset > 0 ? (value0050 + valueZ2 * 2 + this.cash) / netAsset : 1;

    return {
      date: null, // 由 Runner 注入
      cash: this.cash,
      qty0050: this.qty0050,
      qtyZ2: this.qtyZ2,
      totalLoan: this.totalLoan,
      netAsset,
      value0050,
      valueZ2,
      pledgeCap,
      availCredit,
      maintenanceMargin: mm,
      actualLeverage: leverage,
    };
  }
}
