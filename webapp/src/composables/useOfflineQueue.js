import { ref, computed } from "vue";

/**
 * 離線請求佇列。
 *
 * 當裝置離線時，將 API 請求放入佇列；回線後依序重播（flush）。
 * 每筆項目為 { key, fn, resolve, reject }，fn 為實際發出請求的非同步函式。
 */
export function useOfflineQueue() {
  const queue = ref([]);

  const pendingCount = computed(() => queue.value.length);

  /**
   * 將請求放入佇列，回傳一個 Promise，於 flush 時解析或拒絕。
   * @param {Object} item
   * @param {string} [item.key] 請求鍵，用於去重或除錯
   * @param {() => Promise<any>} item.fn 實際執行請求的函式
   * @returns {Promise<any>}
   */
  const enqueue = ({ key, fn }) => {
    return new Promise((resolve, reject) => {
      queue.value.push({ key, fn, resolve, reject });
    });
  };

  /**
   * 依序重播佇列中所有請求。回線時自動呼叫。
   * @returns {Promise<Array<{ok: boolean, value?: any, error?: any}>>}
   */
  const flush = async () => {
    const pending = [...queue.value];
    queue.value = [];

    const results = [];
    for (const item of pending) {
      try {
        const value = await item.fn();
        item.resolve?.(value);
        results.push({ ok: true, value });
      } catch (error) {
        item.reject?.(error);
        results.push({ ok: false, error });
      }
    }
    return results;
  };

  const clear = () => {
    queue.value = [];
  };

  return { queue, pendingCount, enqueue, flush, clear };
}
