/**
 * AI 數據預處理工具
 */

// 這個 function 的目的是把各種可能的數值（不論是字串還是數字）統一轉成小數點兩位的數字，並且對於無效的輸入（例如非數字字串、null、undefined）回傳 null，確保後續的 AI 模組在處理這些數據時不會遇到格式問題或 NaN
const n2 = (v) => {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
};

// 這個 function 的目的是把數據轉換成我們內部統一使用的格式，並且在遇到任何錯誤（例如網路問題、API 格式改變）時提供一個合理的預設值，確保後續的 AI 模組不會因為缺少數據而崩潰
const cleanUndef = (obj) => {
  if (obj == null) return obj;
  if (Array.isArray(obj))
    return obj.map(cleanUndef).filter((v) => v !== undefined);
  if (typeof obj !== "object") return obj;

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const vv = cleanUndef(v);
    if (vv !== undefined) out[k] = vv;
  }
  return out;
};

// 這個 function 的目的是把 strategy 裡面對 AI 解釋用的參數抽取出來，轉成更簡潔的格式，方便後續在 minifyExplainInput 裡使用
function minifyStrategyForExplain(strategy) {
  if (!strategy) return null;

  const buy = strategy.buy || {};
  const sell = strategy.sell || {};
  const th = strategy.threshold || {};
  const lev = strategy.leverage || {};

  return cleanUndef({
    // entryCheck 還需要
    buy: {
      minDrop: n2(buy.minDropPercentToConsider),
      minScore: n2(buy.minWeightScoreToBuy),
    },

    // riskWatch.sell 還需要
    sell: {
      minUp: n2(sell.minUpPercentToSell),
      minSignals: n2(sell.minSignalCountToSell),
    },

    // riskWatch.overheat/reversal/vix 還需要
    threshold: {
      overheatNeed: n2(th.overheatCount),
      reversalNeed: n2(th.reversalTriggerCount),
      vixLow: n2(th.vixLowComplacency),
      vixHigh: n2(th.vixHighFear),

      // account 區塊你仍在算 z2TargetPct/z2HighPct
      z2Target: n2(th.z2TargetRatio),
      z2High: n2(th.z2RatioHigh),

      // 目前雖然 prompt 沒直接用，但你說 guardrails 想保留就留
      mmDanger: n2(th.mmDanger),
    },

    // 讓你未來可以改成從 cleanData 讀目標槓桿（現在 prompt 還是用 strategy.leverage）
    leverage: {
      targetMultiplier: n2(lev.targetMultiplier),
    },
  });
}

// 這個 function 的目的是把原本給 AI 的 explainInput 做進一步的精簡，讓它更專注在關鍵資訊上，並且統一一些格式（例如門檻狀態的表達）
export function minifyExplainInput(marketData, portfolio = {}, vixData = null) {
  const st = minifyStrategyForExplain(marketData?.strategy);

  const hitToZh = (k) =>
    ({
      // --- Overheat factors（狀態）---
      rsiHigh: "RSI 高檔",
      kdHigh: "KD(D) 高檔",
      biasHigh: "年線乖離過高",

      // --- Sell state flags（狀態）---
      rsiStateOverbought: "RSI 偏熱",
      kdStateOverbought: "KD(D) 偏熱",

      // --- Sell flags（事件）---
      rsiSell: "RSI 回落（賣出訊號）",
      macdSell: "MACD 轉弱（賣出訊號）",
      kdSell: "KD 高檔轉弱觸發（K↘D / D↘）",

      // --- Reversal triggers（事件/門檻）---
      kdBearCross: "KD 死叉（K↘D）",
      macdBearCross: "MACD 死叉",
      rsiDrop: "RSI 轉弱",
      kdDrop: "KD(min) 轉弱",
    })[k] || k;

  const truthyKeys = (obj) =>
    obj && typeof obj === "object"
      ? Object.keys(obj).filter((k) => obj[k] === true)
      : [];

  // ===== 進場判定（直接給 LLM 用）=====
  const actualDrop = n2(marketData?.priceDropPercent);
  const needDrop = n2(st?.buy?.minDrop);

  const actualScore = n2(
    marketData?.weightScore ?? marketData?.entry?.weightScore,
  );
  const needScore = n2(st?.buy?.minScore);

  // ===== 過熱 / 轉弱 / 賣出 =====
  const overheat = marketData?.overheat || {};
  const reversal = marketData?.reversal || {};
  const sellSignals = marketData?.sellSignals || {};

  const overheatHits = truthyKeys(overheat.factors).map(hitToZh);
  const sellStateHits = truthyKeys(sellSignals.stateFlags).map(hitToZh);
  const sellFlagHits = truthyKeys(sellSignals.flags).map(hitToZh);

  // ===== 帳戶安全 / 部位 =====
  const z2Ratio = n2(marketData?.z2Ratio); // 你目前是 percent 數值（8.86）
  const z2TargetPct =
    st?.threshold?.z2Target != null ? n2(st.threshold.z2Target * 100) : null; // 0.4 => 40
  const z2HighPct = n2(st?.threshold?.z2High); // 42
  const z2GapToTarget =
    z2Ratio != null && z2TargetPct != null ? n2(z2TargetPct - z2Ratio) : null;

  // ===== VIX =====
  const vixVal = n2(vixData?.value);
  const vixLow = n2(st?.threshold?.vixLow);
  const vixHigh = n2(st?.threshold?.vixHigh);

  const gapLabel = (gap, unit = "") => {
    if (gap == null) return null;
    if (gap <= 0) return null;

    const u = String(unit).trim().toLowerCase();

    // 1) unit 分類：不同量綱講法不同
    const kind = u.includes("%")
      ? "pct"
      : u.includes("分") || u.includes("pt") || u.includes("點")
        ? "score"
        : u.includes("次") || u.includes("個") || u.includes("筆")
          ? "count"
          : u.includes("萬") || u.includes("元") || u.includes("$")
            ? "money"
            : "generic";

    // 2) 分級門檻（只用於判斷，不出現在文字裡）
    const levels = {
      pct: { near: 2, mid: 5 },
      score: { near: 1, mid: 3 },
      count: { near: 1, mid: 2 },
      money: { near: 0.5, mid: 2 },
      generic: { near: 2, mid: 5 },
    }[kind];

    // 3) 對應語氣模板（讓 AI 不會一直用「差距明顯」）
    const tone = {
      pct: {
        near: "接近門檻（幅度差一點）",
        mid: "仍需一段幅度",
        far: "離門檻還有距離",
      },
      score: {
        near: "接近門檻（分數差一點）",
        mid: "仍需累積條件",
        far: "分數門檻仍偏遠",
      },
      count: {
        near: "接近門檻（訊號差一點）",
        mid: "仍需訊號累積",
        far: "訊號累積仍不足",
      },
      money: {
        near: "接近目標（差一點）",
        mid: "仍需一段距離",
        far: "距離目標仍明顯",
      },
      generic: {
        near: "接近門檻（差一點）",
        mid: "仍需一段距離",
        far: "離門檻還有距離",
      },
    }[kind];

    if (gap <= levels.near) return tone.near;
    if (gap <= levels.mid) return tone.mid;
    return tone.far;
  };

  // 統一的門檻狀態：
  // - direction="up"   ：actual >= threshold 代表 breached
  // - direction="down" ：actual <= threshold 代表 breached
  const mkThresholdStatus = (actual, threshold, unit, direction, opt = {}) => {
    const a = actual == null ? null : actual;
    const t = threshold == null ? null : threshold;

    const {
      breachedTextUp = "已越過門檻（需留意）",
      breachedTextDown = "已跌破門檻（需留意）",
    } = opt;

    if (a == null || t == null) {
      return {
        actual: a,
        threshold: t,
        breached: null,
        distance: null,
        distanceLabel: null,
        direction,
      };
    }

    const rawNum = direction === "up" ? t - a : a - t;
    const raw = n2(rawNum);
    if (raw == null) {
      return {
        actual: a,
        threshold: t,
        breached: null,
        distance: null,
        distanceLabel: null,
        direction,
      };
    }

    const breached = raw <= 0;
    const distance = breached ? 0 : raw;
    const breachedText = direction === "up" ? breachedTextUp : breachedTextDown;

    return {
      actual: a,
      threshold: t,
      breached,
      distance,
      distanceLabel: breached ? breachedText : gapLabel(distance, unit),
      direction,
    };
  };

  // ===== riskWatch 用到的數值（先 n2 避免 NaN/字串干擾）=====
  const overheatNeed = n2(st?.threshold?.overheatNeed);
  const reversalNeed = n2(st?.threshold?.reversalNeed);
  const sellNeedSignals = n2(st?.sell?.minSignals);
  const sellUpNeed = n2(st?.sell?.minUp);

  const overheatHitCount = n2(overheat?.highCount);
  const reversalTriggered = n2(reversal?.triggeredCount);
  const sellSignalCount = n2(sellSignals?.signalCount);
  const sellUpActual = n2(marketData?.priceUpPercent);

  // VIX
  const vixValue = vixVal; // 你前面已 n2
  const vixLowTh = vixLow;
  const vixHighTh = vixHigh;

  // 各項門檻狀態（統一 schema）
  const overheatThreshold = mkThresholdStatus(
    overheatHitCount,
    overheatNeed,
    "個",
    "up",
  );
  const reversalThreshold = mkThresholdStatus(
    reversalTriggered,
    reversalNeed,
    "個",
    "up",
  );

  const sellSignalsThreshold = mkThresholdStatus(
    sellSignalCount,
    sellNeedSignals,
    "次",
    "up",
  );

  const sellUpThreshold = mkThresholdStatus(
    sellUpActual,
    sellUpNeed,
    "%",
    "up",
  );

  // VIX 有兩條線：低檔（跌破）與高檔（越過）
  const vixLowZone = mkThresholdStatus(vixValue, vixLowTh, "點", "down", {
    breachedTextDown: "已落入低波動區（偏安逸）",
  });
  const vixHighZone = mkThresholdStatus(vixValue, vixHighTh, "點", "up", {
    breachedTextUp: "已落入高波動區（偏恐慌）",
  });

  const dropStatus = mkThresholdStatus(actualDrop, needDrop, "%", "up", {
    breachedTextUp: "已達標",
  });
  const scoreStatus = mkThresholdStatus(actualScore, needScore, "分", "up", {
    breachedTextUp: "已達標",
  });

  // 可選：把 weightDetails 當 entryCheck 的 hits（你原本就是給 AI 用）
  const entryHits = [
    marketData?.weightDetails?.dropInfo,
    marketData?.weightDetails?.rsiInfo,
    marketData?.weightDetails?.macdInfo,
    marketData?.weightDetails?.kdInfo,
  ].filter(Boolean);

  const uniq = (arr) => [...new Set(arr)];
  const sellHits = uniq([...sellStateHits, ...sellFlagHits].filter(Boolean));

  return cleanUndef({
    meta: {
      dateText: marketData?.dateText ?? null, // 你若有就塞，沒有也行
      symbol: marketData?.symbol ?? "00675L",
    },

    conclusion: {
      marketStatus: marketData?.marketStatus ?? null,
      target: marketData?.target ?? null,
      suggestionShort: marketData?.targetSuggestionShort ?? null,
      suggestion: marketData?.suggestion ?? null,
      reasonOneLine: marketData?.targetSuggestion ?? null,
    },

    entryCheck: {
      hits: entryHits,

      drop: {
        thresholdStatus: dropStatus,
        // 可選：保留一個短字串讓 AI 更好引用，但不要放 text（避免它照抄）
        // summary: dropStatus?.breached === true ? "跌幅條件已滿足" : "跌幅條件未滿足",
      },

      score: {
        thresholdStatus: scoreStatus,
        // summary: scoreStatus?.breached === true ? "評分條件已滿足" : "評分條件未滿足",
      },
    },

    riskWatch: {
      historicalLevel: marketData?.historicalLevel ?? null,

      vix:
        vixValue != null
          ? {
              thresholdText: `低<${vixLowTh ?? "N/A"} / 高>${vixHighTh ?? "N/A"}`,
              lowZone: vixLowZone, // {actual, threshold, breached, distance, distanceLabel, direction:"down"}
              highZone: vixHighZone, // {actual, threshold, breached, distance, distanceLabel, direction:"up"}
            }
          : null,

      overheat: {
        hits: overheatHits,
        thresholdStatus: overheatThreshold, // {actual: hitCount, threshold: need, breached, distance, distanceLabel, direction:"up"}
      },

      reversal: {
        hits: [
          reversal?.rsiDrop ? hitToZh("rsiDrop") : null,
          reversal?.kdDrop ? hitToZh("kdDrop") : null,
          reversal?.kdBearCross ? hitToZh("kdBearCross") : null,
          reversal?.macdBearCross ? hitToZh("macdBearCross") : null,
        ].filter(Boolean),
        thresholdStatus: reversalThreshold, // {actual: triggered, threshold: need, breached, distance, distanceLabel, direction:"up"}
      },

      sell: {
        hits: sellHits,
        signals: sellSignalsThreshold,
        up: sellUpThreshold,
      },
    },

    account: {
      netAsset: n2(marketData?.netAsset),
      totalLoan: n2(marketData?.totalLoan),
      actualLeverage: n2(marketData?.actualLeverage),
      maintenanceMargin: n2(marketData?.maintenanceMargin),
      z2RatioPct: z2Ratio,
      z2TargetPct,
      z2HighPct,
      z2GapToTarget,
      cash: n2(portfolio?.cash),
      holdings: {
        qty0050: portfolio?.qty0050 ?? null,
        qtyZ2: portfolio?.qtyZ2 ?? null,
      },
    },

    // 讓 LLM 不用再去猜門檻
    thresholds: st,

    // 你最後那句紀律提醒直接塞這裡
    disciplineReminder: marketData?.disciplineReminder ?? null,
  });
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
 * 將所有原始總經資料轉換、組裝成最終給 AI 的 Context 字串
 * @param {Object} rawMarketData - fetchAllMacroData() 回傳的生資料
 * @returns {String} 可直接塞入 LLM Prompt 的 JSON 字串
 */
export function buildExtendedMacroContext(rawMarketData) {
  // 1. 各別進行格式轉換，若無資料則回傳預設錯誤結構
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

  // 2. 組裝成統一的結構體
  const combinedContext = {
    總體經濟與籌碼面指標_Macro_And_Chip: {
      "1_美股情緒": aiCnn,
      "2_台股散戶籌碼": aiMargin,
      "3_外資動向匯率": aiFx,
      "4_台股長線景氣位階": aiNdc,
    },
  };

  // 3. 轉成漂亮的 JSON 字串 (縮排 2 格)，AI 解析 JSON 結構能力極強
  return JSON.stringify(combinedContext, null, 2);
}
