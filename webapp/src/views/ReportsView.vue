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

    <!-- Science Backtest Tab Content -->
    <div
      v-else-if="activeTab === 'discipline'"
      class="discipline-container fade-in"
    >
      <div class="discipline-intro-card">
        <div class="intro-badge">✨ 核心思想：理性數據戰勝直覺</div>
        <h3 class="intro-title">以長期實證消除踏空焦慮，維持強大紀律</h3>
        <p class="intro-desc">
          本系統決策「隨波逐流減倉 50%」及「動態去槓桿守衛」非憑空猜測，而是基於
          2009 至 2026 年（跨越 17
          年、歷經多次多空大循環）的完整歷史數據模擬。數據為所有理性的投資者提供了強烈的信心支撐，確保在車上享受複利，並在危機到來時安全存活。
        </p>
      </div>

      <!-- Comparison Card -->
      <div class="card-section">
        <h4 class="section-sub-title">17年長期回測數據大比拼 (2009 ~ 2026)</h4>

        <!-- ECharts 圖表區 -->
        <div class="chart-container" style="height: 300px; margin-bottom: 20px">
          <v-chart class="chart" :option="cagrOptions" autoresize />
        </div>

        <div class="table-wrapper">
          <table class="backtest-table">
            <thead>
              <tr>
                <th>策略模式</th>
                <th>期末淨資產</th>
                <th>年化報酬 (CAGR)</th>
                <th>最大回撤 (MDD)</th>
                <th>生存率</th>
              </tr>
            </thead>
            <tbody>
              <tr class="row-highlight">
                <td>
                  <strong>進攻模式 (最新 V2.8)</strong><br />
                  <span class="sub-row">訊號觸發減持 50% + 去槓桿守衛</span>
                </td>
                <td class="val-gain">NT$ 4,620 萬</td>
                <td class="val-gain">12.7%</td>
                <td class="val-safe">-41%</td>
                <td>100%</td>
              </tr>
              <tr>
                <td>
                  <strong>溫和積極組 (舊版)</strong><br />
                  <span class="sub-row">訊號觸發 100% 清倉 + 去槓桿守衛</span>
                </td>
                <td>NT$ 3,199 萬</td>
                <td>10.09%</td>
                <td>-43.61%</td>
                <td>100%</td>
              </tr>
              <tr>
                <td>
                  <strong>控制組 (基線)</strong><br />
                  <span class="sub-row">純 DCA 買進 0050 (帳面帳戶)</span>
                </td>
                <td>NT$ 789 萬*</td>
                <td>1.44%</td>
                <td>-76.94%</td>
                <td>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="table-footnote">
          * 備註：回測初始資金為 0，每月 DCA 30,000 元，質押率上限
          60%。舊版雖能在高點完美清倉，但頻繁全賣退場在反彈初期「踏空摩擦阻力」極大；最新
          v2.8 採行的「50% 保留底倉」完美在保留複利與防滑間取得黃金平衡！(0050
          基線結果含 1 拆 4 帳面重置偏誤)
        </p>
      </div>

      <!-- Explanatory Grid Cards -->
      <div class="insights-grid">
        <div class="insight-card">
          <div class="card-icon">💡</div>
          <h4 class="card-title">為什麼「僅減碼 50%」完勝「全數出清」？</h4>
          <p class="card-text">
            <strong>避免踏空踏錯與情緒反覆：</strong> 舊版策略在賣出訊號成立時
            100%
            出清槓桿，回測證明這會導致在牛市的回調和暴漲邊際中陷入「頻繁踏空」，錯失最早、反彈速度最快的複利。
            <br /><br />
            <strong>保留火種延續複利：</strong> 限制最大減碼比例為
            50%，一來落實主動式防禦避開急跌區，二來保留 50% 的核心槓桿等待 V
            型反轉，免遭多頭洗盤。配合去槓桿守衛，期末最終淨值大勝傳統全賣清倉！
          </p>
        </div>

        <div class="insight-card">
          <div class="card-icon">🛡️</div>
          <h4 class="card-title">去槓桿守衛：抵禦 2022 升息熊市的盾牌</h4>
          <p class="card-text">
            <strong>極端行情的終極底層安防：</strong> 在 2022 年 Fed
            歷史級急升息熊市下，帳戶的維持率受到高壓威脅，舊版模擬中的融資使用率（Loan
            Usage）曾崩潰至觸平警戒的 132%！ <br /><br />
            <strong>自動還款防微杜漸：</strong> V2.8 內嵌
            <strong>Deleverage 去槓桿守衛</strong
            >，在每日滾動迴圈中，當大腦維持率低於 85%
            防線時自動觸發市價降倉還款，成功將歷史借款使用率牢牢鎖在極安全的 79%
            上限，完美生存！
          </p>
        </div>

        <div class="insight-card">
          <div class="card-icon">📐</div>
          <h4 class="card-title">完美還原股票分割與真實價格假跳空</h4>
          <p class="card-text">
            <strong>數據極致精準度：</strong>
            我們的回測歷程不是紙上談兵，而是完全擬合真實世界持產現狀：
            <br /><br />
            1. <strong>股票分割處理：</strong> 0050 於 2025-06-18 進行「1 拆
            4」分割。程式會自動在當日將庫存股數乘以
            4，將歷史買入timeline均值還原，完美消除資料跳空。
            <br />
            2. <strong>修護假跳空資料：</strong> 修正了 2014 年 Yahoo 數據庫中
            0050 出現單日 -75% 的人工記錄假跌幅，消除一切回測偏誤。
          </p>
        </div>
      </div>
    </div>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import {
  fetchReports,
  fetchWeeklyReports,
  fetchMonthlyReports,
} from "../api/index.js";
import GlobalErrorBoundary from "../components/common/GlobalErrorBoundary.vue";
import { useTelegram, waitReady } from "../composables/useTelegram.js";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// 註冊 ECharts 組件
use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  BarChart,
  LineChart,
  CanvasRenderer,
]);

const cagrOptions = computed(() => {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { textStyle: { color: "var(--tg-theme-text-color, #333)" } },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: ["進攻模式(最新)", "溫和積極(舊版)", "控制組(基線)"],
      axisLabel: { color: "var(--tg-theme-text-color, #333)", interval: 0 },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "var(--tg-theme-text-color, #333)",
        formatter: "{value}%",
      },
    },
    series: [
      {
        name: "年化報酬 (CAGR)",
        type: "bar",
        data: [12.7, 10.09, 1.44],
        itemStyle: { color: "#26a17b" },
        label: { show: true, position: "top", formatter: "{c}%" },
      },
      {
        name: "最大回撤 (MDD)",
        type: "bar",
        data: [-41, -43.61, -76.94],
        itemStyle: { color: "#e84855" },
        label: { show: true, position: "bottom", formatter: "{c}%" },
      },
    ],
  };
});

const route = useRoute();

const tabs = [
  { key: "daily", label: "日報" },
  { key: "weekly", label: "週報" },
  { key: "monthly", label: "月報" },
  { key: "discipline", label: "科學回測" },
];

const activeTab = ref("daily");
const expanded = reactive({});

// Each tab keeps its own state so switching back doesn't refetch
const state = reactive({
  daily: { loading: false, error: null, items: [], loaded: false },
  weekly: { loading: false, error: null, items: [], loaded: false },
  monthly: { loading: false, error: null, items: [], loaded: false },
  discipline: { loading: false, error: null, items: [1], loaded: true },
});

const currentState = computed(() => state[activeTab.value]);

const subtitleText = computed(() => {
  const s = currentState.value;
  if (!s || s.loading || s.error || !s.items.length) return "";
  const tab = activeTab.value;
  if (tab === "daily") return `近 ${s.items.length} 份`;
  if (tab === "weekly") return `近 ${s.items.length} 週`;
  if (tab === "monthly") return `近 ${s.items.length} 個月`;
  if (tab === "discipline") return "17年實證數據與紀律";
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
    else data = await fetchMonthlyReports(12);

    if (tab === "daily") {
      s.items = [...data].sort((a, b) => b.date.localeCompare(a.date));
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
  if (tab === "discipline") return;
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
  if (route?.query?.tab === "discipline") {
    activeTab.value = "discipline";
  } else {
    load("daily");
  }
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
.backtest-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 12px;
  min-width: 420px;
}
.backtest-table th {
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
  color: var(--tg-theme-hint-color, #666);
  font-weight: 700;
  padding: 10px 8px;
}
.backtest-table td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--tg-theme-secondary-bg-color, #eee);
  vertical-align: middle;
  color: var(--tg-theme-text-color, #333);
}
.row-highlight {
  background: rgba(38, 161, 123, 0.05);
}
.dark .row-highlight {
  background: rgba(38, 161, 123, 0.15);
}
.row-highlight td {
  font-weight: 600;
}
.sub-row {
  font-size: 9px;
  color: #888;
  font-weight: normal;
}
.val-gain {
  color: #26a17b !important;
  font-weight: 700 !important;
}
.val-safe {
  color: #2481cc !important;
  font-weight: 700 !important;
}
.table-footnote {
  font-size: 10px;
  color: var(--tg-theme-hint-color, #888);
  margin: 10px 0 0 0;
  line-height: 1.4;
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
.dark .backtest-table th {
  background: #2c2c2e;
  color: #aaa;
}
.dark .backtest-table td {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
</style>
