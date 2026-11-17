import { mount, flushPromises } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import TechnicalPanel from "@/components/chart/TechnicalPanel.vue";
import StatCard from "@/components/common/StatCard.vue";
import Icon from "@/components/common/Icon.vue";
import CollapsibleSection from "@/components/common/CollapsibleSection.vue";
import EmptyState from "@/components/common/EmptyState.vue";

// Mock fetchReports
vi.mock("../../../api/index.js", () => ({
  fetchReports: vi.fn(),
}));

const { fetchReports } = await import("../../../api/index.js");

const mockReport = {
  signals: {
    RSI: 65,
    KD_K: 72,
    KD_D: 68,
    bias240: 12.5,
    macdSignal: { signal: "bull", description: "MACD 金叉" },
  },
};

function mountPanel() {
  return mount(TechnicalPanel, {
    global: {
      components: {
        StatCard,
        Icon,
        CollapsibleSection,
        EmptyState,
      },
      stubs: {
        GlobalErrorBoundary: {
          template: "<div><slot /></div>",
        },
        BackPill: { template: "<div />" },
      },
    },
  });
}

describe("TechnicalPanel CARD-5.3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchReports.mockResolvedValue([mockReport]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("應渲染 5 張 StatCard 指標卡", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const cards = wrapper.findAllComponents(StatCard);
    expect(cards).toHaveLength(5);

    const labels = cards.map((c) => c.props("label"));
    expect(labels).toEqual(["RSI", "KD (K)", "KD (D)", "乖離率 MA240", "MACD"]);
  });

  it('每張 StatCard 應有 <Icon name="info"> 指標說明按鈕', async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const infoIcons = wrapper
      .findAllComponents(Icon)
      .filter((c) => c.props("name") === "info");
    expect(infoIcons).toHaveLength(5);
  });

  it("點擊 info 圖示應展開該指標說明", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    // 點擊第一張卡（RSI）的 info 圖示
    const infoIcons = wrapper
      .findAllComponents(Icon)
      .filter((c) => c.props("name") === "info");
    await infoIcons[0].trigger("click");
    await wrapper.vm.$nextTick();

    // 應該出現 RSI 的說明文字
    expect(wrapper.text()).toContain("相對強弱指標");
  });

  it("每張 StatCard 的 status 應對應 indicatorInfo 的狀態映射", async () => {
    const wrapper = mountPanel();
    await flushPromises();

    const cards = wrapper.findAllComponents(StatCard);
    // RSI=65 → ok_low=40, warn_high=70 → "正常" → cardClass="" → status=null
    expect(cards[0].props("status")).toBeNull();
    // KD_K=72 → warn_high=70 → "偏熱" → cardClass="ind-warn" → status="warn"
    expect(cards[1].props("status")).toBe("warn");
    // KD_D=68 → ok_low=30, warn_high=70 → "正常" → cardClass="" → status=null
    expect(cards[2].props("status")).toBeNull();
    // bias240=12.5 → ok_low (none), danger_high=25, warn_high=15 → "中位正常" → cardClass="" → status=null
    expect(cards[3].props("status")).toBeNull();
    // MACD=bull → cardClass="ind-ok" → status="ok"
    expect(cards[4].props("status")).toBe("ok");
  });
});
