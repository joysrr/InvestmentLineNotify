/**
 * AI 數據預處理工具：將龐大的量化數據轉換為教練 AI 易讀的純文字簡報
 */

const n2 = (v) => {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
};

const fmt = (v, defaultStr = "--") => (v != null ? v : defaultStr);

export function formatQuantDataForCoach(
  marketData,
  portfolio = {},
  vixData = null,
) {
  // 1. 抽取策略與門檻參數
  const st = marketData?.strategy || {};
  const buyTh = st.buy || {};
  const sellTh = st.sell || {};
  const th = st.threshold || {};
  const lev = st.leverage || {};

  // ===== 帳戶與風控數據 =====
  const actualLev = n2(marketData?.actualLeverage);
  const targetLev = n2(lev.targetMultiplier);
  const mm = n2(marketData?.maintenanceMargin);
  const z2Ratio = n2(marketData?.z2Ratio);
  const z2TargetPct =
    th.z2TargetRatio != null ? n2(th.z2TargetRatio * 100) : null;
  const cash = n2(portfolio?.cash);
  const qty0050 = portfolio?.qty0050 ?? 0;
  const qtyZ2 = portfolio?.qtyZ2 ?? 0;

  let levStatus = "安全";
  if (actualLev != null && targetLev != null) {
    if (actualLev > targetLev) levStatus = "⚠️ 過度擴張 (超標)";
    else if (Math.abs(actualLev - targetLev) <= 0.1) levStatus = "⚖️ 目標區間";
    else levStatus = "🛡️ 防禦狀態 (具備加碼空間)";
  }

  // ===== 進場評分數據 =====
  const actualScore = n2(
    marketData?.weightScore ?? marketData?.entry?.weightScore,
  );
  const minScore = n2(buyTh.minWeightScoreToBuy);
  const scoreReached =
    actualScore != null && minScore != null && actualScore >= minScore;

  const entryHits =
    [
      marketData?.weightDetails?.dropInfo,
      marketData?.weightDetails?.rsiInfo,
      marketData?.weightDetails?.macdInfo,
      marketData?.weightDetails?.kdInfo,
    ]
      .filter(Boolean)
      .join("、") || "無";

  // ===== 風險與賣出指標 =====
  const vixVal = n2(vixData?.value);
  const vixHighTh = n2(th.vixHighFear);
  let vixLabel = "正常區間";
  if (vixVal != null && vixHighTh != null && vixVal > vixHighTh) {
    vixLabel = "🔥 落入高波動區 (偏恐慌)";
  } else if (
    vixVal != null &&
    th.vixLowComplacency != null &&
    vixVal < th.vixLowComplacency
  ) {
    vixLabel = "❄️ 落入低波動區 (偏安逸)";
  }

  const histLevel = marketData?.historicalLevel || "未知";
  const overheatHits = n2(marketData?.overheat?.highCount) || 0;
  const reversalHits = n2(marketData?.reversal?.triggeredCount) || 0;
  const sellHits = n2(marketData?.sellSignals?.signalCount) || 0;

  const mktStatus = marketData?.marketStatus || "未知";
  const suggestionShort = marketData?.targetSuggestionShort || "無特殊建議";

  // 2. 組裝成純文字簡報結構 (加入策略參數配置區塊)
  return `
【量化系統判定狀態】
系統狀態：${mktStatus}
行動建議：${marketData?.target || "觀望"} (${suggestionShort})

【帳戶風控狀態】
實際槓桿：${fmt(actualLev)} 倍 (目標 ${fmt(targetLev)} 倍) ➔ 狀態：${levStatus}
大盤維持率：${fmt(mm)}%
00675L佔比：${fmt(z2Ratio)}% (目標上限 ${fmt(z2TargetPct)}%)
現金儲備：$${cash != null ? cash.toLocaleString("en-US") : "--"}
持股分佈：0050 (${qty0050.toLocaleString("en-US")} 股) / 00675L (${qtyZ2.toLocaleString("en-US")} 股)

【買進條件判定】
總評分：${fmt(actualScore)} 分 (門檻 ${fmt(minScore)} 分) ➔ ${scoreReached ? "🟢已達標" : "🔴未達標"}
觸發因子：${entryHits}

【風險與賣出監控】
大盤位階：${histLevel}
VIX指數：${fmt(vixVal)} ➔ ${vixLabel}
過熱指標：觸發 ${overheatHits} 個 (門檻 ${fmt(th.overheatCount)})
轉弱指標：觸發 ${reversalHits} 個 (門檻 ${fmt(th.reversalTriggerCount)})
賣出訊號：觸發 ${sellHits} 次 (門檻 ${fmt(sellTh.minSignalCountToSell)})

【底層策略參數配置 (供教練決策參考)】
- 目標槓桿倍數：${fmt(lev.targetMultiplier)}
- 買入分數門檻：${fmt(buyTh.minWeightScoreToBuy)} 分
- 賣出觸發門檻：累積 ${fmt(sellTh.minSignalCountToSell)} 個賣出訊號
- 乖離過熱門檻：累積 ${fmt(th.overheatCount)} 個過熱因子
- 轉弱確認門檻：累積 ${fmt(th.reversalTriggerCount)} 個轉弱因子
- VIX 恐慌/安逸線：> ${fmt(th.vixHighFear)} / < ${fmt(th.vixLowComplacency)}
- 融資斷頭警戒線：低於 ${fmt(th.mmDanger)}%
- 00675L 佔比上限：${fmt(z2TargetPct)}% (硬限制 ${fmt(n2(th.z2RatioHigh * 100))}%)
`.trim();
}

/**
 * 將 CNN 原始資料轉換為 AI 教練易於閱讀的結構與趨勢描述
 * @param {Object} rawData - fetchFearAndGreedIndex() 的回傳值
 * @returns {Object} 供 AI 解析的結構化資料
 */
export function formatCnnDataForAi(rawData) {
  // 防呆：確保傳入的資料有效
  if (!rawData || typeof rawData.score !== "number") {
    return { error: "無法取得有效的 CNN 恐懼貪婪資料" };
  }

  const { score, rating, previousClose, previous1Week } = rawData;

  // 1. 將英文 rating 轉換為中文標籤，讓 AI 判讀更直觀
  const ratingMap = {
    "extreme fear": "極度恐慌",
    fear: "恐慌",
    neutral: "中立",
    greed: "貪婪",
    "extreme greed": "極度貪婪",
  };
  const currentRating = ratingMap[rating.toLowerCase()] || rating;

  // 2. 計算短期與中期趨勢 (用來判斷情緒是正在惡化還是好轉)
  const diffFromYesterday = Number((score - previousClose).toFixed(1));
  const diffFromLastWeek = Number((score - previous1Week).toFixed(1));

  let shortTermTrend = "持平";
  if (diffFromYesterday > 2)
    shortTermTrend = `情緒回暖 (+${diffFromYesterday}分)`;
  else if (diffFromYesterday < -2)
    shortTermTrend = `恐慌加劇 (${diffFromYesterday}分)`;

  let midTermTrend = "盤整";
  if (diffFromLastWeek > 5)
    midTermTrend = `較上週明顯樂觀 (+${diffFromLastWeek}分)`;
  else if (diffFromLastWeek < -5)
    midTermTrend = `較上週明顯悲觀 (${diffFromLastWeek}分)`;

  // 3. 組合出給 AI 看的完美 JSON
  return {
    指標名稱: "CNN 恐懼與貪婪指數 (美股情緒)",
    當前狀態: `${score}分 (${currentRating})`,
    短期趨勢_較昨日: shortTermTrend,
    中期趨勢_較上週: midTermTrend,
    AI解讀提示:
      score <= 25
        ? "進入極度恐慌，留意美股左側超跌買點"
        : score >= 75
          ? "進入極度貪婪，留意美股過熱回檔風險"
          : "情緒處於正常區間，不構成極端反轉訊號",
  };
}

/**
 * 將台股融資餘額與維持率轉換為 AI 教練易於閱讀的結構與趨勢描述
 * @param {Object} rawMargin - fetchTwseMarginData() 的回傳值
 * @returns {Object} 供 AI 解析的結構化資料
 */
export function formatMarginForAi(rawMargin) {
  // 防呆檢查
  if (!rawMargin || typeof rawMargin.maintenanceRatio !== "number") {
    return { error: "無法取得有效的台股融資資料" };
  }

  const { marginBalance100M, marginBalanceChange100M, maintenanceRatio } =
    rawMargin;

  // 1. 判斷大盤維持率位階 (籌碼安定度)
  let ratioStatus = "正常";
  let ratioAdvice = "籌碼安定，無系統性斷頭風險";

  if (maintenanceRatio >= 166) {
    ratioStatus = "極度安全";
  } else if (maintenanceRatio < 135) {
    ratioStatus = "極度恐慌 (歷史低點)";
    ratioAdvice =
      "大盤維持率瀕臨斷頭臨界點，散戶遭到血洗，極可能出現 V 型反轉，留意左側買點！";
  } else if (maintenanceRatio < 145) {
    ratioStatus = "危險 (斷頭潮湧現)";
    ratioAdvice = "大量中小型股面臨斷頭追繳，多殺多賣壓沉重，切勿輕易接刀。";
  } else if (maintenanceRatio < 155) {
    ratioStatus = "警戒";
    ratioAdvice = "散戶資金壓力升高，大盤籌碼轉趨不穩。";
  }

  // 2. 判斷融資餘額增減變化 (籌碼流向)
  let balanceTrend = "持平";
  if (marginBalanceChange100M > 20) {
    balanceTrend = `大幅增加 (+${marginBalanceChange100M}億)`;
  } else if (marginBalanceChange100M > 0) {
    balanceTrend = `微幅增加 (+${marginBalanceChange100M}億)`;
  } else if (marginBalanceChange100M < -30) {
    balanceTrend = `恐慌性殺出 (${marginBalanceChange100M}億)`;
  } else if (marginBalanceChange100M < 0) {
    balanceTrend = `減少 (${marginBalanceChange100M}億)`;
  }

  // 3. 組合出給 AI 看的 JSON
  return {
    指標名稱: "台股大盤融資狀態 (散戶籌碼面)",
    大盤維持率: `${maintenanceRatio.toFixed(1)}% (${ratioStatus})`,
    融資餘額: `${marginBalance100M} 億`,
    今日餘額變化: balanceTrend,
    AI解讀提示: ratioAdvice,
  };
}

/**
 * 將匯率資料轉換為 AI 教練易於閱讀的結構與趨勢描述 (支援雙週期)
 * @param {Object} rawFx - fetchUsdTwdExchangeRate() 的回傳值
 * @returns {Object} 供 AI 解析的結構化資料
 */
export function formatFxForAi(rawFx) {
  if (!rawFx || typeof rawFx.currentRate !== "number") {
    return { error: "無法取得有效的 USD/TWD 匯率資料" };
  }

  const { currentRate, changePercent, historicalPrices } = rawFx;

  // 1. 單日變化標籤
  let dailyTrend = "持平";
  if (changePercent > 0.3) dailyTrend = `急貶 (+${changePercent}%)`;
  else if (changePercent > 0.1) dailyTrend = `微貶 (+${changePercent}%)`;
  else if (changePercent < -0.3) dailyTrend = `急升 (${changePercent}%)`;
  else if (changePercent < -0.1) dailyTrend = `微升 (${changePercent}%)`;

  let shortTermTrend = "資料不足";
  let midTermTrend = "資料不足";
  let capitalImplication = "外資動向不明";

  // 確保我們有足夠的歷史資料 (1mo 通常會有 20~22 筆)
  if (historicalPrices && historicalPrices.length >= 5) {
    const pricesLen = historicalPrices.length;

    // 取得 5 天前 (約一週) 與最舊 (約一個月前) 的價格
    const price5DaysAgo = historicalPrices[pricesLen - 5];
    const price1MonthAgo = historicalPrices[0];

    // 2. 計算短期 (近 5 日) 變化：衡量當下動能
    const diff5Days = Number((currentRate - price5DaysAgo).toFixed(4));
    if (diff5Days > 0.15) shortTermTrend = `短期急貶 (+${diff5Days})`;
    else if (diff5Days < -0.15) shortTermTrend = `短期急升 (${diff5Days})`;
    else shortTermTrend = "短期盤整";

    // 3. 計算中期 (近 1 個月) 變化：衡量波段趨勢
    const diff1Month = Number((currentRate - price1MonthAgo).toFixed(4));
    if (diff1Month > 0.3) midTermTrend = `中期貶值趨勢 (+${diff1Month})`;
    else if (diff1Month < -0.3) midTermTrend = `中期升值趨勢 (${diff1Month})`;
    else midTermTrend = "中期區間震盪";

    // 4. 綜合判定 AI 提示 (交叉比對長短天期)
    if (diff1Month > 0.3 && diff5Days > 0.15) {
      capitalImplication =
        "【強烈警戒】外資中期持續匯出，且短期加速撤離中，台股大型權值股賣壓極重。";
    } else if (diff1Month > 0.3 && diff5Days < -0.15) {
      capitalImplication =
        "【跌深反彈】外資中期偏空，但短期有匯入跡象，可能是台股的短線反彈契機。";
    } else if (diff1Month < -0.3 && diff5Days < -0.15) {
      capitalImplication =
        "【資金行情】熱錢持續且加速匯入台灣，台股具備強大的資金動能與下檔支撐。";
    } else if (diff1Month < -0.3 && diff5Days > 0.15) {
      capitalImplication =
        "【漲多休息】外資中期仍偏多，但短線出現匯出調節，台股可能暫時高檔震盪。";
    } else {
      capitalImplication =
        "匯率波動在正常範圍內，外資無極端進出跡象，回歸基本面與個股表現。";
    }
  }

  // 5. 組合出給 AI 看的 JSON
  return {
    指標名稱: "USD/TWD 美元兌台幣匯率 (外資資金風向球)",
    最新報價: currentRate,
    今日變化: dailyTrend,
    短線動能_近5日: shortTermTrend,
    中線趨勢_近1月: midTermTrend,
    AI解讀提示: capitalImplication,
  };
}

/**
 * 將國發會景氣對策信號轉換為 AI 教練易於閱讀的結構與投資週期建議
 * @param {Object} rawIndicator - fetchBusinessIndicator() 的回傳值
 * @returns {Object} 供 AI 解析的結構化資料
 */
export function formatBusinessIndicatorForAi(rawIndicator) {
  if (!rawIndicator || typeof rawIndicator.score !== "number") {
    return { error: "無法取得有效的景氣信號資料" };
  }

  const { date, score, light } = rawIndicator;

  // 1. 判斷景氣位階與長線投資策略
  let cyclePosition = "未知位階";
  let longTermStrategy = "無明確建議";

  if (score >= 38) {
    cyclePosition = "景氣過熱 (長線高檔區)";
    longTermStrategy =
      "大盤處於相對高風險區，強烈建議逐步獲利了結、降低持股水位並提高現金比重，切勿重壓或過度擴張信用。";
  } else if (score >= 32) {
    cyclePosition = "景氣轉熱 (接近高檔)";
    longTermStrategy =
      "進入多頭末段或高檔區，應停止大部位加碼，持盈保泰，並開始檢視弱勢股予以汰弱留強。";
  } else if (score >= 23) {
    cyclePosition = "景氣穩定 (主升段或復甦期)";
    longTermStrategy =
      "基本面穩健支撐股市，可維持正常持股比例，順勢操作，挑選產業趨勢向上的類股。";
  } else if (score >= 17) {
    cyclePosition = "景氣轉弱/復甦初期";
    longTermStrategy =
      "若是從藍燈轉黃藍燈，代表最壞情況已過，為長線加碼良機；若是從綠燈轉黃藍燈，則需留意景氣下行風險。";
  } else {
    cyclePosition = "景氣低迷 (長線底部區)";
    longTermStrategy =
      "歷史經驗顯示此為長線極佳的左側買點（藍燈買股票）。市場雖恐慌，但應克服心理壓力，分批佈局優質錯殺股與指數型 ETF。";
  }

  // 2. 組合出給 AI 看的 JSON
  return {
    指標名稱: "台灣國發會景氣對策信號 (台股長線位階指標)",
    資料月份: date,
    當月分數與燈號: `${score}分 (${light})`,
    景氣循環位階: cyclePosition,
    AI解讀提示: longTermStrategy,
  };
}

/**
 * 將 AI 產出的 Macro Analysis JSON 轉換為教練 AI 易於閱讀的結構化純文字
 * @param {Object} macroAnalysis - 由 analyzeMacroNewsWithAI 產出的原始 JSON 物件
 * @returns {string} - 格式化後的純文本字串
 */
export function formatMacroAnalysisForCoach(macroAnalysis) {
  // 防呆：如果沒有資料，回傳預設字串
  if (!macroAnalysis || !macroAnalysis.conclusion) {
    return "【總經多空對決報告】\n無最新總經分析資料。";
  }

  const {
    bull_events = [],
    bear_events = [],
    neutral_events = [],
    total_bull_score = 0,
    total_bear_score = 0,
    conclusion,
  } = macroAnalysis;

  // 1. 將重大事件轉化為條列式字串 (最多只抓取前3大的事件，避免 Token 浪費)
  // 這裡只提取 event 本身，教練 AI 不需要看詳細的 reason
  const topBullEvents = bull_events
    .map((e) => `[+${e.score}分] ${e.event}`)
    .join("\n  ");

  const topBearEvents = bear_events
    .map((e) => `[-${e.score}分] ${e.event}`)
    .join("\n  ");

  const formattedNeutralEvents = neutral_events
    .map((e) => `[觀望] ${e.event}`)
    .join("\n  ");

  // 2. 處理核心邏輯 (防呆處理，確保 key_takeaways 存在且為陣列)
  let takeawaysText = "";
  if (
    Array.isArray(conclusion.key_takeaways) &&
    conclusion.key_takeaways.length > 0
  ) {
    takeawaysText = conclusion.key_takeaways
      .map((point) => `- ${point}`)
      .join("\n");
  } else {
    // 兼容舊版可能只有 analysis 的情況
    takeawaysText = `- ${conclusion.analysis || "無詳細分析"}`;
  }

  // 3. 組合出結構極度清晰的純文本
  // 使用 .trim() 確保頭尾沒有多餘的空白換行
  return `
【總經多空對決報告】
最終判定方向：${conclusion.market_direction || "未知"}
市場主軸：${conclusion.short_summary || "無"}

[積分對決]
🟢 總利多分數：${total_bull_score}
🔴 總利空分數：${total_bear_score}

[核心驅動邏輯]
${takeawaysText}

[當下重大驅動事件]
利多推力：
  ${topBullEvents || "無顯著利多事件"}
利空拉力：
  ${topBearEvents || "無顯著利空事件"}
不確定性/未爆彈：
  ${formattedNeutralEvents || "無顯著觀望事件"}
`.trim();
}

/**
 * 將所有原始總經資料轉換、組裝成最終給 AI 的 Context 字串
 * @param {Object} rawMarketData - fetchAllMacroData() 回傳的生資料
 * @returns {String} 教練 AI 易讀的純文字簡報字串
 */
export function formatMacroChipForCoach(rawMarketData) {
  // 1. 各別獲取原本的物件資料 (若無資料則給預設值)
  const aiCnn = rawMarketData.rawCnn
    ? formatCnnDataForAi(rawMarketData.rawCnn)
    : { 狀態: "獲取失敗，略過此指標" };

  const aiMargin = rawMarketData.rawMargin
    ? formatMarginForAi(rawMarketData.rawMargin)
    : { 狀態: "獲取失敗，略過此指標" };

  const aiFx = rawMarketData.rawFx
    ? formatFxForAi(rawMarketData.rawFx)
    : { 狀態: "獲取失敗，略過此指標" };

  const aiNdc = rawMarketData.rawNdc
    ? formatBusinessIndicatorForAi(rawMarketData.rawNdc)
    : { 狀態: "獲取失敗，略過此指標" };

  // 輔助函式：安全提取物件值
  const getVal = (obj, key, fallback = "未知") => obj?.[key] ?? fallback;

  // 2. 將各模組物件扁平化為條列式字串
  // 針對 CNN
  const cnnText = aiCnn["狀態"]
    ? `1. 美股情緒 (CNN恐懼貪婪)：${aiCnn["狀態"]}`
    : `1. 美股情緒 (CNN恐懼貪婪)：${getVal(aiCnn, "當前狀態")}
   趨勢：${getVal(aiCnn, "短期趨勢_較昨日")} / ${getVal(aiCnn, "中期趨勢_較上週")}
   解讀：${getVal(aiCnn, "AI解讀提示")}`;

  // 針對維持率
  const marginText = aiMargin["狀態"]
    ? `2. 散戶籌碼 (大盤維持率)：${aiMargin["狀態"]}`
    : `2. 散戶籌碼 (大盤維持率)：${getVal(aiMargin, "大盤維持率")}
   動態：融資餘額 ${getVal(aiMargin, "融資餘額")} (${getVal(aiMargin, "今日餘額變化")})
   解讀：${getVal(aiMargin, "AI解讀提示")}`;

  // 針對匯率
  const fxText = aiFx["狀態"]
    ? `3. 外資動向 (USD/TWD)：${aiFx["狀態"]}`
    : `3. 外資動向 (USD/TWD)：${getVal(aiFx, "最新報價")}
   動態：${getVal(aiFx, "今日變化")} / ${getVal(aiFx, "中線趨勢_近1月")}
   解讀：${getVal(aiFx, "AI解讀提示")}`;

  // 針對國發會燈號
  const ndcText = aiNdc["狀態"]
    ? `4. 長線景氣 (國發會燈號)：${aiNdc["狀態"]}`
    : `4. 長線景氣 (國發會燈號)：${getVal(aiNdc, "當月分數與燈號")}
   位階：${getVal(aiNdc, "景氣循環位階")}
   解讀：${getVal(aiNdc, "AI解讀提示")}`;

  // 3. 組合出結構極度清晰的純文本
  return `
【總體經濟與籌碼狀態】
${cnnText}

${marginText}

${fxText}

${ndcText}
`.trim();
}
