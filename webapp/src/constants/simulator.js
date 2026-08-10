// 前端共用常數 - 從後端同步
// 注意：請保持與 src/modules/simulator/constants.mjs 同步

/** 可掃描的策略參數 (用於敏感度分析) */
export const SCANNABLE_PARAMS = [
  // 維持率防禦
  {
    path: "maintenance.protectTrigger",
    label: "維持率防禦觸發",
    type: "number",
    min: 100,
    max: 200,
  },
  {
    path: "maintenance.protectTarget",
    label: "維持率防禦目標",
    type: "number",
    min: 100,
    max: 200,
  },
  {
    path: "maintenance.marginCallThreshold",
    label: "追加保證金閾值",
    type: "number",
    min: 100,
    max: 150,
  },
  {
    path: "maintenance.frozenZone",
    label: "凍結區間",
    type: "number",
    min: 0,
    max: 50,
  },

  // 交易設定
  {
    path: "trading.transFee",
    label: "手續費率",
    type: "number",
    min: 0.001,
    max: 0.01,
  },
  {
    path: "trading.transFeeDiscount",
    label: "手續費折扣",
    type: "number",
    min: 0.5,
    max: 1,
  },
  {
    path: "trading.taxRate",
    label: "交易稅率",
    type: "number",
    min: 0.001,
    max: 0.005,
  },
  {
    path: "trading.loanInterestRate",
    label: "融資利率",
    type: "number",
    min: 0.01,
    max: 0.1,
  },
  {
    path: "trading.budget",
    label: "預算",
    type: "number",
    min: 10000,
    max: 1000000,
  },

  // 買入設定
  {
    path: "buy.minDropPercentToConsider",
    label: "最小跌幅考慮",
    type: "number",
    min: 1,
    max: 15,
  },
  {
    path: "buy.minWeightScoreToBuy",
    label: "最小權重分數",
    type: "number",
    min: 0,
    max: 100,
  },
  { path: "buy.rsi.enabled", label: "買入 RSI 啟用", type: "boolean" },
  { path: "buy.macd.enabled", label: "買入 MACD 啟用", type: "boolean" },
  { path: "buy.kd.enabled", label: "買入 KD 啟用", type: "boolean" },

  // 賣出設定
  {
    path: "sell.minUpPercentToSell",
    label: "最小漲幅賣出",
    type: "number",
    min: 1,
    max: 15,
  },
  {
    path: "sell.minSignalCountToSell",
    label: "最小信號數",
    type: "number",
    min: 1,
    max: 5,
  },
  {
    path: "sell.trailingStop",
    label: "移動停損",
    type: "number",
    min: 0,
    max: 20,
  },

  // 系統閾值
  {
    path: "threshold.ma240Bias",
    label: "MA240 偏離閾值",
    type: "number",
    min: -20,
    max: 20,
  },
  {
    path: "threshold.kdGolden",
    label: "KD 黃金交叉",
    type: "number",
    min: 0,
    max: 100,
  },
  {
    path: "threshold.kdDead",
    label: "KD 死亡交叉",
    type: "number",
    min: 0,
    max: 100,
  },
];
