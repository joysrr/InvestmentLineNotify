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
