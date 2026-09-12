import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MacroCockpitCard from "../components/dashboard/MacroCockpitCard.vue";
import PortfolioShieldCard from "../components/dashboard/PortfolioShieldCard.vue";
import MarketDetailDrawer from "../components/dashboard/MarketDetailDrawer.vue";
import RiskDetailDrawer from "../components/dashboard/RiskDetailDrawer.vue";

describe("Phase 4 RWD & Mobile Layout Tests (375px/390px Viewport)", () => {
  it("MacroCockpitCard 應具備手機友善之可點擊卡片樣式與 thumb-zone 點擊提示", () => {
    const wrapper = mount(MacroCockpitCard, {
      props: {
        regimeLevel: {
          label: "多頭趨勢",
          cardClass: "card-ok",
          textClass: "text-ok",
          subLabel: "MA60 上揚且 VIX < 20",
        },
        vix: 16.5,
      },
    });

    expect(wrapper.classes()).toContain("cockpit-card");
    expect(wrapper.find(".drawer-hint").exists()).toBe(true);
    expect(wrapper.find(".drawer-hint").text()).toContain("點擊查看市場明細");
  });

  it("PortfolioShieldCard 應具備手機友善之可點擊卡片樣式與 thumb-zone 點擊提示", () => {
    const wrapper = mount(PortfolioShieldCard, {
      props: {
        maintenanceRatio: 280,
        bufferPercent: 42.8,
        grossLeverage: 1.15,
      },
    });

    expect(wrapper.classes()).toContain("cockpit-card");
    expect(wrapper.find(".drawer-hint").exists()).toBe(true);
    expect(wrapper.find(".drawer-hint").text()).toContain("點擊查看風控明細");
  });

  it("MarketDetailDrawer 與 RiskDetailDrawer 應設定 btt (bottom-to-top) 與 75% 抽屜高度以符合單手操作", () => {
    const marketDrawer = mount(MarketDetailDrawer, {
      props: { modelValue: true },
      global: {
        stubs: {
          "el-drawer": {
            props: ["direction", "size"],
            template:
              '<div class="el-drawer-stub" :data-direction="direction" :data-size="size"><slot /></div>',
          },
        },
      },
    });

    const elDrawerStub = marketDrawer.find(".el-drawer-stub");
    expect(elDrawerStub.attributes("data-direction")).toBe("btt");
    expect(elDrawerStub.attributes("data-size")).toBe("75%");

    const riskDrawer = mount(RiskDetailDrawer, {
      props: { modelValue: true },
      global: {
        stubs: {
          "el-drawer": {
            props: ["direction", "size"],
            template:
              '<div class="el-drawer-stub" :data-direction="direction" :data-size="size"><slot /></div>',
          },
        },
      },
    });

    const riskElDrawerStub = riskDrawer.find(".el-drawer-stub");
    expect(riskElDrawerStub.attributes("data-direction")).toBe("btt");
    expect(riskElDrawerStub.attributes("data-size")).toBe("75%");
  });
});
