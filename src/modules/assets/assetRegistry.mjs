/**
 * assetRegistry.mjs
 * 資產註冊表與 Schema Mapper - 核心抽象層
 *
 * 功能：
 * 1. AssetRegistry: 統一管理所有資產定義 (單一來源)
 * 2. SchemaMapper: 新/舊 Schema 雙向轉換 (向後相容)
 * 3. 驗證工具: 確保資產配置正確性
 */

// 資產類型常數
export const ASSET_TYPES = {
  BASE: "base", // 底倉資產 (如 0050) - 只進不出、DCA、可質押
  LEVERAGED: "leveraged", // 槓桿資產 (如 00675L) - 可買賣、計息、去槓桿
  CASH: "cash", // 現金等價物
};

/**
 * AssetRegistry - 資產註冊表
 * 單一來源管理所有資產定義
 */
export class AssetRegistry {
  constructor() {
    this._assets = new Map();
  }

  /**
   * 註冊資產
   * @param {Object} config - 資產配置
   * @param {string} config.id - 資產唯一識別碼 (如 "0050", "00675L")
   * @param {string} config.symbol - 交易代碼 (如 "0050.TW")
   * @param {string} config.type - 資產類型 (ASSET_TYPES)
   * @param {number} config.leverage - 槓桿倍數 (1=無槓桿, 2=2倍槓桿)
   * @param {boolean} config.isDca - 是否為 DCA 標的
   * @param {boolean} config.sellable - 是否可賣出
   * @param {Array} [config.splitHistory] - 股票分割歷史
   */
  registerAsset(config) {
    validateAssetConfig(config);

    if (this._assets.has(config.id)) {
      throw new Error(`Asset already registered: ${config.id}`);
    }

    const asset = {
      id: config.id,
      symbol: config.symbol,
      type: config.type,
      leverage: config.leverage ?? 1,
      isDca: config.isDca ?? false,
      sellable: config.sellable ?? false,
      splitHistory: config.splitHistory ?? [],
      createdAt: new Date().toISOString(),
    };

    this._assets.set(config.id, asset);
    return asset;
  }

  /**
   * 取得資產定義
   * @param {string} id - 資產 ID
   * @returns {Object|undefined}
   */
  getAsset(id) {
    return this._assets.get(id);
  }

  /**
   * 取得所有資產
   * @returns {Array}
   */
  getAllAssets() {
    return Array.from(this._assets.values());
  }

  /**
   * 依類型取得資產
   * @param {string} type - 資產類型
   * @returns {Array}
   */
  getAssetsByType(type) {
    return this.getAllAssets().filter((a) => a.type === type);
  }

  /**
   * 取得可 DCA 的資產
   * @returns {Array}
   */
  getDcaAssets() {
    return this.getAllAssets().filter((a) => a.isDca === true);
  }

  /**
   * 取得可賣出的資產
   * @returns {Array}
   */
  getSellableAssets() {
    return this.getAllAssets().filter((a) => a.sellable === true);
  }

  /**
   * 取得可質押的資產 (通常為底倉)
   * @returns {Array}
   */
  getPledgeableAssets() {
    return this.getAllAssets().filter((a) => a.type === ASSET_TYPES.BASE);
  }

  /**
   * 取得槓桿資產
   * @returns {Array}
   */
  getLeveragedAssets() {
    return this.getAllAssets().filter((a) => a.type === ASSET_TYPES.LEVERAGED);
  }

  /**
   * 檢查資產是否存在
   * @param {string} id
   * @returns {boolean}
   */
  hasAsset(id) {
    return this._assets.has(id);
  }

  /**
   * 移除資產 (測試用)
   * @param {string} id
   */
  removeAsset(id) {
    this._assets.delete(id);
  }

  /**
   * 清空註冊表 (測試用)
   */
  clear() {
    this._assets.clear();
  }
}

/**
 * SchemaMapper - Schema 雙向轉換器
 * 處理新舊格式之間的轉換，確保向後相容
 * 泛型化：根據 Registry 內容動態生成 legacy 欄位
 */
export class SchemaMapper {
  constructor(assetRegistry) {
    this.registry = assetRegistry;
  }

  // ==================== Portfolio 轉換 ====================

  /**
   * 新 Schema → 舊欄位格式 (向後相容)
   * 動態根據 Registry 中的資產生成 legacy 欄位
   * @param {Object} newPortfolio - 新格式 portfolio
   * @returns {Object} 舊格式 portfolio
   */
  toLegacyPortfolio(newPortfolio) {
    const assets = newPortfolio?.assets || {};
    const legacy = {
      cash: newPortfolio?.cash ?? 0,
      totalLoan: newPortfolio?.totalLoan ?? 0,
    };

    // 動態生成 legacy 欄位：根據 registry 中的資產
    for (const asset of this.registry.getAllAssets()) {
      const assetData = assets[asset.id] || {};
      const fieldName = this._getLegacyFieldName(asset);
      legacy[`qty${fieldName}`] = assetData.qty ?? 0;
      legacy[`avgCost${fieldName}`] = assetData.avgCost ?? null;
    }

    return legacy;
  }

  /**
   * 舊欄位格式 → 新 Schema
   * @param {Object} legacyPortfolio - 舊格式 portfolio
   * @returns {Object} 新格式 portfolio
   */
  fromLegacyPortfolio(legacyPortfolio) {
    const assets = {};

    for (const asset of this.registry.getAllAssets()) {
      const fieldName = this._getLegacyFieldName(asset);
      assets[asset.id] = {
        qty: legacyPortfolio?.[`qty${fieldName}`] ?? 0,
        avgCost: legacyPortfolio?.[`avgCost${fieldName}`] ?? null,
      };
    }

    return {
      assets,
      cash: legacyPortfolio?.cash ?? 0,
      totalLoan: legacyPortfolio?.totalLoan ?? 0,
    };
  }

  // ==================== MarketData 轉換 ====================

  /**
   * 新格式 → 舊格式 (向後相容)
   * @param {Object} newMarketData
   * @returns {Object}
   */
  toLegacyMarketData(newMarketData) {
    const prices = newMarketData?.prices || {};
    const legacy = {
      vix: newMarketData?.vix ?? null,
      pb: newMarketData?.pb ?? null,
      currentRate: newMarketData?.currentRate ?? null,
      cnnScore: newMarketData?.cnnScore ?? null,
      maintenanceRatio: newMarketData?.maintenanceRatio ?? null,
    };

    // 動態生成價格欄位
    for (const asset of this.registry.getAllAssets()) {
      const fieldName = this._getLegacyPriceFieldName(asset);
      legacy[`price${fieldName}`] = prices[asset.id] ?? 0;
    }

    // 向後相容：priceZ2 為 00675L 別名
    if (prices["00675L"] !== undefined) {
      legacy.priceZ2 = prices["00675L"];
    }

    return legacy;
  }

  /**
   * 舊格式 → 新格式
   * @param {Object} legacyMarketData
   * @returns {Object}
   */
  fromLegacyMarketData(legacyMarketData) {
    const prices = {};

    for (const asset of this.registry.getAllAssets()) {
      const fieldName = this._getLegacyPriceFieldName(asset);
      prices[asset.id] = legacyMarketData?.[`price${fieldName}`] ?? 0;
    }

    // 支援 priceZ2 別名 (00675L)
    if (legacyMarketData?.priceZ2 !== undefined) {
      prices["00675L"] = legacyMarketData.priceZ2;
    }

    return {
      prices,
      vix: legacyMarketData?.vix ?? null,
      pb: legacyMarketData?.pb ?? null,
      currentRate: legacyMarketData?.currentRate ?? null,
      cnnScore: legacyMarketData?.cnnScore ?? null,
      maintenanceRatio: legacyMarketData?.maintenanceRatio ?? null,
    };
  }

  // ==================== SignalContext 轉換 ====================

  /**
   * 新格式 SignalContext → 舊格式 (給策略引擎用)
   * @param {Object} newCtx
   * @returns {Object}
   */
  toLegacySignalContext(newCtx) {
    const prices = newCtx?.marketData?.prices || {};
    const portfolio = newCtx?.portfolio || {};
    const assets = portfolio.assets || {};

    const legacy = {
      // 價格
      basePrice: newCtx?.basePrice ?? 0,
      vixArr: newCtx?.vixArr ?? [],
      vixData: newCtx?.vixData ?? {},
      ma60SlopeArr: newCtx?.ma60SlopeArr ?? [],
      closeArr: newCtx?.closeArr ?? [],
      pbRecords: newCtx?.pbRecords ?? [],
      pbRecordsObjects: newCtx?.pbRecordsObjects ?? [],
      macroData: newCtx?.macroData ?? {},
      macroMarketDirection: newCtx?.macroMarketDirection ?? "NEUTRAL",
      valuationGuardState: newCtx?.valuationGuardState ?? {},
      cooldownStatus: newCtx?.cooldownStatus ?? {},
      history0050: newCtx?.history0050 ?? [],
      historyZ2: newCtx?.historyZ2 ?? [],
      institutionalNet: newCtx?.institutionalNet ?? 0,
      institutionalHistory: newCtx?.institutionalHistory ?? [],
    };

    // 動態生成價格欄位 (使用價格欄位名稱)
    for (const asset of this.registry.getAllAssets()) {
      const fieldName = this._getLegacyPriceFieldName(asset);
      legacy[`price${fieldName}`] = prices[asset.id] ?? 0;
    }

    // currentPrice = 00675L 價格 (向後相容)
    legacy.currentPrice = prices["00675L"] ?? 0;

    // Portfolio (使用 portfolio 欄位名稱)
    legacy.portfolio = {
      cash: portfolio.cash ?? 0,
      totalLoan: portfolio.totalLoan ?? 0,
      lastBuyDate: portfolio.lastBuyDate ?? null,
    };
    for (const asset of this.registry.getAllAssets()) {
      const fieldName = this._getLegacyFieldName(asset);
      legacy.portfolio[`qty${fieldName}`] = assets[asset.id]?.qty ?? 0;
      legacy.portfolio[`avgCost${fieldName}`] =
        assets[asset.id]?.avgCost ?? null;
    }

    return legacy;
  }

  /**
   * 舊格式 SignalContext → 新格式
   * @param {Object} legacyCtx
   * @returns {Object}
   */
  fromLegacySignalContext(legacyCtx) {
    const marketData = this.fromLegacyMarketData({
      price0050: legacyCtx.price0050,
      price00675L: legacyCtx.price00675L,
      vix: legacyCtx.vixData?.value,
      pb: legacyCtx.macroData?.rawValuation?.pb,
      currentRate: legacyCtx.currentRate,
      cnnScore: legacyCtx.cnnScore,
      maintenanceRatio: legacyCtx.maintenanceRatio,
    });

    const portfolio = this.fromLegacyPortfolio({
      qty0050: legacyCtx.portfolio?.qty0050,
      qtyZ2: legacyCtx.portfolio?.qtyZ2,
      cash: legacyCtx.portfolio?.cash,
      totalLoan: legacyCtx.portfolio?.totalLoan,
      avgCost0050: legacyCtx.portfolio?.avgCost0050,
      avgCostZ2: legacyCtx.portfolio?.avgCostZ2,
      lastBuyDate: legacyCtx.portfolio?.lastBuyDate,
    });

    return {
      marketData,
      portfolio,
      basePrice: legacyCtx.basePrice,
      vixArr: legacyCtx.vixArr,
      vixData: legacyCtx.vixData,
      ma60SlopeArr: legacyCtx.ma60SlopeArr,
      closeArr: legacyCtx.closeArr,
      pbRecords: legacyCtx.pbRecords,
      pbRecordsObjects: legacyCtx.pbRecordsObjects,
      macroData: legacyCtx.macroData,
      macroMarketDirection: legacyCtx.macroMarketDirection,
      valuationGuardState: legacyCtx.valuationGuardState,
      cooldownStatus: legacyCtx.cooldownStatus,
      history0050: legacyCtx.history0050,
      historyZ2: legacyCtx.historyZ2,
      institutionalNet: legacyCtx.institutionalNet,
      institutionalHistory: legacyCtx.institutionalHistory,
    };
  }

  // ==================== Helper Methods ====================

  /**
   * 取得資產的 legacy 欄位名稱 (用於 portfolio 欄位: qty, avgCost)
   * @param {Object} asset
   * @returns {string}
   */
  _getLegacyFieldName(asset) {
    // 0050 -> 0050
    // 00675L -> Z2 (特殊處理，向後相容 portfolio 欄位)
    // 其他資產直接用 id
    if (asset.id === "00675L") return "Z2";
    return asset.id;
  }

  /**
   * 取得資產的 legacy 價格欄位名稱 (用於 price 欄位)
   * @param {Object} asset
   * @returns {string}
   */
  _getLegacyPriceFieldName(asset) {
    // 價格欄位直接使用 asset id
    return asset.id;
  }
}

/**
 * 驗證資產配置
 * @param {Object} config
 * @throws {Error} 配置無效時拋出
 */
export function validateAssetConfig(config) {
  if (!config.id || typeof config.id !== "string") {
    throw new Error("Asset id is required and must be a string");
  }

  if (!config.symbol || typeof config.symbol !== "string") {
    throw new Error("Asset symbol is required and must be a string");
  }

  if (!Object.values(ASSET_TYPES).includes(config.type)) {
    throw new Error(
      `Invalid asset type: ${config.type}. Must be one of: ${Object.values(ASSET_TYPES).join(", ")}`,
    );
  }

  if (config.leverage !== undefined) {
    if (typeof config.leverage !== "number" || config.leverage <= 0) {
      throw new Error("Asset leverage must be a positive number");
    }
  }

  if (config.isDca !== undefined && typeof config.isDca !== "boolean") {
    throw new Error("Asset isDca must be a boolean");
  }

  if (config.sellable !== undefined && typeof config.sellable !== "boolean") {
    throw new Error("Asset sellable must be a boolean");
  }

  if (config.splitHistory !== undefined) {
    if (!Array.isArray(config.splitHistory)) {
      throw new Error("splitHistory must be an array");
    }
    for (const split of config.splitHistory) {
      if (!split.date || !split.ratio || typeof split.ratio !== "number") {
        throw new Error(
          "splitHistory items must have date (string) and ratio (number)",
        );
      }
    }
  }
}

/**
 * 建立預設資產註冊表 (包含 0050, 00675L)
 * @returns {AssetRegistry}
 */
export function createDefaultAssetRegistry() {
  const registry = new AssetRegistry();

  // 0050 - 底倉 ETF
  registry.registerAsset({
    id: "0050",
    symbol: "0050.TW",
    type: ASSET_TYPES.BASE,
    leverage: 1,
    isDca: true,
    sellable: false,
    splitHistory: [{ date: "2025-06-18", ratio: 4 }],
  });

  // 00675L - 2倍槓桿反向 ETF
  registry.registerAsset({
    id: "00675L",
    symbol: "00675L.TW",
    type: ASSET_TYPES.LEVERAGED,
    leverage: 2,
    isDca: false,
    sellable: true,
  });

  return registry;
}

/**
 * 全域預設註冊表實例 (單例模式)
 */
let _defaultRegistry = null;
export function getDefaultAssetRegistry() {
  if (!_defaultRegistry) {
    _defaultRegistry = createDefaultAssetRegistry();
  }
  return _defaultRegistry;
}

export default {
  AssetRegistry,
  SchemaMapper,
  ASSET_TYPES,
  validateAssetConfig,
  createDefaultAssetRegistry,
  getDefaultAssetRegistry,
};
