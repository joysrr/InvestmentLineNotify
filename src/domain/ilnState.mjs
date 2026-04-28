/**
 * ILN Domain State / IlnState
 *
 * 統一管理 InvestmentLineNotify 的「當下狀態」：
 * - macro：外部總經 / 市場資料 (data/market/latest.json 或當次 providers 抓回)
 * - portfolioRaw：原始持股 / 快照物件（尚未 normalise 前）
 * - signals：策略與風控計算結果
 * - strategySnapshot：策略設定完整快照
 * - ai：AI pipeline 輸出（macroAnalysis / actions / period report 等）
 *
 * 提供：
 * - 從「今日重新運算」建立 state → createStateFromTodayRun()
 * - 從「既有檔案」建立 state → loadStateFromLatestFiles() / loadStateFromReport(date)
 * - 常用欄位 getter（valuation、槓桿、維持率、macroAnalysis、latestSnapshot...）
 * - 輸出報告物件 → toReportObject()
 * - 輸出 API payload（例如 /api/status）→ toStatusPayload()
 */

/// ====== Imports（依實際實作調整後版本） ==========================

import { fetchAllMacroData } from "../modules/providers/marketData.mjs"; // 總經 / 市場 slot 抽象層

import { archiveManager } from "../modules/data/archiveManager.mjs"; // getLatestMarketData / saveMarketData / listArchiveDates / saveReport 等

import { encryptSnapshot, decryptSnapshot } from "../utils/snapshotCrypto.mjs"; // AES-256-GCM 加解密快照

import { normaliseSnapshot } from "../api/utils/snapshotAggregator.mjs";
// ↑ 實際檔名是 snapshotAggregator.mjs（原本 skeleton 寫成 snapshotNormalizer）

// 注意：暫時先不在這裡直接 import storage/strategy/ai，
// createStateFromTodayRun 先關閉，避免依賴不存在的 exported 函式。

/// ====== IlnState 類別 ==================================================

export class IlnState {
  /**
   * @param {Object} args
   * @param {Object} args.macro            - 總經 / 市場 canonical state（通常對應 data/market/latest.json 或 report.marketState）
   * @param {Object|null} args.portfolioRaw - 原始快照 / 持股資料（尚未 normalise 的物件；可能為 null）
   * @param {Object} args.signals          - 策略與風控 signals 子樹（report.signals）
   * @param {Object} args.strategySnapshot - 策略設定完整快照（report.strategySnapshot）
   * @param {Object} args.ai               - AI pipeline 輸出（report.ai）
   * @param {string|null} args.reportDate  - 對應報告日期（YYYY-MM-DD），重新運算的情境可以是 today
   * @param {Object|null} args.meta        - 額外 meta，例如 data/market/latest.json 的 _meta
   */
  constructor({
    macro,
    portfolioRaw,
    signals,
    strategySnapshot,
    ai,
    reportDate = null,
    meta = null,
  }) {
    this.macro = macro ?? {};
    this.portfolioRaw = portfolioRaw ?? null;
    this.signals = signals ?? {};
    this.strategySnapshot = strategySnapshot ?? {};
    this.ai = ai ?? {};
    this.reportDate = reportDate;
    this.meta = meta ?? null;

    // 內部 lazy cache
    this._derived = Object.create(null);
  }

  /// ----- 常用 getter：Valuation / Sentiment / Liquidity 等 -------------

  /** 台股估值 (PE) */
  get valuationPe() {
    // 你可以視 marketState 結構調整路徑：
    // - 若已 canonical：this.macro.valuation.pe
    // - 若仍沿用 raw slot：this.macro.data?.rawValuation?.pe
    return (
      this.macro?.valuation?.pe ?? this.macro?.data?.rawValuation?.pe ?? null
    );
  }

  /** 台股估值 (PB) */
  get valuationPb() {
    return (
      this.macro?.valuation?.pb ?? this.macro?.data?.rawValuation?.pb ?? null
    );
  }

  /** CNN 恐懼貪婪分數 */
  get cnnScore() {
    // 一樣依 canonical / raw 結構調整
    return (
      this.macro?.sentiment?.cnnScore ?? this.macro?.data?.rawCnn?.score ?? null
    );
  }

  /** USD/TWD 匯率 */
  get fxRate() {
    return (
      this.macro?.liquidity?.usdTwd?.currentRate ??
      this.macro?.data?.rawFx?.currentRate ??
      null
    );
  }

  /** 大盤成交金額（億元） */
  get marketTurnover100M() {
    return (
      this.macro?.liquidity?.twMarket?.turnover100M ??
      this.macro?.data?.rawMarketOverview?.turnover100M ??
      null
    );
  }

  /// ----- Signals 相關 getter ------------------------------------------

  /** 估值分位 (PR) */
  get currentPr() {
    return this.signals?.valuationGuardResult?.currentPR ?? null;
  }

  /** 槓桿倍數 */
  get grossLeverage() {
    return this.signals?.grossLeverage ?? null;
  }

  /** 維持率 (%) */
  get maintenanceMargin() {
    return this.signals?.maintenanceMargin ?? null;
  }

  /** 總分 / 多空 bias */
  get overallScore() {
    return this.signals?.overallScore ?? null;
  }

  get bias() {
    return this.signals?.bias ?? null; // 'BULL' | 'BEAR' | 'NEUTRAL' 等
  }

  /// ----- 投組快照相關 getter（lazy normalise） -------------------------

  /**
   * latestSnapshot：日粒度最新快照（經 normalise 後）
   *
   * 預期 normaliseSnapshot 輸入為 { date, snapshotRaw } 或類似結構，
   * 可視你現有實作微調。
   */
  get latestSnapshot() {
    if (this._derived.latestSnapshot !== undefined) {
      return this._derived.latestSnapshot;
    }
    if (!this.portfolioRaw) {
      this._derived.latestSnapshot = null;
      return null;
    }

    // 這裡假設 portfolioRaw 已經代表某一天的 snapshot；
    // 若你是存 history 陣列，就改成取最後一筆再 normalise。
    const date = this.reportDate ?? this.portfolioRaw.date ?? null;
    this._derived.latestSnapshot = normaliseSnapshot(date, this.portfolioRaw);
    return this._derived.latestSnapshot;
  }

  /** 市價淨值 (net value by market price) */
  get netValueMarket() {
    return this.latestSnapshot?.netValueMarket ?? null;
  }

  /** 0050 股數 */
  get qty0050() {
    return this.latestSnapshot?.qty0050 ?? null;
  }

  /** 00675L 股數 */
  get qtyZ2() {
    return this.latestSnapshot?.qtyZ2 ?? null;
  }

  /** 總融資餘額 */
  get totalLoan() {
    return this.latestSnapshot?.totalLoan ?? null;
  }

  /// ----- AI 相關 getter -----------------------------------------------

  get macroAnalysis() {
    return this.ai?.macroAnalysis ?? null;
  }

  get actions() {
    return this.ai?.actions ?? [];
  }

  get weeklySummary() {
    return this.ai?.weeklySummary ?? null;
  }

  get monthlySummary() {
    return this.ai?.monthlySummary ?? null;
  }

  /// ----- API / 報告輸出 helper ----------------------------------------

  /**
   * 狀態 API payload（/api/status 用）
   * 注意：若你希望維持既有合約，可以讓這裡直接回 data/market/latest.json 結構。
   */
  toStatusPayload() {
    // 這裡示範保留原本 latest.json 結構：{ _meta, data }
    return {
      _meta: this.meta ?? this.macro?._meta ?? undefined,
      data: this.macro?.data ?? this.macro ?? {},
    };
  }

  /**
   * 報告完整物件（符合 REPORT_SCHEMA）
   */
  toReportObject() {
    const snapshotEncrypted =
      this.portfolioRaw != null
        ? encryptSnapshot(this.portfolioRaw)
        : undefined;

    return {
      id: this.reportDate ?? new Date().toISOString().slice(0, 10),
      date: this.reportDate ?? new Date().toISOString().slice(0, 10),
      marketState: this.macro,
      signals: this.signals,
      strategySnapshot: this.strategySnapshot,
      ai: this.ai,
      snapshot: snapshotEncrypted,
    };
  }
}

/// ====== Factory / Loader：建立 IlnState ================================

/**
 * 從「現有檔案」載入最新狀態。
 * - 適用場景：/api/status、Bot /status_debug
 * - 只做 IO，不重算 strategy / AI
 */
export async function loadStateFromLatestFiles() {
  // 1) 最新市場資料（data/market/latest.json）
  const latestMarket = await archiveManager.getLatestMarketData(); // { _meta, data } 或 null

  // 2) 最新報告（data/reports/*.json）
  const latestReport = await archiveManager.getLatestReport(); // 我們等一下會在 archiveManager 裡加上這個方法
  if (!latestMarket && !latestReport) {
    return null;
  }

  // 3) snapshot 解密
  let portfolioRaw = null;
  if (latestReport?.snapshot) {
    portfolioRaw = decryptSnapshot(latestReport.snapshot);
  }

  return new IlnState({
    macro: latestReport?.marketState ?? {
      _meta: latestMarket?._meta,
      data: latestMarket?.data,
    },
    portfolioRaw,
    signals: latestReport?.signals ?? {},
    strategySnapshot: latestReport?.strategySnapshot ?? {},
    ai: latestReport?.ai ?? {},
    reportDate: latestReport?.date ?? null,
    meta: latestMarket?._meta ?? latestReport?._meta ?? null,
  });
}

/**
 * 從「指定日期的報告檔」載入 IlnState。
 * - 適用場景：/api/report/:date、Bot /daily YYYY-MM-DD
 */
export async function loadStateFromReport(reportDate) {
  const report = await archiveManager.getReportByDate(reportDate);
  if (!report) {
    return null;
  }

  let portfolioRaw = null;
  if (report.snapshot) {
    portfolioRaw = decryptSnapshot(report.snapshot);
  }

  return new IlnState({
    macro: report.marketState ?? {},
    portfolioRaw,
    signals: report.signals ?? {},
    strategySnapshot: report.strategySnapshot ?? {},
    ai: report.ai ?? {},
    reportDate: report.date ?? reportDate,
    meta: report._meta ?? null,
  });
}

/**
 * ⚠️ createStateFromTodayRun 目前先保留為 TODO，
 * 等之後我們把 dailyCheck 的主邏輯正式搬進來再實作。
 */
export async function createStateFromTodayRun() {
  throw new Error(
    "createStateFromTodayRun 尚未實作，請先透過 dailyCheck 現有流程產生報告，再用 loadStateFromLatestFiles/loadStateFromReport 載入。",
  );
}
