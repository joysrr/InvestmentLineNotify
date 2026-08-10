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
});
