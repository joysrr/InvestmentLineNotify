import { describe, it, expect } from "vitest";

// 複製 HealthPanel.vue 中的 getCompDisplayValue 邏輯進行單元測試
const getCompDisplayValue = (comp) => {
  const d = comp.details || {};
  if (d.margin != null) return `${d.margin}%`;
  if (d.dropPercent != null)
    return typeof d.dropPercent === "number"
      ? `${d.dropPercent.toFixed(1)}%`
      : d.dropPercent;
  if (d.z2Ratio != null) return `${d.z2Ratio.toFixed(1)}%`;
  if (d.current != null) return `${d.current.toFixed(2)}x`;
  if (d.stage) return d.stage;
  if (d.vix != null && d.vixTW != null)
    return `VIX ${d.vix} / 台股 VIX ${d.vixTW}`;
  if (d.vix != null) return `VIX ${d.vix}`;
  if (d.vixTW != null) return `台股 VIX ${d.vixTW}`;
  return comp.value || "—";
};

describe("HealthPanel VIX display", () => {
  it("should display VIX value when regime details.vix is a non-zero number", () => {
    const comp = {
      key: "regime",
      status: "GREEN",
      score: 100,
      details: {
        level: "normal",
        message: "正常市場環境",
        vix: 18.5,
        sentiment: "NEUTRAL",
      },
    };
    expect(getCompDisplayValue(comp)).toBe("VIX 18.5");
  });

  it("should display VIX 0 when regime details.vix is exactly 0", () => {
    const comp = {
      key: "regime",
      status: "GREEN",
      score: 100,
      details: {
        level: "normal",
        message: "正常市場環境",
        vix: 0,
        sentiment: "NEUTRAL",
      },
    };
    expect(getCompDisplayValue(comp)).toBe("VIX 0");
  });

  it("should fall back to dash when regime details.vix is null/undefined", () => {
    const comp = {
      key: "regime",
      status: "GREEN",
      score: 100,
      details: {
        level: "normal",
        message: "正常市場環境",
        sentiment: "NEUTRAL",
      },
    };
    expect(getCompDisplayValue(comp)).toBe("—");
  });

  it("should display dual VIX (US + Taiwan) when both are present", () => {
    const comp = {
      key: "regime",
      status: "GREEN",
      score: 100,
      details: {
        level: "normal",
        message: "正常市場環境",
        vix: 18.5,
        vixTW: 14.2,
        sentiment: "NEUTRAL",
      },
    };
    expect(getCompDisplayValue(comp)).toBe("VIX 18.5 / 台股 VIX 14.2");
  });

  it("should display only Taiwan VIX when US VIX is null", () => {
    const comp = {
      key: "regime",
      status: "GREEN",
      score: 100,
      details: {
        level: "normal",
        message: "正常市場環境",
        vixTW: 14.2,
        sentiment: "NEUTRAL",
      },
    };
    expect(getCompDisplayValue(comp)).toBe("台股 VIX 14.2");
  });

  it("should display VIX from backend response structure", () => {
    // 模擬 /api/portfolio/health 的完整回應結構
    const healthData = {
      status: "GREEN",
      score: 88,
      components: {
        regime: {
          status: "GREEN",
          score: 100,
          details: {
            level: "normal",
            message: "正常市場環境",
            vix: 18.5,
            sentiment: "NEUTRAL",
          },
        },
        margin: {
          status: "GREEN",
          score: 100,
          details: { margin: 250 },
        },
      },
    };

    const regimeComp = healthData.components.regime;
    expect(getCompDisplayValue(regimeComp)).toBe("VIX 18.5");
  });
});
