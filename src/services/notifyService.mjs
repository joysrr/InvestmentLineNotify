import axios from "axios";
import { toArray } from "../utils/arrayUtils.mjs";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

// 元件
const sep = (margin = "md") => ({ type: "separator", margin });

const txt = (text, opt = {}) => ({
  type: "text",
  text: String(text ?? ""),
  ...opt,
});

const uriBtn = (label, uri) => ({
  type: "button",
  style: "link",
  height: "sm",
  action: { type: "uri", label, uri },
});

const baselineRow = (left, right, rightColor = "#111111", rightBold = false) => ({
  type: "box",
  layout: "baseline",
  contents: [
    txt(left, { size: "sm", color: "#666666", flex: 3 }),
    txt(right, {
      size: "sm",
      color: rightColor,
      weight: rightBold ? "bold" : "regular",
      flex: 7,
      align: "end",
      wrap: true,
      maxLines: 2,
    }),
  ],
});

const indicatorCard = (label, value) => ({
  type: "box",
  layout: "vertical",
  backgroundColor: "#F7F7F7",
  cornerRadius: "md",
  paddingAll: "8px",
  contents: [
    { type: "text", text: label, size: "xs", color: "#888888", align: "center" },
    {
      type: "text",
      text: String(value),
      size: "lg",
      weight: "bold",
      color: "#D93025",
      align: "center",
    },
  ],
});

const metricCard = (label, value, accent = false) => ({
  type: "box",
  layout: "vertical",
  cornerRadius: "md",
  backgroundColor: "#F7F7F7",
  paddingAll: "8px",
  contents: [
    txt(label, { size: "xs", color: "#888888", wrap: true, maxLines: 1 }),
    txt(value, {
      size: "sm",
      color: accent ? "#D93025" : "#111111",
      weight: accent ? "bold" : "regular",
      margin: "xs",
      wrap: true,
      maxLines: 2,
    }),
  ],
});

const okX = (b) => (b ? "✔️" : "❌");
const safeNum = (v) => (Number.isFinite(v) ? v : NaN);

const pctGapText = (current, threshold, dir = "gte") => {
  const c = Number(current);
  const t = Number(threshold);
  if (!Number.isFinite(c) || !Number.isFinite(t)) return "--";
  const gap = dir === "gte" ? t - c : c - t;
  return gap <= 0 ? "已達成" : `差 ${gap.toFixed(1)}%`;
};

/**
 * 統一推播入口：
 * - pushLine("hello")
 * - pushLine([{ type: "text", text: "hi" }, { type: "flex", ... }])
 */
export async function pushLine(input, { to = process.env.USER_ID } = {}) {
  const token = process.env.LINE_ACCESS_TOKEN;

  if (!token || !to) {
    console.warn("缺少 LINE_ACCESS_TOKEN 或 USER_ID/to，跳過推播");
    return { ok: false, skipped: true };
  }

  const messages =
    typeof input === "string" ? [{ type: "text", text: input }] : toArray(input);

  if (messages.length === 0) {
    console.warn("messages 為空，跳過推播");
    return { ok: false, skipped: true };
  }

  if (messages.length > 5) {
    throw new Error(`LINE push messages 超過上限(5)：目前=${messages.length}`);
  }

  try {
    const res = await axios.post(
      LINE_PUSH_URL,
      { to, messages },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 20_000,
      },
    );

    const requestId =
      res?.headers?.["x-line-request-id"] ??
      res?.headers?.["x-line-accepted-request-id"];
    return { ok: true, status: res.status, requestId };
  } catch (error) {
    const status = error?.response?.status;
    const statusText = error?.response?.statusText;
    const responseData = error?.response?.data;
    const requestId = error?.response?.headers?.["x-line-request-id"];

    console.error("❌ LINE push failed", {
      message: error?.message,
      code: error?.code,
      status,
      statusText,
      requestId,
      url: LINE_PUSH_URL,
      responseData,
    });

    throw error;
  }
}

export function buildFlexCarouselFancy({ result, vixData, config, dateText }) {
  const isOverheat = Boolean(result.overheat?.isOverheat);
  const status = String(result.marketStatus ?? "");

  // header 顏色（依狀態）
  const headerBg =
    status.includes("追繳風險") ? "#B00020" :
    status.includes("極度過熱") ? "#D93025" :
    status.includes("轉弱監控") ? "#E67E22" :
    "#2F3136";

  const vixShort =
    vixData?.value != null
      ? `${vixData.value.toFixed(2)} (${vixData.status ?? "N/A"})`
      : "N/A";

  const buyDropTh = result?.strategy?.buy?.minDropPercentToConsider;
  const buyScoreTh = result?.strategy?.buy?.minWeightScoreToBuy;
  const sellUpTh = result?.strategy?.sell?.minUpPercentToSell;
  const sellSigNeed = result?.strategy?.sell?.minSignalCountToSell;

  const buyGap = pctGapText(safeNum(result.priceDropPercent), safeNum(buyDropTh), "gte");
  const sellGap = pctGapText(safeNum(result.priceUpPercent), safeNum(sellUpTh), "gte");

  const sellState = result.sellSignals?.stateFlags ?? {};
  const sellTrig = result.sellSignals?.flags ?? {};
  const sellStateCount = result.sellSignals?.stateCount ?? 0;
  const sellTrigCount = result.sellSignals?.signalCount ?? 0;

  const targetSuggestionShort =
    result.targetSuggestionShort ?? result.targetSuggestion ?? "";

  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`
    : null;

  // ========== Bubble 1：核心行動 + 摘要 ==========
  const bubble1 = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: headerBg,
      paddingAll: "15px",
      contents: [
        txt(`${result.marketStatus.replace("【", "").replace("】", "")}`, {
          weight: "bold",
          color: "#ffffff",
          size: "lg",
          align: "center",
        }),
        txt(`📅 ${dateText} 戰報`, {
          color: "#ffffff",
          size: "xs",
          align: "center",
          margin: "sm",
        }),
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#FFF5F5",
          cornerRadius: "md",
          paddingAll: "12px",
          margin: "md",
          contents: [
            txt("🏹 核心行動", { weight: "bold", color: "#D93025", size: "sm" }),
            txt(result.target ?? "-", {
              weight: "bold",
              size: "xl",
              color: "#111111",
              margin: "sm",
              wrap: true,
              maxLines: 2,
            }),
            txt(targetSuggestionShort, {
              size: "xs",
              color: "#666666",
              wrap: true,
              maxLines: 2,
            }),
          ],
        },

        sep("lg"),

        {
          type: "box",
          layout: "horizontal",
          margin: "lg",
          spacing: "sm",
          contents: [
            metricCard("VIX", vixShort),
            metricCard("持股", `0050 ${config.qty0050}｜00675L ${config.qtyZ2}`),
          ],
        },

        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            metricCard(
              "過熱狀態",
              isOverheat
                ? "過熱（禁撥）"
                : (result.overheat?.highCount > 0
                    ? `偏熱 ${result.overheat.highCount}/${result.overheat.factorCount}`
                    : "中性"),
              isOverheat || (result.overheat?.highCount > 0),
            ),
            metricCard(
              "賣出觸發",
              `目前 ${sellTrigCount}/${sellSigNeed ?? 2}`,
              sellTrigCount >= (sellSigNeed ?? 2),
            ),
          ],
        },

        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "sm",
          contents: [
            metricCard(
              "進場差距",
              `${result.priceDropPercentText}%（${buyGap}）`,
              buyGap.includes("已達成"),
            ),
            metricCard(
              "停利差距",
              `${result.priceUpPercentText}%（${sellGap}）`,
              sellGap.includes("已達成"),
            ),
          ],
        },
      ],
    },
  };

  // ========== Bubble 2：進出場策略 + 轉弱觸發 ==========
  const sellTriggerSummary = `${sellTrigCount}/${sellSigNeed ?? 2}｜RSI${okX(
    sellTrig.rsiSell,
  )} KD${okX(sellTrig.kdSell)} MACD${okX(sellTrig.macdSell)}`;

  const r = result.reversal ?? {};
  const th = result.strategy?.threshold ?? {};

  const bubble2 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("📊 進出場策略 & 轉弱", { weight: "bold", size: "md", color: "#111111" }),
        sep("md"),

        txt("進場條件", { weight: "bold", size: "sm", color: "#111111" }),
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "box",
                  layout: "baseline",
                  contents: [
                    txt("跌幅", { size: "sm", color: "#666666", flex: 3 }),
                    txt(`${result.priceDropPercentText}%`, {
                      size: "sm",
                      color: buyGap.includes("已達成") ? "#28a745" : "#111111",
                      weight: "bold",
                      flex: 7,
                      align: "end",
                    }),
                  ],
                },
                txt(`門檻 ≥${buyDropTh ?? "--"}%，${buyGap}`, {
                  size: "xs",
                  color: "#999999",
                  wrap: true,
                  maxLines: 1,
                  margin: "xs",
                }),
              ],
            },
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "box",
                  layout: "baseline",
                  contents: [
                    txt("評分", { size: "sm", color: "#666666", flex: 3 }),
                    txt(`${result.weightScore}`, {
                      size: "sm",
                      color:
                        Number.isFinite(buyScoreTh) && result.weightScore >= buyScoreTh
                          ? "#28a745"
                          : "#111111",
                      weight: "bold",
                      flex: 7,
                      align: "end",
                    }),
                  ],
                },
                txt(`門檻 ≥${buyScoreTh ?? "--"} 分`, {
                  size: "xs",
                  color: "#999999",
                  wrap: true,
                  maxLines: 1,
                  margin: "xs",
                }),
              ],
            },
          ],
        },

        sep("md"),

        txt("停利/賣出", { weight: "bold", size: "sm", color: "#111111" }),
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "box",
                  layout: "baseline",
                  contents: [
                    txt("漲幅", { size: "sm", color: "#666666", flex: 3 }),
                    txt(`${result.priceUpPercentText}%`, {
                      size: "sm",
                      color: sellGap.includes("已達成") ? "#28a745" : "#111111",
                      weight: "bold",
                      flex: 7,
                      align: "end",
                    }),
                  ],
                },
                txt(`門檻 ≥${sellUpTh ?? "--"}%，${sellGap}`, {
                  size: "xs",
                  color: "#999999",
                  wrap: true,
                  maxLines: 1,
                  margin: "xs",
                }),
              ],
            },

            {
              type: "box",
              layout: "baseline",
              contents: [
                txt("超買狀態", { size: "sm", color: "#666666", flex: 3 }),
                txt(
                  `RSI≥70 ${okX(sellState.rsiStateOverbought)}｜K≥80 ${okX(
                    sellState.kdStateOverbought,
                  )}（${sellStateCount}/2）`,
                  {
                    size: "sm",
                    color: sellStateCount === 2 ? "#D93025" : "#111111",
                    weight: "bold",
                    flex: 7,
                    align: "end",
                    wrap: true,
                    maxLines: 2,
                  },
                ),
              ],
            },

            {
              type: "box",
              layout: "baseline",
              contents: [
                txt("賣出觸發", { size: "sm", color: "#666666", flex: 3 }),
                txt(sellTriggerSummary, {
                  size: "sm",
                  color: sellTrigCount >= (sellSigNeed ?? 2) ? "#28a745" : "#111111",
                  weight: "bold",
                  flex: 7,
                  align: "end",
                  wrap: true,
                  maxLines: 2,
                }),
              ],
            },
          ],
        },

        sep("md"),

        txt("📉 轉弱觸發掃描", { weight: "bold", size: "sm", color: "#111111" }),
        txt(`觸發數：${r.triggeredCount ?? 0} / ${r.totalFactor ?? 4}`, {
          size: "xs",
          color: "#aaaaaa",
          margin: "xs",
        }),
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            baselineRow(
              "RSI 跌破",
              `${result.RSI?.toFixed(1) ?? "--"}（<${th.rsiReversalLevel ?? 65} ${okX(r.rsiDrop)}）`,
            ),
            baselineRow(
              "KD(K) 跌破",
              `${result.KD_K?.toFixed(1) ?? "--"}（<${th.kReversalLevel ?? 80} ${okX(r.kdDrop)}）`,
            ),
            baselineRow("KD 死叉", okX(r.kdBearCross)),
            baselineRow("MACD 死叉", okX(r.macdBearCross)),
          ],
        },
      ],
    },
  };

  // ========== Bubble 3：技術指標 + 過熱明細 + 帳戶安全 ==========
  const bubble3 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("📈 技術指標 & 帳戶", { weight: "bold", size: "md", color: "#111111" }),
        sep("md"),

        txt("技術指標", { weight: "bold", size: "sm", color: "#111111" }),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "md",
          contents: [
            indicatorCard("RSI", result.RSI?.toFixed(1) ?? "--"),
            indicatorCard("KD (K)", result.KD_K?.toFixed(1) ?? "--"),
            indicatorCard(
              "變動",
              result.priceChangePercentText != null
                ? `${result.priceChangePercentText}%`
                : "--",
            ),
          ],
        },

        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            baselineRow(
              "年線乖離(240MA)",
              result.bias240 != null ? `${result.bias240.toFixed(2)}%` : "N/A",
            ),

            result.overheat?.factorCount != null && result.overheat?.highCount != null
              ? baselineRow(
                  "過熱明細",
                  (() => {
                    const o = result.overheat ?? {};
                    const f = o.factors ?? {};
                    const summary =
                      `${o.highCount}/${o.factorCount}` + (o.isOverheat ? "（過熱）" : "（未達過熱）");
                    const detail = `RSI${okX(f.rsiHigh)} KD${okX(f.kdHigh)} BIAS${okX(f.biasHigh)}`;
                    return `${summary}\n${detail}`;
                  })(),
                  result.overheat?.isOverheat ? "#D93025" : "#111111",
                  true,
                )
              : null,
          ].filter(Boolean),
        },

        sep("lg"),

        txt("🛡️ 帳戶安全狀態", { weight: "bold", size: "sm", color: "#111111" }),
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            baselineRow(
              "維持率",
              result.totalLoan > 0 ? `${result.maintenanceMargin.toFixed(1)}%` : "未質押 (安全)",
              result.totalLoan > 0 ? "#111111" : "#28a745",
              true,
            ),
            baselineRow("00675L 佔比", `${result.z2Ratio.toFixed(1)}%`, "#111111", true),
            baselineRow(
              "現金儲備",
              `$${Number(config.cash || 0).toLocaleString("zh-TW")}`,
              "#111111",
              true,
            ),
          ],
        },
      ],
    },
  };

  // ========== Bubble 4：心理紀律 + 目標 + 連結 ==========
  const bubble4 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("🧠 心理紀律", { weight: "bold", size: "md", color: "#111111" }),
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F0F0F0",
          cornerRadius: "md",
          paddingAll: "12px",
          margin: "md",
          contents: [
            txt("「下跌是加碼的禮物，上漲是資產的果實。」", {
              size: "sm",
              color: "#666666",
              wrap: true,
            }),
          ],
        },

        sep("lg"),

        txt("🎯 目標：7,480萬 (33年)", { size: "sm", color: "#111111", align: "center" }),
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        sep("md"),
        sheetUrl && uriBtn("財富自由領航表", sheetUrl),
        process.env.STRATEGY_URL && uriBtn("策略檔案", process.env.STRATEGY_URL),
      ].filter(Boolean),
    },
  };

  return {
    type: "carousel",
    contents: [bubble1, bubble2, bubble3, bubble4],
  };
}
