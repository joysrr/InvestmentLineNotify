import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PortfolioShieldCard from "./PortfolioShieldCard.vue";
import ContentCard from "@/components/common/ContentCard.vue";

const baseProps = {
  marginRatio: 200,
  grossLeverage: 1.5,
  shieldStatus: {
    cardClass: "shield-ok",
    textClass: "text-ok",
    fillClass: "fill-ok",
    label: "安全",
  },
};

describe("PortfolioShieldCard.vue", () => {
  it("外層使用 ContentCard，clickable variant=outlined padding=lg radius=lg", () => {
    const wrapper = mount(PortfolioShieldCard, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("clickable")).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("lg");
    expect(card.props("radius")).toBe("lg");
  });

  it("顯示標題與防護比例", () => {
    const wrapper = mount(PortfolioShieldCard, { props: baseProps });
    expect(wrapper.text()).toContain("資產安全防護");
    expect(wrapper.text()).toContain("安全");
  });

  it("clickable 卡片可觸發 open-drawer", async () => {
    const wrapper = mount(PortfolioShieldCard, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    await card.trigger("click");
    expect(wrapper.emitted("open-drawer")).toBeTruthy();
  });

  it("顯示耐跌與槓桿資訊", () => {
    const wrapper = mount(PortfolioShieldCard, { props: baseProps });
    expect(wrapper.text()).toContain("20");
    expect(wrapper.text()).toContain("1.5");
  });
});
