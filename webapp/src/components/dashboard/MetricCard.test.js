import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MetricCard from "./MetricCard.vue";
import ContentCard from "@/components/common/ContentCard.vue";

describe("MetricCard.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=md radius=md", () => {
    const wrapper = mount(MetricCard, {
      props: { title: "0050", value: "145.20" },
    });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("md");
    expect(card.props("radius")).toBe("md");
  });

  it("顯示 title 與 value", () => {
    const wrapper = mount(MetricCard, {
      props: { title: "0050 台股", value: "145.20" },
    });
    expect(wrapper.text()).toContain("0050 台股");
    expect(wrapper.text()).toContain("145.20");
  });

  it("icon 存在時顯示圖示", () => {
    const wrapper = mount(MetricCard, {
      props: { title: "0050", value: "145.20", icon: "📈" },
    });
    expect(wrapper.text()).toContain("📈");
  });

  it("trend=up 時添加 metric-card--up 類", () => {
    const wrapper = mount(MetricCard, {
      props: { title: "0050", value: "145.20", trend: "up" },
    });
    expect(wrapper.classes()).toContain("metric-card--up");
  });

  it("trend=down 時添加 metric-card--down 類", () => {
    const wrapper = mount(MetricCard, {
      props: { title: "0050", value: "145.20", trend: "down" },
    });
    expect(wrapper.classes()).toContain("metric-card--down");
  });
});
