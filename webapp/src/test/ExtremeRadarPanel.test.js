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
      freeze00675L: false,
      allowLeft0050: true,
      p0Exempt: true,
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
      freeze00675L: true,
      allowLeft0050: true,
      p0Exempt: true,
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
    expect(wrapper.text()).toContain("美股隔夜衝擊");
    expect(wrapper.text()).toContain("籌碼沉澱偵測");
  });

  it("極端警報觸發時預設展開警報面板並清晰呈現行動紀律", () => {
    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: triggeredLeadingIndicators,
      },
    });

    // 警報狀態外觀
    expect(wrapper.find(".radar-panel-alert").exists()).toBe(true);
    expect(wrapper.text()).toContain("防禦層已啟動");
    expect(wrapper.text()).toContain("ACTIVE_DEFENSE");

    // 觸發的雷達項目呈現
    expect(wrapper.text()).toContain("美股隔夜衝擊");
    expect(wrapper.text()).toContain("費半 -5.2%");

    // 行動紀律
    // 00675L 凍結
    expect(wrapper.text()).toContain("00675L");
    expect(wrapper.text()).toContain("凍結禁止加碼");

    // 0050 逆週期低接
    expect(wrapper.text()).toContain("0050");
    expect(wrapper.text()).toContain("允許低接");

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

  it("顯示新資料口徑，避免把夜盤交易流量誤稱為散戶多空比", async () => {
    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: {
          ...normalLeadingIndicators,
          radars: [
            {
              radarId: "OVERNIGHT_SHOCK",
              triggered: false,
              severity: "NORMAL",
              metrics: {
                rNight: 0.00694,
                dayToNightChangePct: 0.00694,
                dataStatus: "VERIFIED",
              },
            },
            {
              radarId: "RETAIL_SENTIMENT",
              triggered: false,
              severity: "NORMAL",
              metrics: {
                rsr: null,
                dataStatus: "UNAVAILABLE",
              },
            },
          ],
        },
      },
    });

    await wrapper.find(".radar-panel-header").trigger("click");

    expect(wrapper.text()).toContain("日盤到夜盤變化率");
    expect(wrapper.text()).toContain("非三大法人淨部位比率");
    expect(wrapper.text()).toContain("資料不足");
    expect(wrapper.text()).not.toContain("散戶多空比 0%");
  });

  it("顯示台股大盤 60 日乖離率定義與資料不足狀態", async () => {
    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: {
          ...normalLeadingIndicators,
          radars: normalLeadingIndicators.radars.map((radar) =>
            radar.radarId === "EXTREME_PANIC"
              ? {
                  ...radar,
                  metrics: {
                    bias60: null,
                    bias60DataStatus: "INSUFFICIENT_HISTORY",
                  },
                }
              : radar,
          ),
        },
      },
    });

    await wrapper.find(".radar-panel-header").trigger("click");

    expect(wrapper.text()).toContain("60 日乖離率");
    expect(wrapper.text()).toContain("資料不足");
    expect(wrapper.text()).toContain("暫不判讀");
    expect(wrapper.text()).not.toContain("0.0%");
  });

  it("以中文主標題、用途說明與次要英文代碼改善使用者理解", async () => {
    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: normalLeadingIndicators,
      },
    });

    await wrapper.find(".radar-panel-header").trigger("click");

    expect(wrapper.text()).toContain("監控狀態：IDLE");
    expect(wrapper.text()).toContain("隔夜衝擊");
    expect(wrapper.text()).toContain("監測跨日價格是否出現異常跳動");
    expect(wrapper.text()).toContain("RADAR_OVERNIGHT_SHOCK");
    expect(wrapper.find(".radar-code").exists()).toBe(true);

    await wrapper
      .find("[data-testid='radar-info-OVERNIGHT_SHOCK']")
      .trigger("click");
    expect(wrapper.text()).toContain("這個指標在看什麼？");
    expect(wrapper.text()).toContain("何時需要注意？");
    expect(wrapper.text()).toContain("目前未超過警戒門檻");
  });

  it("後端 radarId 帶 RADAR_ 前綴時仍顯示中文名稱且不重複英文代碼", async () => {
    const wrapper = mount(ExtremeRadarPanel, {
      props: {
        leadingIndicators: {
          ...normalLeadingIndicators,
          radars: normalLeadingIndicators.radars.map((radar) => ({
            ...radar,
            radarId: `RADAR_${radar.radarId}`,
          })),
        },
      },
    });

    await wrapper.find(".radar-panel-header").trigger("click");

    expect(wrapper.findAll(".mini-name")[0].text()).toBe("美股隔夜衝擊");
    expect(wrapper.findAll(".radar-code")[0].text()).toBe(
      "RADAR_OVERNIGHT_SHOCK",
    );
    expect(wrapper.findAll(".mini-name")[0].text()).not.toMatch(/^RADAR_/);
    expect(wrapper.text()).not.toContain("RADAR_RADAR_");
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
