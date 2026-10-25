/**
 * useTheoryData.js
 * Composable for fetching and managing theoretical analysis data
 * from the latest daily report.
 */

import { ref, computed } from "vue";
import { fetchReports } from "../api/index.js";

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
   */
  async function fetch() {
    loading.value = true;
    error.value = null;
    data.value = null;

    try {
      const reports = await fetchReports(1); // Fetch only the latest report

      if (!reports || reports.length === 0) {
        error.value = "無報告數據";
        return;
      }

      const latestReport = reports[0];
      const theoreticalShadow = latestReport.theoreticalShadow;

      // Store the full theoretical data
      data.value = {
        date: latestReport.date,
        theoreticalShadow: theoreticalShadow || null,
        portfolioSnapshot: latestReport.portfolioSnapshot || null,
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
  };
}
