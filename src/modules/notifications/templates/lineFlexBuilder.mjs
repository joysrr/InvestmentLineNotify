// ============================================================================
// 戰報建構函式 (Flex Message Builder)
// ============================================================================

export function buildFlexCarouselFancy({
  result,
  vixData,
  usRisk,
  config,
  dateText,
  aiAdvice,
  quote,
}) {
  // 策略參數
  const strategy = result.strategy || {};
  const th = strategy.threshold || {};
  const buyTh = strategy.buy || {};
  const sellTh = strategy.sell || {};

  // 反轉掃描資料
  const w = result.weightDetails ?? {};
  const r = result.reversal ?? {};
  const s = result.sellSignals ?? {};

  const status = String(result.marketStatus ?? "");

  // 1) 狀態判定與顏色
  const headerBg = status.includes("追繳")
    ? "#B00020"
    : status.includes("過熱") || status.includes("禁撥")
      ? "#D93025"
      : status.includes("轉弱")
        ? "#E67E22"
        : "#2F3136";

  const vixValue = vixData?.value != null ? Number(vixData.value) : NaN;
  const vixValueText = Number.isFinite(vixValue) ? vixValue.toFixed(2) : "N/A";
  const vixLowComplacency = Number.isFinite(th.vixLowComplacency)
    ? Number(th.vixLowComplacency)
    : 13.5;
  const vixHighFear = Number.isFinite(th.vixHighFear)
    ? Number(th.vixHighFear)
    : 20;
  let vixStatusText = `【${vixValueText}/正常】😐`;
  if (Number.isFinite(vixValue)) {
    if (vixValue < vixLowComplacency) {
      vixStatusText = `【${vixValueText}/過度安逸】😴`;
    } else if (vixValue > vixHighFear) {
      vixStatusText = `【${vixValueText}/恐慌】😱`;
    }
  }

  const vixStatusColor =
    Number.isFinite(vixValue) && vixValue < vixLowComplacency
      ? "#2E7D32"
      : Number.isFinite(vixValue) && vixValue > vixHighFear
        ? "#F9A825"
        : "#C62828";

  // Google Sheet 連結
  const sheetUrl = process.env.GOOGLE_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit?usp=drivesdk`
    : null;

  // ========== Bubble 1：核心行動 + 持股儀表板 ==========
  const GOAL_ASSET = 74_800_000;
  const currentAsset = Number(result.netAsset || 0);

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
          size: "md",
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
            txt("📌 核心行動", {
              weight: "bold",
              color: "#D93025",
              size: "sm",
            }),
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

        txt("市場指標", { size: "xs", color: "#aaaaaa", margin: "md" }),

        /** 1) 台指VIX：沿用你原本的 vixStatusText/vixStatusColor **/
        baselineRow("台指VIX", vixStatusText, vixStatusColor, true),

        /** 2) 美股VIX：對齊 baselineRow 樣式 **/
        baselineRow(
          "美股VIX",
          usRisk?.vix && usRisk?.riskLevel
            ? `【${usRisk.vix}/${usRisk.riskLevel}】${usRisk.riskIcon}`
            : "N/A（資料不足）",
          usRisk?.isHighRisk
            ? "#D93025"
            : usRisk?.riskLevel?.includes("風險")
              ? "#F59E0B"
              : "#111111",
          true,
        ),

        /** 3) S&P500：同 baselineRow，顏色跟你其他「紅/綠」一致 **/
        (() => {
          const raw = String(usRisk?.spxChg ?? "");
          const n = Number(raw.replace("%", ""));
          const c = Number.isFinite(n)
            ? n < 0
              ? "#28a745"
              : n > 0
                ? "#D93025"
                : "#111111"
            : "#111111"; // 你 bubble3 變動幅度也是跌綠漲紅
          return baselineRow("S&P500", usRisk?.spxChg ?? "N/A", c, true);
        })(),

        baselineRow(
          "歷史位階",
          result.historicalLevel,
          result.bias240 > th.bias240OverheatLevel ? "#D93025" : "#111111",
          true,
        ),

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
                txt("🛡️ 0050", {
                  size: "xs",
                  color: "#555555",
                  align: "center",
                }),
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
                txt("⚔️ 00675L", {
                  size: "xs",
                  color: "#555555",
                  align: "center",
                }),
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
        sep("lg"),
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          contents: [
            txt("🎯 目標：7,480萬 (33年)", {
              size: "sm",
              color: "#111111",
              weight: "bold",
              margin: "sm",
            }),
            progressBar(currentAsset, GOAL_ASSET),
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

  const dropOk =
    Number.isFinite(dropPct) && Number.isFinite(minDrop) && dropPct >= minDrop;
  const scoreOk =
    Number.isFinite(score) && Number.isFinite(minScore) && score >= minScore;

  const kVal = Number(result.KD_K);
  const dVal = Number(result.KD_D);
  const kdConservative = Math.min(kVal, dVal);
  const kdConservativeText = Number.isFinite(kdConservative)
    ? kdConservative.toFixed(1)
    : "--";

  const bubble2 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("📊 策略訊號掃描", {
          weight: "bold",
          size: "md",
          color: "#111111",
        }),

        sep("md"),
        txt("🟢 進場訊號", {
          weight: "bold",
          size: "sm",
          color: "#28a745",
          margin: "md",
        }),
        {
          type: "box",
          layout: "vertical",
          margin: "sm",
          spacing: "sm",
          contents: [
            scannerRow(
              "跌幅",
              Number.isFinite(w.dropScore) ? String(w.dropScore) : "--",
              w.dropInfo,
              Number.isFinite(w.dropScore) && w.dropScore > 0 ? "ok" : "",
              Number.isFinite(w.dropScore) && w.dropScore > 0
                ? "#28a745"
                : "#111111",
            ),
            scannerRow(
              "RSI",
              Number.isFinite(w.rsiScore) ? String(w.rsiScore) : "--",
              w.rsiInfo,
              Number.isFinite(w.rsiScore) && w.rsiScore > 0 ? "ok" : "",
              Number.isFinite(w.rsiScore) && w.rsiScore > 0
                ? "#28a745"
                : "#111111",
            ),
            scannerRow(
              "MACD",
              Number.isFinite(w.macdScore) ? String(w.macdScore) : "--",
              w.macdInfo,
              Number.isFinite(w.macdScore) && w.macdScore > 0 ? "ok" : "",
              Number.isFinite(w.macdScore) && w.macdScore > 0
                ? "#28a745"
                : "#111111",
            ),
            scannerRow(
              "KD",
              Number.isFinite(w.kdScore) ? String(w.kdScore) : "--",
              w.kdInfo,
              Number.isFinite(w.kdScore) && w.kdScore > 0 ? "ok" : "",
              Number.isFinite(w.kdScore) && w.kdScore > 0
                ? "#28a745"
                : "#111111",
            ),
            sep("sm"),
            scannerRow(
              "總評分",
              Number.isFinite(score) ? String(score) : "--",
              `> ${Number.isFinite(minScore) ? minScore : "--"}`,
              scoreOk,
              scoreOk ? "#28a745" : "#111111",
            ),
          ],
        },

        txt("🟡 轉弱監控", {
          weight: "bold",
          size: "sm",
          color: "#F59E0B",
          margin: "lg",
        }),
        txt(`轉弱觸發數：${r.triggeredCount ?? 0} / ${r.totalFactor ?? 4}`, {
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
              `>${th.rsiReversalLevel} → <${th.rsiReversalLevel}`,
              Boolean(r.rsiDrop),
              r.rsiDrop ? "#D93025" : "#111111",
            ),
            scannerRow(
              "KD(保守)轉弱",
              kdConservativeText,
              `>${th.kReversalLevel} → <${th.kReversalLevel}`,
              Boolean(r.kdDrop),
              r.kdDrop ? "#D93025" : "#111111",
            ),
            scannerRow(
              "KD 死叉",
              r.kdBearCross ? "死叉" : "未發生",
              "K▽D",
              Boolean(r.kdBearCross),
            ),
            scannerRow(
              "MACD",
              r.macdBearCross ? "死叉" : "未發生",
              "DIF▽DEA",
              Boolean(r.macdBearCross),
            ),
          ],
        },
        txt("🔴 賣出訊號", {
          weight: "bold",
          size: "sm",
          color: "#D93025",
          margin: "lg",
        }),
        txt(`賣出觸發數：${s.signalCount ?? 0} / ${s.total ?? 3}`, {
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
              "RSI",
              s.flags.rsiSell ? "已觸發" : "未觸發",
              `>${sellTh.rsi.overbought} → ${sellTh.rsi.overbought}↘`,
              Boolean(s.flags.rsiSell),
              s.flags.rsiSell ? "#D93025" : "#111111",
            ),
            scannerRow(
              "KD",
              s.flags.kdSell ? "已觸發" : "未觸發",
              `K↘D & min(K,D)≥${sellTh.kd.overboughtK} | D↘${sellTh.kd.overboughtK}`,
              Boolean(s.flags.kdSell),
              s.flags.kdSell ? "#D93025" : "#111111",
            ),
            scannerRow(
              "MACD",
              s.flags.macdSell ? "已觸發" : "未觸發",
              "DIF↘DEA & +→−",
              Boolean(s.flags.macdSell),
              s.flags.macdSell ? "#D93025" : "#111111",
            ),
          ],
        },
      ],
    },
  };

  // ========== Bubble 3：技術 & 帳戶 ==========
  const rsiOverheat = Number(th.rsiOverheatLevel ?? 80);
  const dOverheat = Number(th.dOverheatLevel ?? 90);
  const biasOverheat = Number(th.bias240OverheatLevel ?? 25);

  const rsi = Number(result.RSI);
  const d = Number(result.KD_D);
  const bias240 = Number(result.bias240);

  const rsiAlert = Number.isFinite(rsi) && rsi > rsiOverheat;
  const dAlert = Number.isFinite(d) && d > dOverheat;
  const biasAlert = Number.isFinite(bias240) && bias240 > biasOverheat;

  const mm = Number(result.maintenanceMargin);
  const hasLoan = Number(result.totalLoan) > 0;
  const mmSafe = !hasLoan || (Number.isFinite(mm) && mm > 160);
  const z2Safe =
    Number(result.z2Ratio) > Number.isFinite(th.z2TargetRatio)
      ? Number(th.z2TargetRatio) * 100
      : 40;
  const leverageSave = Number.isFinite(strategy.leverage.targetMultiplier)
    ? Number(strategy.leverage.targetMultiplier)
    : 1.8;

  const grossAsset =
    Number(result.netAsset || 0) + Number(result.totalLoan || 0);

  const bubble3 = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        txt("📈 技術指標 & 帳戶", {
          weight: "bold",
          size: "md",
          color: "#111111",
        }),
        sep("md"),

        txt("即時指標", { size: "xs", color: "#aaaaaa" }),
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          spacing: "md",
          contents: [
            indicatorCard(
              "RSI",
              Number.isFinite(rsi) ? rsi.toFixed(1) : "--",
              rsiAlert ? "red" : "",
            ),
            indicatorCard(
              "KD (D)",
              Number.isFinite(d) ? d.toFixed(1) : "--",
              dAlert ? "red" : "",
            ),
            indicatorCard(
              "乖離率",
              Number.isFinite(bias240) ? `${bias240.toFixed(1)}%` : "--",
              biasAlert ? "red" : "",
            ),
          ],
        },
        txt("00675L價格資訊", { size: "xs", color: "#aaaaaa" }),
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          spacing: "md",
          contents: [
            indicatorCard(
              "現價",
              Number.isFinite(result.currentPrice)
                ? result.currentPrice.toFixed(2)
                : "--",
              "",
            ),
            indicatorCard(
              "基準價",
              Number.isFinite(result.basePrice)
                ? result.basePrice.toFixed(2)
                : "--",
              "",
            ),
            indicatorCard(
              "變動幅度",
              Number.isFinite(result.priceChangePercent)
                ? `${result.priceChangePercent.toFixed(1)}%`
                : "--",
              result.priceChangePercent > 0
                ? "red"
                : result.priceChangePercent < 0
                  ? "green"
                  : "",
            ),
          ],
        },

        sep("lg"),

        txt("🛡️ 帳戶安全狀態", {
          weight: "bold",
          size: "sm",
          color: "#111111",
          margin: "md",
        }),
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
              true,
            ),
            baselineRow(
              "總資產(含貸)",
              `$${grossAsset.toLocaleString("zh-TW")}`,
              "#111111",
              false,
            ),
            baselineRow(
              "預估維持率",
              hasLoan && Number.isFinite(mm)
                ? `${mm.toFixed(0)}%`
                : "未動用 (安全)",
              mmSafe ? "#28a745" : "#D93025",
              true,
            ),
            baselineRow(
              "00675L佔比",
              Number.isFinite(Number(result.z2Ratio))
                ? `${Number(result.z2Ratio).toFixed(1)}%`
                : "--",
              z2Safe ? "#111111" : "#D93025",
              true,
            ),
            baselineRow(
              "現金儲備",
              `$${Number(config.cash || 0).toLocaleString("zh-TW")}`,
            ),
            // 實際槓桿顯示
            baselineRow(
              "實際槓桿",
              `${result.actualLeverage} 倍`,
              result.actualLeverage > leverageSave
                ? "#D93025"
                : result.actualLeverage == leverageSave
                  ? "#F59E0B"
                  : "#28a745",
              true,
            ),
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
        {
          type: "text",
          text: "🤖 AI 策略領航",
          weight: "bold",
          size: "md",
          color: "#1A73E8",
        },
        { type: "separator", margin: "md", color: "#E0E0E0" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          paddingAll: "15px",
          backgroundColor: "#F4F7FB", // 極簡淡藍色背景
          cornerRadius: "md",
          contents: buildFlexTextBlocks(aiAdvice || "數據分析中..."),
        },
        {
          type: "text",
          text: "💡 決策依據已由量化模型驗證",
          size: "xxs",
          color: "#AAAAAA",
          margin: "md",
          align: "center",
        },
      ],
    },
  };

  // ========== Bubble 5：心理紀律 + 連結 ==========
  const q = quote || {};
  // ========== Bubble 5：心理紀律 + 連結（同卡片） ==========

  const linksBox = {
    type: "box",
    layout: "horizontal",
    spacing: "xs", // ← sm → xs
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
      txt("💡 每日一句", { size: "xs", color: "#888888" }),

      // 原文
      txt(`“${q.quote}”`, {
        size: "xs", // 建議順便用 xs，減少被 … 截斷機率
        color: "#333333",
        wrap: true,
        maxLines: 10,
        margin: "sm",
      }),
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
        txt("📈 持紀律，享複利", {
          weight: "bold",
          size: "md",
          color: "#111111",
        }),

        sep("lg"),

        // 灰卡（quote + links）
        quoteAndLinksCard,
        linksRowCard,
      ],
    },
  };

  const flexCarousel = {
    type: "carousel",
    contents: [bubble1, bubble2, bubble3, bubble4, bubble5],
  };

  const lineMessages = [
    {
      type: "flex",
      altText: `00675L ${result.marketStatus}`,
      contents: flexCarousel,
    },
  ];

  return lineMessages;
}

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
const scannerRow = (
  label,
  valueText,
  targetText,
  state,
  valueColor = "#111111",
) => ({
  type: "box",
  layout: "horizontal",
  contents: [
    txt(label, { size: "sm", color: "#666666", flex: 3 }),
    txt(valueText ?? "--", {
      size: "sm",
      color: valueColor,
      weight: "bold",
      align: "center",
      flex: 3,
    }),
    txt(targetText ?? "", {
      size: "xxs",
      color: "#aaaaaa",
      align: "end",
      gravity: "center",
      flex: 4,
      wrap: true,
      maxLines: 1,
    }),
    txt(state === "watch" ? "🟡" : state === "ok" || state ? "🟢" : "🔴", {
      size: "sm",
      align: "end",
      flex: 1,
    }),
  ],
});

// 基礎行顯示 (左標籤, 右數值)
const baselineRow = (
  left,
  right,
  rightColor = "#111111",
  rightBold = false,
) => ({
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
const indicatorCard = (label, value, status = "") => ({
  type: "box",
  layout: "vertical",
  backgroundColor:
    status == "red" ? "#FFF5F5" : status == "green" ? "#F0FFF4" : "#F7F7F7",
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
      text: String(value ?? "--"),
      size: "lg",
      weight: "bold",
      color:
        status == "red" ? "#D93025" : status == "green" ? "#28a745" : "#111111",
      align: "center",
    },
  ],
});

// 進度條元件 (用於 Bubble 4)
const progressBar = (current, goal, color = "#28a745") => {
  const c = Number.isFinite(Number(current)) ? Number(current) : 0;
  const g =
    Number.isFinite(Number(goal)) && Number(goal) > 0 ? Number(goal) : 1;
  const percent = Math.min(Math.max((c / g) * 100, 0), 100);

  return {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          txt(`達成率 ${percent.toFixed(1)}%`, {
            size: "xs",
            color: "#666666",
            flex: 1,
          }),
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
