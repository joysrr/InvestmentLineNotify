import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiFetch } from "../api/index.js";

export const useStrategyStore = defineStore("strategy", () => {
  // State
  const config = ref({});
  const meta = ref({});
  const validationErrors = ref([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref(null);
  const hasChanges = ref(false);

  // Getters
  const isValid = computed(() => validationErrors.value.length === 0);
  const configKeys = computed(() => Object.keys(config.value || {}));

  // Actions
  async function fetchConfig() {
    loading.value = true;
    error.value = null;
    try {
      const [configData, metaData] = await Promise.all([
        apiFetch("/api/strategy-config"),
        apiFetch("/api/strategy-config/meta"),
      ]);
      config.value = configData;
      meta.value = metaData;
      hasChanges.value = false;
      return { config: configData, meta: metaData };
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function saveConfig(newConfig) {
    saving.value = true;
    error.value = null;
    try {
      const data = await apiFetch("/api/strategy-config", {
        method: "POST",
        body: JSON.stringify(newConfig),
      });
      config.value = data;
      hasChanges.value = false;
      return data;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      saving.value = false;
    }
  }

  function setValidationErrors(errors) {
    validationErrors.value = errors;
  }

  function markChanged() {
    hasChanges.value = true;
  }

  function resetChanges() {
    hasChanges.value = false;
  }

  function clearError() {
    error.value = null;
  }

  return {
    config,
    meta,
    validationErrors,
    loading,
    saving,
    error,
    hasChanges,
    isValid,
    configKeys,
    fetchConfig,
    saveConfig,
    setValidationErrors,
    markChanged,
    resetChanges,
    clearError,
  };
});