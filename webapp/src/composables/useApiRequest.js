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
 * @param {boolean} options.dedup - 相同參數的並行請求是否共用（預設 false）
 * @param {number} options.retry - 失敗重試次數（預設 0）
 * @param {number} options.retryDelay - 重試間隔毫秒數（預設 300）
 * @param {boolean} options.abort - 是否啟用 AbortController（預設 false）
 * @returns {Object} { loading, error, data, execute, cancel, reset }
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
    dedup = false,
    retry = 0,
    retryDelay = 300,
    abort = false,
  } = options;

  const loading = ref(false);
  const pendingRequests = new Map();
  let activeController = null;
  const error = ref(null);
  const data = ref(null);

  const execute = async (...args) => {
    const requestKey = dedup ? JSON.stringify(args) : null;
    if (requestKey && pendingRequests.has(requestKey)) {
      return pendingRequests.get(requestKey);
    }

    loading.value = true;
    error.value = null;
    const controller = abort ? new AbortController() : null;
    if (controller) {
      activeController = controller;
    }

    const request = (async () => {
      try {
        let result;
        for (let attempt = 0; attempt <= retry; attempt += 1) {
          try {
            result = controller
              ? await apiFunc(...args, { signal: controller.signal })
              : await apiFunc(...args);
            break;
          } catch (err) {
            if (attempt === retry) {
              throw err;
            }
            if (retryDelay > 0) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
          }
        }
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
          const message =
            err.response?.data?.message || err.message || errorMessage;
          ElMessage.error(message);
        }

        if (onError) {
          onError(err);
        }

        throw err;
      } finally {
        loading.value = false;
        if (controller && activeController === controller) {
          activeController = null;
        }
        if (requestKey) {
          pendingRequests.delete(requestKey);
        }
      }
    })();

    if (requestKey) {
      pendingRequests.set(requestKey, request);
    }

    return request;
  };

  const cancel = () => {
    activeController?.abort();
  };

  const reset = () => {
    cancel();
    loading.value = false;
    error.value = null;
    data.value = null;
  };

  return {
    loading,
    error,
    data,
    execute,
    cancel,
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
        apiFuncs.map((fn) => fn(...args)),
      );

      dataList.value = results.map((r) =>
        r.status === "fulfilled" ? r.value : null,
      );
      errors.value = results.map((r) =>
        r.status === "rejected" ? r.reason : null,
      );

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
