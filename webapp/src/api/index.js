const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

/**
 * apiFetch with automatic retry.
 * Retries up to `maxRetries` times when initData is still empty or the
 * server returns 401 (guard rejected the request because initData wasn't
 * ready yet on the first render).
 *
 * @param {string} path        - API path, e.g. '/api/status'
 * @param {number} maxRetries  - max retry attempts (default 3)
 * @param {number} retryDelay  - ms between retries (default 800)
 */
async function apiFetch(path, maxRetries = 3, retryDelay = 800) {
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const initData = window.Telegram?.WebApp?.initData || ''

    // If initData is still empty and we have retries left, wait and retry
    if (!initData && attempt < maxRetries) {
      await delay(retryDelay)
      continue
    }

    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'X-Telegram-Init-Data': initData }
      })

      // 401 means guard rejected — initData may have just become available,
      // so retry (but not on the last attempt)
      if (res.status === 401 && attempt < maxRetries) {
        await delay(retryDelay)
        continue
      }

      if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
      return res.json()
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) await delay(retryDelay)
    }
  }

  throw lastError ?? new Error(`API ${path} failed after ${maxRetries} retries`)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const fetchReports = (limit = 30) => apiFetch(`/api/reports?limit=${limit}`)
export const fetchNews    = ()           => apiFetch('/api/news')
export const fetchStatus  = ()           => apiFetch('/api/status')
