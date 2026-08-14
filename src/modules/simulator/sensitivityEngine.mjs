// src/modules/simulator/sensitivityEngine.mjs
// 敏感度分析引擎

import { buildSimulationInput } from "./dataAdapter.mjs";

/**
 * 執行單參數敏感度掃描
 * @param {Object} params
 * @returns {Object} { paramPath, metric, points, slope, correlation }
 */
export async function runSensitivitySingleParam({
  targetParam,
  scanRange,
  metrics,
  baseSimulationInput,
  baseParams,
  latestReport,
  runForwardSimulation,
}) {
  const { min, max, step } = scanRange;
  const points = [];

  // 解析參數路徑 (支援 nested path 如 "maintenance.protectTrigger")
  const paramPathParts = targetParam.split(".");

  for (let value = min; value <= max; value += step) {
    // 建構模擬輸入，注入參數值
    const simulationInput = setNestedParam(
      { ...baseSimulationInput },
      paramPathParts,
      value,
    );

    try {
      const result = await runForwardSimulation(
        simulationInput,
        latestReport.price0050,
        latestReport.currentPrice,
      );

      // 收集指標
      const point = { x: value };
      metrics.forEach((metric) => {
        point[metric] = extractMetric(result, metric);
      });
      points.push(point);
    } catch (err) {
      // 單點失敗不中斷，記錄 null
      const point = { x: value };
      metrics.forEach((metric) => {
        point[metric] = null;
      });
      points.push(point);
    }
  }

  // 計算斜率與相關係數 (以第一個 metric 為主)
  const primaryMetric = metrics[0];
  const validPoints = points.filter((p) => p[primaryMetric] !== null);
  const { slope, correlation } = calculateSlopeAndCorrelation(
    validPoints,
    primaryMetric,
  );

  return {
    paramPath: targetParam,
    metric: primaryMetric,
    points,
    slope,
    correlation,
  };
}

/**
 * 執行多參數掃描 (用於 Tornado 圖 - one-at-a-time)
 * @param {Object} params
 * @returns {Object} { results, keyDrivers }
 */
export async function runSensitivityMultiParam({
  multiParams,
  baseSimulationInput,
  baseParams,
  latestReport,
  runForwardSimulation,
}) {
  const results = [];

  for (const { path, range, paramDef } of multiParams) {
    const [min, max] = range;
    const step = Math.max(1, (max - min) / 20); // 固定 20 點

    let prevValue = null;
    let totalImpact = 0;
    let direction = "neutral";

    // 在範圍內掃描多個點，計算平均影響度
    let pointCount = 0;
    for (let value = min; value <= max; value += step) {
      const simulationInput = setNestedParam(
        { ...baseSimulationInput },
        path.split("."),
        value,
      );

      try {
        const result = await runForwardSimulation(
          simulationInput,
          latestReport.price0050,
          latestReport.currentPrice,
        );

        const currentScore = result.strategyScore ?? 0;

        if (prevValue !== null) {
          const impact = Math.abs(currentScore - prevValue);
          totalImpact += impact;
          if (currentScore > prevValue) direction = "positive";
          else if (currentScore < prevValue) direction = "negative";
          pointCount++;
        }
        prevValue = currentScore;
      } catch (err) {
        // 忽略單點錯誤
      }
    }

    const avgImpact = pointCount > 0 ? totalImpact / pointCount : 0;

    results.push({
      paramPath: path,
      label: paramDef?.label || path,
      impact: Number(avgImpact.toFixed(2)),
      direction,
    });
  }

  // 依影響度排序，取 Top 3 關鍵驅動因子
  const sorted = [...results].sort((a, b) => b.impact - a.impact);
  const keyDrivers = sorted.slice(0, 3).map((r) => r.paramPath);

  return { results: sorted, keyDrivers };
}

/**
 * 設定巢狀參數值
 * @param {Object} obj
 * @param {string[]} pathParts
 * @param {any} value
 * @returns {Object}
 */
function setNestedParam(obj, pathParts, value) {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!current[pathParts[i]]) current[pathParts[i]] = {};
    current = current[pathParts[i]];
  }
  current[pathParts[pathParts.length - 1]] = value;
  return obj;
}

/**
 * 從模擬結果提取指標
 * @param {Object} result
 * @param {string} metric
 * @returns {number|null}
 */
function extractMetric(result, metric) {
  switch (metric) {
    case "strategyScore":
      return result.strategyScore ?? null;
    case "maintenanceMargin":
      return result.maintenanceMargin ?? null;
    case "simulatedPrice0050":
      return result.simulatedPrice0050 ?? null;
    case "simulatedPriceZ2":
      return result.simulatedPriceZ2 ?? null;
    default:
      return null;
  }
}

/**
 * 計算斜率與相關係數
 * @param {Array} points - [{ x, y }]
 * @param {string} metricKey
 * @returns {Object} { slope, correlation }
 */
function calculateSlopeAndCorrelation(points, metricKey) {
  if (points.length < 2) return { slope: 0, correlation: 0 };

  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + (p[metricKey] ?? 0), 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * (p[metricKey] ?? 0), 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = points.reduce(
    (sum, p) => sum + (p[metricKey] ?? 0) * (p[metricKey] ?? 0),
    0,
  );

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
  );
  const correlation = denominator !== 0 ? numerator / denominator : 0;

  return {
    slope: Number(slope.toFixed(4)),
    correlation: Number(correlation.toFixed(4)),
  };
}
