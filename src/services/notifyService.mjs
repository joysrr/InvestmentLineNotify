import axios from "axios";
import { toArray } from "../utils/arrayUtils.mjs";
import { getDailyQuote } from "./quoteService.mjs";
import { buildFlexTextBlocks } from "../utils/flexTextParser.mjs";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

const quote = await getDailyQuote();

// ============================================================================
// UI 元件 Helper Functions
// ============================================================================

const sep = (margin = "md") => ({ type: "separator", margin });

const txt = (text, opt = {}) => ({
  type: "text",
  text: String(text ?? ""),
  size: "sm",
  color: "#111111",
  ...opt,
});

const uriButtonBox = (label, uri, opt = {}) => {
  const {
    bg = "#F8F9FA",
    textColor = "#1A73E8",
    borderColor = "#DADCE0",
  } = opt;

  return {
    type: "box",
    layout: "vertical",
    flex: 1,
    backgroundColor: bg,
    borderColor,
    borderWidth: "1px",
    cornerRadius: "md",
    paddingAll: "8px",
    justifyContent: "center",
    contents: [
      txt(label, {
        size: "xxs",
        color: textColor,
        align: "center",
        wrap: false,
        maxLines: 1,
        action: { type: "uri", label, uri },
      }),
    ],
  };
};

const uriLinkText = (label, uri, color = "#4285F4") =>
  txt(label, {
    size: "xxs",
    color,
    action: { type: "uri", label, uri },
    decoration: "underline",
    align: "center",
    wrap: false,
    maxLines: 1,
  });

// 產生帶有顏色的狀態文字（目前未使用，可保留）
const statusText = (
  condition,
  textTrue,
  textFalse,
  colorTrue = "#28a745",
  colorFalse = "#D93025",
) => ({
  type: "text",
  text: condition ? textTrue : textFalse,
  size: "xs",
  color: condition ? colorTrue : colorFalse,
  weight: "bold",
});

// 列表式掃描儀的一行：標籤 | 數值 | 門檻條件 | 狀態
const scannerRow = (label, valueText, targetText, state, valueColor = "#111111") => ({
  type: "box",
  layout: "horizontal",
  contents: [
    txt(label, { size: "sm", color: "#666666", flex: 3 }),
    txt(valueText ?? "--", { size: "sm", color: valueColor, weight: "bold", align: "center", flex: 3 }),
    txt(targetText ?? "", { size: "xs", color: "#aaaaaa", align: "end", gravity: "center", flex: 4, wrap: true, maxLines: 1 }),
    txt(state === "watch" ? "👀" : state === "ok" ? "✅" : "❌", { size: "sm", align: "end", flex: 1 }),
  ],
});


// 基礎行顯示 (左標籤, 右數值)
const baselineRow = (left, right, rightColor = "#111111", rightBold = false) => ({
  type: "box",
  layout: "baseline",
  contents: [
    txt(left, { size: "sm", color: "#666666", flex: 4 }),
    txt(right ?? "--", {
      size: "sm",
      color: rightColor,
      weight: rightBold ? "bold" : "regular",
      flex: 6,
      align: "end",
      wrap: true,
    }),
  ],
});

// 技術指標卡片 (數值大字顯示)
const indicatorCard = (label, value, isAlert = false) => ({
  type: "box",
  layout: "vertical",
  backgroundColor: isAlert ? "#FFF5F5" : "#F7F7F7",
  cornerRadius: "md",
  paddingAll: "8px",
  contents: [
    { type: "text", text: label, size: "xs", color: "#888888", align: "center" },
    {
      type: "text",
      text: String(value ?? "--"),
      size: "lg",
      weight: "bold",
      color: isAlert ? "#D93025" : "#111111",
      align: "center",
    },
  ],
});

// 進度條元件 (用於 Bubble 4)
const progressBar = (current, goal, color = "#28a745") => {
  const c = Number.isFinite(Number(current)) ? Number(current) : 0;
  const g = Number.isFinite(Number(goal)) && Number(goal) > 0 ? Number(goal) : 1;
  const percent = Math.min(Math.max((c / g) * 100, 0), 100);

  return {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          txt(`達成率 ${percent.toFixed(1)}%`, { size: "xs", color: "#666666", flex: 1 }),
          txt(`$${(c / 10000).toFixed(0)}萬 / $${(g / 10000).toFixed(0)}萬`, {
            size: "xs",
            color: "#aaaaaa",
            align: "end",
            flex: 1,
          }),
        ],
        margin: "sm",
      },
      {
        type: "box",
        layout: "vertical",
        backgroundColor: "#E0E0E0",
        cornerRadius: "md",
        height: "6px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: color,
            cornerRadius: "md",
            width: `${percent}%`,
            height: "6px",
            contents: [{ type: "spacer", size: "xs" }],
          },
        ],
      },
    ],
  };
};

const okX = (b) => (b ? "✔️" : "❌");
const safeNum = (v) => (Number.isFinite(v) ? v : NaN);

// ============================================================================
// 主推播函式
// ============================================================================

export async function pushLine(input, { to = process.env.USER_ID } = {}) {
  const token = process.env.LINE_ACCESS_TOKEN;

  if (!token || !to) {
    console.warn("缺少 LINE_ACCESS_TOKEN 或 USER_ID/to，跳過推播");
    return { ok: false, skipped: true };
  }

  const messages =
    typeof input === "string" ? [{ type: "text", text: input }] : toArray(input);

  if (!Array.isArray(messages) || messages.length === 0) {
    console.warn("messages 為空，跳過推播");
    return { ok: false, skipped: true };
  }

  // push messages 常見上限 5
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
    return { ok: true, status: res.status };
  } catch (error) {
    console.error("LINE push failed", {
      status: error?.response?.status,
      message: error?.response?.data?.message,
      details: JSON.stringify(error?.response?.data?.details),
      requestId: error?.response?.headers?.["x-line-request-id"],
    });
    throw error;
  }
}

// ============================================================================
// 戰報建構函式 (Flex Message Builder)
// ============================================================================

export function buildFlexCarouselFancy({ result, vixData, config, dateText, aiAdvice }) {
  const status = String(result.marketStatus ?? "");

  // 1) 狀態判定與顏色
  const headerBg =
    status.includes("追繳") ? "#B00020" :
      status.includes("過熱") || status.includes("禁撥") ? "#D93025" :
        status.includes("轉弱") ? "#E67E22" :
          "#2F3136";

  const vixValue = vixData?.value != null ? Number(vixData.value) : NaN;
  const vixValueText = Number.isFinite(vixValue) ? vixValue.toFixed(2) : "N/A";
  const vixStatus =
    Number.isFinite(vixValue) && vixValue < 13.5 ? "過度安逸" :
      Number.isFinite(vixValue) && vixValue > 20 ? "恐慌" :
        "正常";

  // 策略參數
  const strategy = result.strategy || {};
  const th = strategy.threshold || {};
  const buyTh = strategy.buy || {};
  const sellTh = strategy.sell || {};

  // 反轉掃描資料
  const r = result.reversal ?? {};

  // Google Sheet 連結
  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`
    : null;

  // ========== Bubble 1：核心行動 + 持股儀表板 ==========
  const bubble1 = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: headerBg,
      paddingAll: "15px",
      contents: [
        txt(status.replace(/[【】]/g, ""), {
          weight: "bold",
          color: "#ffffff",
          size: "xl",
          align: "center",
        }),
        txt(`📅 ${dateText} 戰報`, {
          color: "#ffffffcc",
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
          contents: [
            txt("🏹 核心行動", { weight: "bold", color: "#D93025", size: "sm" }),
            txt(result.target ?? "觀望", {
              weight: "bold",
              size: "xl",
              color: "#111111",
              margin: "sm",
              wrap: true,
              maxLines: 2,
            }),
            txt(result.targetSuggestion ?? "", {
              size: "xs",
              color: "#666666",
              wrap: true,
              maxLines: 3,
            }),
          ],
        },

        sep("lg"),

        {
          type: "box",
          layout: "horizontal",
          contents: [
            txt("🎭 恐慌 VIX", { size: "sm", color: "#666666", flex: 3 }),
            txt(`${vixValueText} (${vixStatus})`, {
              size: "sm",
              color: "#111111",
              weight: "bold",
              align: "end",
              flex: 7,
              wrap: true,
            }),
          ],
        },

        sep("md"),

        txt("✅ 持股配置", { size: "sm", color: "#aaaaaa", margin: "md" }),
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#F7F7F7",
              cornerRadius: "md",
              paddingAll: "10px",
              flex: 1,
              contents: [
                txt("🛡️ 0050 (盾)", { size: "xs", color: "#555555", align: "center" }),
                txt(`${config.qty0050} 股`, {
                  size: "md",
                  weight: "bold",
                  color: "#111111",
                  align: "center",
                  margin: "sm",
                }),
              ],
            },
            {
              type: "box",
              layout: "vertical",
              backgroundColor: "#FFF5F5",
              cornerRadius: "md",
              paddingAll: "10px",
              flex: 1,
              contents: [
                txt("⚔️ 00675L (矛)", { size: "xs", color: "#555555", align: "center" }),
                txt(`${config.qtyZ2} 股`, {
                  size: "md",
                  weight: "bold",
                  color: "#D93025",
                  align: "center",
                  margin: "sm",
                }),
              ],
            },
          ],
        },
      ],
    },
  };

  // ========== Bubble 2：策略掃描 (列表式) ==========
  const minDrop = Number(buyTh.minDropPercentToConsider ?? NaN);
  const minScore = Number(buyTh.minWeightScoreToBuy ?? NaN);

  const dropPct = Number(result.priceDropPercent);
  const score = Number(result.weightScore);

  const dropOk = Number.isFinite(dropPct) && Number.isFinite(minDrop) && dropPct >= minDrop;
  const scoreOk = Number.isFinite(score) && Number.isFinite(minScore) && score >= minScore;

  const bubble2 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("📊 策略訊號掃描", { weight: "bold", size: "md", color: "#111111" }),

        sep("md"),
        txt("🟢 進場條件 (低檔加碼)", { weight: "bold", size: "sm", color: "#28a745" }),
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          spacing: "sm",
          contents: [
            scannerRow(
              "跌幅(監控)",
              `${result.priceDropPercentText}%`,
              `進場門檻 ≥ ${minDrop}%`,
              dropOk ? "ok" : "watch",
              dropOk ? "#28a745" : "#111111"
            ),
            scannerRow(
              "總評分",
              Number.isFinite(score) ? String(score) : "--",
              `需 > ${Number.isFinite(minScore) ? minScore : "--"} 分`,
              scoreOk,
              scoreOk ? "#28a745" : "#111111",
            ),
          ],
        },

        sep("lg"),
        txt("🔴 轉弱/過熱訊號 (監控賣點)", { weight: "bold", size: "sm", color: "#D93025" }),
        txt(`觸發數：${r.triggeredCount ?? 0} / ${r.totalFactor ?? 4}`, {
          size: "xs",
          color: "#aaaaaa",
          margin: "xs",
        }),

        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          spacing: "sm",
          contents: [
            scannerRow(
              "RSI 轉弱",
              result.RSI != null ? Number(result.RSI).toFixed(1) : "--",
              `跌破 < ${th.rsiReversalLevel ?? 60}`,
              Boolean(r.rsiDrop),
              r.rsiDrop ? "#D93025" : "#111111",
            ),
            scannerRow(
              "K值 轉弱",
              result.KD_K != null ? Number(result.KD_K).toFixed(1) : "--",
              `跌破 < ${th.kReversalLevel ?? 80}`,
              Boolean(r.kdDrop),
              r.kdDrop ? "#D93025" : "#111111",
            ),
            scannerRow("KD 死叉", r.kdBearCross ? "死叉" : "安全", "需死叉", Boolean(r.kdBearCross)),
            scannerRow("MACD", r.macdBearCross ? "死叉" : "安全", "需死叉", Boolean(r.macdBearCross)),
          ],
        },
      ],
    },
  };

  // ========== Bubble 3：技術 & 帳戶 ==========
  const rsiOverheat = Number(th.rsiOverheatLevel ?? 80);
  const kOverheat = Number(th.kOverheatLevel ?? 90);
  const biasOverheat = Number(th.bias240OverheatLevel ?? 25);

  const rsi = Number(result.RSI);
  const k = Number(result.KD_K);
  const bias240 = Number(result.bias240);

  const rsiAlert = Number.isFinite(rsi) && rsi > rsiOverheat;
  const kAlert = Number.isFinite(k) && k > kOverheat;
  const biasAlert = Number.isFinite(bias240) && bias240 > biasOverheat;

  const mm = Number(result.maintenanceMargin);
  const hasLoan = Number(result.totalLoan) > 0;
  const mmSafe = !hasLoan || (Number.isFinite(mm) && mm > 160);

  const currentAsset = Number(result.netAsset || 0);
  const grossAsset = Number(result.netAsset || 0) + Number(result.totalLoan || 0);

  const bubble3 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("📈 技術指標 & 帳戶", { weight: "bold", size: "md", color: "#111111" }),
        sep("md"),

        txt("即時指標", { size: "xs", color: "#aaaaaa" }),
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          spacing: "md",
          contents: [
            indicatorCard("RSI", Number.isFinite(rsi) ? rsi.toFixed(1) : "--", rsiAlert),
            indicatorCard("KD (K)", Number.isFinite(k) ? k.toFixed(1) : "--", kAlert),
            indicatorCard(
              "乖離率",
              Number.isFinite(bias240) ? `${bias240.toFixed(1)}%` : "--",
              biasAlert,
            ),
          ],
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
              "帳戶總值",
              `$${currentAsset.toLocaleString("zh-TW")}`,
              "#111111",
              true
            ),
            baselineRow("總資產(含貸)", `$${grossAsset.toLocaleString("zh-TW")}`, "#111111", false),
            baselineRow(
              "預估維持率",
              hasLoan && Number.isFinite(mm) ? `${mm.toFixed(0)}%` : "未動用 (安全)",
              mmSafe ? "#28a745" : "#D93025",
              true,
            ),
            baselineRow(
              "正2 佔比",
              Number.isFinite(Number(result.z2Ratio)) ? `${Number(result.z2Ratio).toFixed(1)}%` : "--",
              Number(result.z2Ratio) > 40 ? "#D93025" : "#111111",
              true,
            ),
            baselineRow("現金儲備", `$${Number(config.cash || 0).toLocaleString("zh-TW")}`),
          ],
        },
      ],
    },
  };

  // ========== Bubble 4：AI 策略領航 (新增) ==========
  const bubble4 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🤖 AI 策略領航", weight: "bold", size: "md", color: "#1A73E8" },
        { type: "separator", margin: "md", color: "#E0E0E0" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          paddingAll: "15px",
          backgroundColor: "#F4F7FB", // 極簡淡藍色背景
          cornerRadius: "md",
          contents: buildFlexTextBlocks(aiAdvice || "數據分析中...")
        },
        {
          type: "text",
          text: "💡 決策依據已由量化模型驗證",
          size: "xxs",
          color: "#AAAAAA",
          margin: "md",
          align: "center"
        }
      ]
    }
  };
  
  // ========== Bubble 5：心理紀律 + 進度條 + 連結 ==========
  const GOAL_ASSET = 74_800_000;

  const q = quote || {};
  const en = q.textEn || q.textZh || "Discipline beats prediction.";
  const zh = q.textZh && q.textZh !== q.textEn ? q.textZh : "";

  // ========== Bubble 5：心理紀律 + 進度條 + 連結（同卡片） ==========

  const linksBox = {
    type: "box",
    layout: "horizontal",
    spacing: "xs",     // ← sm → xs
    margin: "sm",
    contents: [
      sheetUrl
        ? uriButtonBox("📊 開啟財富領航表", sheetUrl, {
          bg: "#F8F9FA",
          borderColor: "#DADCE0",
          textColor: "#1A73E8",
        })
        : null,
      process.env.STRATEGY_URL
        ? uriButtonBox("📄 查看策略設定檔", process.env.STRATEGY_URL, {
          bg: "#F8F9FA",
          borderColor: "#DADCE0",
          textColor: "#5F6368",
        })
        : null,
    ].filter(Boolean),
  };


  const quoteAndLinksCard = {
    type: "box",
    layout: "vertical",
    backgroundColor: "#F0F0F0",
    cornerRadius: "md",
    paddingAll: "12px",
    margin: "md",
    contents: [
      txt("💡 投資心法", { size: "xs", color: "#888888" }),

      // 原文（主）
      txt(`“${en}”`, {
        size: "xs",        // 建議順便用 xs，減少被 … 截斷機率
        color: "#333333",
        wrap: true,
        maxLines: 6,
        margin: "sm",
      }),

      // 翻譯（副）
      zh
        ? txt(zh, {
          size: "xxs",
          color: "#777777",
          wrap: true,
          maxLines: 6,
          margin: "sm",
        })
        : null,

      txt(`— ${q.author || "Unknown"}`, {
        size: "xs",
        color: "#888888",
        align: "end",
        margin: "sm",
      }),
    ].filter(Boolean),
  };

  const linksRowCard = {
    type: "box",
    layout: "horizontal",
    spacing: "xs",
    margin: "md",
    contents: [
      sheetUrl
        ? uriButtonBox("📊 開啟財富領航表", sheetUrl, {
          bg: "#F8F9FA",
          borderColor: "#DADCE0",
          textColor: "#1A73E8",
        })
        : null,
      process.env.STRATEGY_URL
        ? uriButtonBox("📄 查看策略設定檔", process.env.STRATEGY_URL, {
          bg: "#F8F9FA",
          borderColor: "#DADCE0",
          textColor: "#5F6368",
        })
        : null,
    ].filter(Boolean),
  };

  const bubble5 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("🧠 財富自由航道", { weight: "bold", size: "md", color: "#111111" }),

        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          contents: [
            txt("🎯 終極目標：7,480萬 (33年)", {
              size: "sm",
              color: "#111111",
              weight: "bold",
              margin: "sm",
            }),
            progressBar(currentAsset, GOAL_ASSET),
          ],
        },

        sep("lg"),

        // 灰卡（quote + links）
        quoteAndLinksCard,
        linksRowCard,
      ],
    },
  };

  return {
    type: "carousel",
    contents: [bubble1, bubble2, bubble3, bubble4, bubble5],
  };
}
