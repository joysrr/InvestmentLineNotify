import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ExtremeRadarPanel from "./ExtremeRadarPanel.vue";
import ContentCard from "@/components/common/ContentCard.vue";
import StatCard from "@/components/common/StatCard.vue";

const baseProps = {
  leadingIndicators: {
    stateMachine: {
      state: "IDLE",
      cooldownDays: 0,
      activeDays: 0,
      freeze00675L: false,
      allowLeft0050: true,
      p0Exempt: true,
    },
    cashExposureAnalysis: null,
  },
};

const alertProps = {
  leadingIndicators: {
    stateMachine: {
      state: "ACTIVE_DEFENSE",
      cooldownDays: 0,
      activeDays: 1,
      freeze00675L: true,
      allowLeft0050: false,
      p0Exempt: true,
    },
    cashExposureAnalysis: null,
  },
};

describe("ExtremeRadarPanel.vue", () => {
  it("外層包含 ContentCard (variant=outlined, padding=sm, radius=md)", () => {
    const wrapper = mount(ExtremeRadarPanel, { props: baseProps });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].props("variant")).toBe("outlined");
    expect(cards[0].props("padding")).toBe("sm");
    expect(cards[0].props("radius")).toBe("md");
  });

  it("discipline-card 改用 StatCard (size=sm, framed=false, align=left)", () => {
    const wrapper = mount(ExtremeRadarPanel, { props: alertProps });
    const statCards = wrapper.findAllComponents({ name: "StatCard" });
    expect(statCards.length).toBeGreaterThan(0);
    statCards.forEach((card) => {
      expect(card.props("size")).toBe("sm");
      expect(card.props("framed")).toBe(false);
      expect(card.props("align")).toBe("left");
    });
  });

  it("顯示 00675L 行動紀律卡片", () => {
    const wrapper = mount(ExtremeRadarPanel, { props: alertProps });
    expect(wrapper.text()).toContain("00675L (2x槓桿)");
  });

  it("顯示 0050 行動紀律卡片", () => {
    const wrapper = mount(ExtremeRadarPanel, { props: alertProps });
    expect(wrapper.text()).toContain("0050 (原型加碼)");
  });

  it("顯示 P0 定期定額卡片", () => {
    const wrapper = mount(ExtremeRadarPanel, { props: alertProps });
    expect(wrapper.text()).toContain("P0 定期定額");
  });

  it("顯示極端防禦狀態標題", () => {
    const wrapper = mount(ExtremeRadarPanel, { props: baseProps });
    expect(wrapper.text()).toContain("極端防禦狀態");
  });
});
