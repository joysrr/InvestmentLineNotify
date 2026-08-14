import { ref } from "vue";
import { ElMessage } from "element-plus";

/**
 * 統一的 API 請求 composable
 * 提供 loading/error/data 狀態管理與錯誤處理
 *
 * @param {Function} apiFunc - API 請求函數
 * @param {Object} options - 選項
 * @param {boolean} options.showSuccessMessage - 成功時是否顯示 toast（預設 false）
 * @param {boolean} options.showErrorMessage - 失敗時是否顯示 toast（預設 true）
 * @param {string} options.successMessage - 自訂成功訊息
 * @param {string} options.errorMessage - 自訂錯誤訊息
 * @param {Function} options.onSuccess - 成功回調
 * @param {Function} options.onError - 錯誤回調
 * @returns {Object} { loading, error, data, execute, reset }
 *
 * @example
 * import { useApiRequest } from '@/composables/useApiRequest';
 * import { fetchReports } from '@/api';
 *
 * const { loading, error, data, execute } = useApiRequest(fetchReports);
 *
 * // 執行請求
 * await execute();
 *
 * // 帶參數執行
 * await execute({ startDate: '2026-08-01', endDate: '2026-08-14' });
 */
export function useApiRequest(apiFunc, options = {}) {
  const {
    showSuccessMessage = false,
    showErrorMessage = true,
    successMessage = "操作成功",
    errorMessage = "操作失敗",
    onSuccess = null,
    onError = null,
  } = options;

  const loading = ref(false);
  const error = ref(null);
  const data = ref(null);

  const execute = async (...args) => {
    loading.value = true;
    error.value = null;

    try {
      const result = await apiFunc(...args);
      data.value = result;

      if (showSuccessMessage) {
        ElMessage.success(successMessage);
      }

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (err) {
      error.value = err;

      if (showErrorMessage) {
        const message = err.response?.data?.message || err.message || errorMessage;
        ElMessage.error(message);
      }

      if (onError) {
        onError(err);
      }

      throw err;
    } finally {
      loading.value = false;
    }
  };

  const reset = () => {
    loading.value = false;
    error.value = null;
    data.value = null;
  };

  return {
    loading,
    error,
    data,
    execute,
    reset,
  };
}

/**
 * 用於多個並行請求的 composable
 *
 * @param {Array<Function>} apiFuncs - API 請求函數陣列
 * @returns {Object} { loading, errors, dataList, executeAll, reset }
 *
 * @example
 * const { loading, dataList, executeAll } = useApiRequestBatch([
 *   fetchReports,
 *   fetchMarketData,
 *   fetchPortfolio,
 * ]);
 *
 * await executeAll();
 * const [reports, market, portfolio] = dataList.value;
 */
export function useApiRequestBatch(apiFuncs) {
  const loading = ref(false);
  const errors = ref([]);
  const dataList = ref([]);

  const executeAll = async (...args) => {
    loading.value = true;
    errors.value = [];
    dataList.value = [];

    try {
      const results = await Promise.allSettled(
        apiFuncs.map((fn) => fn(...args))
      );

      dataList.value = results.map((r) => (r.status === "fulfilled" ? r.value : null));
      errors.value = results.map((r) => (r.status === "rejected" ? r.reason : null));

      const failedCount = errors.value.filter((e) => e !== null).length;
      if (failedCount > 0) {
        ElMessage.warning(`${failedCount} 個請求失敗`);
      }

      return dataList.value;
    } catch (err) {
      ElMessage.error("批次請求失敗");
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const reset = () => {
    loading.value = false;
    errors.value = [];
    dataList.value = [];
  };

  return {
    loading,
    errors,
    dataList,
    executeAll,
    reset,
  };
}
