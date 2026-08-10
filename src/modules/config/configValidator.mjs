/**
 * configValidator.mjs
 * 策略設定驗證器
 * 依據 ConfigMeta.json 進行欄位型別、範圍、必要性驗證
 */

import { readFileSync } from "fs";
import { resolve } from "path";

let configMetaCache = null;

/**
 * 載入 ConfigMeta (支援快取)
 */
export function loadConfigMeta() {
  if (configMetaCache) return configMetaCache;

  const metaPath = resolve("data/config/ConfigMeta.json");
  const content = readFileSync(metaPath, "utf-8");
  configMetaCache = JSON.parse(content);
  return configMetaCache;
}

/**
 * 取得欄位元資料
 * @param {string} path - 欄位路徑 (e.g., "maintenance.protectTrigger")
 * @param {Object} meta - ConfigMeta 物件
 * @returns {Object|null} 欄位元資料或 null
 */
export function getFieldMeta(path, meta = loadConfigMeta()) {
  return meta[path] || null;
}

/**
 * 驗證單一欄位
 * @param {string} path - 欄位路徑
 * @param {any} value - 欄位值
 * @param {Object} meta - ConfigMeta 物件
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateField(path, value, meta = loadConfigMeta()) {
  const fieldMeta = getFieldMeta(path, meta);
  const errors = [];

  if (!fieldMeta) {
    return { valid: true, errors: [] }; // 未定義的欄位不強制驗證
  }

  const { type, min, max, required = false } = fieldMeta;

  // 必填檢查
  if (required && (value === undefined || value === null || value === "")) {
    errors.push(`${path}: 必填欄位不可為空`);
    return { valid: false, errors };
  }

  // 選填且為空值時跳過型別檢查
  if (value === undefined || value === null || value === "") {
    return { valid: true, errors: [] };
  }

  // 型別驗證
  switch (type) {
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        errors.push(`${path}: 必須是數值`);
      } else {
        if (min !== undefined && value < min) {
          errors.push(`${path}: 低於最小值 ${min}`);
        }
        if (max !== undefined && value > max) {
          errors.push(`${path}: 超過最大值 ${max}`);
        }
      }
      break;

    case "boolean":
      if (typeof value !== "boolean") {
        errors.push(`${path}: 必須是布林值 (true/false)`);
      }
      break;

    case "string":
      if (typeof value !== "string") {
        errors.push(`${path}: 必須是字串`);
      }
      break;

    case "array":
      if (!Array.isArray(value)) {
        errors.push(`${path}: 必須是陣列`);
      }
      break;

    case "object":
      if (typeof value !== "object" || Array.isArray(value) || value === null) {
        errors.push(`${path}: 必須是物件`);
      }
      break;

    default:
      // 未知型別不強制驗證
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 扁平化巢狀物件
 * @param {Object} obj - 巢狀物件
 * @param {string} prefix - 路徑前綴
 * @returns {Object} 扁平化物件
 */
export function flattenConfig(obj, prefix = "") {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenConfig(value, path));
    } else {
      result[path] = value;
    }
  }

  return result;
}

/**
 * 還原扁平物件為巢狀
 * @param {Object} flat - 扁平化物件
 * @returns {Object} 巢狀物件
 */
export function unflattenConfig(flat) {
  const result = {};

  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".");
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  return result;
}

/**
 * 完整驗證設定物件
 * @param {Object} config - 策略設定物件
 * @param {Object} meta - ConfigMeta 物件
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateConfig(config, meta = loadConfigMeta()) {
  const flat = flattenConfig(config);
  const allErrors = [];

  for (const [path, value] of Object.entries(flat)) {
    const result = validateField(path, value, meta);
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * 載入並驗證預設設定檔
 * @returns {Object} 驗證後的設定
 */
export function loadAndValidateDefaultConfig() {
  const configPath = resolve("data/config/Strategy.default.json");
  const content = readFileSync(configPath, "utf-8");
  const config = JSON.parse(content);

  const result = validateConfig(config);
  if (!result.valid) {
    throw new Error(`預設設定驗證失敗: ${result.errors.join("; ")}`);
  }

  return config;
}
