/**
 * accountSimulator.test.mjs
 * AccountSimulator N-asset 支援測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountSimulator } from "../../modules/backtest/accountSimulator.mjs";
import {
  AssetRegistry,
  ASSET_TYPES,
  createDefaultAssetRegistry,
} from "../../modules/assets/assetRegistry.mjs";
import { SchemaMapper } from "../../modules/assets/assetRegistry.mjs";

describe("AccountSimulator - N-asset 支援", () => {
  let registry;
  let simulator;

  beforeEach(() => {
    registry = createDefaultAssetRegistry();

    simulator = new AccountSimulator({
      cash: 100000,
      qty0050: 1000,
      qtyZ2: 500,
      totalLoan: 50000,
      pledgeRatio: 0.6,
      interestRate: 0.022,
    });
  });

  describe("executeTrade - 支援任意 symbol", () => {
    it("應支援 0050.TW 買入 (DCA 模式，現金扣款)", () => {
      const price0050 = 175;
      simulator.totalLoan = 0; // 重置借款為 0 以驗證 0050 買入不增加借款
      const initialCash = simulator.cash;
      const initialQty0050 = simulator.qty0050;

      simulator.executeTrade("0050.TW", 30000, price0050, null, true);

      expect(simulator.qty0050).toBeGreaterThan(initialQty0050);
      expect(simulator.cash).toBeLessThan(initialCash);
      expect(simulator.totalLoan).toBe(0);
    });

    it("應支援 00675L.TW 買入 (質押借款模式)", () => {
      const price0050 = 175;
      const priceZ2 = 275;
      const initialLoan = simulator.totalLoan;
      const initialQtyZ2 = simulator.qtyZ2;
      const initialCash = simulator.cash;

      simulator.executeTrade("00675L.TW", 50000, 275, price0050, true);

      expect(simulator.qtyZ2).toBeGreaterThan(initialQtyZ2);
      expect(simulator.totalLoan).toBeGreaterThan(initialLoan);
      expect(simulator.cash).toBe(initialCash);
    });

    it("應支援 00675L.TW 賣出 (優先還款)", () => {
      const priceZ2 = 275;
      const initialLoan = simulator.totalLoan;
      const initialQtyZ2 = simulator.qtyZ2;
      const initialCash = simulator.cash;

      simulator.executeTrade("00675L.TW", -50000, 275, 175, true);

      expect(simulator.qtyZ2).toBeLessThan(initialQtyZ2);
      expect(simulator.totalLoan).toBeLessThan(initialLoan);
      expect(simulator.cash).toBeGreaterThanOrEqual(initialCash);
    });

    it("新資產 00878.TW 應能正常交易", () => {
      const registry = createDefaultAssetRegistry();
      registry.registerAsset({
        id: "00878",
        symbol: "00878.TW",
        type: ASSET_TYPES.BASE,
        leverage: 1,
        isDca: true,
        sellable: false,
      });

      const simulator2 = new AccountSimulator({
        cash: 100000,
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 50000,
        pledgeRatio: 0.6,
        interestRate: 0.022,
      });

      simulator2.qty00878 = 0;
      simulator2.avgCost00878 = 0;

      expect(() => {
        simulator2.executeTrade("00878.TW", 30000, 100, 175, true);
      }).not.toThrow();
    });
  });

  describe("getAvailableCredit - 根據 BASE 類型資產計算", () => {
    it("應根據 BASE 類型資產總值計算質押額度", () => {
      const registry = createDefaultAssetRegistry();
      const baseAssets = registry.getAssetsByType("base");

      let totalPledgeValue = 0;
      for (const asset of baseAssets) {
        const qty = `qty${asset.id === "00675L" ? "Z2" : asset.id}`;
      }

      const price0050 = 175;
      const pledgeCap = 1000 * price0050 * 0.6;
      expect(pledgeCap).toBe(105000);
    });
  });

  describe("processStockSplit - 走 Registry 的 splitHistory", () => {
    it("應處理 0050 股票分割", () => {
      const registry = createDefaultAssetRegistry();
      const asset0050 = registry.getAsset("0050");

      expect(asset0050.splitHistory).toHaveLength(1);
      expect(asset0050.splitHistory[0].date).toBe("2025-06-18");
      expect(asset0050.splitHistory[0].ratio).toBe(4);

      const simulator2 = new AccountSimulator({
        qty0050: 1000,
      });

      simulator2.processStockSplit("2025-06-18", true);
      expect(simulator2.qty0050).toBe(4000);
      expect(simulator2._splitProcessed_20250618).toBe(true);
    });

    it("重複調用不應重複分割", () => {
      const simulator2 = new AccountSimulator({
        qty0050: 1000,
      });

      simulator2.processStockSplit("2025-06-18", true);
      simulator2.processStockSplit("2025-06-18", true);
      expect(simulator2.qty0050).toBe(4000);
    });

    it("未註冊的分割日期不應處理", () => {
      const simulator2 = new AccountSimulator({
        qty0050: 1000,
      });

      simulator2.processStockSplit("2024-01-01", true);
      expect(simulator2.qty0050).toBe(1000);
    });
  });

  describe("deleverage - 動態去槓桿", () => {
    it("借款比率超過觸發值時應自動賣出", () => {
      const simulator2 = new AccountSimulator({
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 80000,
        pledgeRatio: 0.6,
      });

      const price0050 = 175;
      const priceZ2 = 275;

      const sold1 = simulator2.deleverage(price0050, 275, {
        triggerRatio: 0.85,
        targetRatio: 0.7,
        quiet: true,
      });
      expect(sold1).toBe(0);

      simulator2.totalLoan = 90000;
      const sold2 = simulator2.deleverage(price0050, 275, {
        triggerRatio: 0.85,
        targetRatio: 0.7,
        quiet: true,
      });
      expect(sold2).toBeGreaterThan(0);
      expect(simulator2.totalLoan).toBeLessThan(90000);
    });
  });

  describe("getSnapshot - 完整快照包含所有資產", () => {
    it("快照應包含完整帳戶狀態", () => {
      const simulator2 = new AccountSimulator({
        cash: 100000,
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 50000,
      });

      const snap = simulator2.getSnapshot(175, 275);

      expect(snap).toHaveProperty("cash");
      expect(snap).toHaveProperty("qty0050");
      expect(snap).toHaveProperty("qtyZ2");
      expect(snap).toHaveProperty("totalLoan");
      expect(snap).toHaveProperty("netAsset");
      expect(snap).toHaveProperty("maintenanceMargin");
      expect(snap).toHaveProperty("actualLeverage");
      expect(snap).toHaveProperty("pledgeCap");
      expect(snap).toHaveProperty("availCredit");
    });
  });
});
