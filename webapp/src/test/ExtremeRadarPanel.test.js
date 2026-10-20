import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ExtremeRadarPanel from "@/components/radar/ExtremeRadarPanel.vue";

describe("ExtremeRadarPanel (TDD RED-GREEN)", () => {
  const normalLeadingIndicators = {
    evaluatedAt: "2026-10-20T08:30:00.000Z",
    radars: [
      {
        radarId: "OVERNIGHT_SHOCK",
        radarName: "隔夜美股與夜盤暴跌",
        triggered: false,
        severity: "NORMAL",
        cardSummary: "美股與夜盤平穩",
      },
      {
        radarId: "MARGIN_SETTLING",
        radarName: "融資維持率斷頭潮",
        triggered: false,
        severity: "NORMAL",
        cardSummary: "維持率正常 (165.2%)",
      },
      {
        radarId: "EXTREME_PANIC",
        radarName: "系統性恐慌極端拋售",
        triggered: false,
        severity: "NORMAL",
        cardSummary: "市場情緒中性",
      },
      {
        radarId: "RETAIL_SENTIMENT",
        radarName: "小台散戶多空極端情緒",
        triggered: false,
        severity: "NORMAL",
        cardSummary: "散戶部位均衡 (RSR 10.5%)",
      },
    ],
    triggeredRadars: [],
    stateMachine: {
      state: "IDLE",
      cooldownDays: 0,
      activeDays: 0,
      p1Frozen: false,
      freeze00675L: false,
      allowLeft0050: true,
      p0Exempt: true,
    },
    p1Allocation: {
      allocated00675L: 0,
      allocated0050: 0,
      p1Frozen: false,
      glMax0050: 2.5,
    },
    telegramCard: null,
  };

  const triggeredLeadingIndicators = {
    evaluatedAt: "2026-10-20T08:30:00.000Z",
    radars: [
      {
        radarId: "OVERNIGHT_SHOCK",
        radarName: "隔夜美股與夜盤暴跌",
        triggered: true,
        severity: "CRITICAL",
        cardSummary: "費半 -5.2%、TSM -4.8%、夜盤 -650點",
      },
      {
        radarId: "MARGIN_SETTLING",
        radarName: "融資維持率斷頭潮",
        triggered: true,
        severity: "ALERT",
        cardSummary: "維持率跌破 139.5%、融資單日大減 -2.8%",
      },
      {
        radarId: "EXTREME_PANIC",
        radarName: "系統性恐慌極端拋售",
        triggered: false,
        severity: "NORMAL",
        cardSummary: "正常",
      },
      {
        radarId: "RETAIL_SENTIMENT",
        radarName: "小台散戶多空極端情緒",
        triggered: false,
        severity: "NORMAL",
        cardSummary: "正常",
      },
    ],
    triggeredRadars: [
      {
        radarId: "OVERNIGHT_SHOCK",
        radarName: "隔夜美股與夜盤暴跌",
        severity: "CRITICAL",
        cardSummary: "費半 -5.2%、TSM -4.8%、夜盤 -650點",
      },
      {
        radarId: "MARGIN_SETTLING",
        radarName: "融資維持率斷頭潮",
        severity: "ALERT",
        cardSummary: "維持率跌破 139.5%、融資單日大減 -2.8%",
      },
    ],
    stateMachine: {
      state: "ACTIVE_DEFENSE",
      cooldownDays: 0,
      activeDays: 1,
      p1Frozen: false,
      freeze00675L: true,
      allowLeft0050: true,
      p0Exempt: true,
    },
    p1Allocation: {
      allocated00675L: 0,
      allocated0050: 150000,
      p1Frozen: false,
      glMax0050: 2.5,
    },
    telegramCard: "🚨 領先指標極端警報",
  };

  it("常態平穩時渲染簡潔徽章，點擊可切換折疊狀態", async () => {
    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: normalLeadingIndicators,
      },
    });

    // 常態平穩指示
    expect(wrapper.find(".radar-panel-idle").exists()).toBe(true);
    expect(wrapper.text()).toContain("常態平穩");
    expect(wrapper.text()).toContain("全數正常");

    // 預設折疊，不顯示雷達清單詳細卡片
    expect(wrapper.find(".radar-detail-list").exists()).toBe(false);

    // 點擊展開折疊
    await wrapper.find(".radar-panel-header").trigger("click");
    expect(wrapper.find(".radar-detail-list").exists()).toBe(true);
    expect(wrapper.text()).toContain("隔夜美股與夜盤暴跌");
    expect(wrapper.text()).toContain("融資維持率斷頭潮");
  });

  it("極端警報觸發時預設展開警報面板並清晰呈現行動紀律", () => {
    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: triggeredLeadingIndicators,
        p1Balance: 450000,
      },
    });

    // 警報狀態外觀
    expect(wrapper.find(".radar-panel-alert").exists()).toBe(true);
    expect(wrapper.text()).toContain("防禦層已啟動");
    expect(wrapper.text()).toContain("ACTIVE_DEFENSE");

    // 觸發的雷達項目呈現
    expect(wrapper.text()).toContain("隔夜美股與夜盤暴跌");
    expect(wrapper.text()).toContain("費半 -5.2%");

    // 行動紀律
    // 00675L 凍結
    expect(wrapper.text()).toContain("00675L");
    expect(wrapper.text()).toContain("凍結禁止加碼");

    // 0050 逆週期低接
    expect(wrapper.text()).toContain("0050");
    expect(wrapper.text()).toContain("允許低接");
    expect(wrapper.text()).toContain("15.0 萬");

    // P0 正常豁免
    expect(wrapper.text()).toContain("P0 定期定額");
    expect(wrapper.text()).toContain("正常扣款");
  });

  it("當後端傳入真實物件格式且無 radarName 時，能自動補充中文名稱與常態說明", async () => {
    const rawBackendLeadingIndicators = {
      evaluatedAt: "2026-10-20T08:30:00.000Z",
      radars: {
        overnightShock: {
          radarId: "OVERNIGHT_SHOCK",
          triggered: false,
          severity: "NONE",
          cardSummary: null,
        },
        marginSettling: {
          radarId: "MARGIN_SETTLING",
          triggered: false,
          severity: "NONE",
          cardSummary: null,
        },
        extremePanic: {
          radarId: "EXTREME_PANIC",
          triggered: false,
          severity: "NONE",
          cardSummary: null,
        },
        retailSentiment: {
          radarId: "RETAIL_SENTIMENT",
          triggered: false,
          severity: "NONE",
          cardSummary: null,
        },
      },
      triggeredRadars: [],
      stateMachine: {
        state: "IDLE",
        cooldownDays: 0,
        activeDays: 0,
        p1Frozen: false,
        freeze00675L: false,
        allowLeft0050: true,
        p0Exempt: true,
      },
    };

    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: rawBackendLeadingIndicators,
      },
    });

    await wrapper.find(".radar-panel-header").trigger("click");
    expect(wrapper.find(".radar-detail-list").exists()).toBe(true);

    // 應補充繁體中文雷達名稱，不可為空白
    expect(wrapper.text()).toContain("美股隔夜衝擊");
    expect(wrapper.text()).toContain("籌碼沉澱偵測");
    expect(wrapper.text()).toContain("歷史極度恐慌");
    expect(wrapper.text()).toContain("散戶多空情緒");

    // 應顯示常態說明與狀態標籤
    expect(wrapper.text()).toContain("平穩");
    expect(wrapper.findAll(".mini-badge-ok").length).toBe(4);
  });

  it("無 leadingIndicators 資料時優雅不崩潰", () => {
    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: null,
      },
    });
    expect(wrapper.find(".extreme-radar-container").exists()).toBe(true);
    expect(wrapper.text()).toContain("暫無雷達數據");
  });
});
