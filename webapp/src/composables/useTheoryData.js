/**
 * useTheoryData.js
 * Composable for fetching and managing theoretical analysis data
 * from the latest daily report.
 */

import { ref, computed } from "vue";
import { fetchReports, fetchLatestTheoretical } from "../api/index.js";

/**
 * Composable for theoretical shadow data
 * @returns {Object} - { data, loading, error, fetch, isEmpty, isAvailable }
 */
export function useTheoryData() {
  const data = ref(null);
  const loading = ref(false);
  const error = ref(null);

  /**
   * Fetch the latest daily report and extract theoreticalShadow
   * Priority: 1) Try /api/report/latest-theoretical (searches backward for AVAILABLE)
   *           2) Fallback to latest report via fetchReports(1)
   */
  async function fetch() {
    loading.value = true;
    error.value = null;
    data.value = null;

    try {
      // First try the dedicated endpoint that finds the latest AVAILABLE theoretical data
      let latestReport = null;
      try {
        latestReport = await fetchLatestTheoretical();
      } catch (err) {
        // 404 or other error - fallback to latest report
        if (err.status !== 404) {
          console.warn(
            "[useTheoryData] fetchLatestTheoretical error:",
            err.message,
          );
        }
      }

      // Fallback: fetch the latest report directly
      if (!latestReport) {
        const reports = await fetchReports(1);
        if (reports && reports.length > 0) {
          latestReport = reports[0];
        }
      }

      if (!latestReport) {
        error.value = "無報告數據";
        return;
      }

      const theoreticalShadow = latestReport.theoreticalShadow;

      // Store the full theoretical data
      data.value = {
        date: latestReport.date,
        theoreticalShadow: theoreticalShadow || null,
        portfolioSnapshot: latestReport.portfolioSnapshot || null,
        isFromLastTradingDay: theoreticalShadow?.isFromLastTradingDay || false,
        lastTradingDay: theoreticalShadow?.lastTradingDay || null,
      };
    } catch (err) {
      console.error("[useTheoryData] fetch error:", err);
      error.value = err.message || "載入失敗";
    } finally {
      loading.value = false;
    }
  }

  /**
   * Check if theoretical data is empty (no report or no theoreticalShadow)
   */
  const isEmpty = computed(() => {
    return !data.value || !data.value.theoreticalShadow;
  });

  /**
   * Check if theoretical data is available and status is AVAILABLE
   */
  const isAvailable = computed(() => {
    return data.value?.theoreticalShadow?.status === "AVAILABLE";
  });

  /**
   * Get theory data (null if not available)
   */
  const theory = computed(() => {
    if (!isAvailable.value) return null;
    return data.value.theoreticalShadow.theory;
  });

  /**
   * Get inputs data (null if not available)
   */
  const inputs = computed(() => {
    if (!isAvailable.value) return null;
    return data.value.theoreticalShadow.inputs;
  });

  /**
   * Get portfolio snapshot (null if not available)
   */
  const portfolioSnapshot = computed(() => {
    return data.value?.portfolioSnapshot || null;
  });

  /**
   * Get report date
   */
  const reportDate = computed(() => {
    return data.value?.date || null;
  });

  /** Check if theory data comes from last trading day (non-trading day fallback) */
  const isFromLastTradingDay = computed(() => {
    return data.value?.isFromLastTradingDay === true;
  });

  /** Get the last trading day date (when isFromLastTradingDay is true) */
  const lastTradingDay = computed(() => {
    return data.value?.lastTradingDay || null;
  });

  return {
    // State
    data,
    loading,
    error,

    // Actions
    fetch,

    // Computed
    isEmpty,
    isAvailable,
    theory,
    inputs,
    portfolioSnapshot,
    reportDate,
    isFromLastTradingDay,
    lastTradingDay,
  };
}
