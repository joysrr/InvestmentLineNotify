import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MacroCockpitCard from "@/components/dashboard/MacroCockpitCard.vue";
import ContentCard from "@/components/common/ContentCard.vue";
import StatCard from "@/components/common/StatCard.vue";

describe("Phase 1: L2 雙核心駕駛艙組件 (TDD)", () => {
  describe("MacroCockpitCard (市場總經象限卡)", () => {
    const baseProps = {
      regimeLevel: {
        label: "BULL_TREND",
        cardClass: "card-ok",
        textClass: "text-ok",
        subLabel: "市場處於多頭趨勢，建議維持 DCA",
      },
      vix: 18.2,
      vixOverrideActive: false,
    };

    it("應正確渲染 BULL_TREND 狀態與動能指引", () => {
      const wrapper = mount(MacroCockpitCard, { props: baseProps });
      const contentCard = wrapper.findComponent({ name: "ContentCard" });
      expect(contentCard.exists()).toBe(true);
      expect(contentCard.props("status")).toBe("ok");
      expect(contentCard.props("statusStyle")).toBe("left-border");

      expect(wrapper.find(".cockpit-title").text()).toBe("BULL_TREND");
      expect(wrapper.find(".cockpit-sub").text()).toBe(
        "市場處於多頭趨勢，建議維持 DCA",
      );
    });

    it("當 VIX 短路保護生效時，應顯示閃電標誌", () => {
      const wrapper = mount(MacroCockpitCard, {
        props: { ...baseProps, vixOverrideActive: true },
      });
      expect(wrapper.find(".cockpit-flash").exists()).toBe(true);
    });

    it("VIX 短路保護未生效時，不顯示閃電標誌", () => {
      const wrapper = mount(MacroCockpitCard, { props: baseProps });
      expect(wrapper.find(".cockpit-flash").exists()).toBe(false);
    });

    it("使用 StatCard 顯示 VIX，framed=false size=md align=right", () => {
      const wrapper = mount(MacroCockpitCard, { props: baseProps });
      const statCard = wrapper.findComponent({ name: "StatCard" });
      expect(statCard.exists()).toBe(true);
      expect(statCard.props("label")).toBe("CBOE VIX 指數");
      expect(statCard.props("framed")).toBe(false);
      expect(statCard.props("size")).toBe("md");
      expect(statCard.props("align")).toBe("right");
    });

    it("點擊卡片觸發 open-drawer 事件", async () => {
      const wrapper = mount(MacroCockpitCard, { props: baseProps });
      const contentCard = wrapper.findComponent({ name: "ContentCard" });
      await contentCard.trigger("click");
      expect(wrapper.emitted("open-drawer")).toBeTruthy();
    });

    it("data-testid 為 macro-cockpit-card", () => {
      const wrapper = mount(MacroCockpitCard, { props: baseProps });
      expect(wrapper.find('[data-testid="macro-cockpit-card"]').exists()).toBe(
        true,
      );
    });
  });
});
