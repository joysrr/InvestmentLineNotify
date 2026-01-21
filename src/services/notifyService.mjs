import axios from "axios";

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const USER_ID = process.env.USER_ID;
const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

const lineHttp = axios.create({
  headers: {
    "Content-Type": "application/json",
    ...(LINE_ACCESS_TOKEN ? { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` } : {}),
  },
  timeout: 20_000,
});

function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

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
    txt(left, { size: "sm", color: "#666666", flex: 1 }),
    txt(right, {
      size: "sm",
      color: rightColor,
      weight: rightBold ? "bold" : "regular",
      flex: 1,
      align: "end",
    }),
  ],
});

// 小工具：指標卡
function indicatorCard(label, value) {
  return {
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
    ],
  };
}

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

    const requestId = res?.headers?.["x-line-request-id"]; // 方便追查 [web:782]
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
  const isOverheat = String(result.marketStatus || "").includes("過熱");
  const headerBg = isOverheat ? "#D93025" : "#2F3136";

  // 你範例：顯示「21.79 (緊張)」這種短狀態
  const vixShort =
    vixData?.value != null
      ? `${vixData.value.toFixed(2)} (${vixData.vixStatus})`
      : "N/A";

  const bubble1 = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: headerBg,
      paddingAll: "15px",
      contents: [
        txt(`${result.marketStatus.replace("【", "").replace("】", "")}`, { weight: "bold", color: "#ffffff", size: "lg", align: "center" }),
        txt(`📅 ${dateText} 戰報`, { color: "#ffffffcc", size: "xs", align: "center", margin: "sm" })
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        // 核心行動指令（照你範例樣式，但文字來自 result.suggestion）
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#FFF5F5",
          cornerRadius: "md",
          paddingAll: "12px",
          margin: "md",
          contents: [
            txt("🏹 核心行動指令", { weight: "bold", color: "#D93025", size: "sm" }),
            txt(result.target ?? "-", { weight: "bold", size: "xl", color: "#111111", margin: "sm", wrap: true }),
            txt(result.targetSuggestion ?? "", { size: "xs", color: "#666666" })
          ],
        },
        sep("lg"),
        // 關鍵摘要（VIX/持股）
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "baseline",
              contents: [
                txt("🎭 恐慌 VIX", { color: "#aaaaaa", size: "sm", flex: 4 }),
                txt(vixShort, { wrap: true, color: "#111111", size: "sm", flex: 6, align: "end", weight: "bold" }),
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                txt("🛡️ 0050", { color: "#aaaaaa", size: "sm", flex: 4 }),
                txt(`${config.qty0050} 股`, { wrap: true, color: "#111111", size: "sm", flex: 6, align: "end", weight: "bold" })
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                txt("⚔️ 正2", { color: "#aaaaaa", size: "sm", flex: 4 }),
                txt(`${config.qtyZ2} 股`, { wrap: true, color: "#111111", size: "sm", flex: 6, align: "end", weight: "bold" })
              ],
            },
          ],
        },
        ...(isOverheat ? buildFactorSection(result) : []),
        ...buildReversalSection(result),
      ],
    },
  };

  const sheetUrl =
    process.env.GOOGLE_SHEET_ID
      ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`
      : null;

  const bubble2 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt(`🔍 技術指標細節`, { weight: "bold", size: "md", color: "#111111" }),
        // 三個指標卡
        {
          type: "box",
          layout: "horizontal",
          margin: "md",
          spacing: "md",
          contents: [
            indicatorCard("RSI", result.RSI?.toFixed(1) ?? "--"),
            indicatorCard("KD (K)", result.KD_K?.toFixed(1) ?? "--"),
            indicatorCard(
              "乖離率",
              result.bias240 != null ? `${result.bias240.toFixed(0)}%` : "--",
            ),
          ],
        },
        sep("xl"),
        txt(`🛡️ 帳戶安全狀態`, { weight: "bold", size: "md", margin: "lg" }),
        // 帳戶狀態列表（用 baseline 排版）
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            baselineRow(
              "預估維持率",
              result.totalLoan > 0
                ? `${result.maintenanceMargin.toFixed(1)}%`
                : "未質押 (安全)",
              result.totalLoan > 0 ? "#111111" : "#28a745",
              true,
            ),
            baselineRow(
              "正2 佔比",
              `${result.z2Ratio.toFixed(1)}%`,
              "#111111",
              false,
            ),
            baselineRow(
              "現金儲備",
              `$${Number(config.cash || 0).toLocaleString("zh-TW")}`,
              "#111111",
              false,
            ),
          ],
        },

        // 心理紀律（你的文字照貼）
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F0F0F0",
          cornerRadius: "md",
          paddingAll: "10px",
          margin: "lg",
          contents: [
            txt("🧠 心理紀律", { weight: "bold", size: "sm", color: "#111111" }),
            txt("「下跌是加碼的禮物，上漲是資產的果實。」", { size: "xs", color: "#666666", margin: "sm", wrap: true }),
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
    contents: [bubble1, bubble2],
  };
}

function buildFactorSection(result) {
  return [
    sep("lg"),
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      contents: [
        txt(`🪓 解除禁令進度 (需≥${result.strategy.threshold.overheatCount})`, { weight: "bold", size: "sm", color: "#111111" }),
        txt(`目前達成數：${result.factor.hitFactor} / ${result.factor.factorCount}`, { size: "xs", color: "#aaaaaa", margin: "xs" }),
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                txt("RSI 強弱", { size: "sm", color: "#666666", flex: 3 }),
                txt(result.RSI?.toFixed(1), { size: "sm", color: "#D93025", weight: "bold", align: "center", flex: 2 }),
                txt(`目標 < ${result.strategy.threshold.rsiCoolOff}`, { size: "xs", color: "#aaaaaa", align: "end", gravity: "center", flex: 4 }),
                txt(result.factor.rsiDrop ? "✔️" : "❌", { size: "sm", align: "end", flex: 1 })
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                txt("KD 指標", { size: "sm", color: "#666666", flex: 3 }),
                txt(result.KD_K?.toFixed(1), { size: "sm", color: "#D93025", weight: "bold", align: "center", flex: 2 }),
                txt(`目標 < ${result.strategy.threshold.kdCoolOff}`, { size: "xs", color: "#aaaaaa", align: "end", gravity: "center", flex: 4 }),
                txt(result.factor.kdDrop ? "✔️" : "❌", { size: "sm", align: "end", flex: 1 })
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                txt("年線乖離", { size: "sm", color: "#666666", flex: 3 }),
                txt(result.bias240?.toFixed(0), { size: "sm", color: "#D93025", weight: "bold", align: "center", flex: 2 }),
                txt(`目標 < ${result.strategy.threshold.bias240CoolOff}%`, { size: "xs", color: "#aaaaaa", align: "end", gravity: "center", flex: 4 }),
                txt(result.factor.biasDrop ? "✔️" : "❌", { size: "sm", align: "end", flex: 1 })
              ],
            },
          ],
        },
      ],
    }
  ];
}

function buildReversalSection(result) {
  return [
    sep("lg"),
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      contents: [
        txt(`📉 反轉訊號掃描 (進場監控)`, { weight: "bold", size: "sm", color: "#111111" }),
        txt(`目前達成數：${result.reversal.hitFactor} / ${result.reversal.totalFactor}`, { size: "xs", color: "#aaaaaa", margin: "xs" }),
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                txt("RSI 強弱", { size: "sm", color: "#666666", flex: 3 }),
                txt(result.RSI?.toFixed(1), { size: "sm", color: "#D93025", weight: "bold", align: "center", flex: 2 }),
                txt(`目標 < ${result.strategy.threshold.rsiCoolOff}`, { size: "xs", color: "#aaaaaa", align: "end", gravity: "center", flex: 4 }),
                txt(result.reversal.rsiDrop ? "✔️" : "❌", { size: "sm", align: "end", flex: 1 }),
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                txt("KD 指標", { size: "sm", color: "#666666", flex: 3 }),
                txt(result.KD_K?.toFixed(1), { size: "sm", color: "#D93025", weight: "bold", align: "center", flex: 2 }),
                txt(`目標 < ${result.strategy.threshold.kdCoolOff}`, { size: "xs", color: "#aaaaaa", align: "end", gravity: "center", flex: 4 }),
                txt(result.reversal.kdDrop ? "✔️" : "❌", { size: "sm", align: "end", flex: 1 }),
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                txt("KD", { size: "sm", color: "#666666", flex: 3 }),
                txt("金叉", { size: "sm", color: "#666666", weight: "bold", align: "center", flex: 2 }),
                txt("需黃金交叉", { size: "xs", color: "#aaaaaa", align: "end", gravity: "center", flex: 4 }),
                txt(result.reversal.kdBullCross ? "✔️" : "❌", { size: "sm", align: "end", flex: 1 }),
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                txt("MACD", { size: "sm", color: "#666666", flex: 3 }),
                txt("金叉", { size: "sm", color: "#666666", weight: "bold", align: "center", flex: 2 }),
                txt("需黃金交叉", { size: "xs", color: "#aaaaaa", align: "end", gravity: "center", flex: 4 }),
                txt(result.reversal.macdBullCross ? "✔️" : "❌", { size: "sm", align: "end", flex: 1 }),
              ],
            },
          ],
        },
      ],
    }
  ];
}