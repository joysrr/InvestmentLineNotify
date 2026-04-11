const BASE = import.meta.env.VITE_API_BASE || ''

async function apiFetch(path, maxRetries = 3, retryDelay = 800) {
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const initData =
      window.Telegram?.WebApp?.initData ||
      (import.meta.env.DEV ? 'dev-bypass' : '')

    if (!initData && attempt < maxRetries) {
      await delay(retryDelay)
      continue
    }

    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'X-Telegram-Init-Data': initData }
      })

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

export const fetchReports        = (limit = 30)  => apiFetch(`/api/reports?limit=${limit}`)
export const fetchWeeklyReports  = (limit = 12)  => apiFetch(`/api/reports/weekly?limit=${limit}`)
export const fetchMonthlyReports = (limit = 12)  => apiFetch(`/api/reports/monthly?limit=${limit}`)
export const fetchNews           = ()             => apiFetch('/api/news')
export const fetchStatus         = ()             => apiFetch('/api/status')
export const fetchReportNews     = ()             => apiFetch('/api/report/news')
export const fetchSnapshots      = (limit = 30)  => apiFetch(`/api/reports/snapshots?limit=${limit}`)
