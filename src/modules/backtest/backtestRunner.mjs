// src/modules/backtest/backtestRunner.mjs
//
// ══════════════════════════════════════════════════════════════════
// 回測資金架構（對齊生產策略設計）
// ──────────────────────────────────────────────────────────────────
//  【底倉】0050
//    - 起始 qty0050 = 0，每月 DCA 固定金額買入（預設 30,000）
//    - 永遠不賣出；是質押品的本體
//
//  【質押槓桿】00675L
//    - 策略訊號 = long  → 借款買入 00675L
//                         借款上限 = qty0050 × price0050 × pledgeRatio(60%)
//                         本次借款 = 剩餘可借額度 × scalingRatio(tier1~3)
//    - 策略訊號 = short → 全數出清 00675L，優先還款
//    - CRISIS（VIX超標）→ 強制出清
//
//  【現金】
//    - DCA 資金在月初以現金入帳，月底買 0050（或月初就買，視設定）
//    - 借款不經過現金；賣 00675L 還款後的剩餘才進現金
// ══════════════════════════════════════════════════════════════════

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { AccountSimulator } from "./accountSimulator.mjs";
import { buildSignalContext } from "../../domain/signalContext.mjs";
import { evaluateInvestmentSignal } from "../strategy/strategyEngine.mjs";
import { fetchStrategyConfigUnified as fetchStrategyConfig } from "../strategy/strategyLoader.mjs";
import logger from "../../utils/logger.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const TIMELINE_FILE = path.join(PROJECT_ROOT, "data/backtest/timeline.json");

export class BacktestRunner {
  constructor(config = {}) {
    this.config = config;

    // 起始設定
    this.initialCash = config.initialCash ?? 0; // 起始現金（預設 0）
    this.monthlyDca = config.monthlyDca ?? 30000; // 每月 DCA 金額
    this.pledgeRatio = config.pledgeRatio ?? 0.6; // 質押折數（60%）
    this.interestRate = config.interestRate ?? 0.022; // 質押年利率（2.2%）

    this.account = new AccountSimulator({
      cash: this.initialCash,
      pledgeRatio: this.pledgeRatio,
      interestRate: this.interestRate,
    });

    this.timeline = [];
    this.results = [];
    this.strategy = null;
    this.lastDcaMonth = -1;
    this.disableGuards = true; // 預設關閉守衛（觀察計分矩陣純粹效果）
  }

  // ──────────────────────────────────────────────────────────────
  // setup()：載入 timeline、計算 MA60 Slope、套用策略設定
  // ──────────────────────────────────────────────────────────────
  async setup() {
    const content = await fs.readFile(TIMELINE_FILE, "utf-8");
    this.timeline = JSON.parse(content);

    // 預計算 MA60 & Slope（避免每天重算）
    const closes = this.timeline.map((d) => d.price0050);
    for (let i = 0; i < this.timeline.length; i++) {
      this.timeline[i].ma60 =
        i >= 59
          ? closes.slice(i - 59, i + 1).reduce((a, b) => a + b, 0) / 60
          : null;
      this.timeline[i].ma60Slope =
        i >= 60 && this.timeline[i].ma60 && this.timeline[i - 1].ma60
          ? ((this.timeline[i].ma60 - this.timeline[i - 1].ma60) /
              this.timeline[i - 1].ma60) *
            100
          : 0;
    }

    this.strategy = await fetchStrategyConfig();

    // disableGuards：關閉 valuationGuard / entryGate，純觀察計分矩陣效果
    // disableGuards=false 時完全對齊實盤守衛
    this.disableGuards = this.config.disableGuards !== false;
    if (this.disableGuards) {
      if (this.strategy.valuationGuard)
        this.strategy.valuationGuard.enabled = false;
      if (this.strategy.buy) {
        this.strategy.buy.entryGate.enabled = false;
        this.strategy.buy.minDropPercentToConsider = 0;
      }
    }

    // 覆寫買入門檻（對照組用）
    if (
      this.config.buyTactical != null &&
      this.strategy.scoringMatrix?.thresholds
    ) {
      this.strategy.scoringMatrix.thresholds.buyTactical =
        this.config.buyTactical;
      this.strategy.scoringMatrix.thresholds.buyTacticalBullish =
        this.config.buyTacticalBullish ?? this.config.buyTactical;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // run()：主迴圈
  // ──────────────────────────────────────────────────────────────
  async run() {
    await this.setup();

    const WARM_UP = 60;

    for (let i = WARM_UP; i < this.timeline.length; i++) {
      const day = this.timeline[i];
      const { date, price0050, price00675L, vix, pb } = day;

      // ── 每月 DCA：現金入帳後立刻買 0050 ──────────────────────
      const month = new Date(date).getMonth();
      if (month !== this.lastDcaMonth) {
        this.account.cash += this.monthlyDca; // 薪水入帳
        this.account.executeTrade(
          // 立刻買 0050
          "0050.TW",
          this.monthlyDca,
          price0050,
          null,
          this.config.quiet,
        );
        this.lastDcaMonth = month;
      }

      // ── 處理股票分割 ──────────────────────────────────────────────
      this.account.processStockSplit(date, this.config.quiet);

      // ── 建構策略輸入 ────────────────────────────────────────
      const priceZ2 =
        price00675L && price00675L > 0 ? price00675L : price0050 * 2.0;

      const histSlice0050 = this.timeline
        .slice(Math.max(0, i - 120), i + 1)
        .map((d) => ({
          close: d.price0050,
          high: d.price0050,
          low: d.price0050,
        }));
      const histSliceZ2 = this.timeline
        .slice(Math.max(0, i - 120), i + 1)
        .map((d) => {
          const p =
            d.price00675L && d.price00675L > 0
              ? d.price00675L
              : d.price0050 * 2.0;
          return { close: p, high: p, low: p };
        });
      const ma60SlopeSlice = this.timeline
        .slice(Math.max(0, i - 120), i + 1)
        .map((d) => d.ma60Slope ?? 0);
      const closeSlice = this.timeline
        .slice(Math.max(0, i - 120), i + 1)
        .map((d) => d.price0050);

      // basePrice = 近 120 日 00675L 最高點（計算跌幅用）
      const recentZ2 = this.timeline
        .slice(Math.max(0, i - 120), i + 1)
        .map((d) =>
          d.price00675L && d.price00675L > 0
            ? d.price00675L
            : d.price0050 * 2.0,
        );
      const basePrice = Math.max(...recentZ2);

      const slope = day.ma60Slope ?? 0;
      const marketDirection =
        slope > 0 ? "BULL" : slope < -0.1 ? "BEAR" : "NEUTRAL";

      // ── 質押狀態傳給策略引擎（disableGuards 時清零借款，避免守衛誤觸發） ──
      const reportedLoan = this.disableGuards ? 0 : this.account.totalLoan;

      const ctxMock = {
        history0050: histSlice0050,
        historyZ2: histSliceZ2,
        price0050,
        currentPriceZ2: priceZ2,
        basePrice,
        vixData: { value: vix, status: vix > 30 ? "CRISIS" : "NORMAL" },
        vixArr: this.timeline
          .slice(Math.max(0, i - 30), i + 1)
          .map((d) => d.vix),
        pbRecords: this.timeline.slice(0, i + 1).map((d) => d.pb),
        pbRecordsObjects: this.timeline
          .slice(0, i + 1)
          .map((d) => ({ date: d.date, pb: d.pb })),
        macroData: { rawValuation: { pb } },
        lastState: {
          cash: this.account.cash,
          qty0050: this.account.qty0050,
          qtyZ2: this.account.qtyZ2,
          totalLoan: reportedLoan,
          avgCostZ2: 0,
          lastBuyDate: null,
        },
        macroMarketDirection: marketDirection,
        valuationGuardState: { latchActive: false },
        cooldownStatus: { inCooldown: false, daysLeft: 0, message: "" },
        ma60SlopeArr: ma60SlopeSlice,
        closeArr: closeSlice,
        institutionalNet: 0,
        institutionalHistory: [],
      };

      const signalContext = buildSignalContext(ctxMock);
      signalContext.signalData.cooldownStatus = ctxMock.cooldownStatus;
      signalContext.signalData.indicators = signalContext.indicatorsZ2;
      signalContext.signalData.ma60SlopeArr = ctxMock.ma60SlopeArr;
      signalContext.signalData.basePrice = ctxMock.basePrice;

      const decisionResult = await evaluateInvestmentSignal(
        signalContext.signalData,
        this.strategy,
      );
      const decision = decisionResult.signals;

      await this.handleDecision(decision, day, price0050, priceZ2);

      // ── 動態去槓桿守衛（每日檢查，與策略訊號無關）──────────────
      // 當 totalLoan / pledgeCap > triggerRatio 時，自動賣 00675L 還款
      // 防止熊市底倉縮水→質押額度縮水→借款比率爆表
      // disableGuards 只禁用策略引擎內的借款守衛，不禁用去槓桿守衛
      const skipDeleverage = this.config.disableLoanGuard === true;
      if (!skipDeleverage && priceZ2 > 0) {
        this.account.deleverage(price0050, priceZ2, {
          triggerRatio: 0.85, // 使用率超過 85% 觸發
          targetRatio: 0.7, // 降回 70%
          quiet: this.config.quiet,
        });
      }

      // 每日利息結算
      this.account.accrueInterest();

      // 每日快照
      const snap = this.account.getSnapshot(price0050, priceZ2);
      snap.date = date;
      snap.advice = decision.target ?? "";
      snap.score = decision.finalScore ?? null;
      snap.signal = decision.signalDirection ?? "hold";
      snap.price0050 = price0050;
      snap.priceZ2 = priceZ2;
      this.results.push(snap);
    }

    return this.getSummary();
  }

  // ──────────────────────────────────────────────────────────────
  // handleDecision()：執行買賣
  // ──────────────────────────────────────────────────────────────
  async handleDecision(decision, day, price0050, priceZ2) {
    const signalDir = decision.signalDirection ?? "hold";
    const targetStr = decision.target ?? "";

    // ── 買入條件 ──────────────────────────────────────────────
    const isBuy = signalDir === "long";

    // ── 賣出條件（正常 short + CRISIS 強制賣出） ──────────────
    // 「減碼還款」是借款管理訊號，在 disableGuards 模式下不執行
    const isSell = signalDir === "short" || targetStr.includes("強制賣出");

    if (isBuy) {
      // ────────────────────────────────────────────────────────
      // 加碼金額 = 剩餘質押空間 × scalingRatio
      //
      //  scalingRatio 由生產策略的 scoring tier 決定：
      //    tier1 (score ≥ 1.5) → 0.4
      //    tier2 (score ≥ 3.5) → 0.7
      //    tier3 (score ≥ 6.0) → 1.0
      //
      //  剩餘質押空間 = qty0050 × price0050 × 60% − totalLoan
      //  → 每次最多用掉 scalingRatio 比例的剩餘空間
      // ────────────────────────────────────────────────────────
      const availCredit = this.account.getAvailableCredit(price0050);
      const scalingRatio = decision.scalingRatio ?? 1.0;
      const buyAmount = availCredit * scalingRatio;

      if (buyAmount > priceZ2) {
        // 至少要能買一股
        this.account.executeTrade(
          "00675L.TW",
          buyAmount,
          priceZ2,
          price0050,
          this.config.quiet,
        );
      }
    } else if (isSell) {
      // 依據策略配置的 sellRatioLimit 進行局部出清（預設為 1.0 全額出清）
      if (this.account.qtyZ2 > 0) {
        const sellRatio = this.strategy.sell?.sellRatioLimit ?? 1.0;
        const sellQty = Math.ceil(this.account.qtyZ2 * sellRatio);
        const sellValue = sellQty * priceZ2;
        if (sellValue > 0) {
          this.account.executeTrade(
            "00675L.TW",
            -sellValue,
            priceZ2,
            price0050,
            this.config.quiet,
          );
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────
  // getSummary()
  // ──────────────────────────────────────────────────────────────
  getSummary() {
    if (this.results.length === 0) return null;
    const end = this.results.at(-1);
    const totalReturn =
      ((end.netAsset - this.initialCash) / Math.max(1, this.initialCash)) * 100;
    const mms = this.results
      .map((r) => r.maintenanceMargin)
      .filter((m) => isFinite(m) && m !== 999);
    const minMm = mms.length > 0 ? Math.min(...mms) : 999;

    return {
      name: this.config.name,
      returnPct: totalReturn,
      finalNetAsset: end.netAsset,
      qty0050: end.qty0050,
      qtyZ2: end.qtyZ2,
      totalLoan: end.totalLoan,
      finalLeverage: end.actualLeverage,
      minMm,
    };
  }
}
