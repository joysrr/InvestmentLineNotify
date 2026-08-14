import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiFetch } from "../api/index.js";

export const useMarketStore = defineStore("market", () => {
  // State
  const status = ref(null);
  const reports = ref([]);
  const news = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const lastUpdated = ref(null);

  // Getters
  const isHealthy = computed(() => {
    if (!status.value) return false;
    const sources = status.value.data?.sources || {};
    return Object.values(sources).every(s => s.status === "SUCCESS");
  });

  const latestReport = computed(() => reports.value[0] || null);
  const latestNews = computed(() => news.value.slice(0, 5));

  // Actions
  async function fetchStatus() {
    loading.value = true;
    error.value = null;
    try {
      const data = await apiFetch("/api/status");
      status.value = data;
      lastUpdated.value = new Date().toISOString();
      return data;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchReports(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const query = new URLSearchParams(params).toString();
      const path = `/api/reports${query ? `?${query}` : ""}`;
      const data = await apiFetch(path);
      reports.value = data.reports || data;
      return reports.value;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchNews(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const query = new URLSearchParams(params).toString();
      const path = `/api/news${query ? `?${query}` : ""}`;
      const data = await apiFetch(path);
      news.value = data.news || data;
      return news.value;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAll() {
    await Promise.all([fetchStatus(), fetchReports({ limit: 5 }), fetchNews({ limit: 10 })]);
  }

  function clearError() {
    error.value = null;
  }

  return {
    status,
    reports,
    news,
    loading,
    error,
    lastUpdated,
    isHealthy,
    latestReport,
    latestNews,
    fetchStatus,
    fetchReports,
    fetchNews,
    fetchAll,
    clearError,
  };
});