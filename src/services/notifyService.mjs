import axios from "axios";
import { toArray } from "../utils/arrayUtils.mjs";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

// 元件
const sep = (margin = "md") => ({ type: "separator", margin });

const txt = (text, opt = {}) => ({ type: "text", text: String(text ?? ""), ...opt });

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
      maxLines: 2, // 可視情況調 1~3
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
    {
      type: "text",
      text: label,
      size: "xs",
      color: "#888888",
      align: "center",
    },
    {
      type: "text",
      text: String(value),
      size: "lg",
      weight: "bold",
      color: "#D93025",
      align: "center",
    },
  ]
});

const okX = (b) => (b ? "✔️" : "❌");

const safeNum = (v) => (Number.isFinite(v) ? v : NaN);

const pctGapText = (current, threshold, dir = "gte") => {
  const c = Number(current);
  const t = Number(threshold);
  if (!Number.isFinite(c) || !Number.isFinite(t)) return "--";

  const gap = dir === "gte" ? (t - c) : (c - t);
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

  // LINE push messages 常見上限為 5 [web:782]
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
    // Axios error 結構：response / request / message [web:775]
    const status = error?.response?.status;
    const statusText = error?.response?.statusText;
    const responseData = error?.response?.data;
    const requestId = error?.response?.headers?.["x-line-request-id"]; // [web:782]

    console.error("❌ LINE push failed", {
      message: error?.message,
      code: error?.code,
      status,
      statusText,
      requestId,
      url: LINE_PUSH_URL,
      responseData,
      // 不要 log Authorization/token
    });

    throw error;
  }
}

export function buildFlexCarouselFancy({ result, vixData, config, dateText }) {
  const isOverheat = Boolean(result.overheat?.isOverheat);
  const status = String(result.marketStatus ?? "");

  const headerBg =
    status.includes("追繳風險") ? "#B00020" :      // 深紅：最高優先
      status.includes("極度過熱") ? "#D93025" :      // 紅：過熱禁撥
        status.includes("轉弱監控") ? "#E67E22" :      // 橘：轉弱警戒
          "#2F3136";                                     // 深灰：一般狀態

  const vixShort =
    vixData?.value != null
      ? `${vixData.value.toFixed(2)} (${vixData.status ?? "N/A"})`
      : "N/A";

  const buyDropTh = result?.strategy?.buy?.minDropPercentToConsider; // 20
  const buyScoreTh = result?.strategy?.buy?.minWeightScoreToBuy;     // 7
  const sellUpTh = result?.strategy?.sell?.minUpPercentToSell;       // 50
  const sellSigNeed = result?.strategy?.sell?.minSignalCountToSell;  // 2

  const buyGap = pctGapText(safeNum(result.priceDropPercent), safeNum(buyDropTh), "gte");
  const sellGap = pctGapText(safeNum(result.priceUpPercent), safeNum(sellUpTh), "gte");

  const sellState = result.sellSignals?.stateFlags ?? {};
  const sellTrig = result.sellSignals?.flags ?? {};
  const sellStateCount = result.sellSignals?.stateCount ?? 0;
  const sellTrigCount = result.sellSignals?.signalCount ?? 0;

  // 讓第一張更不容易爆字：優先 short 版
  const targetSuggestionShort =
    result.targetSuggestionShort ??
    result.targetSuggestion ??
    "";

  const sheetUrl =
    process.env.GOOGLE_SHEET_ID
      ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`
      : null;

  // ========== Bubble 1：極簡決策 ==========
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
              maxLines: 2, // ✅ 防止第一張被塞爆
            }),
          ],
        },

        sep("lg"),

        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            baselineRow("🎭 VIX", vixShort, "#111111", true),
            baselineRow("持股", `0050 ${config.qty0050}｜00675L ${config.qtyZ2}`, "#111111", true),
          ],
        },

        sep("md"),

        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            baselineRow(
              "市場溫度",
              isOverheat
                ? "過熱（禁撥）"
                : (result.overheat?.highCount > 0 ? `偏熱 ${result.overheat.highCount}/${result.overheat.factorCount}` : "中性"),
              (isOverheat || (result.overheat?.highCount > 0)) ? "#D93025" : "#111111",
              true,
            ),
            baselineRow(
              buyDropTh != null ? `進場差距(≥${buyDropTh}%)` : "進場差距",
              `${result.priceDropPercentText}%（${buyGap}）`,
              buyGap.includes("已達成") ? "#28a745" : "#111111",
              true,
            ),
            baselineRow(
              sellUpTh != null ? `停利差距(≥${sellUpTh}%)` : "停利差距",
              `${result.priceUpPercentText}%（${sellGap}）`,
              sellGap.includes("已達成") ? "#28a745" : "#111111",
              true,
            ),
            baselineRow(
              "賣出觸發",
              `目前 ${sellTrigCount}/${sellSigNeed ?? 2}`,
              sellTrigCount >= (sellSigNeed ?? 2) ? "#28a745" : "#111111",
              true,
            ),
          ],
        },

      ],
    },
  };

  // ========== Bubble 2：策略判斷（進出場 + 訊號） ==========
  const sellTriggerSummary =
    `觸發 ${sellTrigCount}/${sellSigNeed ?? 2}｜` +
    `RSI${okX(sellTrig.rsiSell)} KD${okX(sellTrig.kdSell)} MACD${okX(sellTrig.macdSell)}`;

  const sellTriggerDetail =
    `RSI↓70 ${okX(sellTrig.rsiSell)}  KD死叉 ${okX(sellTrig.kdSell)}  MACD↓ ${okX(sellTrig.macdSell)}`;

  const bubble2 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("📊 策略判斷", { weight: "bold", size: "md", color: "#111111" }),
        sep("md"),

        txt("進場條件", { weight: "bold", size: "sm", color: "#111111" }),
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            baselineRow(
              buyDropTh != null ? `跌幅(≥${buyDropTh}%)` : "跌幅(進場)",
              `${result.priceDropPercentText}%（${buyGap}）`,
              buyGap.includes("已達成") ? "#28a745" : "#111111",
              true,
            ),
            baselineRow(
              buyScoreTh != null ? `評分(≥${buyScoreTh})` : "評分",
              `${result.weightScore}/${buyScoreTh ?? "--"}`,
              (Number.isFinite(buyScoreTh) && result.weightScore >= buyScoreTh) ? "#28a745" : "#111111",
              true,
            ),
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
            baselineRow(
              sellUpTh != null ? `漲幅(≥${sellUpTh}%)` : "漲幅(停利)",
              `${result.priceUpPercentText}%（${sellGap}）`,
              sellGap.includes("已達成") ? "#28a745" : "#111111",
              true,
            ),
            baselineRow(
              "超買狀態",
              `RSI≥70 ${okX(sellState.rsiStateOverbought)}｜K≥80 ${okX(sellState.kdStateOverbought)}（${sellStateCount}/2）`,
              sellStateCount === 2 ? "#D93025" : "#111111",
              true,
            ),
            {
              type: "box",
              layout: "vertical",
              contents: [
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
                      maxLines: 1,
                    }),
                  ],
                },
                txt(sellTriggerDetail, {
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

        txt("🔍 技術指標", { weight: "bold", size: "md", color: "#111111" }),
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "md",
          contents: [
            indicatorCard("RSI", result.RSI?.toFixed(1) ?? "--"),
            indicatorCard("KD (K)", result.KD_K?.toFixed(1) ?? "--"),
            indicatorCard("變動", result.priceChangePercentText != null ? `${result.priceChangePercentText}%` : "--"),
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
              result.bias240 != null ? `${result.bias240.toFixed(2)}%` : "N/A"
            ),

            // ✅ 過熱因子：摘要 + 明細
            (result.overheat?.factorCount != null && result.overheat?.highCount != null)
              ? baselineRow(
                "過熱因子",
                (() => {
                  const o = result.overheat ?? {};
                  const f = o.factors ?? {};
                  const summary = `${o.highCount}/${o.factorCount}` + (o.isOverheat ? "（過熱）" : "（未達過熱）");
                  const detail =
                    `RSI${okX(f.rsiHigh)} KD${okX(f.kdHigh)} BIAS${okX(f.biasHigh)}`;
                  // 兩行：第一行摘要、第二行明細（避免擠在同一行）
                  return `${summary}\n${detail}`;
                })(),
                result.overheat?.isOverheat ? "#D93025" : "#111111",
                true,
              )
              : null,
          ].filter(Boolean),
        },
      ],
    },
  };

  // ========== Bubble 3：轉弱掃描 + 帳戶安全 + 連結 ==========
  const r = result.reversal ?? {};
  const th = result.strategy?.threshold ?? {};

  const bubble3 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("📉 轉弱觸發掃描", { weight: "bold", size: "md", color: "#111111" }),
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
            baselineRow("RSI 跌破", `${result.RSI?.toFixed(1) ?? "--"}（<${th.rsiReversalLevel ?? 65} ${okX(r.rsiDrop)}）`),
            baselineRow("KD(K) 跌破", `${result.KD_K?.toFixed(1) ?? "--"}（<${th.kReversalLevel ?? 80} ${okX(r.kdDrop)}）`),
            baselineRow("KD 死叉", okX(r.kdBearCross)),
            baselineRow("MACD 死叉", okX(r.macdBearCross)),
          ],
        },

        sep("xl"),

        txt("🛡️ 帳戶安全狀態", { weight: "bold", size: "md", margin: "lg" }),
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
            baselineRow("正2 佔比", `${result.z2Ratio.toFixed(1)}%`, "#111111", true),
            baselineRow("現金儲備", `$${Number(config.cash || 0).toLocaleString("zh-TW")}`, "#111111", true),
          ],
        },

        sep("xl"),

        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F0F0F0",
          cornerRadius: "md",
          paddingAll: "10px",
          margin: "lg",
          contents: [
            txt("🧠 心理紀律", { weight: "bold", size: "sm", color: "#111111" }),
            txt("「下跌是加碼的禮物，上漲是資產的果實。」", {
              size: "xs",
              color: "#666666",
              margin: "sm",
              wrap: true,
            }),
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("🎯 目標：7,480萬 (33年)", { size: "xs", color: "#aaaaaa", align: "center" }),
        sep("md"),
        sheetUrl && uriBtn("財富自由領航表", sheetUrl),
        process.env.STRATEGY_URL && uriBtn("策略檔案", process.env.STRATEGY_URL),
      ].filter(Boolean),
    },
  };

  return {
    type: "carousel",
    contents: [bubble1, bubble2, bubble3],
  };
}