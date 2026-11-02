const EXTERNAL_AGENT_INSTRUCTIONS = [
  "確認每項指標的來源是否真實且可查證。",
  "確認資料日期、抓取時間與更新頻率是否一致。",
  "使用官方來源或可靠第二來源核對相同日期的數值。",
  "確認單位、倍率、小數位與百分比方向沒有錯誤。",
  "對衍生指標重新計算所有列出的中間步驟。",
  "將結果分類為已確認、來源可信但無法重現、過期、不一致、定義不明或證據不足。",
];

const DEFINITIONS = {
  pb: {
    background:
      "台股市場整體淨值比（PB），代表市場價格相對於帳面價值的倍數；不是 0050 個別 ETF 的 PB。",
    unit: "倍",
    freshnessBasis:
      "通常以最近一個台股交易日公布；需核對資料日期，不可只看寫入時間。",
    checks: [
      "查核相同資料日期的市場 PB。",
      "確認來源定義為台股市場整體 PB。",
      "確認沒有日期延遲、倍率或四捨五入錯誤。",
    ],
    calculation: "來源直接提供 PB；本系統未自行計算。",
  },
  cnn: {
    background:
      "CNN Fear & Greed 指數，將市場情緒量化為 0 到 100；低值通常代表較恐懼。",
    unit: "分",
    freshnessBasis: "美股市場情緒指標，通常每日更新，需以 timestamp 判斷時效。",
    checks: [
      "查核 CNN 原始資料相同 timestamp 或最近更新值。",
      "確認 score 在 0 到 100 且沒有被快取舊值取代。",
    ],
    calculation: "來源直接提供 score；本系統未自行計算。",
  },
  taiex: {
    background: "臺灣加權股價指數（TAIEX）收盤或最新市場指數。",
    unit: "點",
    freshnessBasis:
      "台股交易日資料，非交易日可沿用最近交易日，但必須保留來源日期。",
    checks: [
      "查核 TWSE 相同日期的 TAIEX。",
      "確認 date 的民國年格式已正確轉換。",
    ],
    calculation: "來源直接提供指數；本系統未自行計算。",
  },
  generic: {
    background:
      "由 InvestmentLineNotify 保存的外部市場或總經數值，需依 provider、dataset 與資料日期追查原始來源。",
    unit: null,
    freshnessBasis:
      "以來源自身資料日期和 provider lastFetch 判斷，不能只依檔案修改時間。",
    checks: [
      "查核 provider 對應的原始來源與相同資料日期。",
      "確認單位、倍率、日期和數值轉換。",
    ],
    calculation:
      "來源直接提供或由 provider 正規化；需核對 provenance 與原始回應。",
  },
  history: {
    background:
      "歷史序列的最新觀測值；外部 Agent 應核對最新日期、序列連續性及來源值。",
    unit: null,
    freshnessBasis: "歷史資料的最後日期應接近最近可取得的交易日。",
    checks: [
      "查核最後一筆相同日期的原始資料。",
      "檢查序列是否有缺日、重複日或不合理跳值。",
    ],
    calculation: "歷史檔案保存來源觀測值；本系統未重新計算。",
  },
  sentiment: {
    background:
      "PTT 與 Bluesky 貼文彙整後的社群情緒結果，不是官方市場指標；score 是系統演算法產物。",
    unit: "分",
    freshnessBasis:
      "每日定格資料，需同時核對 date、updatedAt、樣本數與原始貼文集合。",
    checks: [
      "核對 score 是否能由原始貼文與演算法重現。",
      "核對 sampleCount 是否等於 PTT 與 Bluesky 筆數總和。",
      "核對 ma3、ma7 使用的日期範圍。",
    ],
    calculation:
      "score、ma3、ma7、delta 為系統計算值；不能當成官方數字直接查核。",
  },
  kellyLimits: {
    background:
      "連續凱莉準則（Continuous Kelly Criterion）計算之槓桿上限，追求長期複利成長幾何期望值最大化；為理論參考值（RESEARCH_ONLY），不直接影響實際下單策略。",
    unit: "倍",
    freshnessBasis:
      "依每日收盤價歷史序列（126天樣本）及市場體制計算，與每日報告同步產生。",
    checks: [
      "核對 mu（預期年化報酬率）與 sigma（年化波動率）計算樣本期（預設126交易日）。",
      "核對無風險/借貸利率 r（預設 2.5%）與產品持有/滑價成本 c（預設 1.0%）。",
      "驗算超額報酬 excess = mu - r - c，以及變異數 sigma^2。",
      "驗算完全凱莉 full = excess / sigma^2，以及保守半凱莉 conservative = full * 0.5。",
    ],
    calculation:
      "以連續凱莉公式 f* = (mu - r - c) / sigma^2 計算完全凱莉上限；保守半凱莉為 f* * 0.5。",
  },
  marketRegime: {
    background:
      "由 0050 歷史價格序列對數報酬率估算之年化預期報酬率 mu、波動率 sigma 與所屬體制狀態（BULL / BEAR / HIGH_VOLATILITY）。",
    unit: "",
    freshnessBasis: "與每日收盤價及每日報告同步更新。",
    checks: [
      "查核價格序列天數（sampleDays）。",
      "核對對數報酬率之年化均值 mu 與標準差 sigma。",
    ],
    calculation:
      "對數報酬年化均值 mu = mean(log_returns) * 252；年化標準差 sigma = std(log_returns) * sqrt(252)。",
  },
  currentLeverage: {
    background:
      "當前投資組合總曝險（grossExposure）除以帳戶淨資產（accountNetAsset）之實際槓桿倍數。",
    unit: "倍",
    freshnessBasis: "與每日投資組合總覽及當日收盤價同步更新。",
    checks: [
      "核對 grossExposure 是否等於持有部位市值之總和。",
      "核對 accountNetAsset 是否等於總資產減去總負債（或包含質押部位後之總淨值）。",
      "驗算 currentLeverage = grossExposure / accountNetAsset。",
    ],
    calculation: "currentLeverage = grossExposure / accountNetAsset。",
  },
};

const MARKET_FIELDS = [
  ["rawMargin.marginBalance100M", "rawMargin", "marginBalance100M", "generic"],
  ["rawMargin.maintenanceRatio", "rawMargin", "maintenanceRatio", "generic"],
  ["rawCnn.score", "rawCnn", "score", "cnn"],
  ["rawFx.currentRate", "rawFx", "currentRate", "generic"],
  ["rawCpi.value", "rawCpi", "value", "generic"],
  ["rawMarketOverview.taiex", "rawMarketOverview", "taiex", "taiex"],
  [
    "rawMarketOverview.tradeValueHundredMillion",
    "rawMarketOverview",
    "tradeValueHundredMillion",
    "generic",
  ],
  ["rawUsMarket.soxChg", "rawUsMarket", "soxChg", "generic"],
  ["rawUsMarket.tsmChg", "rawUsMarket", "tsmChg", "generic"],
  ["rawValuation.pe", "rawValuation", "pe", "generic"],
  ["rawValuation.pb", "rawValuation", "pb", "pb"],
  ["rawValuation.yield", "rawValuation", "yield", "generic"],
  ["rawBankRate.value", "rawBankRate", "value", "generic"],
  ["rawNdc.score", "rawNdc", "score", "generic"],
  [
    "rawInstitutional.foreignNetBuy",
    "rawInstitutional",
    "foreignNetBuy",
    "generic",
  ],
  [
    "rawStockMargin.marginBalance",
    "rawStockMargin",
    "marginBalance",
    "generic",
  ],
];

function getSource(market, slot) {
  const sourceByDataset = Object.values(market?._meta?.sources ?? {}).find(
    (source) => source?.dataset === slot,
  );
  const source = sourceByDataset ?? {};
  return {
    provider: source.provider ?? null,
    dataset: source.dataset ?? slot,
    status: source.status ?? "UNKNOWN",
    lastFetch: source.lastFetch ?? null,
    endpoint: source.endpoint ?? null,
    rawHash: source.rawHash ?? null,
    normalizedHash: source.normalizedHash ?? null,
    integrity: source.integrity ?? "UNKNOWN",
  };
}

function createItem({
  field,
  value,
  slot,
  definition,
  market,
  dataDate,
  calculation,
}) {
  const source = getSource(market, slot);
  return {
    field: `data.${field}`,
    value: value ?? null,
    unit: definition.unit,
    source,
    temporal: {
      dataDate: dataDate ?? null,
      fetchedAt: source.lastFetch,
      persistedAt: market?._meta?.lastRun ?? null,
      freshnessBasis: definition.freshnessBasis,
    },
    verification: {
      background: definition.background,
      checks: definition.checks,
      calculation: calculation ?? definition.calculation,
      externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
    },
  };
}

export function buildDataEvidenceReport({
  market = {},
  pbHistory = [],
  vixHistory = [],
  sentiment = null,
  latestReport = null,
  generatedAt = new Date().toISOString(),
}) {
  const data = market?.data ?? {};
  const items = MARKET_FIELDS.map(([field, slot, valueKey, definitionKey]) => {
    const definition = DEFINITIONS[definitionKey];
    const slotData = data[slot] ?? {};
    const dataDate = slotData.timestamp ?? slotData.date ?? null;
    return createItem({
      field,
      value: slotData[valueKey],
      slot,
      definition,
      market,
      dataDate,
    });
  });

  const latestPb = pbHistory.at(-1);
  if (latestPb) {
    items.push(
      createItem({
        field: "pbHistory.latest.pb",
        value: latestPb.pb,
        slot: "rawValuation",
        valueKey: "pb",
        definition: DEFINITIONS.history,
        market,
        dataDate: latestPb.date,
        calculation:
          "歷史序列保存的 PB 觀測值；應與 data.rawValuation.pb 及官方相同日期資料核對。",
      }),
    );
  }

  const latestVix = vixHistory.at(-1);
  if (latestVix) {
    items.push(
      createItem({
        field: "vixHistory.latest.value",
        value: latestVix.value,
        slot: "rawUsMarket",
        valueKey: "vix",
        definition: DEFINITIONS.history,
        market,
        dataDate: latestVix.date,
        calculation:
          "歷史序列保存的 VIX 觀測值；應與相同美股交易日的 FRED 或 Yahoo 原始資料核對。",
      }),
    );
  }

  if (sentiment) {
    const sentimentDefinition = DEFINITIONS.sentiment;
    for (const key of [
      "score",
      "ma3",
      "ma7",
      "delta",
      "sampleCount",
      "pttItems",
      "bskyItems",
    ]) {
      items.push({
        field: `data.sentiment.social_sentiment_daily.${key}`,
        value: sentiment[key] ?? null,
        unit:
          key.includes("Items") || key === "sampleCount"
            ? "筆"
            : sentimentDefinition.unit,
        source: {
          provider: "socialSentimentEngine",
          dataset: "social_sentiment_daily",
          status: "INTERNAL_DERIVED",
          endpoint: null,
        },
        temporal: {
          dataDate: sentiment.date ?? null,
          fetchedAt: sentiment.updatedAt ?? null,
          persistedAt: sentiment.updatedAt ?? null,
          freshnessBasis: sentimentDefinition.freshnessBasis,
        },
        verification: {
          background: sentimentDefinition.background,
          checks: sentimentDefinition.checks,
          calculation: sentimentDefinition.calculation,
          externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
        },
      });
    }
  }

  const theoreticalShadow = latestReport?.theoreticalShadow;
  if (theoreticalShadow) {
    const reportDate = latestReport.date ?? null;
    const asOf = theoreticalShadow.asOf ?? null;

    if (theoreticalShadow.kellyLimits) {
      const def = DEFINITIONS.kellyLimits;
      for (const [key, val] of Object.entries(theoreticalShadow.kellyLimits)) {
        items.push({
          field: `theoreticalShadow.kellyLimits.${key}`,
          value: val,
          unit: def.unit,
          source: {
            provider: "theoreticalEngine",
            dataset: "theoreticalShadow",
            status: "INTERNAL_DERIVED",
            endpoint: null,
          },
          temporal: {
            dataDate: reportDate,
            fetchedAt: asOf,
            persistedAt: asOf,
            freshnessBasis: def.freshnessBasis,
          },
          verification: {
            background: def.background,
            checks: def.checks,
            calculation: def.calculation,
            externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
          },
        });
      }
    }

    if (theoreticalShadow.marketRegime) {
      const def = DEFINITIONS.marketRegime;
      for (const [key, val] of Object.entries(theoreticalShadow.marketRegime)) {
        items.push({
          field: `theoreticalShadow.marketRegime.${key}`,
          value: val,
          unit: key === "sampleDays" ? "天" : def.unit,
          source: {
            provider: "marketRegimeModel",
            dataset: "theoreticalShadow",
            status: "INTERNAL_DERIVED",
            endpoint: null,
          },
          temporal: {
            dataDate: reportDate,
            fetchedAt: asOf,
            persistedAt: asOf,
            freshnessBasis: def.freshnessBasis,
          },
          verification: {
            background: def.background,
            checks: def.checks,
            calculation: def.calculation,
            externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
          },
        });
      }
    }

    if (theoreticalShadow.theory?.currentLeverage !== undefined) {
      const def = DEFINITIONS.currentLeverage;
      items.push({
        field: "theoreticalShadow.theory.currentLeverage",
        value: theoreticalShadow.theory.currentLeverage,
        unit: def.unit,
        source: {
          provider: "theoreticalEngine",
          dataset: "theoreticalShadow",
          status: "INTERNAL_DERIVED",
          endpoint: null,
        },
        temporal: {
          dataDate: reportDate,
          fetchedAt: asOf,
          persistedAt: asOf,
          freshnessBasis: def.freshnessBasis,
        },
        verification: {
          background: def.background,
          checks: def.checks,
          calculation: def.calculation,
          externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
        },
      });
    }
  }

  // Portfolio 欄位 (從 latestReport 提取)
  if (latestReport) {
    const reportDate = latestReport.date ?? null;
    const portfolio = latestReport.portfolio ?? {};
    const signals = latestReport.signals ?? {};

    // Portfolio 核心欄位
    const portfolioFields = [
      {
        field: "portfolio.totalValue",
        value: portfolio.totalValue,
        desc: "投資組合總市值",
      },
      {
        field: "portfolio.netAsset",
        value: signals.netAsset,
        desc: "帳戶淨資產",
      },
      {
        field: "portfolio.actualLeverage",
        value: signals.actualLeverage,
        desc: "實際槓桿倍數",
      },
      {
        field: "portfolio.grossLeverage",
        value: signals.grossLeverage,
        desc: "總槓桿倍數",
      },
      {
        field: "portfolio.totalLoan",
        value: portfolio.totalLoan,
        desc: "總借款金額",
      },
      { field: "portfolio.cash", value: portfolio.cash, desc: "現金餘額" },
      {
        field: "portfolio.qty0050",
        value: portfolio.qty0050,
        desc: "0050持股數",
      },
      {
        field: "portfolio.qtyZ2",
        value: portfolio.qtyZ2,
        desc: "00675L持股數",
      },
      {
        field: "portfolio.lastBuyDate",
        value: portfolio.lastBuyDate,
        desc: "最近買入日期",
      },
    ];

    portfolioFields.forEach(({ field, value, desc }) => {
      items.push({
        field,
        value: value ?? null,
        unit: null,
        source: {
          provider: "InvestmentLineNotify",
          dataset: "dailyReport",
          status: "PERSISTED",
          endpoint: null,
        },
        temporal: {
          dataDate: reportDate,
          fetchedAt: generatedAt,
          persistedAt: generatedAt,
          freshnessBasis: "daily report generation",
        },
        verification: {
          background: `${desc}：由每日報告產生的投資組合持倉資訊，反映帳戶當前狀態。`,
          checks: ["與券商對帳單核對", "確認計算邏輯正確", "檢查數值合理性"],
          calculation: `從 dailyReport 的 ${field} 提取`,
          externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
        },
      });
    });

    // Strategy 欄位
    const strategyFields = [
      {
        field: "strategy.suggestion",
        value: signals.suggestion,
        desc: "投資建議",
      },
      {
        field: "strategy.signalDirection",
        value: signals.signalDirection,
        desc: "信號方向",
      },
      { field: "strategy.score", value: signals.score, desc: "原始市場分數" },
      {
        field: "strategy.weightScore",
        value: signals.weightScore,
        desc: "加權市場分數",
      },
      {
        field: "strategy.signalCategory",
        value: signals.signalCategory,
        desc: "信號分類",
      },
      { field: "strategy.target", value: signals.target, desc: "操作標的" },
      { field: "strategy.status", value: signals.status, desc: "狀態圖示" },
      {
        field: "strategy.regimeState",
        value: signals.regimeState?.lifecycleStage,
        desc: "生命週期階段",
      },
      {
        field: "strategy.regimeResult.state",
        value: signals.regimeResult?.state,
        desc: "市場狀態",
      },
      {
        field: "strategy.regimeResult.leverageMultiplier",
        value: signals.regimeResult?.leverageMultiplier,
        desc: "槓桿調整係數",
      },
      {
        field: "strategy.budgetInfo.dailyAvailable",
        value: signals.budgetInfo?.dailyAvailable,
        desc: "每日可用額度",
      },
      {
        field: "strategy.budgetInfo.tacticalPool",
        value: signals.budgetInfo?.tacticalPool,
        desc: "戰術資金池",
      },
      {
        field: "strategy.cooldownStatus.inCooldown",
        value: signals.cooldownStatus?.inCooldown,
        desc: "是否冷卻期",
      },
    ];

    strategyFields.forEach(({ field, value, desc }) => {
      items.push({
        field,
        value: value ?? null,
        unit: null,
        source: {
          provider: "InvestmentLineNotify",
          dataset: "dailyReport",
          status: "DERIVED",
          endpoint: null,
        },
        temporal: {
          dataDate: reportDate,
          fetchedAt: generatedAt,
          persistedAt: generatedAt,
          freshnessBasis: "daily report generation",
        },
        verification: {
          background: `${desc}：由策略引擎根據市場指標與風險模型綜合計算產生的決策建議。`,
          checks: ["確認邏輯一致性", "驗證風險控制", "檢查與其他欄位交叉驗證"],
          calculation: `從 dailyReport.signals 的 ${field} 提取`,
          externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
        },
      });
    });

    // Theoretical 欄位
    const theoreticalShadow = latestReport.theoreticalShadow ?? {};
    const theory = theoreticalShadow.theory ?? {};

    if (Object.keys(theory).length > 0) {
      const theoreticalFields = [
        {
          field: "theoretical.kellyCriterion.optimalLeverage",
          value: theory.kellyCriterion?.optimalLeverage,
          desc: "Kelly最佳槓桿",
        },
        {
          field: "theoretical.kellyCriterion.recommendation",
          value: theory.kellyCriterion?.recommendation,
          desc: "Kelly建議",
        },
        {
          field: "theoretical.crashTolerance.safetyMargin",
          value: theory.crashTolerance?.safetyMargin,
          desc: "安全邊際",
        },
        {
          field: "theoretical.crashTolerance.maxDrawdown",
          value: theory.crashTolerance?.maxDrawdown,
          desc: "最大容忍跌幅",
        },
        {
          field: "theoretical.trueExposure.effectiveExposure",
          value: theory.trueExposure?.effectiveExposure,
          desc: "有效曝險",
        },
        {
          field: "theoretical.marketRegime.state",
          value: theory.marketRegime?.state,
          desc: "市場狀態",
        },
        {
          field: "theoretical.marketRegime.confidence",
          value: theory.marketRegime?.confidence,
          desc: "狀態信心度",
        },
      ];

      theoreticalFields.forEach(({ field, value, desc }) => {
        items.push({
          field,
          value: value ?? null,
          unit: null,
          source: {
            provider: "theoreticalEngine",
            dataset: "theoreticalShadow",
            status: "DERIVED",
            endpoint: null,
          },
          temporal: {
            dataDate: reportDate,
            fetchedAt: generatedAt,
            persistedAt: generatedAt,
            freshnessBasis: "daily theoretical calculation",
          },
          verification: {
            background: `${desc}：由理論框架模型計算，提供風險管理與倉位優化的學術依據。`,
            checks: ["確認公式正確", "驗證參數範圍", "與實際狀態交叉驗證"],
            calculation: `從 theoreticalShadow.theory 的 ${field} 提取`,
            externalAgentStatus: "PENDING_EXTERNAL_VERIFICATION",
          },
        });
      });
    }
  }

  return {
    schemaVersion: "1.0",
    reportType: "data-evidence",
    generatedAt,
    verificationScope:
      "persisted evidence only; no external API re-fetch was performed",
    instructions: EXTERNAL_AGENT_INSTRUCTIONS,
    items,
  };
}

export { EXTERNAL_AGENT_INSTRUCTIONS, DEFINITIONS };
