/**
 * ROC 日期轉 ISO： "106/08/01" -> "2017-08-01"
 * TWSE STOCK_DAY 會回民國日期。
 */
function rocDateToIso(rocYMD) {
  const [rocY, m, d] = String(rocYMD).trim().split("/");
  const adY = Number(rocY) + 1911;
  return `${adY}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * 產生起訖日期之間「月份」清單（用於 TWSE STOCK_DAY 月查詢）
 * 回傳 ["YYYYMM01", ...]
 */
function enumerateMonths(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const months = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (d <= endMonth) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${yyyy}${mm}01`);
    d.setMonth(d.getMonth() + 1);
  }

  return months;
}

/**
 * symbol 轉 TWSE stockNo： "00675L.TW" -> "00675L"
 */
function toTwseStockNo(symbol) {
  return String(symbol).replace(".TW", "").trim();
}

module.exports = { rocDateToIso, enumerateMonths, toTwseStockNo };