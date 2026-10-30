import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TobinSeparationSummary from "@/components/theory/TobinSeparationSummary.vue";

describe("TobinSeparationSummary", () => {
  it("顯示風險資產與無風險資產比例並標記狀態為 OK", () => {
    const wrapper = mount(TobinSeparationSummary, {
      props: {
        theory: {
          tobinSeparation: {
            status: "OK",
            riskyRatio: 0.6,
            riskFreeRatio: 0.4,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("60%");
    expect(text).toContain("40%");
    expect(text).toContain("OK");
  });

  it("缺資料時顯示 UNAVAILABLE", () => {
    const wrapper = mount(TobinSeparationSummary, {
      props: {
        theory: {
          tobinSeparation: {
            status: "UNAVAILABLE",
            reason: "INVALID_ASSET_INPUT",
            riskyRatio: null,
            riskFreeRatio: null,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("UNAVAILABLE");
    expect(text).toContain("INVALID_ASSET_INPUT");
  });
});
