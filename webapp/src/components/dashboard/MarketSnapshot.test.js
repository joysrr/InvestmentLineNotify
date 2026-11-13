import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MarketSnapshot from "./MarketSnapshot.vue";
import ContentCard from "@/components/common/ContentCard.vue";

const baseProps = {
  status: { data: { rawUsMarket: { vix: 18.5 } } },
  loading: false,
  error: false,
  regimeLevel: { label: "正常", textClass: "text-ok", subLabel: "VIX 低檔" },
  vixOverrideActive: false,
  pbPrLevel: { label: "低檔", textClass: "text-ok", cardClass: "card-ok" },
  pbPrValue: "25",
  glLevel: { label: "正常", textClass: "text-ok" },
  glValue: "1.2",
  lightEmoji: "🟢",
  lightText: "綠燈",
};

describe("MarketSnapshot.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=lg radius=lg", () => {
    const wrapper = mount(MarketSnapshot, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("lg");
    expect(card.props("radius")).toBe("lg");
  });

  it("loading 時顯示 skeleton-card", () => {
    const wrapper = mount(MarketSnapshot, {
      props: { ...baseProps, loading: true },
    });
    expect(wrapper.find(".skeleton-card").exists()).toBe(true);
  });

  it("error 時顯示 inline-error", () => {
    const wrapper = mount(MarketSnapshot, {
      props: { ...baseProps, error: true },
    });
    expect(wrapper.find(".inline-error").exists()).toBe(true);
  });

  it("顯示市場快照資料", () => {
    const wrapper = mount(MarketSnapshot, { props: baseProps });
    expect(wrapper.text()).toContain("市場快照");
    expect(wrapper.text()).toContain("總經狀態");
    expect(wrapper.text()).toContain("18.5");
    expect(wrapper.text()).toContain("🟢");
  });

  it("顯示 PB 分位數與景氣燈號", () => {
    const wrapper = mount(MarketSnapshot, { props: baseProps });
    expect(wrapper.text()).toContain("PB 分位數");
    expect(wrapper.text()).toContain("25%");
    expect(wrapper.text()).toContain("景氣燈號");
    expect(wrapper.text()).toContain("綠燈");
  });
});
