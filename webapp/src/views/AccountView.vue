<template>
  <div class="account-view">
    <!-- ── Header ── -->
    <div class="page-header">
      <h1 class="page-title">帳戶概況</h1>
      <p class="page-subtitle">帳戶快照 ＆ 系統狀態</p>
    </div>

    <!-- ── Skeleton ── -->
    <template v-if="loading">
      <div class="section">
        <div class="sk sk-title"></div>
        <div class="account-snapshot-grid">
          <div v-for="n in 5" :key="n" class="sk sk-snap-card"></div>
        </div>
      </div>
      <div class="section">
        <div class="sk sk-title"></div>
        <div class="sk sk-row"></div>
        <div class="sk sk-row"></div>
      </div>
    </template>

    <!-- ── Error ── -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button class="retry-btn" @click="load">重試</button>
    </div>

    <!-- ── Content ── -->
    <template v-else>

      <!-- 1. 帳戶快照 -->
      <div class="section">
        <h2 class="section-title">💼 帳戶快照</h2>

        <div v-if="!accountData" class="inline-hint">📭 尚無帳戶資料（請確認報告格式包含 result 欄位）</div>
        <template v-else>
          <!-- 淨値 + 未實現損益 -->
          <div class="account-main-row">
            <div class="account-main-card">
              <span class="acct-label">帳戶淨値</span>
              <span class="acct-big-value">{{ fmtNtd(accountData.net_value) }}</span>
              <span class="acct-sub">NTD</span>
            </div>
            <div class="account-main-card" :class="pnlClass">
              <span class="acct-label">未實現損益</span>
              <span class="acct-big-value">{{ fmtPnl(accountData.unrealized_pnl) }}</span>
              <span class="acct-sub">{{ pnlPct }}</span>
            </div>
          </div>

          <!-- 其他指標 -->
          <div class="account-metrics-grid">
            <div class="metric-card" :class="leverageClass">
              <span class="metric-label">槽桿倍數</span>
              <span class="metric-value">{{ fmtX(accountData.leverage_ratio ?? accountData.leverage) }}</span>
              <span class="metric-sub" :class="leverageClass">{{ leverageLabel }}</span>
            </div>
            <div class="metric-card" :class="marginClass">
              <span class="metric-label">維持率</span>
              <span class="metric-value">{{ fmtPct(accountData.maintenance_margin_rate) }}</span>
              <span class="metric-sub" :class="marginClass">{{ marginLabel }}</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">00675L 佔比</span>
              <span class="metric-value">{{ fmtPct(accountData.etf_weight ?? accountData.etf_ratio) }}</span>
              <span class="metric-sub metric-sub--neutral">環瀕台傳</span>
            </div>
            <div class="metric-card">
              <span class="metric-label">現金儲備</span>
              <span class="metric-value">{{ fmtNtd(accountData.cash_reserve) }}</span>
              <span class="metric-sub metric-sub--neutral">NTD</span>
            </div>
            <div class="metric-card" v-if="accountData.total_cost != null">
              <span class="metric-label">總成本</span>
              <span class="metric-value">{{ fmtNtd(accountData.total_cost) }}</span>
              <span class="metric-sub metric-sub--neutral">NTD</span>
            </div>
          </div>

          <!-- 持仓明細 -->
          <div v-if="positions.length" class="position-table">
            <div class="pos-header">
              <span>標的</span>
              <span>平均成本</span>
              <span>現價</span>
              <span>損益</span>
            </div>
            <div v-for="pos in positions" :key="pos.symbol" class="pos-row">
              <span class="pos-sym">{{ pos.symbol }}</span>
              <span class="pos-cost">{{ fmtPriceLite(pos.avg_cost ?? pos.avgCost) }}</span>
              <span class="pos-price">{{ fmtPriceLite(pos.current_price ?? pos.price) }}</span>
              <span class="pos-pnl" :class="pos.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'">
                {{ pos.pnl >= 0 ? '+' : '' }}{{ fmtPct(pos.pnl_pct ?? pos.pnlPct) }}
              </span>
            </div>
          </div>
        </template>

        <div class="section-footer" v-if="reportDate">
          <span>資料日期：{{ reportDate }}</span>
        </div>
      </div>

      <!-- 2. 系統狀態 -->
      <div class="section" v-if="status">
        <h2 class="section-title">🕐 系統狀態</h2>
        <div class="info-row">
          <span class="info-label">資料最後更新</span>
          <span class="info-value">{{ lastRunLabel }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">來源健康度</span>
          <span class="info-value" :class="allHealthy ? 'text-ok' : 'text-warn'">
            {{ healthyCount }}/{{ sourceCount }} 正常
          </span>
        </div>
      </div>

      <!-- 3. 資料來源 -->
      <div class="section" v-if="status">
        <h2 class="section-title">📡 資料來源</h2>
        <div class="source-grid">
          <div
            v-for="(info, key) in sourcesDisplay"
            :key="key"
            class="source-card"
            :class="info.ok ? 'source-ok' : 'source-fail'"
          >
            <div class="source-header">
              <span class="source-name">{{ info.label }}</span>
              <span class="source-badge" :class="info.ok ? 'badge-ok' : 'badge-fail'">
                {{ info.ok ? 'OK' : 'FAIL' }}
              </span>
            </div>
            <div class="source-time">{{ info.lastFetch }}</div>
            <div v-if="!info.ok && info.error" class="source-error">{{ info.error }}</div>
          </div>
        </div>
      </div>

      <!-- 4. 總經快照 -->
      <div class="section" v-if="status">
        <h2 class="section-title">🌐 總經快照</h2>
        <div class="macro-grid">
          <div class="macro-card">
            <div class="macro-label">CNN 恐懼貢婪</div>
            <div class="macro-value" :class="fngClass">{{ fngValue }}</div>
            <div class="macro-sub">{{ fngRating }}</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">USD / TWD</div>
            <div class="macro-value">{{ fxValue }}</div>
            <div class="macro-sub" :class="fxChangeClass">{{ fxChangeSub }}</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">大盤 P/B</div>
            <div class="macro-value">{{ pbValue }}</div>
            <div class="macro-sub">淨値比</div>
          </div>
          <div class="macro-card">
            <div class="macro-label">大盤 P/E</div>
            <div class="macro-value">{{ peValue }}</div>
            <div class="macro-sub">本益比</div>
          </div>
        </div>
      </div>

      <!-- 5. 關於 -->
      <div class="section">
        <h2 class="section-title">ℹ️ 關於</h2>
        <div class="about-block">
          <div class="about-name">📊 投資通知 Mini App</div>
          <div class="about-version">v1.0.0</div>
          <ul class="about-features">
            <li>每日市場戰報與 AI 決策建議</li>
            <li>技術指標即時監控（RSI / KD / 乖離率）</li>
            <li>週報 / 月報彙整與訊號回顧</li>
            <li>總經新跡即時篩選</li>
            <li>與 Telegram Bot 深度整合</li>
          </ul>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchStatus, fetchReports } from '../api/index.js'

const status  = ref(null)
const latestReport = ref(null)
const loading = ref(true)
const error   = ref(null)

async function load() {
  loading.value = true
  error.value   = null
  try {
    const [sRes, rRes] = await Promise.allSettled([
      fetchStatus(),
      fetchReports(3),
    ])
    if (sRes.status === 'fulfilled') status.value = sRes.value
    if (rRes.status === 'fulfilled') {
      const sorted = [...(rRes.value ?? [])].sort((a, b) => b.date.localeCompare(a.date))
      latestReport.value = sorted[0] ?? null
    }
  } catch (e) {
    error.value = '無法載入資料，請稍後再試'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ── 帳戶快照：失淊 ── result 或 accountSnapshot 物件
const accountData = computed(() => {
  const r = latestReport.value
  if (!r) return null
  return r.result ?? r.accountSnapshot ?? r.account ?? null
})
const reportDate = computed(() => latestReport.value?.date ?? null)

// 持仓列表
const positions = computed(() => {
  const pos = accountData.value?.positions ?? accountData.value?.holdings ?? []
  return Array.isArray(pos) ? pos : []
})

// 構行指標
const leverageVal = computed(() => Number(accountData.value?.leverage_ratio ?? accountData.value?.leverage))
const leverageClass = computed(() => {
  const v = leverageVal.value
  if (isNaN(v)) return ''
  if (v >= 2.0) return 'metric-danger'
  if (v >= 1.5) return 'metric-warn'
  return 'metric-ok'
})
const leverageLabel = computed(() => {
  const v = leverageVal.value
  if (isNaN(v)) return ''
  if (v >= 2.0) return '超高風險'
  if (v >= 1.5) return '注意風險'
  return '正常'
})

// 維持率
const marginVal = computed(() => Number(accountData.value?.maintenance_margin_rate))
const marginClass = computed(() => {
  const v = marginVal.value
  if (isNaN(v)) return ''
  if (v < 130) return 'metric-danger'
  if (v < 160) return 'metric-warn'
  return 'metric-ok'
})
const marginLabel = computed(() => {
  const v = marginVal.value
  if (isNaN(v)) return ''
  if (v < 130) return '風險高'
  if (v < 160) return '請注意'
  return '安全'
})

// 未實現損益
const pnlVal = computed(() => Number(accountData.value?.unrealized_pnl))
const pnlClass = computed(() => {
  if (isNaN(pnlVal.value)) return ''
  return pnlVal.value >= 0 ? 'metric-ok-bg' : 'metric-danger-bg'
})
const pnlPct = computed(() => {
  const pct = Number(accountData.value?.unrealized_pnl_pct ?? accountData.value?.pnl_pct)
  if (isNaN(pct)) return ''
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
})

// ── Formatters ──
function fmtNtd(v) {
  const n = Number(v)
  if (isNaN(n) || v == null) return 'N/A'
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtX(v) {
  const n = Number(v)
  return isNaN(n) || v == null ? 'N/A' : `${n.toFixed(2)}x`
}
function fmtPct(v) {
  const n = Number(v)
  return isNaN(n) || v == null ? 'N/A' : `${n.toFixed(1)}%`
}
function fmtPnl(v) {
  const n = Number(v)
  if (isNaN(n) || v == null) return 'N/A'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtPriceLite(v) {
  const n = Number(v)
  return isNaN(n) || v == null ? '--' : n.toFixed(2)
}

// ── 系統狀態 ──
const lastRunLabel = computed(() => {
  const ts = status.value?._meta?.lastRun
  if (!ts) return 'N/A'
  return new Date(ts).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
})

const SOURCE_LABELS = {
  ndcProvider:       '國發會景氣燈號',
  kgiProvider:       '台股融資餘額',
  cnnProvider:       'CNN 恐懼貢婪',
  usMarketProvider:  '美股 FRED',
  valuationProvider: '大盤 PB/PE',
  yahooProvider:     'USD/TWD 匯率',
}

const sourcesDisplay = computed(() => {
  const raw = status.value?._meta?.sources || {}
  const result = {}
  for (const [key, label] of Object.entries(SOURCE_LABELS)) {
    const src = raw[key] || {}
    const ok  = src.status === 'SUCCESS'
    const ts  = src.lastFetch
    result[key] = {
      label,
      ok,
      error: src.error || null,
      lastFetch: ts
        ? new Date(ts).toLocaleString('zh-TW', {
            timeZone: 'Asia/Taipei',
            month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          })
        : '尚無資料',
    }
  }
  return result
})

const sourceCount  = computed(() => Object.keys(sourcesDisplay.value).length)
const healthyCount = computed(() => Object.values(sourcesDisplay.value).filter(s => s.ok).length)
const allHealthy   = computed(() => healthyCount.value === sourceCount.value)

// ── CNN F&G ──
const fngRaw = computed(() => {
  const d = status.value?.data?.rawCnn
  return d?.score ?? d?.value ?? null
})
const fngValue  = computed(() => fngRaw.value != null ? String(fngRaw.value) : 'N/A')
const fngRating = computed(() => status.value?.data?.rawCnn?.rating ?? status.value?.data?.rawCnn?.classification ?? '')
const fngClass  = computed(() => {
  const v = fngRaw.value
  if (v == null) return ''
  if (v <= 25) return 'text-danger'
  if (v <= 45) return 'text-warn'
  if (v >= 75) return 'text-ok'
  return ''
})

// ── FX ──
const fxValue = computed(() => {
  const v = status.value?.data?.rawFx?.currentRate ?? null
  return v != null ? Number(v).toFixed(3) : 'N/A'
})
const fxChangeSub = computed(() => {
  const chg = status.value?.data?.rawFx?.changePercent ?? null
  if (chg == null) return '匯率'
  return `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`
})
const fxChangeClass = computed(() => {
  const chg = status.value?.data?.rawFx?.changePercent ?? null
  if (chg == null) return ''
  if (chg > 0.2)  return 'text-warn'
  if (chg < -0.2) return 'text-ok'
  return ''
})

// ── PB / PE ──
const pbValue = computed(() => {
  const d = status.value?.data?.rawValuation
  const v = d?.pb ?? d?.priceToBook ?? null
  return v != null ? Number(v).toFixed(2) : 'N/A'
})
const peValue = computed(() => {
  const d = status.value?.data?.rawValuation
  const v = d?.pe ?? d?.priceToEarnings ?? null
  return v != null ? Number(v).toFixed(2) : 'N/A'
})
</script>

<style scoped>
.account-view {
  padding: 0 0 32px;
  min-height: 100%;
  background: var(--tg-theme-bg-color, #f5f5f5);
}

/* ── Header ── */
.page-header {
  padding: 20px 16px 12px;
  background: var(--tg-theme-bg-color, #fff);
  border-bottom: 1px solid rgba(0,0,0,0.06);
  margin-bottom: 12px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--tg-theme-text-color, #111);
}
.page-subtitle {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
  margin: 0;
}

/* ── Section ── */
.section {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  margin: 0 12px 12px;
  padding: 14px 14px 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #777);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.section-footer {
  margin-top: 10px;
  font-size: 11px;
  color: var(--tg-theme-hint-color, #aaa);
  text-align: right;
}

/* ── 帳戶快照 ── */
.account-main-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}
.account-main-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 3px;
}
.acct-label     { font-size: 10px; color: var(--tg-theme-hint-color, #999); }
.acct-big-value { font-size: 20px; font-weight: 700; color: var(--tg-theme-text-color, #111); line-height: 1.2; }
.acct-sub       { font-size: 10px; color: var(--tg-theme-hint-color, #aaa); }

.account-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}
.metric-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 10px;
  padding: 9px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 3px;
}
.metric-label   { font-size: 10px; color: var(--tg-theme-hint-color, #999); white-space: nowrap; }
.metric-value   { font-size: 16px; font-weight: 700; color: var(--tg-theme-text-color, #111); line-height: 1.2; }
.metric-sub     { font-size: 10px; font-weight: 500; }
.metric-sub--neutral { color: var(--tg-theme-hint-color, #aaa); }
.metric-ok      { background: rgba(38, 161, 123, 0.10); }
.metric-ok-bg   { background: rgba(38, 161, 123, 0.10); }
.metric-warn    { background: rgba(212, 172, 13, 0.10); }
.metric-danger  { background: rgba(232, 72, 85, 0.10); }
.metric-danger-bg { background: rgba(232, 72, 85, 0.08); }
.metric-ok .metric-sub,
.metric-ok-bg .acct-big-value { color: #26a17b; }
.metric-warn .metric-sub      { color: #a07a00; }
.metric-danger .metric-sub    { color: #e84855; }

/* 持仓表 */
.position-table {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.07);
}
.pos-header {
  display: grid;
  grid-template-columns: 60px 1fr 1fr 60px;
  padding: 6px 10px;
  background: var(--tg-theme-secondary-bg-color, #f0f0f0);
  font-size: 11px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
  text-align: right;
}
.pos-header span:first-child { text-align: left; }
.pos-row {
  display: grid;
  grid-template-columns: 60px 1fr 1fr 60px;
  padding: 8px 10px;
  font-size: 13px;
  border-top: 1px solid rgba(0,0,0,0.05);
  align-items: center;
  text-align: right;
}
.pos-sym   { text-align: left; font-weight: 600; color: var(--tg-theme-text-color, #222); font-size: 12px; }
.pos-cost  { color: var(--tg-theme-hint-color, #666); font-size: 12px; }
.pos-price { font-weight: 600; color: var(--tg-theme-text-color, #111); font-size: 12px; }
.pos-pnl   { font-weight: 700; font-size: 12px; }
.pnl-pos   { color: #26a17b; }
.pnl-neg   { color: #e84855; }

/* ── Info rows ── */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  font-size: 14px;
}
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--tg-theme-hint-color, #888); }
.info-value { font-weight: 600; color: var(--tg-theme-text-color, #111); }

/* ── Source grid ── */
.source-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.source-card { border-radius: 8px; padding: 9px 10px; border: 1px solid transparent; }
.source-ok   { background: rgba(52,199,89,0.08);  border-color: rgba(52,199,89,0.2); }
.source-fail { background: rgba(255,59,48,0.08);  border-color: rgba(255,59,48,0.2); }
.source-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.source-name  { font-size: 12px; font-weight: 600; color: var(--tg-theme-text-color, #111); }
.source-badge { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; letter-spacing: 0.3px; }
.badge-ok   { background: rgba(52,199,89,0.18);  color: #1a7a3a; }
.badge-fail { background: rgba(255,59,48,0.18);  color: #c0392b; }
.source-time  { font-size: 10px; color: var(--tg-theme-hint-color, #aaa); }
.source-error { font-size: 10px; color: #c0392b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Macro ── */
.macro-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.macro-card { background: var(--tg-theme-secondary-bg-color, #f5f5f5); border-radius: 8px; padding: 10px 10px 8px; text-align: center; }
.macro-label { font-size: 11px; color: var(--tg-theme-hint-color, #888); margin-bottom: 4px; }
.macro-value { font-size: 22px; font-weight: 700; color: var(--tg-theme-text-color, #111); line-height: 1; }
.macro-sub   { font-size: 10px; color: var(--tg-theme-hint-color, #aaa); margin-top: 3px; }

/* ── About ── */
.about-block { text-align: center; padding: 4px 0 6px; }
.about-name    { font-size: 16px; font-weight: 700; margin-bottom: 2px; color: var(--tg-theme-text-color, #111); }
.about-version { font-size: 12px; color: var(--tg-theme-hint-color, #999); margin-bottom: 12px; }
.about-features { list-style: none; margin: 0; padding: 0; text-align: left; display: inline-block; }
.about-features li { font-size: 13px; color: var(--tg-theme-text-color, #333); padding: 4px 0 4px 18px; position: relative; }
.about-features li::before { content: '✓'; position: absolute; left: 0; color: var(--tg-theme-button-color, #2481cc); font-weight: 700; }

/* ── Color helpers ── */
.text-ok     { color: #1a7a3a !important; }
.text-warn   { color: #b8860b !important; }
.text-danger { color: #c0392b !important; }
.inline-hint { font-size: 13px; color: var(--tg-theme-hint-color, #999); padding: 8px 0; }

/* ── Skeleton ── */
.sk { background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 6px; }
.sk-title    { height: 14px; width: 40%; margin-bottom: 12px; }
.sk-row      { height: 38px; margin-bottom: 6px; border-radius: 8px; }
.sk-snap-card { height: 72px; border-radius: 10px; }
.account-snapshot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
@keyframes shimmer { to { background-position: -200% 0; } }

/* ── Error ── */
.error-state { display: flex; flex-direction: column; align-items: center; padding: 40px 16px; gap: 10px; color: var(--tg-theme-hint-color, #888); font-size: 14px; }
.error-icon { font-size: 32px; }
.retry-btn { margin-top: 6px; padding: 8px 20px; border-radius: 20px; border: none; background: var(--tg-theme-button-color, #2481cc); color: var(--tg-theme-button-text-color, #fff); font-size: 14px; cursor: pointer; }
</style>
