<template>
    <GlobalErrorBoundary>
    <div class="view-container">
    <!-- Header -->
    <div class="view-header">
      <h2 class="view-title">報告摘要</h2>
      <span class="view-subtitle">{{ subtitleText }}</span>
    </div>

    <!-- Tab Bar -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="currentState?.loading" class="state-box">
      <div class="spinner"></div>
      <p>載入中...</p>
    </div>

    <!-- Error -->
    <div v-else-if="currentState?.error" class="state-box state-error">
      <p>⚠️ {{ currentState.error }}</p>
      <button class="retry-btn" @click="load(activeTab)">重試</button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!currentState || currentState.items?.length === 0"
      class="state-box"
    >
      <p>📭 尚無資料</p>
    </div>

    <!-- Daily List -->
    <div v-else-if="activeTab === 'daily'" class="report-list">
      <div
        v-for="r in currentState.items"
        :key="r.date"
        class="report-card"
        @click="toggle(r.date)"
      >
        <div class="report-summary">
          <div class="report-meta">
            <span class="report-date">{{ r.date }}</span>
            <span class="report-status">{{ r.signals?.marketStatus }}</span>
          </div>
          <div class="report-suggestion">{{ r.signals?.targetSuggestion }}</div>
          <div class="report-badges">
            <span
              class="badge"
              :class="
                r.signals?.priceChangePercent >= 0 ? 'badge-pos' : 'badge-neg'
              "
            >
              {{ r.signals?.priceChangePercent >= 0 ? "+" : ""
              }}{{ r.signals?.priceChangePercentText }}%
            </span>
            <span class="badge badge-score">評分 {{ r.signals?.score }}</span>
            <span class="badge badge-expand">{{
              expanded[r.date] ? "▲" : "▼"
            }}</span>
          </div>
        </div>
        <!-- Expanded AI detail -->
        <div v-show="expanded[r.date]" class="report-detail" @click.stop>
          <div v-if="r.ai?.action_items?.length" class="detail-section">
            <h4 class="detail-title">✅ 行動建議</h4>
            <ul class="detail-list">
              <li v-for="(item, i) in r.ai.action_items" :key="i">
                {{ item }}
              </li>
            </ul>
          </div>
          <div v-if="r.ai?.risk_warnings?.length" class="detail-section">
            <h4 class="detail-title">⚠️ 風险警告</h4>
            <ul class="detail-list detail-list--warn">
              <li v-for="(item, i) in r.ai.risk_warnings" :key="i">
                {{ item }}
              </li>
            </ul>
          </div>
          <div v-if="r.ai?.mindset_advice?.length" class="detail-section">
            <h4 class="detail-title">🧘 心態建議</h4>
            <ul class="detail-list">
              <li v-for="(item, i) in r.ai.mindset_advice" :key="i">
                {{ item }}
              </li>
            </ul>
          </div>
          <details
            v-if="r.ai?.coach_internal_thinking"
            class="thinking-section"
          >
            <summary class="thinking-summary">🤖 AI 推理過程</summary>
            <p class="thinking-content">{{ r.ai.coach_internal_thinking }}</p>
          </details>
        </div>
      </div>
    </div>

    <!-- Weekly / Monthly List -->
    <div
      v-else-if="activeTab === 'weekly' || activeTab === 'monthly'"
      class="report-list"
    >
      <div
        v-for="p in currentState.items"
        :key="p.period"
        class="report-card"
        @click="toggle(p.period)"
      >
        <!-- Period header -->
        <div class="period-header">
          <span class="period-key">{{ formatPeriodLabel(p.period) }}</span>
          <span class="period-range">{{ p.startDate }} ~ {{ p.endDate }}</span>
          <span class="period-days">{{ p.tradingDays }} 交易日</span>
        </div>

        <!-- Last report snapshot -->
        <div class="report-meta" style="margin-top: 6px">
          <span class="report-status">{{
            p.lastReport?.signals?.marketStatus
          }}</span>
          <span
            class="badge"
            :class="
              p.lastReport?.signals?.priceChangePercent >= 0
                ? 'badge-pos'
                : 'badge-neg'
            "
            style="margin-left: auto"
          >
            {{ p.lastReport?.signals?.priceChangePercent >= 0 ? "+" : ""
            }}{{ p.lastReport?.signals?.priceChangePercentText }}%
          </span>
        </div>

        <!-- Cross-period stats -->
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-label">RSI 均</span>
            <span
              class="stat-value"
              :class="statClass(p.summary?.avgRSI, 70, 80)"
              >{{ fmt(p.summary?.avgRSI) }}</span
            >
          </div>
          <div class="stat-item">
            <span class="stat-label">KD 均</span>
            <span
              class="stat-value"
              :class="statClass(p.summary?.avgKD_K, 70, 85)"
              >{{ fmt(p.summary?.avgKD_K) }}</span
            >
          </div>
          <div class="stat-item">
            <span class="stat-label">乖離均</span>
            <span
              class="stat-value"
              :class="biasClass(p.summary?.avgBias240)"
              >{{ fmtPct(p.summary?.avgBias240) }}</span
            >
          </div>
          <div class="stat-item">
            <span class="stat-label">評分區間</span>
            <span class="stat-value">{{
              p.summary?.scoreRange
                ? `${p.summary.scoreRange.min}~${p.summary.scoreRange.max}`
                : "—"
            }}</span>
          </div>
        </div>

        <!-- Decision badges -->
        <div class="report-badges" style="margin-top: 8px">
          <span
            v-for="(d, i) in (p.summary?.decisions ?? []).slice(0, 3)"
            :key="i"
            class="badge badge-decision"
            >{{ d }}</span
          >
          <span class="badge badge-expand">{{
            expanded[p.period] ? "▲" : "▼"
          }}</span>
        </div>

        <!-- Expanded: last report AI detail -->
        <div v-show="expanded[p.period]" class="report-detail" @click.stop>
          <p class="period-snapshot-label">
            📅 最後一日 ({{ p.lastReport?.date }}) 完整數據
          </p>
          <div
            v-if="p.lastReport?.ai?.action_items?.length"
            class="detail-section"
          >
            <h4 class="detail-title">✅ 行動建議</h4>
            <ul class="detail-list">
              <li v-for="(item, i) in p.lastReport.ai.action_items" :key="i">
                {{ item }}
              </li>
            </ul>
          </div>
          <div
            v-if="p.lastReport?.ai?.risk_warnings?.length"
            class="detail-section"
          >
            <h4 class="detail-title">⚠️ 風险警告</h4>
            <ul class="detail-list detail-list--warn">
              <li v-for="(item, i) in p.lastReport.ai.risk_warnings" :key="i">
                {{ item }}
              </li>
            </ul>
          </div>
          <div v-if="p.lastReport?.signals?.suggestion" class="detail-section">
            <h4 class="detail-title">📊 策略詳情</h4>
            <p class="thinking-content">
              {{ p.lastReport.signals.suggestion }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Replay Evidence List -->
    <div v-else-if="activeTab === 'replay'" class="report-list">
      <div
        v-for="evidence in currentState.items"
        :key="evidence.replayDate"
        class="report-card"
        @click="toggle(evidence.replayDate)"
      >
        <div class="report-summary">
          <div class="report-meta">
            <span class="report-date">{{ evidence.replayDate }}</span>
            <span
              class="badge"
              :class="evidence.replayMatches ? 'badge-pos' : 'badge-neg'"
            >
              {{ evidence.replayMatches ? "✓ 一致" : "✗ 不一致" }}
            </span>
          </div>
          <div class="report-suggestion">
            來源: {{ evidence.fixtureSource }} | 資料截至: {{ evidence.dataAsOf }}
          </div>
          <div class="report-badges">
            <span class="badge">Strategy: {{ evidence.strategyHash?.substring(0, 8) || 'N/A' }}</span>
            <span class="badge">Data: {{ evidence.dataProvenance?.substring(0, 8) || 'N/A' }}</span>
            <span class="badge badge-expand">{{
              expanded[evidence.replayDate] ? "▲" : "▼"
            }}</span>
          </div>
        </div>
        <div v-show="expanded[evidence.replayDate]" class="report-detail" @click.stop>
          <pre class="detail-json">{{ JSON.stringify(evidence, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import {
  fetchReports,
  fetchWeeklyReports,
  fetchMonthlyReports,
  fetchReplayEvidence,
} from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import { waitReady } from "../composables/useTelegram.js";

const tabs = [
  { key: "daily", label: "日報" },
  { key: "weekly", label: "週報" },
  { key: "monthly", label: "月報" },
  { key: "replay", label: "Replay" },
];

const activeTab = ref("daily");
const expanded = reactive({});

// Each tab keeps its own state so switching back doesn't refetch
const state = reactive({
  daily: { loading: false, error: null, items: [], loaded: false },
  weekly: { loading: false, error: null, items: [], loaded: false },
  monthly: { loading: false, error: null, items: [], loaded: false },
  replay: { loading: false, error: null, items: [], loaded: false },
});

const currentState = computed(() => state[activeTab.value]);

const subtitleText = computed(() => {
  const s = currentState.value;
  if (!s || s.loading || s.error || !s.items.length) return "";
  const tab = activeTab.value;
  if (tab === "daily") return `近 ${s.items.length} 份`;
  if (tab === "weekly") return `近 ${s.items.length} 週`;
  if (tab === "monthly") return `近 ${s.items.length} 個月`;
  if (tab === "replay") return `${s.items.length} 筆驗證記錄`;
  return "";
});

async function load(tab) {
  const s = state[tab];
  s.loading = true;
  s.error = null;
  try {
    let data;
    if (tab === "daily") data = await fetchReports(30);
    else if (tab === "weekly") data = await fetchWeeklyReports(12);
    else if (tab === "monthly") data = await fetchMonthlyReports(12);
    else if (tab === "replay") data = await fetchReplayEvidence();

    if (tab === "daily") {
      s.items = [...data].sort((a, b) => b.date.localeCompare(a.date));
    } else if (tab === "replay") {
      // API returns { evidence: [...] }, extract the array
      s.items = [...(data.evidence || [])].sort((a, b) =>
        b.replayDate.localeCompare(a.replayDate),
      );
    } else {
      s.items = data; // already DESC from API
    }
    s.loaded = true;
  } catch (e) {
    s.error = e.message;
  } finally {
    s.loading = false;
  }
}

function switchTab(tab) {
  activeTab.value = tab;
  if (!state[tab].loaded) load(tab);
}

function toggle(key) {
  expanded[key] = !expanded[key];
}

// ── Helpers ──
function fmt(v) {
  return Number.isFinite(v) ? v.toFixed(1) : "—";
}
function fmtPct(v) {
  if (!Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function statClass(v, warnLevel, dangerLevel) {
  if (!Number.isFinite(v)) return "";
  if (v >= dangerLevel) return "val-danger";
  if (v >= warnLevel) return "val-warn";
  return "";
}
function biasClass(v) {
  if (!Number.isFinite(v)) return "";
  if (v >= 25) return "val-danger";
  if (v >= 15) return "val-warn";
  if (v < 0) return "val-buy";
  return "";
}
function formatPeriodLabel(period) {
  // '2026-W15' → '2026 第15週'  |  '2026-04' → '2026 年4月'
  const weekMatch = period.match(/^(\d{4})-W(\d{2})$/);
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (weekMatch) return `${weekMatch[1]} 第${parseInt(weekMatch[2])}週`;
  if (monthMatch) return `${monthMatch[1]} 年${parseInt(monthMatch[2])}月`;
  return period;
}

onMounted(async () => {
  await waitReady();
  load("daily");
});
</script>

<style scoped>
.view-container {
  padding: 16px;
  min-height: 100%;
}

.view-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}
.view-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.view-subtitle {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

/* ── Tab Bar ── */
.tab-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
  background: var(--tg-theme-secondary-bg-color, #f0f0f0);
  border-radius: 10px;
  padding: 4px;
}
.tab-btn {
  flex: 1;
  padding: 6px 0;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--tg-theme-hint-color, #888);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.tab-btn--active {
  background: var(--tg-theme-bg-color, #fff);
  color: var(--tg-theme-text-color, #222);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* ── Report list ── */
.report-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.report-card {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  user-select: none;
}

/* ── Daily ── */
.report-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.report-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.report-status {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}
.report-suggestion {
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  margin-bottom: 8px;
  line-height: 1.4;
}
.report-badges {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

/* ── Period (Weekly/Monthly) ── */
.period-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.period-key {
  font-size: 14px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #111);
}
.period-range {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}
.period-days {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-left: auto;
}

/* ── Cross-period stats row ── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 8px;
}
.stat-item {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 8px;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}
.stat-label {
  font-size: 9px;
  color: var(--tg-theme-hint-color, #aaa);
}
.stat-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
}
.val-danger {
  color: #e84855;
}
.val-warn {
  color: #d4ac0d;
}
.val-buy {
  color: #2481cc;
}

/* ── Badges ── */
.badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 20px;
  font-weight: 600;
}
.badge-pos {
  background: #e6f7f1;
  color: #26a17b;
}
.badge-neg {
  background: #fdecea;
  color: #e84855;
}
.badge-score {
  background: var(--tg-theme-hint-color, #eee);
  color: var(--tg-theme-text-color, #555);
  opacity: 0.7;
}
.badge-expand {
  background: transparent;
  color: var(--tg-theme-hint-color, #aaa);
  font-size: 10px;
  margin-left: auto;
}
.badge-decision {
  background: rgba(36, 129, 204, 0.1);
  color: var(--tg-theme-button-color, #2481cc);
  font-size: 10px;
  padding: 2px 6px;
}

/* ── Expanded detail ── */
.report-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--tg-theme-hint-color, #e0e0e0);
}
.period-snapshot-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-bottom: 8px;
}
.detail-section {
  margin-bottom: 10px;
}
.detail-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--tg-theme-hint-color, #888);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.detail-list {
  padding-left: 16px;
  font-size: 13px;
  color: var(--tg-theme-text-color, #444);
  line-height: 1.6;
}
.detail-list--warn li {
  color: #c0392b;
}
.thinking-section {
  margin-top: 8px;
}
.thinking-summary {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #aaa);
  cursor: pointer;
}
.thinking-content {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #aaa);
  margin-top: 6px;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* ── State boxes ── */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  color: var(--tg-theme-hint-color, #999);
  font-size: 14px;
}
.state-error {
  color: #e84855;
}
.retry-btn {
  padding: 8px 20px;
  background: var(--tg-theme-button-color, #2481cc);
  color: var(--tg-theme-button-text-color, #fff);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--tg-theme-hint-color, #ddd);
  border-top-color: var(--tg-theme-button-color, #2481cc);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Discipline Styles ── */
.discipline-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}
.discipline-intro-card {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}
.intro-badge {
  display: inline-block;
  font-size: 11px;
  background: rgba(36, 129, 204, 0.1);
  color: var(--tg-theme-button-color, #2481cc);
  padding: 3px 8px;
  border-radius: 20px;
  font-weight: 700;
  margin-bottom: 8px;
}
.intro-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 8px 0;
  line-height: 1.3;
}
.intro-desc {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #555);
  margin: 0;
  line-height: 1.5;
}

.card-section {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}
.section-sub-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #333);
  margin: 0 0 12px 0;
  border-left: 3px solid var(--tg-theme-button-color, #2481cc);
  padding-left: 8px;
}
.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--tg-theme-secondary-bg-color, #eee);
}

.insights-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.insight-card {
  background: var(--tg-theme-bg-color, #fff);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
}
.card-icon {
  font-size: 20px;
  margin-bottom: 6px;
}
.card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 8px 0;
}
.card-text {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #555);
  margin: 0;
  line-height: 1.5;
}

/* 深色模式修正 */
.dark .discipline-intro-card,
.dark .card-section,
.dark .insight-card {
  background: #1c1c1d;
  border-color: rgba(255, 255, 255, 0.08);
}
.dark .table-wrapper {
  border-color: rgba(255, 255, 255, 0.1);
}
</style>
