import { ref, computed } from "vue";

/**
 * 頁面狀態機：loading / error / empty / ready 四態
 *
 * 優先級：loading > error > empty > ready
 *
 * @returns {Object} { loading, error, data, state, run }
 *   loading {Ref<boolean>} 是否正在載入
 *   error {Ref<Error|null>} 錯誤物件
 *   data {Ref<any>} 資料
 *   state {Ref<'loading'|'error'|'empty'|'ready'>} 衍生狀態
 *   run {Function} 執行非同步 fetcher，自動管理四態
 */
export function usePageState() {
  const loading = ref(false);
  const error = ref(null);
  const data = ref(null);

  const state = computed(() => {
    if (loading.value) return "loading";
    if (error.value) return "error";
    if (!data.value || (Array.isArray(data.value) && data.value.length === 0))
      return "empty";
    return "ready";
  });

  async function run(fetcher) {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fetcher();
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, data, state, run };
}
