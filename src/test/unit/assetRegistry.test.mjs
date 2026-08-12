/**
 * assetRegistry.test.mjs
 * 資產註冊表與 Schema Mapper 單元測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AssetRegistry,
  SchemaMapper,
  ASSET_TYPES,
  validateAssetConfig,
} from "../../modules/assets/assetRegistry.mjs";

describe("AssetRegistry", () => {
  let registry;

  beforeEach(() => {
    registry = new AssetRegistry();
  });

  describe("registerAsset()", () => {
    it("應正常註冊基本資產", () => {
      const config = {
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
        splitHistory: [{ date: "2025-06-18", ratio: 4 }],
      };

      registry.registerAsset(config);

      const asset = registry.getAsset("0050");
      expect(asset).toBeDefined();
      expect(asset.id).toBe("0050");
      expect(asset.symbol).toBe("0050.TW");
      expect(asset.type).toBe(ASSET_TYPES.BASE);
      expect(asset.leverage).toBe(1);
      expect(asset.isDca).toBe(true);
      expect(asset.sellable).toBe(false);
    });

    it("應正常註冊槓桿資產", () => {
      const config = {
        id: "00675L",
        symbol: "00675L.TW",
        type: ASSET_TYPES.LEVERAGED,
        leverage: 2,
        isDca: false,
        sellable: true,
      };

      registry.registerAsset(config);

      const asset = registry.getAsset("00675L");
      expect(asset.leverage).toBe(2);
      expect(asset.isDca).toBe(false);
      expect(asset.sellable).toBe(true);
    });

    it("重複註冊應拋出錯誤", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
      });

      expect(() => {
        registry.registerAsset({
          id: "0050",
          symbol: "0050.TW",
          type: ASSET_TYPES.BASE,
        });
      }).toThrow("Asset already registered");
    });

    it("缺少必要欄位應拋出錯誤", () => {
      expect(() => {
        registry.registerAsset({ symbol: "0050.TW" }); // 缺 id
      }).toThrow("Asset id is required");

      expect(() => {
        registry.registerAsset({ id: "0050" }); // 缺 symbol
      }).toThrow("Asset symbol is required");
    });

    it("無效 type 應拋出錯誤", () => {
      expect(() => {
        registry.registerAsset({
          id: "0050",
          symbol: "0050.TW",
          type: "INVALID",
        });
      }).toThrow("Invalid asset type");
    });

    it("槓桿倍數必須為正數", () => {
      expect(() => {
        registry.registerAsset({
          id: "0050",
          symbol: "0050.TW",
          type: ASSET_TYPES.BASE,
          leverage: -1,
        });
      }).toThrow("Asset leverage must be a positive number");
    });

    it("註冊時應設定預設值", () => {
      registry.registerAsset({
        id: "TEST",
        symbol: "TEST.TW",
        type: ASSET_TYPES.BASE,
      });

      const asset = registry.getAsset("TEST");
      expect(asset.leverage).toBe(1);
      expect(asset.isDca).toBe(false);
      expect(asset.sellable).toBe(false);
      expect(asset.splitHistory).toEqual([]);
      expect(asset.createdAt).toBeDefined();
    });
  });

  describe("getAsset()", () => {
    it("查詢不存在資產應回傳 undefined", () => {
      const asset = registry.getAsset("NONEXISTENT");
      expect(asset).toBeUndefined();
    });
  });

  describe("getAllAssets()", () => {
    it("應回傳所有已註冊資產", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
      });
      registry.registerAsset({
        id: "00675L",
        symbol: "00675L.TW",
        type: ASSET_TYPES.LEVERAGED,
        leverage: 2,
        isDca: false,
        sellable: true,
      });

      const assets = registry.getAllAssets();
      expect(assets).toHaveLength(2);
      expect(assets.map((a) => a.id)).toContain("0050");
      expect(assets.map((a) => a.id)).toContain("00675L");
    });

    it("空註冊表應回傳空陣列", () => {
      expect(registry.getAllAssets()).toEqual([]);
    });
  });

  describe("getAssetsByType()", () => {
    it("應按類型過濾資產", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
      });
      registry.registerAsset({
        id: "00675L",
        symbol: "00675L.TW",
        type: ASSET_TYPES.LEVERAGED,
        leverage: 2,
        isDca: false,
        sellable: true,
      });
      registry.registerAsset({
        id: "0056",
        symbol: "0056.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
      });

      const baseAssets = registry.getAssetsByType(ASSET_TYPES.BASE);
      expect(baseAssets).toHaveLength(2);
      expect(baseAssets.every((a) => a.type === ASSET_TYPES.BASE)).toBe(true);

      const leveragedAssets = registry.getAssetsByType(ASSET_TYPES.LEVERAGED);
      expect(leveragedAssets).toHaveLength(1);
      expect(leveragedAssets[0].id).toBe("00675L");
    });

    it("不存在的類型應回傳空陣列", () => {
      expect(registry.getAssetsByType("NONEXISTENT")).toEqual([]);
    });
  });

  describe("getDcaAssets()", () => {
    it("應只回傳可 DCA 的資產", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
      });
      registry.registerAsset({
        id: "00675L",
        symbol: "00675L.TW",
        type: ASSET_TYPES.LEVERAGED,
        leverage: 2,
        isDca: false,
        sellable: true,
      });

      const dcaAssets = registry.getDcaAssets();
      expect(dcaAssets).toHaveLength(1);
      expect(dcaAssets[0].id).toBe("0050");
    });
  });

  describe("getSellableAssets()", () => {
    it("應只回傳可賣出的資產", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
      });
      registry.registerAsset({
        id: "00675L",
        symbol: "00675L.TW",
        type: ASSET_TYPES.LEVERAGED,
        leverage: 2,
        isDca: false,
        sellable: true,
      });

      const sellableAssets = registry.getSellableAssets();
      expect(sellableAssets).toHaveLength(1);
      expect(sellableAssets[0].id).toBe("00675L");
    });
  });

  describe("getPledgeableAssets()", () => {
    it("應只回傳可質押的資產 (BASE 類型)", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
      });
      registry.registerAsset({
        id: "00675L",
        symbol: "00675L.TW",
        type: ASSET_TYPES.LEVERAGED,
        leverage: 2,
        isDca: false,
        sellable: true,
      });
      registry.registerAsset({
        id: "CASH",
        symbol: "CASH",
        type: ASSET_TYPES.CASH,
        leverage: 1,
        isDca: false,
        sellable: false,
      });

      const pledgeableAssets = registry.getPledgeableAssets();
      expect(pledgeableAssets).toHaveLength(1);
      expect(pledgeableAssets[0].id).toBe("0050");
      expect(pledgeableAssets[0].type).toBe(ASSET_TYPES.BASE);
    });
  });

  describe("getLeveragedAssets()", () => {
    it("應只回傳槓桿資產 (LEVERAGED 類型)", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
      });
      registry.registerAsset({
        id: "00675L",
        symbol: "00675L.TW",
        type: ASSET_TYPES.LEVERAGED,
        leverage: 2,
        isDca: false,
        sellable: true,
      });

      const leveragedAssets = registry.getLeveragedAssets();
      expect(leveragedAssets).toHaveLength(1);
      expect(leveragedAssets[0].id).toBe("00675L");
      expect(leveragedAssets[0].type).toBe(ASSET_TYPES.LEVERAGED);
    });
  });

  describe("hasAsset()", () => {
    it("存在的資產應回傳 true", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
      });
      expect(registry.hasAsset("0050")).toBe(true);
    });

    it("不存在的資產應回傳 false", () => {
      expect(registry.hasAsset("NONEXISTENT")).toBe(false);
    });
  });

  describe("removeAsset()", () => {
    it("應能移除已註冊資產", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
      });
      expect(registry.hasAsset("0050")).toBe(true);

      registry.removeAsset("0050");
      expect(registry.hasAsset("0050")).toBe(false);
      expect(registry.getAsset("0050")).toBeUndefined();
    });

    it("移除不存在資產不應拋錯", () => {
      expect(() => registry.removeAsset("NONEXISTENT")).not.toThrow();
    });
  });

  describe("clear()", () => {
    it("應清空所有資產", () => {
      registry.registerAsset({
        id: "0050",
        symbol: "0050.TW",
        type: ASSET_TYPES.BASE,
      });
      registry.registerAsset({
        id: "00675L",
        symbol: "00675L.TW",
        type: ASSET_TYPES.LEVERAGED,
      });

      registry.clear();
      expect(registry.getAllAssets()).toEqual([]);
      expect(registry.hasAsset("0050")).toBe(false);
    });
  });
});

describe("SchemaMapper", () => {
  let mapper;
  let registry;

  beforeEach(() => {
    registry = new AssetRegistry();
    registry.registerAsset({
      id: "0050",
      symbol: "0050.TW",
      type: ASSET_TYPES.BASE,
      leverage: 1,
      isDca: true,
      sellable: false,
    });
    registry.registerAsset({
      id: "00675L",
      symbol: "00675L.TW",
      type: ASSET_TYPES.LEVERAGED,
      leverage: 2,
      isDca: false,
      sellable: true,
    });

    mapper = new SchemaMapper(registry);
  });

  describe("toLegacyPortfolio()", () => {
    it("應將新 Schema 轉換為舊欄位格式", () => {
      const newPortfolio = {
        assets: {
          "0050": { qty: 1000, avgCost: 150 },
          "00675L": { qty: 500, avgCost: 300 },
        },
        cash: 50000,
        totalLoan: 100000,
      };

      const legacy = mapper.toLegacyPortfolio(newPortfolio);

      expect(legacy.qty0050).toBe(1000);
      expect(legacy.qtyZ2).toBe(500);
      expect(legacy.cash).toBe(50000);
      expect(legacy.totalLoan).toBe(100000);
    });

    it("缺少資產時應使用預設值 0", () => {
      const newPortfolio = {
        assets: { "0050": { qty: 1000 } },
        cash: 0,
        totalLoan: 0,
      };

      const legacy = mapper.toLegacyPortfolio(newPortfolio);

      expect(legacy.qty0050).toBe(1000);
      expect(legacy.qtyZ2).toBe(0);
    });
  });

  describe("fromLegacyPortfolio()", () => {
    it("應將舊欄位格式轉換為新 Schema", () => {
      const legacyPortfolio = {
        qty0050: 1000,
        qtyZ2: 500,
        cash: 50000,
        totalLoan: 100000,
      };

      const newPortfolio = mapper.fromLegacyPortfolio(legacyPortfolio);

      expect(newPortfolio.assets["0050"].qty).toBe(1000);
      expect(newPortfolio.assets["00675L"].qty).toBe(500);
      expect(newPortfolio.cash).toBe(50000);
      expect(newPortfolio.totalLoan).toBe(100000);
    });
  });

  describe("toLegacyMarketData()", () => {
    it("應將新價格格式轉換為舊欄位", () => {
      const newMarketData = {
        prices: { "0050": 150.5, "00675L": 301.0 },
        vix: 20,
        pb: 2.5,
      };

      const legacy = mapper.toLegacyMarketData(newMarketData);

      expect(legacy.price0050).toBe(150.5);
      expect(legacy.price00675L).toBe(301.0);
      expect(legacy.priceZ2).toBe(301.0); // 向後相容
      expect(legacy.vix).toBe(20);
      expect(legacy.pb).toBe(2.5);
    });
  });

  describe("fromLegacyMarketData()", () => {
    it("應將舊價格格式轉換為新 Schema", () => {
      const legacyMarketData = {
        price0050: 150.5,
        price00675L: 301.0,
        vix: 20,
        pb: 2.5,
      };

      const newMarketData = mapper.fromLegacyMarketData(legacyMarketData);

      expect(newMarketData.prices["0050"]).toBe(150.5);
      expect(newMarketData.prices["00675L"]).toBe(301.0);
      expect(newMarketData.vix).toBe(20);
      expect(newMarketData.pb).toBe(2.5);
    });

    it("應支援 priceZ2 別名", () => {
      const legacyMarketData = {
        price0050: 150.5,
        priceZ2: 301.0, // 使用 priceZ2 而非 price00675L
        vix: 20,
      };

      const newMarketData = mapper.fromLegacyMarketData(legacyMarketData);

      expect(newMarketData.prices["00675L"]).toBe(301.0);
    });
  });

  describe("toLegacySignalContext()", () => {
    it("應將新格式 SignalContext 轉換為舊格式", () => {
      const newCtx = {
        marketData: { prices: { "0050": 150, "00675L": 300 } },
        portfolio: {
          assets: { "0050": { qty: 1000 }, "00675L": { qty: 500 } },
          cash: 50000,
          totalLoan: 100000,
        },
        basePrice: 250,
        vixArr: [20, 22],
        vixData: { value: 20 },
        ma60SlopeArr: [0.1],
        closeArr: [150, 151],
        pbRecords: [],
        pbRecordsObjects: [],
        macroData: {},
        macroMarketDirection: "BULL",
        valuationGuardState: {},
        cooldownStatus: { inCooldown: false },
        history0050: [],
        historyZ2: [],
        institutionalNet: 0,
        institutionalHistory: [],
      };

      const legacy = mapper.toLegacySignalContext(newCtx);

      expect(legacy.price0050).toBe(150);
      expect(legacy.price00675L).toBe(300);
      expect(legacy.currentPrice).toBe(300);
      expect(legacy.portfolio.qty0050).toBe(1000);
      expect(legacy.portfolio.qtyZ2).toBe(500);
      expect(legacy.basePrice).toBe(250);
    });
  });

  describe("fromLegacySignalContext()", () => {
    it("應將舊格式 SignalContext 轉換為新格式", () => {
      const legacyCtx = {
        price0050: 150,
        price00675L: 300,
        vixData: { value: 20 },
        macroData: { rawValuation: { pb: 2.5 } },
        portfolio: {
          qty0050: 1000,
          qtyZ2: 500,
          cash: 50000,
          totalLoan: 100000,
          avgCost0050: 100,
          avgCostZ2: 200,
          lastBuyDate: "2024-01-01",
        },
        basePrice: 250,
        vixArr: [20],
        ma60SlopeArr: [0.1],
        closeArr: [150],
        pbRecords: [],
        pbRecordsObjects: [],
        macroMarketDirection: "BULL",
        valuationGuardState: {},
        cooldownStatus: { inCooldown: false },
        history0050: [],
        historyZ2: [],
        institutionalNet: 0,
        institutionalHistory: [],
      };

      const newCtx = mapper.fromLegacySignalContext(legacyCtx);

      expect(newCtx.marketData.prices["0050"]).toBe(150);
      expect(newCtx.marketData.prices["00675L"]).toBe(300);
      expect(newCtx.portfolio.assets["0050"].qty).toBe(1000);
      expect(newCtx.basePrice).toBe(250);
    });
  });

  describe("雙向轉換一致性", () => {
    it("portfolio 雙向轉換應保持資料完整", () => {
      const original = {
        assets: { "0050": { qty: 1000 }, "00675L": { qty: 500 } },
        cash: 50000,
        totalLoan: 100000,
      };

      const legacy = mapper.toLegacyPortfolio(original);
      const restored = mapper.fromLegacyPortfolio(legacy);

      expect(restored.assets["0050"].qty).toBe(original.assets["0050"].qty);
      expect(restored.assets["00675L"].qty).toBe(original.assets["00675L"].qty);
      expect(restored.cash).toBe(original.cash);
      expect(restored.totalLoan).toBe(original.totalLoan);
    });

    it("marketData 雙向轉換應保持資料完整", () => {
      const original = {
        prices: { "0050": 150.5, "00675L": 301.0 },
        vix: 20,
        pb: 2.5,
      };

      const legacy = mapper.toLegacyMarketData(original);
      const restored = mapper.fromLegacyMarketData(legacy);

      expect(restored.prices["0050"]).toBe(original.prices["0050"]);
      expect(restored.prices["00675L"]).toBe(original.prices["00675L"]);
    });
  });
});

describe("validateAssetConfig()", () => {
  it("有效配置應通過驗證", () => {
    const config = {
      id: "0050",
      symbol: "0050.TW",
      type: ASSET_TYPES.BASE,
      leverage: 1,
    };
    expect(() => validateAssetConfig(config)).not.toThrow();
  });

  it("缺少 id 應拋出錯誤", () => {
    const config = { symbol: "0050.TW", type: ASSET_TYPES.BASE };
    expect(() => validateAssetConfig(config)).toThrow("id is required");
  });

  it("缺少 symbol 應拋出錯誤", () => {
    const config = { id: "0050", type: ASSET_TYPES.BASE };
    expect(() => validateAssetConfig(config)).toThrow("symbol is required");
  });

  it("無效 type 應拋出錯誤", () => {
    const config = { id: "0050", symbol: "0050.TW", type: "INVALID" };
    expect(() => validateAssetConfig(config)).toThrow("Invalid asset type");
  });

  it("槓桿倍數必須為正數", () => {
    const config = {
      id: "0050",
      symbol: "0050.TW",
      type: ASSET_TYPES.BASE,
      leverage: -1,
    };
    expect(() => validateAssetConfig(config)).toThrow(
      "Asset leverage must be a positive number",
    );
  });

  it("isDca 必須是布林值", () => {
    const config = {
      id: "0050",
      symbol: "0050.TW",
      type: ASSET_TYPES.BASE,
      isDca: "true",
    };
    expect(() => validateAssetConfig(config)).toThrow(
      "isDca must be a boolean",
    );
  });

  it("sellable 必須是布林值", () => {
    const config = {
      id: "0050",
      symbol: "0050.TW",
      type: ASSET_TYPES.BASE,
      sellable: "false",
    };
    expect(() => validateAssetConfig(config)).toThrow(
      "sellable must be a boolean",
    );
  });

  it("splitHistory 必須是陣列", () => {
    const config = {
      id: "0050",
      symbol: "0050.TW",
      type: ASSET_TYPES.BASE,
      splitHistory: "invalid",
    };
    expect(() => validateAssetConfig(config)).toThrow(
      "splitHistory must be an array",
    );
  });

  it("splitHistory 項目必須有 date 和 ratio", () => {
    const config = {
      id: "0050",
      symbol: "0050.TW",
      type: ASSET_TYPES.BASE,
      splitHistory: [{ date: "2025-01-01" }], // 缺 ratio
    };
    expect(() => validateAssetConfig(config)).toThrow(
      "splitHistory items must have date (string) and ratio (number)",
    );
  });

  it("ratio 必須是數字", () => {
    const config = {
      id: "0050",
      symbol: "0050.TW",
      type: ASSET_TYPES.BASE,
      splitHistory: [{ date: "2025-01-01", ratio: "4" }], // ratio 是字串
    };
    expect(() => validateAssetConfig(config)).toThrow(
      "splitHistory items must have date (string) and ratio (number)",
    );
  });
});
