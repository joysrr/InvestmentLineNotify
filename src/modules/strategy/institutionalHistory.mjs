const TRADING_DATE = /^\d{8}$/;

export function buildInstitutionalHistory(records, currentDate = null) {
  return (Array.isArray(records) ? records : [])
    .filter(
      (record) =>
        TRADING_DATE.test(record?.date ?? "") &&
        Number.isFinite(record?.totalNetBuy) &&
        record.date !== currentDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => record.totalNetBuy / 1_000_000);
}

// Deliberate ceiling: duplicate dates are preserved; add date-level aggregation
// only when the provider emits multiple records for the same trading day.

export default buildInstitutionalHistory;
