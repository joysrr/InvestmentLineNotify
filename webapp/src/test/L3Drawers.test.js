import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MarketDetailDrawer from "../components/dashboard/MarketDetailDrawer.vue";
import RiskDetailDrawer from "../components/dashboard/RiskDetailDrawer.vue";

describe("Phase 2: L3 漸進式抽屜組件 (TDD)", () => {
  describe("MarketDetailDrawer (市場總經底層抽屜)", () => {
    it("應正確渲染 VIX、PB PR、景氣燈號與大盤融資等詳細指標", () => {
      const wrapper = mount(MarketDetailDrawer, {
        props: {
          visible: true,
          vix: 16.8,
          pbPrValue: 85,
          pbPrLevel: { label: "估值偏高", textClass: "text-warn" },
          lightEmoji: "🟢",
          lightText: "綠燈 (穩定)",
          marginChange5d: 1.2,
          marginOverheated: false,
        },
        global: {
          stubs: {
            "el-drawer": {
              template: '<div class="el-drawer-stub"><slot /></div>',
            },
          },
        },
      });

      expect(wrapper.text()).toContain("16.8");
      expect(wrapper.text()).toContain("85%");
      expect(wrapper.text()).toContain("估值偏高");
      expect(wrapper.text()).toContain("綠燈 (穩定)");
      expect(wrapper.text()).toContain("+1.2%");
      expect(wrapper.text()).toContain("未過熱");
    });
  });

  describe("RiskDetailDrawer (資產風控底層抽屜)", () => {
    it("應正確渲染維持率階梯、總槓桿率與安全說明", () => {
      const wrapper = mount(RiskDetailDrawer, {
        props: {
          visible: true,
          marginRatio: 285,
          grossLeverage: 1.45,
          hardCapLeverage: 3.0,
          warningThreshold: 160,
          dropBufferPercent: 44,
        },
        global: {
          stubs: {
            "el-drawer": {
              template: '<div class="el-drawer-stub"><slot /></div>',
            },
          },
        },
      });

      expect(wrapper.text()).toContain("285%");
      expect(wrapper.text()).toContain("1.45x");
      expect(wrapper.text()).toContain("3.00x");
      expect(wrapper.text()).toContain("160%");
      expect(wrapper.text()).toContain("44%");
    });
  });
});
