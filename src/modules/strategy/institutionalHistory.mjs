const TRADING_DATE = /^\d{8}$/;

export function extractInstitutionalHistoryRecords(snapshots) {
  return (Array.isArray(snapshots) ? snapshots : [])
    .map((snapshot) => snapshot?.data?.rawInstitutional)
    .filter((record) => record && typeof record === "object")
    .map(({ date, totalNetBuy }) => ({ date, totalNetBuy }));
}

export function buildInstitutionalHistory(records, currentDate = null) {
  const validRecords = (Array.isArray(records) ? records : []).filter(
    (record) =>
      TRADING_DATE.test(record?.date ?? "") &&
      Number.isFinite(record?.totalNetBuy) &&
      record.date !== currentDate,
  );
  const latestByDate = new Map(
    validRecords.map((record) => [record.date, record]),
  );

  return [...latestByDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((record) => record.totalNetBuy / 1_000_000); // one value per trading date.
}

// Deliberate ceiling: duplicate dates use the last valid snapshot; aggregate
// multiple provider records only if their meaning becomes explicit.

export default buildInstitutionalHistory;
