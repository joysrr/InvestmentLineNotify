import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import HumanCapitalSummary from "@/components/theory/HumanCapitalSummary.vue";

describe("HumanCapitalSummary", () => {
  it("顯示人力資本金額並標記狀態為 OK", () => {
    const wrapper = mount(HumanCapitalSummary, {
      props: {
        theory: {
          humanCapital: {
            status: "OK",
            humanCapital: 1500000,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("1,500,000");
    expect(text).toContain("OK");
  });

  it("缺資料時顯示 UNAVAILABLE", () => {
    const wrapper = mount(HumanCapitalSummary, {
      props: {
        theory: {
          humanCapital: {
            status: "UNAVAILABLE",
            reason: "MISSING_CASH_FLOWS",
            humanCapital: null,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("UNAVAILABLE");
    expect(text).toContain("MISSING_CASH_FLOWS");
  });
});
