import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiFetch } from "../api/index.js";

export const usePortfolioStore = defineStore("portfolio", () => {
  // State
  const snapshots = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const lastUpdated = ref(null);

  // Getters
  const latestSnapshot = computed(() => snapshots.value[snapshots.value.length - 1] || null);
  const totalValue = computed(() => latestSnapshot.value?.totalValue || 0);
  const netValue = computed(() => latestSnapshot.value?.netValue || 0);
  const maintenanceMargin = computed(() => latestSnapshot.value?.maintenanceMargin || 0);

  // Actions
  async function fetchSnapshots(params = {}) {
    loading.value = true;
    error.value = null;
    
    try {
      const query = new URLSearchParams(params).toString();
      const path = `/api/reports/snapshots${query ? `?${query}` : ""}`;
      const data = await apiFetch(path);
      snapshots.value = data.snapshots || data;
      lastUpdated.value = new Date().toISOString();
      return snapshots.value;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchLatest() {
    return fetchSnapshots({ limit: 1 });
  }

  function clearError() {
    error.value = null;
  }

  return {
    snapshots,
    loading,
    error,
    lastUpdated,
    latestSnapshot,
    totalValue,
    netValue,
    maintenanceMargin,
    fetchSnapshots,
    fetchLatest,
    clearError,
  };
});