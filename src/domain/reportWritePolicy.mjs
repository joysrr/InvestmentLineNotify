export function shouldPersistDailyReport({ newsAnalysisStatus } = {}) {
  return newsAnalysisStatus !== "failed";
}
