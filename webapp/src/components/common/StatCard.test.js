import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatCard from "./StatCard.vue";

describe("StatCard.vue", () => {
  it("預設渲染：label / value / unit 全部顯示", () => {
    const wrapper = mount(StatCard, {
      props: { label: "可用金額", value: 1234, unit: "元" },
    });
    expect(wrapper.text()).toContain("可用金額");
    expect(wrapper.text()).toContain("1,234");
    expect(wrapper.text()).toContain("元");
  });

  it("size: sm / md / lg 對應不同字級類別", () => {
    for (const size of ["sm", "md", "lg"]) {
      const wrapper = mount(StatCard, {
        props: { size, label: "L", value: 1 },
      });
      expect(wrapper.classes()).toContain(`stat-card--size-${size}`);
      expect(wrapper.classes()).toContain("stat-card");
    }
  });

  it("status ok/warn/danger/info/neutral 套用對應文字顏色類別", () => {
    for (const status of ["ok", "warn", "danger", "info", "neutral"]) {
      const wrapper = mount(StatCard, {
        props: { status, label: "L", value: 1 },
      });
      expect(wrapper.classes()).toContain(`stat-card--status-${status}`);
    }
  });

  it("status null 不加 status 類別", () => {
    const wrapper = mount(StatCard, {
      props: { status: null, label: "L", value: 1 },
    });
    expect(wrapper.classes()).not.toContain("stat-card--status-ok");
    expect(wrapper.classes()).not.toContain("stat-card--status-warn");
    expect(wrapper.classes()).not.toContain("stat-card--status-danger");
    expect(wrapper.classes()).not.toContain("stat-card--status-info");
    expect(wrapper.classes()).not.toContain("stat-card--status-neutral");
  });

  it("format auto：≥ 10000 顯示 X.X 萬，其餘 toLocaleString", () => {
    const big = mount(StatCard, {
      props: { label: "L", value: 12345, format: "auto" },
    });
    expect(big.text()).toContain("1.2 萬");

    const small = mount(StatCard, {
      props: { label: "L", value: 9999, format: "auto" },
    });
    expect(small.text()).toContain("9,999");
  });

  it("format: number / percent / currency / raw", () => {
    const num = mount(StatCard, {
      props: { label: "L", value: 1234, format: "number", decimals: 0 },
    });
    expect(num.text()).toContain("1,234");

    const pct = mount(StatCard, {
      props: { label: "L", value: 0.1234, format: "percent", decimals: 1 },
    });
    expect(pct.text()).toContain("12.3%");

    const cur = mount(StatCard, {
      props: { label: "L", value: 1234, format: "currency", decimals: 0 },
    });
    expect(cur.text()).toContain("$1,234");

    const raw = mount(StatCard, {
      props: { label: "L", value: 1234, format: "raw" },
    });
    expect(raw.text()).toContain("1234");
  });

  it("trend: up / down / flat 套用對應類別", () => {
    for (const trend of ["up", "down", "flat"]) {
      const wrapper = mount(StatCard, {
        props: { trend, label: "L", value: 1 },
      });
      expect(wrapper.classes()).toContain(`stat-card--trend-${trend}`);
    }
  });

  it("framed: false 不加外框類別", () => {
    const framed = mount(StatCard, {
      props: { framed: true, label: "L", value: 1 },
    });
    expect(framed.classes()).toContain("stat-card--framed");

    const unframed = mount(StatCard, {
      props: { framed: false, label: "L", value: 1 },
    });
    expect(unframed.classes()).not.toContain("stat-card--framed");
  });

  it("slots: label / value / suffix 可覆寫", () => {
    const wrapper = mount(StatCard, {
      props: { label: "標籤", value: 1, unit: "元" },
      slots: {
        label: "自訂標籤",
        value: "自訂數值",
        suffix: "自訂單位",
      },
    });
    expect(wrapper.text()).toContain("自訂標籤");
    expect(wrapper.text()).toContain("自訂數值");
    expect(wrapper.text()).toContain("自訂單位");
  });
});
