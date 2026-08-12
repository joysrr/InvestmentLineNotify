/**
 * Schema Validator Helper
 * 使用 AJV 驗證 JSON 物件符合 JSON Schema
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";

/**
 * 建立 AJV 實例
 * @returns {Ajv}
 */
export function createAjv() {
  const ajv = new Ajv({
    strict: false, // 允許未知關鍵字、忽略 $schema
    allErrors: true,
    verbose: true,
  });
  addFormats(ajv);
  return ajv;
}

/**
 * 編譯並快取 schema
 * @param {Ajv} ajv
 * @param {Object} schema - JSON Schema 物件
 * @returns {Function} validate function
 */
export function compileSchema(ajv, schema) {
  // 移除 $schema 避免 AJV 嘗試解析遠端 meta-schema
  const { $schema, ...cleanSchema } = schema;
  return ajv.compile(cleanSchema);
}

/**
 * 驗證資料
 * @param {Function} validate - compiled validate function
 * @param {Object} data - 要驗證的資料
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateData(validate, data) {
  const valid = validate(data);
  if (valid) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: (validate.errors || []).map(
      (e) => `${e.instancePath || "root"} ${e.message}`,
    ),
  };
}

/**
 * 批次驗證多個 schema
 * @param {Ajv} ajv
 * @param {Object} data
 * @param {Object} schemas - { name: schema }
 * @returns {Object} { valid: boolean, results: { name: { valid, errors } } }
 */
export function validateAgainstSchemas(ajv, data, schemas) {
  const results = {};
  let allValid = true;
  for (const [name, schema] of Object.entries(schemas)) {
    const validate = ajv.compile(schema);
    const result = validateData(validate, data);
    results[name] = result;
    if (!result.valid) allValid = false;
  }
  return { valid: allValid, results };
}
