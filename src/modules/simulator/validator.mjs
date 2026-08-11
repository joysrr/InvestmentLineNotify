// src/modules/simulator/validator.mjs
// 輸入驗證：價格範圍、目標類型、必填欄位 (DEC-16, DEC-17, DEC-19)

import {
  REVERSE_TARGET_TYPES,
  PRICE_BOUNDS,
  RSI_BOUNDS,
  STRATEGY_SCORE_BOUNDS,
  SCANNABLE_PARAMS,
} from "./constants.mjs";

/**
 * 驗證正向模擬輸入
 * @param {Object} body - { price0050, priceZ2? }
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[], sanitized: Object }
 */
export function validateForwardInput(body) {
  const errors = [];
  const warnings = [];
  const sanitized = {};

  // price0050 必填
  if (body.price0050 === undefined || body.price0050 === null) {
    errors.push("price0050 為必填欄位");
  } else {
    const price = Number(body.price0050);
    if (!Number.isFinite(price)) {
      errors.push("price0050 必須是有效數字");
    } else if (price <= 0) {
      errors.push("price0050 必須大於 0");
    } else if (price < PRICE_BOUNDS.MIN || price > PRICE_BOUNDS.MAX) {
      errors.push(
        `price0050 必須在 ${PRICE_BOUNDS.MIN} 到 ${PRICE_BOUNDS.MAX} 之間`,
      );
    } else {
      sanitized.price0050 = price;

      // 價格偏離警告 (需配合當前價格，這裡只做基本範圍檢查)
      // 實際警告會在 forwardSimulator 中依 currentPrice0050 判斷
    }
  }

  // priceZ2 選填
  if (body.priceZ2 !== undefined && body.priceZ2 !== null) {
    const priceZ2 = Number(body.priceZ2);
    if (!Number.isFinite(priceZ2)) {
      errors.push("priceZ2 必須是有效數字");
    } else if (priceZ2 <= 0) {
      errors.push("priceZ2 必須大於 0");
    } else if (priceZ2 < PRICE_BOUNDS.MIN || priceZ2 > PRICE_BOUNDS.MAX) {
      errors.push(
        `priceZ2 必須在 ${PRICE_BOUNDS.MIN} 到 ${PRICE_BOUNDS.MAX} 之間`,
      );
    } else {
      sanitized.priceZ2 = priceZ2;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized,
  };
}

/**
 * 驗證反向推導輸入
 * @param {Object} body - { target: { type, value?, direction? } }
 * @returns {Object} { valid: boolean, errors: string[], sanitized: Object }
 */
export function validateReverseInput(body) {
  const errors = [];
  const sanitized = {};

  if (!body.target || typeof body.target !== "object") {
    errors.push("target 為必填物件");
    return { valid: false, errors, sanitized: null };
  }

  const { type, value, direction } = body.target;

  if (!type || typeof type !== "string") {
    errors.push("target.type 為必填字串");
  } else if (!REVERSE_TARGET_TYPES.includes(type)) {
    errors.push(
      `不支援的目標類型: ${type}，支援類型: ${REVERSE_TARGET_TYPES.join(", ")}`,
    );
  } else {
    sanitized.target = { type };

    // 依類型驗證 value/direction
    switch (type) {
      case "maintenanceRatio":
        if (value === undefined || value === null) {
          errors.push("maintenanceRatio 目標需提供 value (目標維持率)");
        } else {
          const v = Number(value);
          if (!Number.isFinite(v) || v <= 0) {
            errors.push("維持率目標必須為正數");
          } else {
            sanitized.target.value = v;
          }
        }
        break;

      case "rsi":
        if (value === undefined || value === null) {
          errors.push("RSI 目標需提供 value (1-99)");
        } else {
          const v = Number(value);
          if (!Number.isFinite(v) || v < RSI_BOUNDS.MIN || v > RSI_BOUNDS.MAX) {
            errors.push(
              `RSI 目標必須在 ${RSI_BOUNDS.MIN} 到 ${RSI_BOUNDS.MAX} 之間`,
            );
          } else {
            sanitized.target.value = v;
          }
        }
        break;

      case "ma20":
      case "ma60":
        if (value === undefined || value === null) {
          errors.push(`${type.toUpperCase()} 目標需提供 value (目標均線價格)`);
        } else {
          const v = Number(value);
          if (!Number.isFinite(v) || v <= 0) {
            errors.push(`${type.toUpperCase()} 目標必須為正數`);
          } else {
            sanitized.target.value = v;
          }
        }
        break;

      case "ma240Bias":
        if (value === undefined || value === null) {
          errors.push("MA240 偏離目標需提供 value (百分比，如 10 代表 +10%)");
        } else {
          const v = Number(value);
          if (!Number.isFinite(v)) {
            errors.push("MA240 偏離目標必須為數字");
          } else {
            sanitized.target.value = v;
          }
        }
        break;

      case "kdCross":
      case "macdCross":
        if (!direction || !["golden", "dead"].includes(direction)) {
          errors.push(`${type} 目標需提供 direction: "golden" 或 "dead"`);
        } else {
          sanitized.target.direction = direction;
        }
        break;

      case "strategyScore":
        if (value === undefined || value === null) {
          errors.push("策略分數目標需提供 value");
        } else {
          const v = Number(value);
          if (
            !Number.isFinite(v) ||
            v < STRATEGY_SCORE_BOUNDS.MIN ||
            v > STRATEGY_SCORE_BOUNDS.MAX
          ) {
            errors.push(
              `策略分數目標建議在 ${STRATEGY_SCORE_BOUNDS.MIN} 到 ${STRATEGY_SCORE_BOUNDS.MAX} 之間`,
            );
          } else {
            sanitized.target.value = v;
          }
        }
        break;

      case "portfolioHealth":
        // 可選 value 指定目標狀態
        if (value !== undefined && value !== null) {
          if (!["green", "yellow", "red"].includes(value)) {
            errors.push("portfolioHealth 目標狀態必須為 green/yellow/red");
          } else {
            sanitized.target.status = value;
          }
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : null,
  };
}

/**
 * 驗證批次模擬輸入
 * @param {Object} body - { jobs: Array, options?: Object }
 * @returns {Object} { valid: boolean, errors: string[], sanitized: Object }
 */
export function validateBatchInput(body) {
  const errors = [];
  const sanitized = {};

  if (!body || typeof body !== "object") {
    errors.push("body 為必填物件");
    return { valid: false, errors, sanitized: null };
  }

  const { jobs, options } = body;

  // 驗證 jobs 陣列
  if (!Array.isArray(jobs)) {
    errors.push("jobs 必須為陣列");
  } else if (jobs.length === 0) {
    errors.push("jobs 至少需要 1 個任務");
  } else if (jobs.length > 100) {
    errors.push("jobs 數量不能超過 100");
  } else {
    jobs.forEach((job, index) => {
      if (!job || typeof job !== "object") {
        errors.push(`jobs[${index}] 必須為物件`);
        return;
      }

      // price0050 必填
      if (job.price0050 === undefined || job.price0050 === null) {
        errors.push(`jobs[${index}].price0050 為必填欄位`);
      } else {
        const price = Number(job.price0050);
        if (!Number.isFinite(price)) {
          errors.push(`jobs[${index}].price0050 必須是有效數字`);
        } else if (price <= 0) {
          errors.push(`jobs[${index}].price0050 必須大於 0`);
        } else if (price < PRICE_BOUNDS.MIN || price > PRICE_BOUNDS.MAX) {
          errors.push(
            `jobs[${index}].price0050 必須在 ${PRICE_BOUNDS.MIN} 到 ${PRICE_BOUNDS.MAX} 之間`,
          );
        }
      }

      // priceZ2 選填
      if (job.priceZ2 !== undefined && job.priceZ2 !== null) {
        const priceZ2 = Number(job.priceZ2);
        if (!Number.isFinite(priceZ2)) {
          errors.push(`jobs[${index}].priceZ2 必須是有效數字`);
        } else if (priceZ2 <= 0) {
          errors.push(`jobs[${index}].priceZ2 必須大於 0`);
        } else if (priceZ2 < PRICE_BOUNDS.MIN || priceZ2 > PRICE_BOUNDS.MAX) {
          errors.push(
            `jobs[${index}].priceZ2 必須在 ${PRICE_BOUNDS.MIN} 到 ${PRICE_BOUNDS.MAX} 之間`,
          );
        }
      }
    });
  }

  // 驗證 options (選填)
  let sanitizedOptions = {};
  if (options !== undefined && options !== null) {
    if (typeof options !== "object") {
      errors.push("options 必須為物件");
    } else {
      const { concurrency, retryAttempts, retryDelayMs } = options;

      if (concurrency !== undefined) {
        const c = Number(concurrency);
        if (!Number.isFinite(c) || c < 1 || c > 16) {
          errors.push("options.concurrency 必須在 1 到 16 之間");
        } else {
          sanitizedOptions.concurrency = c;
        }
      }

      if (retryAttempts !== undefined) {
        const r = Number(retryAttempts);
        if (!Number.isFinite(r) || r < 0 || r > 5) {
          errors.push("options.retryAttempts 必須在 0 到 5 之間");
        } else {
          sanitizedOptions.retryAttempts = r;
        }
      }

      if (retryDelayMs !== undefined) {
        const d = Number(retryDelayMs);
        if (!Number.isFinite(d) || d < 0 || d > 10000) {
          errors.push("options.retryDelayMs 必須在 0 到 10000 之間");
        } else {
          sanitizedOptions.retryDelayMs = d;
        }
      }
    }
  }

  if (errors.length === 0) {
    sanitized.jobs = jobs;
    sanitized.options =
      Object.keys(sanitizedOptions).length > 0 ? sanitizedOptions : undefined;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : null,
  };
}

/**
 * 驗證敏感度分析輸入
 * @param {Object} body - { baseParams, targetParam, scanRange, metrics?, multiParams? }
 * @returns {Object} { valid: boolean, errors: string[], sanitized: Object }
 */
export function validateSensitivityInput(body) {
  const errors = [];
  const sanitized = {};
  const SUPPORTED_METRICS = [
    "strategyScore",
    "maintenanceMargin",
    "simulatedPrice0050",
    "simulatedPriceZ2",
  ];

  if (!body || typeof body !== "object") {
    errors.push("body 為必填物件");
    return { valid: false, errors, sanitized: null };
  }

  const { baseParams, targetParam, scanRange, metrics, multiParams } = body;

  // 驗證 baseParams
  if (!baseParams || typeof baseParams !== "object") {
    errors.push("baseParams 為必填物件");
  } else {
    const baseValidation = validateForwardInput(baseParams);
    if (!baseValidation.valid) {
      errors.push(...baseValidation.errors.map((e) => `baseParams: ${e}`));
    } else {
      sanitized.baseParams = baseValidation.sanitized;
    }
  }

  // 驗證 targetParam
  if (!targetParam || typeof targetParam !== "string") {
    errors.push("targetParam 為必填字串");
  } else {
    // 檢查是否在 SCANNABLE_PARAMS 中
    const paramDef = SCANNABLE_PARAMS.find((p) => p.path === targetParam);
    if (!paramDef) {
      errors.push(`不支援的參數路徑: ${targetParam}`);
    } else {
      sanitized.targetParam = targetParam;
      sanitized.targetParamDef = paramDef;
    }
  }

  // 驗證 scanRange
  if (!scanRange || typeof scanRange !== "object") {
    errors.push("scanRange 為必填物件");
  } else {
    const { min, max, step } = scanRange;
    if (min === undefined || max === undefined || step === undefined) {
      errors.push("scanRange 需包含 min, max, step");
    } else {
      const minVal = Number(min);
      const maxVal = Number(max);
      const stepVal = Number(step);

      if (
        !Number.isFinite(minVal) ||
        !Number.isFinite(maxVal) ||
        !Number.isFinite(stepVal)
      ) {
        errors.push("scanRange 的 min, max, step 必須為有效數字");
      } else if (minVal > maxVal) {
        errors.push("scanRange.min 不能大於 max");
      } else if (stepVal <= 0) {
        errors.push("scanRange.step 必須大於 0");
      } else if ((maxVal - minVal) / stepVal > 200) {
        errors.push("掃描點數不能超過 200 (請調大 step 或縮小範圍)");
      } else {
        sanitized.scanRange = { min: minVal, max: maxVal, step: stepVal };
      }
    }
  }

  // 驗證 metrics (選填)
  if (metrics !== undefined) {
    if (!Array.isArray(metrics)) {
      errors.push("metrics 必須為陣列");
    } else if (metrics.length === 0) {
      errors.push("metrics 至少需要 1 個觀測指標");
    } else {
      const invalidMetrics = metrics.filter(
        (m) => !SUPPORTED_METRICS.includes(m),
      );
      if (invalidMetrics.length > 0) {
        errors.push(
          `不支援的觀測指標: ${invalidMetrics.join(", ")}，支援: ${SUPPORTED_METRICS.join(", ")}`,
        );
      } else {
        sanitized.metrics = metrics;
      }
    }
  } else {
    sanitized.metrics = ["strategyScore", "maintenanceMargin"]; // 預設
  }

  // 驗證 multiParams (選填，用於 Tornado 圖)
  if (multiParams !== undefined) {
    if (!Array.isArray(multiParams)) {
      errors.push("multiParams 必須為陣列");
    } else if (multiParams.length > 10) {
      errors.push("multiParams 數量不能超過 10");
    } else {
      const validatedMultiParams = [];
      multiParams.forEach((mp, idx) => {
        if (!mp || typeof mp !== "object") {
          errors.push(`multiParams[${idx}] 必須為物件`);
          return;
        }
        const { path, range } = mp;
        if (!path || typeof path !== "string") {
          errors.push(`multiParams[${idx}].path 為必填字串`);
        } else {
          const paramDef = SCANNABLE_PARAMS.find((p) => p.path === path);
          if (!paramDef) {
            errors.push(`multiParams[${idx}].path 不支援: ${path}`);
          } else if (!range || !Array.isArray(range) || range.length !== 2) {
            errors.push(`multiParams[${idx}].range 必須為 [min, max] 陣列`);
          } else {
            const [rMin, rMax] = range.map(Number);
            if (
              !Number.isFinite(rMin) ||
              !Number.isFinite(rMax) ||
              rMin > rMax
            ) {
              errors.push(`multiParams[${idx}].range 無效`);
            } else {
              validatedMultiParams.push({
                path,
                range: [rMin, rMax],
                paramDef,
              });
            }
          }
        }
      });
      if (errors.length === 0) {
        sanitized.multiParams = validatedMultiParams;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : null,
  };
}

/**
 * 驗證 Pareto 前沿分析輸入
 * @param {Object} body - { baseParams, scanParams, objectives, weights?, sampling? }
 * @returns {Object} { valid: boolean, errors: string[], sanitized: Object }
 */
export function validateParetoInput(body) {
  const errors = [];
  const sanitized = {};
  const SUPPORTED_METRICS = [
    "strategyScore",
    "maintenanceMargin",
    "simulatedPrice0050",
    "simulatedPriceZ2",
  ];
  const VALID_DIRECTIONS = ["maximize", "minimize"];
  const VALID_SAMPLING_METHODS = ["lhs", "random", "grid"];

  if (!body || typeof body !== "object") {
    errors.push("body 為必填物件");
    return { valid: false, errors, sanitized: null };
  }

  const { baseParams, scanParams, objectives, weights, sampling } = body;

  // 驗證 baseParams
  if (!baseParams || typeof baseParams !== "object") {
    errors.push("baseParams 為必填物件");
  } else {
    const baseValidation = validateForwardInput(baseParams);
    if (!baseValidation.valid) {
      errors.push(...baseValidation.errors.map((e) => `baseParams: ${e}`));
    } else {
      sanitized.baseParams = baseValidation.sanitized;
    }
  }

  // 驗證 scanParams
  if (!scanParams || !Array.isArray(scanParams)) {
    errors.push("scanParams 為必填陣列");
  } else if (scanParams.length === 0) {
    errors.push("scanParams 至少需要 1 個掃描參數");
  } else if (scanParams.length > 5) {
    errors.push("scanParams 數量不能超過 5");
  } else {
    const validatedScanParams = [];
    scanParams.forEach((sp, idx) => {
      if (!sp || typeof sp !== "object") {
        errors.push(`scanParams[${idx}] 必須為物件`);
        return;
      }
      const { path, range } = sp;
      if (!path || typeof path !== "string") {
        errors.push(`scanParams[${idx}].path 為必填字串`);
      } else {
        const paramDef = SCANNABLE_PARAMS.find((p) => p.path === path);
        if (!paramDef) {
          errors.push(`scanParams[${idx}].path 不支援: ${path}`);
        } else if (!range || !Array.isArray(range) || range.length !== 2) {
          errors.push(`scanParams[${idx}].range 必須為 [min, max] 陣列`);
        } else {
          const [rMin, rMax] = range.map(Number);
          if (
            !Number.isFinite(rMin) ||
            !Number.isFinite(rMax) ||
            rMin >= rMax
          ) {
            errors.push(`scanParams[${idx}].range 無效: min 必須小於 max`);
          } else {
            validatedScanParams.push({ path, range: [rMin, rMax], paramDef });
          }
        }
      }
    });
    if (errors.length === 0) {
      sanitized.scanParams = validatedScanParams;
    }
  }

  // 驗證 objectives
  if (!objectives || !Array.isArray(objectives)) {
    errors.push("objectives 為必填陣列");
  } else if (objectives.length < 2) {
    errors.push("objectives 至少需要 2 個目標 (Pareto 前沿需雙目標以上)");
  } else if (objectives.length > 3) {
    errors.push("objectives 數量不能超過 3");
  } else {
    const validatedObjectives = [];
    objectives.forEach((obj, idx) => {
      if (!obj || typeof obj !== "object") {
        errors.push(`objectives[${idx}] 必須為物件`);
        return;
      }
      const { metric, direction } = obj;
      if (!metric || typeof metric !== "string") {
        errors.push(`objectives[${idx}].metric 為必填字串`);
      } else if (!SUPPORTED_METRICS.includes(metric)) {
        errors.push(
          `objectives[${idx}].metric 不支援: ${metric}，支援: ${SUPPORTED_METRICS.join(", ")}`,
        );
      } else if (!direction || !VALID_DIRECTIONS.includes(direction)) {
        errors.push(
          `objectives[${idx}].direction 必須為 "maximize" 或 "minimize"`,
        );
      } else {
        validatedObjectives.push({ metric, direction });
      }
    });
    if (errors.length === 0) {
      sanitized.objectives = validatedObjectives;
    }
  }

  // 驗證 weights (選填)
  if (weights !== undefined) {
    if (!Array.isArray(weights)) {
      errors.push("weights 必須為陣列");
    } else if (weights.length !== objectives?.length) {
      errors.push("weights 長度必須等於 objectives 數量");
    } else {
      const sum = weights.reduce((s, w) => s + Number(w), 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        errors.push("weights 總和必須等於 1");
      } else if (weights.some((w) => !Number.isFinite(w) || w < 0 || w > 1)) {
        errors.push("weights 每項必須在 0 到 1 之間");
      } else {
        sanitized.weights = weights.map(Number);
      }
    }
  } else {
    // 預設等權重
    sanitized.weights = objectives
      ? Array(objectives.length).fill(1 / objectives.length)
      : [];
  }

  // 驗證 sampling (選填)
  if (sampling !== undefined) {
    if (!sampling || typeof sampling !== "object") {
      errors.push("sampling 必須為物件");
    } else {
      const { method, samples } = sampling;
      if (!method || !VALID_SAMPLING_METHODS.includes(method)) {
        errors.push(
          `sampling.method 必須為: ${VALID_SAMPLING_METHODS.join(", ")}`,
        );
      } else if (!Number.isFinite(samples) || samples < 10 || samples > 500) {
        errors.push("sampling.samples 必須在 10 到 500 之間");
      } else {
        sanitized.sampling = { method, samples: Number(samples) };
      }
    }
  } else {
    sanitized.sampling = { method: "lhs", samples: 200 }; // 預設
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : null,
  };
}

/**
 * 產生價格偏離警告
 * @param {number} simulatedPrice - 模擬價格
 * @param {number} currentPrice - 當前價格
 * @returns {string[]} 警告訊息陣列
 */
export function generatePriceDeviationWarnings(simulatedPrice, currentPrice) {
  const warnings = [];
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return warnings;

  const deviationPct = Math.abs((simulatedPrice - currentPrice) / currentPrice);

  if (deviationPct > PRICE_BOUNDS.DANGER_THRESHOLD_PCT) {
    warnings.push(
      `價格偏離超過 ${(PRICE_BOUNDS.DANGER_THRESHOLD_PCT * 100).toFixed(0)}%，此情境可能代表多日後狀態，指標路徑依賴性增強`,
    );
  } else if (deviationPct > PRICE_BOUNDS.WARNING_THRESHOLD_PCT) {
    warnings.push(
      `價格偏離超過 ${(PRICE_BOUNDS.WARNING_THRESHOLD_PCT * 100).toFixed(0)}%，結果可能不反映單日情境`,
    );
  }

  return warnings;
}

/**
 * 統一錯誤回應格式 (DEC-17)
 * @param {string} code - 錯誤代碼
 * @param {string} message - 繁中訊息
 * @param {string} [field] - 相關欄位
 * @returns {Object}
 */
export function createErrorResponse(code, message, field = null) {
  const response = { error: code, message, statusCode: getStatusCode(code) };
  if (field) response.field = field;
  return response;
}

function getStatusCode(code) {
  const map = {
    BAD_REQUEST: 400,
    VALIDATION_ERROR: 400,
    CONFLICT: 409,
    DATA_NOT_READY: 409,
    SERVICE_UNAVAILABLE: 503,
    INTERNAL_ERROR: 500,
  };
  return map[code] || 500;
}
