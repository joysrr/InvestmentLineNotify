import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TrueExposureSummary from "@/components/theory/TrueExposureSummary.vue";

describe("TrueExposureSummary", () => {
  it("顯示真實曝險比例並標記狀態為 OK", () => {
    const wrapper = mount(TrueExposureSummary, {
      props: {
        theory: {
          trueExposure: {
            status: "OK",
            trueExposure: 0.45,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("45%");
    expect(text).toContain("OK");
  });

  it("缺人力資本時顯示 UNAVAILABLE", () => {
    const wrapper = mount(TrueExposureSummary, {
      props: {
        theory: {
          trueExposure: {
            status: "UNAVAILABLE",
            reason: "MISSING_HUMAN_CAPITAL",
            trueExposure: null,
          },
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain("UNAVAILABLE");
    expect(text).toContain("MISSING_HUMAN_CAPITAL");
  });
});
