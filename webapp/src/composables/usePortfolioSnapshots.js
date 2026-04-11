import { ref, computed } from 'vue'
import { fetchSnapshots } from '../api/index.js'

/**
 * 共用帳戶快照狀態層
 * - snapshots      : 歷史快照陣列（由新到舊），供圖表使用
 * - latestSnapshot : 最新一筆，供 AccountView 顯示
 * - hasEncryption  : 後端是否已設定加密金鑰
 * - loading        : 載入中
 * - error          : 錯誤訊息（null 表示正常）
 * - load()         : 手動重新載入
 */
export function usePortfolioSnapshots(limit = 30) {
  const snapshots      = ref([])
  const hasEncryption  = ref(false)
  const loading        = ref(false)
  const error          = ref(null)

  const latestSnapshot = computed(() => snapshots.value[0] ?? null)

  async function load() {
    loading.value = true
    error.value   = null
    try {
      const res          = await fetchSnapshots(limit)
      snapshots.value    = res.snapshots     ?? []
      hasEncryption.value = res.hasEncryption ?? false
    } catch (e) {
      error.value = '無法載入帳戶快照，請稍後再試'
    } finally {
      loading.value = false
    }
  }

  return { snapshots, latestSnapshot, hasEncryption, loading, error, load }
}
