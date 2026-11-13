import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import HealthPanel from "./HealthPanel.vue";
import ContentCard from "@/components/common/ContentCard.vue";

const baseData = {
  score: 78,
  summary: "整體健康",
  components: {
    regime: { status: "ok", details: { stage: "正常" } },
  },
};

const baseProps = {
  data: baseData,
  loading: false,
  error: false,
  type: "dashboard",
};

describe("HealthPanel.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=lg radius=lg", () => {
    const wrapper = mount(HealthPanel, {
      props: baseProps,
      global: { stubs: ["router-link"] },
    });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("lg");
    expect(card.props("radius")).toBe("lg");
  });

  it("loading 時顯示 skeleton-list", () => {
    const wrapper = mount(HealthPanel, {
      props: { ...baseProps, loading: true },
      global: { stubs: ["router-link"] },
    });
    expect(wrapper.find(".skeleton-list").exists()).toBe(true);
  });

  it("error 時顯示 inline-error", () => {
    const wrapper = mount(HealthPanel, {
      props: { ...baseProps, error: true, data: null },
      global: { stubs: ["router-link"] },
    });
    expect(wrapper.find(".inline-error").exists()).toBe(true);
  });

  it("data 為 null 時顯示 inline-hint", () => {
    const wrapper = mount(HealthPanel, {
      props: { ...baseProps, data: null },
      global: { stubs: ["router-link"] },
    });
    expect(wrapper.find(".inline-hint").exists()).toBe(true);
  });

  it("data 有值時顯示分數與摘要", () => {
    const wrapper = mount(HealthPanel, {
      props: baseProps,
      global: { stubs: ["router-link"] },
    });
    expect(wrapper.text()).toContain("78");
    expect(wrapper.text()).toContain("整體健康");
  });
});
