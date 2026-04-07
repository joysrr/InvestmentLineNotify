const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

async function apiFetch(path) {
  const initData = window.Telegram?.WebApp?.initData || ''
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Telegram-Init-Data': initData }
  })
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

export const fetchReports = (limit = 30) => apiFetch(`/api/reports?limit=${limit}`)
export const fetchNews = () => apiFetch('/api/news')
export const fetchStatus = () => apiFetch('/api/status')
