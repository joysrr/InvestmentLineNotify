const axios = require("axios");

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const USER_ID = process.env.USER_ID;

/**
 * 發送 LINE push 訊息（文字）。
 */
async function pushMessage(text) {
  if (!LINE_ACCESS_TOKEN || !USER_ID) {
    console.warn("缺少 LINE_ACCESS_TOKEN 或 USER_ID，跳過推播");
    return;
  }

  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to: USER_ID,
      messages: [{ type: "text", text }],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
      },
    },
  );
}

async function pushMessages(messages) {
  if (!LINE_ACCESS_TOKEN || !USER_ID) {
    console.warn("缺少 LINE_ACCESS_TOKEN 或 USER_ID，跳過推播");
    return;
  }

  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to: USER_ID,
      messages: messages,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
      },
    },
  );
}

function buildFlexCarouselFancy({ result, vixData, config, dateText }) {
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
        {
          type: "text",
          text: `${result.marketStatus.replace("【").replace("】")}`,
          weight: "bold",
          color: "#ffffff",
          size: "lg",
          align: "center",
        },
        {
          type: "text",
          text: `📅 ${dateText} 戰報`,
          color: "#ffffffcc",
          size: "xs",
          align: "center",
          margin: "sm",
        },
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
            {
              type: "text",
              text: "🏹 核心行動指令",
              weight: "bold",
              color: "#D93025",
              size: "sm",
            },
            {
              type: "text",
              text: result.target,
              weight: "bold",
              size: "xl",
              color: "#111111",
              margin: "sm",
              wrap: true,
            },
            {
              type: "text",
              text: result.targetSuggestion,
              size: "xs",
              color: "#666666",
            },
          ],
        },

        { type: "separator", margin: "lg" }, // separator 元件可用於 box.contents [web:405]

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
                {
                  type: "text",
                  text: "🎭 恐慌 VIX",
                  color: "#aaaaaa",
                  size: "sm",
                  flex: 4,
                },
                {
                  type: "text",
                  text: vixShort,
                  wrap: true,
                  color: "#111111",
                  size: "sm",
                  flex: 6,
                  align: "end",
                  weight: "bold",
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "🛡️ 0050",
                  color: "#666666",
                  size: "sm",
                  flex: 4,
                },
                {
                  type: "text",
                  text: `${config.qty0050} 股`,
                  size: "sm",
                  color: "#111111",
                  weight: "bold",
                  align: "end",
                  flex: 6,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "⚔️ 正2",
                  color: "#666666",
                  size: "sm",
                  flex: 4,
                },
                {
                  type: "text",
                  text: `${config.qtyZ2} 股`,
                  size: "sm",
                  color: "#D93025",
                  weight: "bold",
                  align: "end",
                  flex: 6,
                },
              ],
            },
          ],
        },
        isOverheat ? buildFactor(result) : "",
        buildReversal(result),
      ],
    },
  };

  const bubble2 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🔍 技術指標細節",
          weight: "bold",
          size: "md",
          color: "#111111",
        },

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

        { type: "separator", margin: "xl" },

        {
          type: "text",
          text: "🛡️ 帳戶安全狀態",
          weight: "bold",
          size: "md",
          margin: "lg",
        },

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
            {
              type: "text",
              text: "🧠 心理紀律",
              size: "xs",
              weight: "bold",
              color: "#555555",
            },
            {
              type: "text",
              text: "「下跌是加碼的禮物，上漲是資產的果實。」",
              size: "xs",
              color: "#666666",
              wrap: true,
              margin: "xs",
            },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "目標：7,480萬 (33年)",
          size: "xxs",
          color: "#aaaaaa",
          align: "center",
        },
        {
          type: "separator",
          margin: "md",
        },
        {
          type: "button",
          style: "link",
          height: "sm",
          action: {
            type: "uri",
            label: "財富自由領航表",
            uri: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`,
          },
        },
        {
          type: "button",
          style: "link",
          height: "sm",
          action: {
            type: "uri",
            label: "策略檔案",
            uri: process.env.STRATEGY_URL,
          },
        },
      ],
    },
  };

  return {
    type: "carousel",
    contents: [bubble1, bubble2],
  };
}

function buildFactor(result) {
  return (
    {
      type: "separator",
      margin: "lg",
    },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      contents: [
        {
          type: "text",
          text: `🪓 解除禁令進度 (需≥${result.strategy.threshold.overheatCount})`,
          weight: "bold",
          size: "sm",
          color: "#111111",
        },
        {
          type: "text",
          text: `目前達成數：${result.factor.hitFactor} / ${result.factor.factorCount}`,
          size: "xs",
          color: "#aaaaaa",
          margin: "xs",
        },
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
                {
                  type: "text",
                  text: "RSI 強弱",
                  size: "sm",
                  color: "#666666",
                  flex: 3,
                },
                {
                  type: "text",
                  text: result.RSI?.toFixed(1),
                  size: "sm",
                  color: "#D93025",
                  weight: "bold",
                  align: "center",
                  flex: 2,
                },
                {
                  type: "text",
                  text: `目標< ${result.strategy.threshold.rsiCoolOff}`,
                  size: "xs",
                  color: "#aaaaaa",
                  align: "end",
                  gravity: "center",
                  flex: 4,
                },
                {
                  type: "text",
                  text: result.factor.rsiDrop ? "✔️" : "❌",
                  size: "sm",
                  align: "end",
                  flex: 1,
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "K 值",
                  size: "sm",
                  color: "#666666",
                  flex: 3,
                },
                {
                  type: "text",
                  text: result.KD_K?.toFixed(1),
                  size: "sm",
                  color: "#D93025",
                  weight: "bold",
                  align: "center",
                  flex: 2,
                },
                {
                  type: "text",
                  text: `目標 < ${result.strategy.threshold.kdCoolOff}`,
                  size: "xs",
                  color: "#aaaaaa",
                  align: "end",
                  gravity: "center",
                  flex: 4,
                },
                {
                  type: "text",
                  text: result.factor.kdDrop ? "✔️" : "❌",
                  size: "sm",
                  align: "end",
                  flex: 1,
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "年線乖離",
                  size: "sm",
                  color: "#666666",
                  flex: 3,
                },
                {
                  type: "text",
                  text: result.bias240.toFixed(0),
                  size: "sm",
                  color: "#D93025",
                  weight: "bold",
                  align: "center",
                  flex: 2,
                },
                {
                  type: "text",
                  text: `目標 < ${result.strategy.threshold.bias240CoolOff}%`,
                  size: "xs",
                  color: "#aaaaaa",
                  align: "end",
                  gravity: "center",
                  flex: 4,
                },
                {
                  type: "text",
                  text: result.factor.biasDrop ? "✔️" : "❌",
                  size: "sm",
                  align: "end",
                  flex: 1,
                },
              ],
            },
          ],
        },
      ],
    }
  );
}

function buildReversal(result) {
  return (
    {
      type: "separator",
      margin: "lg",
    },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      contents: [
        {
          type: "text",
          text: "📉 反轉訊號掃描 (進場監控)",
          weight: "bold",
          size: "sm",
          color: "#111111",
        },
        {
          type: "text",
          text: `目前達成數：${result.reversal.hitFactor} / ${result.reversal.totalFactor}`,
          size: "xs",
          color: "#aaaaaa",
          margin: "xs",
        },
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
                {
                  type: "text",
                  text: "RSI 強弱",
                  size: "sm",
                  color: "#666666",
                  flex: 3,
                },
                {
                  type: "text",
                  text: result.RSI?.toFixed(1),
                  size: "sm",
                  color: "#D93025",
                  weight: "bold",
                  align: "center",
                  flex: 2,
                },
                {
                  type: "text",
                  text: `目標 < ${result.strategy.threshold.rsiCoolOff}`,
                  size: "xs",
                  color: "#aaaaaa",
                  align: "end",
                  gravity: "center",
                  flex: 4,
                },
                {
                  type: "text",
                  text: result.reversal.rsiDrop ? "✔️" : "❌",
                  size: "sm",
                  align: "end",
                  flex: 1,
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "KD 指標",
                  size: "sm",
                  color: "#666666",
                  flex: 3,
                },
                {
                  type: "text",
                  text: result.KD_K?.toFixed(1),
                  size: "sm",
                  color: "#D93025",
                  weight: "bold",
                  align: "center",
                  flex: 2,
                },
                {
                  type: "text",
                  text: `目標 < ${result.strategy.threshold.kdCoolOff}`,
                  size: "xs",
                  color: "#aaaaaa",
                  align: "end",
                  gravity: "center",
                  flex: 4,
                },
                {
                  type: "text",
                  text: result.reversal.rsiDrop ? "✔️" : "❌",
                  size: "sm",
                  align: "end",
                  flex: 1,
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "KD",
                  size: "sm",
                  color: "#666666",
                  flex: 3,
                },
                {
                  type: "text",
                  text: "死叉",
                  size: "sm",
                  color: "#666666",
                  weight: "bold",
                  align: "center",
                  flex: 2,
                },
                {
                  type: "text",
                  text: "需死亡交叉",
                  size: "xs",
                  color: "#aaaaaa",
                  align: "end",
                  gravity: "center",
                  flex: 4,
                },
                {
                  type: "text",
                  text: result.reversal.kdBearCross ? "✔️" : "❌",
                  size: "sm",
                  align: "end",
                  flex: 1,
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "MACD",
                  size: "sm",
                  color: "#666666",
                  flex: 3,
                },
                {
                  type: "text",
                  text: "死叉",
                  size: "sm",
                  color: "#666666",
                  weight: "bold",
                  align: "center",
                  flex: 2,
                },
                {
                  type: "text",
                  text: "需死亡交叉",
                  size: "xs",
                  color: "#aaaaaa",
                  align: "end",
                  gravity: "center",
                  flex: 4,
                },
                {
                  type: "text",
                  text: result.reversal.macdBearCross ? "✔️" : "❌",
                  size: "sm",
                  align: "end",
                  flex: 1,
                },
              ],
            },
          ],
        },
      ],
    }
  );
}

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

// 小工具：左右兩欄 baseline row
function baselineRow(left, right, rightColor = "#111111", rightBold = false) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: left, size: "sm", color: "#666666", flex: 1 },
      {
        type: "text",
        text: right,
        size: "sm",
        color: rightColor,
        weight: rightBold ? "bold" : "regular",
        flex: 1,
        align: "end",
      },
    ],
  };
}

module.exports = { pushMessage, pushMessages, buildFlexCarouselFancy };
