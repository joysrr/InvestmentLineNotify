import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LaplaceSummary from "@/components/theory/LaplaceSummary.vue";

describe("LaplaceSummary", () => {
  it("顯示最小最大損失並標記狀態為 OK", () => {
    const wrapper = mount(LaplaceSummary, {
      props: {
        theory: {
          laplaceCriterion: {
            status: "OK",
            minimaxLoss: 0.2,
            worstScenario: "估值回歸",
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("20%");
    expect(text).toContain("估值回歸");
    expect(text).toContain("OK");
  });

  it("缺資料時顯示 UNAVAILABLE", () => {
    const wrapper = mount(LaplaceSummary, {
      props: {
        theory: {
          laplaceCriterion: {
            status: "UNAVAILABLE",
            reason: "MISSING_SCENARIOS",
            minimaxLoss: null,
            worstScenario: null,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("UNAVAILABLE");
    expect(text).toContain("MISSING_SCENARIOS");
  });
});
