// src/modules/simulator/paretoEngine.mjs
// Pareto 前沿分析引擎

/**
 * 執行 Pareto 前沿分析
 * @param {Object} params
 * @returns {Object} { allPoints, paretoFront, kneePoint, weights }
 */
export async function runParetoAnalysis({
  scanParams,
  objectives,
  weights,
  sampling,
  baseSimulationInput,
  _baseParams,
  latestReport,
  runForwardSimulation,
}) {
  const { method, samples } = sampling;

  // 1. 產生採樣點
  const samplePoints = generateSamples(scanParams, method, samples);

  // 2. 評估每個採樣點
  const allPoints = [];

  for (const sample of samplePoints) {
    // 建構模擬輸入
    const simulationInput = applySampleToInput(
      { ...baseSimulationInput },
      scanParams,
      sample,
    );

    try {
      const result = await runForwardSimulation(
        simulationInput,
        latestReport.price0050,
        latestReport.currentPrice,
      );

      // 提取目標值
      const objectiveValues = {};
      objectives.forEach((obj) => {
        objectiveValues[obj.metric] = extractMetric(result, obj.metric);
      });

      allPoints.push({
        params: sample,
        objectives: objectiveValues,
        dominated: false, // 稍後計算
      });
    } catch (err) {
      // 單點失敗記錄但不中斷
      const objectiveValues = {};
      objectives.forEach((obj) => {
        objectiveValues[obj.metric] = null;
      });
      allPoints.push({
        params: sample,
        objectives: objectiveValues,
        dominated: true, // 失敗視為被支配
      });
    }
  }

  // 3. 非支配排序
  const rankedPoints = fastNonDominatedSort(allPoints, objectives);

  // 4. 提取 Pareto 前沿 (Rank 0)
  const paretoFront = rankedPoints
    .filter((p) => p.rank === 0)
    .sort((a, b) => {
      // 依第一個目標排序
      const m1 = objectives[0].metric;
      return (b.objectives[m1] ?? -Infinity) - (a.objectives[m1] ?? -Infinity);
    });

  // 5. 膝點檢測
  const kneePoint = detectKneePoint(paretoFront, objectives, weights);

  return {
    allPoints: rankedPoints,
    paretoFront,
    kneePoint,
    weights,
  };
}

/**
 * 產生採樣點
 * @param {Array} scanParams - 掃描參數定義
 * @param {string} method - lhs/random/grid
 * @param {number} samples - 採樣數
 * @returns {Array} 採樣點陣列
 */
function generateSamples(scanParams, method, samples) {
  const _paramCount = scanParams.length;
  const _samplesArray = [];

  if (method === "lhs") {
    // Latin Hypercube Sampling
    return latinHyperCubeSampling(scanParams, samples);
  } else if (method === "grid") {
    // 網格採樣 (僅適用於低維)
    return gridSampling(scanParams, samples);
  } else {
    // 隨機採樣
    return randomSampling(scanParams, samples);
  }
}

/**
 * Latin Hypercube Sampling
 */
function latinHyperCubeSampling(scanParams, samples) {
  const _paramCount = scanParams.length;
  const _samplesArray = [];

  // 為每個參數建立分層
  const strata = scanParams.map((sp) => {
    const [min, max] = sp.range;
    const step = (max - min) / samples;
    return Array.from(
      { length: samples },
      (_, i) => min + i * step + Math.random() * step,
    );
  });

  // 隨機排列每個參數的分層
  strata.forEach((s) => {
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
  });

  // 組合採樣點
  for (let i = 0; i < samples; i++) {
    const sample = {};
    scanParams.forEach((sp, paramIdx) => {
      sample[sp.path] = strata[paramIdx][i];
    });
    _samplesArray.push(sample);
  }

  return _samplesArray;
}

/**
 * 隨機採樣
 */
function randomSampling(scanParams, samples) {
  const _samplesArray = [];

  for (let i = 0; i < samples; i++) {
    const sample = {};
    scanParams.forEach((sp) => {
      const [min, max] = sp.range;
      sample[sp.path] = min + Math.random() * (max - min);
    });
    _samplesArray.push(sample);
  }

  return _samplesArray;
}

/**
 * 網格採樣
 */
function gridSampling(scanParams, samples) {
  const _samplesArray = [];
  const _paramCount = scanParams.length;

  // 計算每維度的點數
  const perDim = Math.max(2, Math.floor(Math.pow(samples, 1 / _paramCount)));

  function generateGrid(dimIdx, currentSample) {
    if (dimIdx === _paramCount) {
      _samplesArray.push({ ...currentSample });
      return;
    }

    const sp = scanParams[dimIdx];
    const [min, max] = sp.range;
    for (let i = 0; i < perDim; i++) {
      const val = min + (i / (perDim - 1)) * (max - min);
      currentSample[sp.path] = val;
      generateGrid(dimIdx + 1, currentSample);
    }
  }

  generateGrid(0, {});
  return _samplesArray.slice(0, samples);
}

/**
 * 將採樣值應用到模擬輸入
 */
function applySampleToInput(baseInput, scanParams, sample) {
  const input = { ...baseInput };

  scanParams.forEach((sp) => {
    const pathParts = sp.path.split(".");
    let current = input;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) current[pathParts[i]] = {};
      current = current[pathParts[i]];
    }
    current[pathParts[pathParts.length - 1]] = sample[sp.path];
  });

  return input;
}

/**
 * 快速非支配排序 (NSGA-II 風格)
 * @param {Array} points - 所有採樣點
 * @param {Array} objectives - 目標定義
 * @returns {Array} 帶有 rank 的點
 */
function fastNonDominatedSort(points, objectives) {
  const n = points.length;
  const dominationCount = new Array(n).fill(0);
  const dominatedSet = new Array(n).fill(null).map(() => []);
  const rank = new Array(n).fill(0);
  const fronts = [[]];

  // 建立支配關係
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const result = compareDominance(points[i], points[j], objectives);
      if (result === 1) {
        // i 支配 j
        dominatedSet[i].push(j);
        dominationCount[j]++;
      } else if (result === -1) {
        // j 支配 i
        dominatedSet[j].push(i);
        dominationCount[i]++;
      }
    }

    if (dominationCount[i] === 0) {
      rank[i] = 0;
      fronts[0].push(i);
    }
  }

  // 逐層建立前沿
  let frontIdx = 0;
  while (fronts[frontIdx].length > 0) {
    const nextFront = [];
    for (const i of fronts[frontIdx]) {
      for (const j of dominatedSet[i]) {
        dominationCount[j]--;
        if (dominationCount[j] === 0) {
          rank[j] = frontIdx + 1;
          nextFront.push(j);
        }
      }
    }
    frontIdx++;
    if (nextFront.length > 0) {
      fronts.push(nextFront);
    }
  }

  // 回傳帶有 rank 的點
  return points.map((p, i) => ({ ...p, rank: rank[i] }));
}

/**
 * 比較兩點的支配關係
 * @returns {number} 1: p1 支配 p2, -1: p2 支配 p1, 0: 不支配
 */
function compareDominance(p1, p2, objectives) {
  let p1Better = false;
  let p2Better = false;

  for (const obj of objectives) {
    const v1 = p1.objectives[obj.metric];
    const v2 = p2.objectives[obj.metric];

    if (v1 === null || v2 === null) continue;

    if (obj.direction === "maximize") {
      if (v1 > v2) p1Better = true;
      else if (v1 < v2) p2Better = true;
    } else {
      // minimize
      if (v1 < v2) p1Better = true;
      else if (v1 > v2) p2Better = true;
    }
  }

  if (p1Better && !p2Better) return 1;
  if (p2Better && !p1Better) return -1;
  return 0;
}

/**
 * 膝點檢測
 * 使用加權切比雪夫距離找出最接近理想點的點
 */
function detectKneePoint(paretoFront, objectives, weights) {
  if (paretoFront.length === 0) return null;
  if (paretoFront.length === 1) return paretoFront[0];

  // 找出理想點 (每個目標的最佳值)
  const idealPoint = {};
  objectives.forEach((obj) => {
    const values = paretoFront
      .map((p) => p.objectives[obj.metric])
      .filter((v) => v !== null);
    if (values.length === 0) {
      idealPoint[obj.metric] = null;
    } else if (obj.direction === "maximize") {
      idealPoint[obj.metric] = Math.max(...values);
    } else {
      idealPoint[obj.metric] = Math.min(...values);
    }
  });

  // 找出最差點 (用於正規化)
  const nadirPoint = {};
  objectives.forEach((obj) => {
    const values = paretoFront
      .map((p) => p.objectives[obj.metric])
      .filter((v) => v !== null);
    if (values.length === 0) {
      nadirPoint[obj.metric] = null;
    } else if (obj.direction === "maximize") {
      nadirPoint[obj.metric] = Math.min(...values);
    } else {
      nadirPoint[obj.metric] = Math.max(...values);
    }
  });

  // 計算每個點到理想點的加權切比雪夫距離
  let bestPoint = null;
  let bestDistance = Infinity;

  paretoFront.forEach((p) => {
    let maxDist = 0;
    objectives.forEach((obj, idx) => {
      const ideal = idealPoint[obj.metric];
      const nadir = nadirPoint[obj.metric];
      const val = p.objectives[obj.metric];

      if (val === null || ideal === null || nadir === null || ideal === nadir)
        return;

      let normalized;
      if (obj.direction === "maximize") {
        normalized = (ideal - val) / (ideal - nadir);
      } else {
        normalized = (val - ideal) / (nadir - ideal);
      }

      const weight = weights[idx] ?? 1 / objectives.length;
      maxDist = Math.max(maxDist, weight * normalized);
    });

    if (maxDist < bestDistance) {
      bestDistance = maxDist;
      bestPoint = { ...p, distance: maxDist };
    }
  });

  if (bestPoint) {
    // 計算膝點的權重分佈
    const kneeWeights = objectives.map((obj, idx) => {
      const ideal = idealPoint[obj.metric];
      const nadir = nadirPoint[obj.metric];
      const val = bestPoint.objectives[obj.metric];

      if (val === null || ideal === null || nadir === null || ideal === nadir) {
        return weights[idx] ?? 1 / objectives.length;
      }

      if (obj.direction === "maximize") {
        return (ideal - val) / (ideal - nadir);
      } else {
        return (val - ideal) / (nadir - ideal);
      }
    });

    // 正規化權重
    const sum = kneeWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights =
      sum > 0 ? kneeWeights.map((w) => w / sum) : weights;

    return {
      ...bestPoint,
      weights: normalizedWeights,
    };
  }

  return null;
}

/**
 * 從模擬結果提取指標
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
