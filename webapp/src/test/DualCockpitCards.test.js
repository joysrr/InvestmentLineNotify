import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MacroCockpitCard from "../components/dashboard/MacroCockpitCard.vue";
import PortfolioShieldCard from "../components/dashboard/PortfolioShieldCard.vue";

describe("Phase 1: L2 雙核心駕駛艙組件 (TDD)", () => {
  describe("MacroCockpitCard (市場總經象限卡)", () => {
    it("應正確渲染 BULL_TREND 狀態與動能指引", async () => {
      const wrapper = mount(MacroCockpitCard, {
        props: {
          regimeLevel: {
            label: "強趨勢多頭",
            cardClass: "card-ok",
            textClass: "text-ok",
            subLabel: "動能 70% 順勢進攻",
          },
          vix: 14.5,
          vixOverrideActive: false,
        },
      });

      expect(wrapper.text()).toContain("強趨勢多頭");
      expect(wrapper.text()).toContain("動能 70% 順勢進攻");
      expect(wrapper.text()).toContain("14.5");
      expect(wrapper.classes()).toContain("card-ok");

      // 點擊應觸發 click 事件以打開 L3 抽屜
      await wrapper.trigger("click");
      expect(wrapper.emitted("open-drawer")).toBeTruthy();
    });

    it("當 VIX 短路保護生效時，應顯示閃電標誌", () => {
      const wrapper = mount(MacroCockpitCard, {
        props: {
          regimeLevel: {
            label: "極端恐慌危機",
            cardClass: "card-danger",
            textClass: "text-danger",
            subLabel: "強制 Sell-only 保全部位",
          },
          vix: 38.2,
          vixOverrideActive: true,
        },
      });

      expect(wrapper.text()).toContain("⚡");
      expect(wrapper.classes()).toContain("card-danger");
    });
  });

  describe("PortfolioShieldCard (資產安全防護卡)", () => {
    it("應正確計算並渲染維持率、安全標籤與耐跌緩衝進度條", async () => {
      const wrapper = mount(PortfolioShieldCard, {
        props: {
          marginRatio: 285, // 285%
          warningThreshold: 160,
          grossLeverage: 1.45,
        },
      });

      expect(wrapper.text()).toContain("285%");
      expect(wrapper.text()).toContain("安全");
      // 緩衝耐跌計算：(285 - 160) / 285 ≈ 43.8% -> 44%
      expect(wrapper.text()).toContain("耐跌 44%");
      expect(wrapper.text()).toContain("1.45x");

      await wrapper.trigger("click");
      expect(wrapper.emitted("open-drawer")).toBeTruthy();
    });

    it("當維持率逼近警戒線時，應標示危險等級 card-danger", () => {
      const wrapper = mount(PortfolioShieldCard, {
        props: {
          marginRatio: 155, // 低於 160%
          warningThreshold: 160,
          grossLeverage: 2.2,
        },
      });

      expect(wrapper.classes()).toContain("card-danger");
      expect(wrapper.text()).toContain("警戒");
    });
  });
});
