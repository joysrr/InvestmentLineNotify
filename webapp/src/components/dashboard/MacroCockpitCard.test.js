import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MacroCockpitCard from "./MacroCockpitCard.vue";

describe("MacroCockpitCard.vue", () => {
  const baseProps = {
    regimeLevel: {
      label: "正常",
      cardClass: "card-ok",
      textClass: "text-ok",
      subLabel: "常態運作",
    },
    vix: 25.4,
    vixOverrideActive: false,
  };

  it("使用 ContentCard 作為外層容器，帶 status 左邊框與 clickable", () => {
    const wrapper = mount(MacroCockpitCard, { props: baseProps });
    const contentCard = wrapper.findComponent({ name: "ContentCard" });
    expect(contentCard.exists()).toBe(true);
    expect(contentCard.props("status")).toBe("ok");
    expect(contentCard.props("statusStyle")).toBe("left-border");
    expect(contentCard.props("clickable")).toBe(true);
    expect(contentCard.props("padding")).toBe("md");
    expect(contentCard.props("radius")).toBe("lg");
    expect(contentCard.attributes("data-testid")).toBe("macro-cockpit-card");
  });

  it("status 對應 cardClass：card-ok→ok / card-warn→warn / card-danger→danger", () => {
    for (const [cardClass, expected] of [
      ["card-ok", "ok"],
      ["card-warn", "warn"],
      ["card-danger", "danger"],
    ]) {
      const wrapper = mount(MacroCockpitCard, {
        props: {
          ...baseProps,
          regimeLevel: { ...baseProps.regimeLevel, cardClass },
        },
      });
      const contentCard = wrapper.findComponent({ name: "ContentCard" });
      expect(contentCard.props("status")).toBe(expected);
    }
  });

  it("textClass 套用於標題", () => {
    const wrapper = mount(MacroCockpitCard, {
      props: {
        ...baseProps,
        regimeLevel: { ...baseProps.regimeLevel, textClass: "text-warn" },
      },
    });
    expect(wrapper.find(".cockpit-title").classes()).toContain("text-warn");
  });

  it("使用 StatCard 顯示 VIX，framed=false size=md align=right", () => {
    const wrapper = mount(MacroCockpitCard, { props: baseProps });
    const statCard = wrapper.findComponent({ name: "StatCard" });
    expect(statCard.exists()).toBe(true);
    expect(statCard.props("label")).toBe("CBOE VIX 指數");
    expect(statCard.props("framed")).toBe(false);
    expect(statCard.props("size")).toBe("md");
    expect(statCard.props("align")).toBe("right");
    expect(statCard.props("value")).toBe("25.4");
  });

  it("VIX 為 '—' 時顯示 '—'", () => {
    const wrapper = mount(MacroCockpitCard, {
      props: { ...baseProps, vix: "—" },
    });
    expect(wrapper.text()).toContain("—");
  });

  it("點擊卡片觸發 open-drawer 事件", async () => {
    const wrapper = mount(MacroCockpitCard, { props: baseProps });
    const contentCard = wrapper.findComponent({ name: "ContentCard" });
    await contentCard.trigger("click");
    expect(wrapper.emitted("open-drawer")).toBeTruthy();
  });

  it("顯示標題與副標題", () => {
    const wrapper = mount(MacroCockpitCard, { props: baseProps });
    expect(wrapper.text()).toContain("總經象限");
    expect(wrapper.text()).toContain("正常");
    expect(wrapper.text()).toContain("常態運作");
  });

  it("vixOverrideActive 為 true 時顯示閃電圖示", () => {
    const wrapper = mount(MacroCockpitCard, {
      props: { ...baseProps, vixOverrideActive: true },
    });
    expect(wrapper.find(".cockpit-flash").exists()).toBe(true);
  });
});
