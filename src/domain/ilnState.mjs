// src/domain/ilnState.mjs

/**
 * ILN Domain State / IlnState
 *
 * 統一管理 InvestmentLineNotify 的「某一日狀態」：
 * - macro：外部總經 / 市場資料（通常對應 data/market/latest.json 或 report.marketState）
 * - portfolioRaw：原始持股 / 快照物件（尚未 normalise 的 decrypted snapshot）
 * - signals：策略與風控計算結果（report.signals）
 * - strategySnapshot：策略設定完整快照（report.strategySnapshot）
 * - ai：AI pipeline 輸出（report.ai）
 *
 * 對外提供：
 * - getter：估值 / 槓桿 / 維持率 / snapshot 衍生欄位
 * - toStatusPayload()：/api/status 回傳 payload
 * - toReportObject()：標準報告主體（給 dailyCheck 存檔用）
 * - loadStateFromLatestFiles()：從現有檔案載入「最新狀態」
 * - loadStateFromReport(date)：從指定日期報告載入狀態
 */

import fs from "fs/promises";
import path from "path";

import { archiveManager } from "../modules/data/archiveManager.mjs"; // getLatestMarketData / listArchiveDates
import { encryptSnapshot, decryptSnapshot } from "../utils/snapshotCrypto.mjs";
import { normaliseSnapshot } from "../api/utils/snapshotAggregator.mjs";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

export class IlnState {
  /**
   * @param {Object} args
   * @param {Object} args.macro            - 總經 / 市場 canonical state（通常對應 report.marketState 或 latest.json）
   * @param {Object|null} args.portfolioRaw - 原始快照 / 持股資料（解密後、尚未 normalise 的物件；可能為 null）
   * @param {Object} args.signals          - 策略與風控 signals 子樹（report.signals）
   * @param {Object} args.strategySnapshot - 策略設定完整快照（report.strategySnapshot）
   * @param {Object} args.ai               - AI pipeline 輸出（report.ai）
   * @param {string|null} args.reportDate  - 報告日期（YYYY-MM-DD）
   * @param {Object|null} args.meta        - 額外 meta，例如 latest.json 的 _meta
   * @param {Object|null} args.rawReport   - 原始報告 JSON（若是從報告檔載入）
   */
  constructor({
    macro,
    portfolioRaw,
    signals,
    strategySnapshot,
    ai,
    reportDate = null,
    meta = null,
    rawReport = null,
  }) {
    this.macro = macro ?? {};
    this.portfolioRaw = portfolioRaw ?? null;
    this.signals = signals ?? {};
    this.strategySnapshot = strategySnapshot ?? {};
    this.ai = ai ?? {};
    this.reportDate = reportDate;
    this.meta = meta ?? null;

    // 原始報告（若有從報告檔載入，方便 /api/report/:date 直接輸出）
    this.rawReport = rawReport ?? null;

    // 內部 lazy cache
    this._derived = Object.create(null);
  }

  // ----- 宏觀 / 市場資料 getter ------------------------------------------------

  /** 台股估值 (PE) */
  get valuationPe() {
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

  // ----- Signals 相關 getter ---------------------------------------------------

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

  /** 總分 */
  get overallScore() {
    return this.signals?.overallScore ?? null;
  }

  /** 多空 bias：'BULL' | 'BEAR' | 'NEUTRAL' 等 */
  get bias() {
    return this.signals?.bias ?? null;
  }

  // ----- 投組快照 getter（lazy normalise） ------------------------------------

  /**
   * latestSnapshot：日粒度最新快照（經 normalise 後）
   */
  get latestSnapshot() {
    if (this._derived.latestSnapshot !== undefined) {
      return this._derived.latestSnapshot;
    }
    if (!this.portfolioRaw) {
      this._derived.latestSnapshot = null;
      return null;
    }

    const date = this.reportDate ?? this.portfolioRaw.date ?? null;
    this._derived.latestSnapshot = normaliseSnapshot(date, this.portfolioRaw);
    return this._derived.latestSnapshot;
  }

  /** 市價淨值 (net value by market price) */
  get netValueMarket() {
    return this.latestSnapshot?.netValueMarket ?? null;
  }

  /** 成本淨值 (net value by cost basis) */
  get netValueCost() {
    return this.latestSnapshot?.netValueCost ?? null;
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

  // ----- AI 相關 getter -------------------------------------------------------

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

  // ----- API / 報告輸出 helper ------------------------------------------------

  /**
   * 狀態 API payload（/api/status 用）
   * - 為了維持現有合約，直接回 { _meta, data } 結構。
   */
  toStatusPayload() {
    return {
      _meta: this.meta ?? this.macro?._meta ?? undefined,
      data: this.macro?.data ?? this.macro ?? {},
    };
  }

  /**
   * 報告完整物件主體（不含 quote / news 等附加欄位）
   * - 給 dailyCheck 保存報告檔時用。
   */
  toReportObject() {
    const snapshotEncrypted =
      this.portfolioRaw != null
        ? encryptSnapshot(this.portfolioRaw)
        : undefined;

    const dateStr = this.reportDate ?? new Date().toISOString().slice(0, 10);

    return {
      id: dateStr,
      date: dateStr,
      marketState: this.macro,
      signals: this.signals,
      strategySnapshot: this.strategySnapshot,
      ai: this.ai,
      snapshot: snapshotEncrypted,
    };
  }
}

// ====== Loader：從現有檔案建立 IlnState ====================================

/**
 * 從「現有檔案」載入最新狀態。
 * - 優先使用最新報告檔；若找不到報告，但有 latest.json，則只用 latest.json。
 * - 適用場景：/api/status、Bot /status_debug。
 * @returns {Promise<IlnState|null>}
 */
export async function loadStateFromLatestFiles() {
  const latestMarket = await archiveManager.getLatestMarketData();

  let latestReport = null;

  try {
    const dates = await archiveManager.listArchiveDates();
    if (dates.length > 0) {
      const latestDate = dates[0];
      const filePath = path.join(REPORTS_DIR, `${latestDate}.json`);
      const content = await fs.readFile(filePath, "utf-8");
      latestReport = JSON.parse(content);
      if (!latestReport.date) {
        latestReport.date = latestDate;
      }
    }
  } catch {
    latestReport = null;
  }

  if (!latestMarket && !latestReport) {
    return null;
  }

  let portfolioRaw = null;
  if (latestReport?.snapshot) {
    portfolioRaw = decryptSnapshot(latestReport.snapshot);
  }

  return new IlnState({
    macro:
      latestReport?.marketState ??
      (latestMarket
        ? { _meta: latestMarket._meta, data: latestMarket.data }
        : {}),
    portfolioRaw,
    signals: latestReport?.signals ?? {},
    strategySnapshot: latestReport?.strategySnapshot ?? {},
    ai: latestReport?.ai ?? {},
    reportDate: latestReport?.date ?? null,
    meta: latestMarket?._meta ?? latestReport?._meta ?? null,
    rawReport: latestReport ?? null,
  });
}

/**
 * 從「指定日期的報告檔」載入 IlnState。
 * - 適用場景：/api/report/:date、Bot /daily YYYY-MM-DD。
 * @param {string} reportDate - YYYY-MM-DD
 * @returns {Promise<IlnState|null>}
 */
export async function loadStateFromReport(reportDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    throw new Error(`Invalid reportDate: ${reportDate}`);
  }

  try {
    const filePath = path.join(REPORTS_DIR, `${reportDate}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    const report = JSON.parse(content);

    if (!report.date) {
      report.date = reportDate;
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
      rawReport: report,
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}
