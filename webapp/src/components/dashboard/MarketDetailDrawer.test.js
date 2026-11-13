import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MarketDetailDrawer from "./MarketDetailDrawer.vue";
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

const baseProps = {
  visible: true,
  vix: "18.5",
  pbPrValue: "45",
  pbPrLevel: { label: "合理", textClass: "" },
  lightEmoji: "ok",
  lightText: "綠燈",
  marginChange5d: 2.5,
  marginOverheated: false,
};

const mountOpts = {
  global: {
    stubs: {
      "router-link": { template: "<a><slot /></a>" },
      "el-drawer": { template: "<div><slot /></div>" },
    },
  },
};

describe("MarketDetailDrawer.vue", () => {
  it("內部包含 4 個 ContentCard 度量行", () => {
    const wrapper = mount(MarketDetailDrawer, {
      props: baseProps,
      ...mountOpts,
    });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    expect(cards.length).toBe(4);
  });

  it("每個 ContentCard variant=flat padding=sm radius=md", () => {
    const wrapper = mount(MarketDetailDrawer, {
      props: baseProps,
      ...mountOpts,
    });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    cards.forEach((card) => {
      expect(card.props("variant")).toBe("flat");
      expect(card.props("padding")).toBe("sm");
      expect(card.props("radius")).toBe("md");
    });
  });

  it("顯示 VIX 指數數值", () => {
    const wrapper = mount(MarketDetailDrawer, {
      props: baseProps,
      ...mountOpts,
    });
    expect(wrapper.text()).toContain("18.5");
  });

  it("顯示 PB PR 分位數", () => {
    const wrapper = mount(MarketDetailDrawer, {
      props: baseProps,
      ...mountOpts,
    });
    expect(wrapper.text()).toContain("45%");
  });

  it("顯示景氣燈號", () => {
    const wrapper = mount(MarketDetailDrawer, {
      props: baseProps,
      ...mountOpts,
    });
    expect(wrapper.findComponent(Icon).exists()).toBe(true);
  });

  it("顯示底部雷達連結", () => {
    const wrapper = mount(MarketDetailDrawer, {
      props: baseProps,
      ...mountOpts,
    });
    expect(wrapper.text()).toContain("查看完整市場雷達");
  });
});
