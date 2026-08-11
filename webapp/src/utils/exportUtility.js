// webapp/src/utils/exportUtility.js
// 前端共用匯出工具

/**
 * 觸發檔案下載
 * @param {Blob} blob - 檔案內容
 * @param {string} filename - 檔名
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 產生標準化檔名
 * @param {string} prefix - 前綴
 * @param {string} ext - 副檔名
 * @returns {string}
 */
export function generateFilename(prefix, ext) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}-${timestamp}.${ext}`;
}

/**
 * 陣列物件轉 CSV
 * @param {Array<Object>} data - 資料陣列
 * @param {Object} options - 選項
 * @returns {string} CSV 字串
 */
export function arrayToCSV(data, options = {}) {
  if (!data || data.length === 0) return "";

  const {
    headers = null, // 自訂標題 [{ key, label }]
    delimiter = ",", // 分隔符
    includeHeader = true, // 是否包含標題列
    nullValue = "", // null 值替代字串
  } = options;

  // 決定欄位順序
  const keys = headers ? headers.map((h) => h.key) : Object.keys(data[0]);
  const labels = headers ? headers.map((h) => h.label) : keys;

  const rows = [];

  if (includeHeader) {
    rows.push(labels.map(escapeCSV).join(delimiter));
  }

  for (const row of data) {
    const values = keys.map((key) => {
      const val = row[key];
      if (val === null || val === undefined) return nullValue;
      return escapeCSV(val);
    });
    rows.push(values.join(delimiter));
  }

  return rows.join("\n");
}

/**
 * CSV 欄位轉義
 * @param {any} val - 值
 * @returns {string}
 */
function escapeCSV(val) {
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 物件轉 JSON (含 metadata)
 * @param {Object} data - 資料物件
 * @param {Object} options - 選項
 * @returns {string} JSON 字串
 */
export function toJSON(data, options = {}) {
  const { pretty = true, metadata = {}, includeTimestamp = true } = options;

  const exportData = {
    metadata: {
      exportedAt: includeTimestamp ? new Date().toISOString() : undefined,
      version: "1.0",
      ...metadata,
    },
    data,
  };

  // 移除 undefined
  if (exportData.metadata.exportedAt === undefined) {
    delete exportData.metadata.exportedAt;
  }

  return pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);
}

/**
 * 匯出 CSV 檔案
 * @param {Array<Object>} data - 資料陣列
 * @param {string} filename - 檔名 (不含副檔名)
 * @param {Object} options - 選項
 */
export function exportCSV(data, filename, options = {}) {
  const csv = arrayToCSV(data, options);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * 匯出 JSON 檔案
 * @param {Object} data - 資料物件
 * @param {string} filename - 檔名 (不含副檔名)
 * @param {Object} options - 選項
 */
export function exportJSON(data, filename, options = {}) {
  const json = toJSON(data, options);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  triggerDownload(blob, `${filename}.json`);
}

/**
 * 匯出 ECharts 圖表為圖片
 * @param {Object} chartInstance - ECharts 實例
 * @param {string} filename - 檔名 (不含副檔名)
 * @param {Object} options - 選項
 */
export async function exportChartAsImage(
  chartInstance,
  filename,
  options = {},
) {
  if (!chartInstance) {
    throw new Error("Chart instance is required");
  }

  const {
    type = "png",
    pixelRatio = 2,
    backgroundColor = "#fff",
    excludeComponents = ["toolbox"],
  } = options;

  return new Promise((resolve, reject) => {
    try {
      const dataURL = chartInstance.getDataURL({
        type: `image/${type}`,
        pixelRatio,
        backgroundColor,
        excludeComponents,
      });

      // 轉換為 Blob
      fetch(dataURL)
        .then((res) => res.blob())
        .then((blob) => {
          triggerDownload(blob, `${filename}.${type}`);
          resolve();
        })
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 批次匯出多種格式
 * @param {Object} data - 資料
 * @param {string} filename - 基礎檔名
 * @param {Array<string>} formats - 格式陣列 ['csv', 'json', 'png']
 * @param {Object} chartInstance - ECharts 實例 (圖片匯出需要)
 */
export async function exportAllFormats(
  data,
  filename,
  formats = ["csv", "json"],
  chartInstance = null,
) {
  const results = [];

  if (formats.includes("csv") && Array.isArray(data)) {
    exportCSV(data, filename);
    results.push("csv");
  }

  if (formats.includes("json")) {
    exportJSON(data, filename);
    results.push("json");
  }

  if (formats.includes("png") && chartInstance) {
    await exportChartAsImage(chartInstance, filename);
    results.push("png");
  }

  return results;
}
