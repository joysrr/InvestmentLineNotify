<template>
  <div class="light-dash">
    <!-- 頂部列：標題、報表日期、更新時間與手動重整 -->
    <header class="light-header">
      <div>
        <h1 class="light-title">投資決策總覽</h1>
        <p class="light-sub tabular">
          報表日期：{{ vm.reportDate }}
          <span v-if="formattedUpdatedAt"> · 更新：{{ formattedUpdatedAt }}</span>
        </p>
      </div>
      <button
        type="button"
        class="refresh-btn"
        :disabled="loading"
        @click="loadDashboard"
      >
        {{ loading ? "載入中..." : "重新整理" }}
      </button>
    </header>

    <div v-if="errorMsg" class="alert-box" role="alert">
      <span>{{ errorMsg }}</span>
      <button type="button" class="link-btn" @click="loadDashboard">重試</button>
    </div>

    <!-- 1. 今日決策主卡 -->
    <section class="card decision-card" aria-label="今日策略決策">
      <div class="card-top">
        <span class="tag">今日決策</span>
        <span v-if="vm.decision.signalCategory" class="pill">
          {{ vm.decision.signalCategory }}
        </span>
      </div>

      <div class="decision-main">
        <div class="decision-target">
          <span v-if="vm.decision.statusEmoji" class="emoji">{{ vm.decision.statusEmoji }}</span>
          <span>{{ vm.decision.target }}</span>
        </div>
        <p class="decision-suggestion">{{ vm.decision.suggestion }}</p>
      </div>

      <div class="kv-strip tabular">
        <div class="kv-item">
          <span class="kv-label">策略評分</span>
          <span class="kv-val">{{ vm.decision.score ?? "—" }}</span>
        </div>
        <div class="kv-item">
          <span class="kv-label">冷卻狀態</span>
          <span class="kv-val">{{ vm.decision.cooldownText }}</span>
        </div>
        <div class="kv-item">
          <span class="kv-label">可用額度</span>
          <span class="kv-val">
            {{ vm.decision.budgetAllowed != null ? `$${vm.decision.budgetAllowed.toLocaleString()}` : "—" }}
          </span>
        </div>
        <div class="kv-item">
          <span class="kv-label">市場狀態</span>
          <span class="kv-val">{{ vm.decision.regimeState }}</span>
        </div>
      </div>
    </section>

    <!-- 2. 關鍵風控與市場快照 -->
    <section class="grid-2" aria-label="關鍵風控與市場快照">
      <div class="card">
        <div class="card-title">風控與槓桿</div>
        <div class="metric-row tabular">
          <div>
            <div class="m-label">整戶維持率</div>
            <div class="m-val">
              {{ vm.metrics.maintenanceMargin != null ? `${vm.metrics.maintenanceMargin.toFixed(1)}%` : "—" }}
            </div>
          </div>
          <div>
            <div class="m-label">總槓桿倍數</div>
            <div class="m-val">
              {{ vm.metrics.grossLeverage != null ? `${vm.metrics.grossLeverage.toFixed(2)}x` : "—" }}
            </div>
          </div>
          <div>
            <div class="m-label">估值 PR</div>
            <div class="m-val">
              {{ vm.metrics.currentPR != null ? Math.round(vm.metrics.currentPR) : "—" }}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">市場與景氣</div>
        <div class="metric-row tabular">
          <div>
            <div class="m-label">CBOE VIX</div>
            <div class="m-val">
              {{ vm.metrics.vix != null ? vm.metrics.vix.toFixed(1) : "—" }}
            </div>
          </div>
          <div>
            <div class="m-label">台股 VIX</div>
            <div class="m-val">
              {{ vm.metrics.vixTW != null ? vm.metrics.vixTW.toFixed(1) : "—" }}
            </div>
          </div>
          <div>
            <div class="m-label">國發會燈號</div>
            <div class="m-val">{{ vm.metrics.ndcLight || "—" }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. 帳戶健康度（/portfolio/health） -->
    <section class="card" aria-label="帳戶健康度">
      <div class="card-top">
        <div class="card-title">帳戶健康度</div>
        <span v-if="vm.health.lightStatus" class="pill">{{ vm.health.lightStatus }}</span>
      </div>

      <template v-if="vm.health.hasData">
        <div class="health-head tabular">
          <div class="health-score" :class="`tone-${vm.health.tone}`">
            {{ vm.health.score ?? "—" }}
            <span class="health-unit">/ 100</span>
          </div>
          <p class="health-summary">{{ vm.health.summary || "無健康度摘要" }}</p>
        </div>

        <div class="progress-track">
          <div
            class="progress-fill"
            :class="`tone-${vm.health.tone}`"
            :style="{ width: `${Math.max(0, Math.min(100, vm.health.score ?? 0))}%` }"
          ></div>
        </div>

        <details v-if="vm.health.components.length" class="details-box">
          <summary>展開 6 項健康維度（{{ vm.health.components.length }}）</summary>
          <div class="comp-grid tabular">
            <div
              v-for="c in vm.health.components"
              :key="c.key"
              class="comp-cell"
              :class="`tone-${c.status}`"
            >
              <div class="comp-name">{{ c.label }}</div>
              <div class="comp-val">{{ c.valueText }}</div>
              <div v-if="c.subText" class="comp-sub">{{ c.subText }}</div>
            </div>
          </div>
        </details>
      </template>
      <p v-else class="muted">尚未取得帳戶健康度資料</p>
    </section>

    <!-- 4. AI 教練建議：僅在後端實際有產出 AI 內容時顯示 -->
    <section v-if="vm.ai.hasData" class="card ai-card" aria-label="AI 教練建議">
      <div class="card-top">
        <div class="card-title">AI 教練建議</div>
        <span v-if="vm.ai.verdict" class="pill pill-accent">{{ vm.ai.verdict }}</span>
      </div>

      <p v-if="vm.ai.insight" class="ai-insight">{{ vm.ai.insight }}</p>

      <div v-if="vm.ai.actions.length" class="ai-list-group">
        <div class="ai-list-title">行動建議</div>
        <ul class="ai-list">
          <li v-for="(item, idx) in vm.ai.actions" :key="`act-${idx}`">{{ item }}</li>
        </ul>
      </div>

      <div v-if="vm.ai.risks.length" class="ai-list-group">
        <div class="ai-list-title">風險提示</div>
        <ul class="ai-list">
          <li v-for="(item, idx) in vm.ai.risks" :key="`risk-${idx}`">{{ item }}</li>
        </ul>
      </div>

      <details v-if="vm.ai.mindset.length || vm.ai.thinking" class="details-box">
        <summary>展開心態微調與推演</summary>
        <ul v-if="vm.ai.mindset.length" class="ai-list">
          <li v-for="(item, idx) in vm.ai.mindset" :key="`m-${idx}`">{{ item }}</li>
        </ul>
        <p v-if="vm.ai.thinking" class="ai-thinking">{{ vm.ai.thinking }}</p>
      </details>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import {
  fetchStatus,
  fetchReports,
  fetchPortfolioHealth,
} from "../api/index.js";
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import {
  extractLatestReport,
  buildDashboardViewModel,
} from "../composables/buildDashboardViewModel.js";

const loading = ref(false);
const errorMsg = ref("");
const statusData = ref(null);
const latestReport = ref(null);
const healthData = ref(null);

const vm = computed(() =>
  buildDashboardViewModel({
    status: statusData.value,
    report: latestReport.value,
    health: healthData.value,
  }),
);

const formattedUpdatedAt = computed(() => {
  if (!vm.value.updatedAt) return "";
  const formatted = formatDateTimeInTaipei(vm.value.updatedAt);
  return formatted === "—" ? "" : formatted;
});

async function loadDashboard() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const [statusRes, reportsRes, healthRes] = await Promise.allSettled([
      fetchStatus(),
      fetchReports(1),
      fetchPortfolioHealth(),
    ]);

    if (statusRes.status === "fulfilled") statusData.value = statusRes.value;
    if (reportsRes.status === "fulfilled") {
      latestReport.value = extractLatestReport(reportsRes.value);
    }
    if (healthRes.status === "fulfilled") healthData.value = healthRes.value;

    const allFailed =
      statusRes.status === "rejected" &&
      reportsRes.status === "rejected" &&
      healthRes.status === "rejected";

    if (allFailed) {
      errorMsg.value = "無法取得後端資料，請稍後再試。";
    } else if (reportsRes.status === "rejected" && healthRes.status === "rejected") {
      errorMsg.value = "報表與健康度 API 載入失敗，部分資訊可能暫缺。";
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadDashboard);
</script>

<style scoped>
.light-dash {
  max-width: 820px;
  margin: 0 auto;
  padding: 16px 16px 96px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--iln-text, #111827);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

.light-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.light-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}

.light-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--iln-hint, #6b7280);
}

.refresh-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
  background: var(--iln-surface, #ffffff);
  color: var(--iln-text, #111827);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
  font-size: 13px;
}

.link-btn {
  border: none;
  background: transparent;
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.card {
  background: var(--iln-surface, #ffffff);
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.decision-card {
  background: var(--iln-brand-soft, #eff6ff);
  border-color: rgba(37, 99, 235, 0.2);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tag,
.card-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--iln-hint, #4b5563);
  margin: 0;
}

.pill {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--iln-surface-alt, #f3f4f6);
  color: var(--iln-text, #111827);
}

.pill-accent {
  background: rgba(37, 99, 235, 0.12);
  color: var(--iln-brand, #2563eb);
}

.decision-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.decision-target {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--iln-brand, #2563eb);
}

.decision-suggestion {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.35;
}

.kv-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

@media (min-width: 640px) {
  .kv-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.kv-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kv-label,
.m-label {
  font-size: 11px;
  color: var(--iln-hint, #6b7280);
}

.kv-val,
.m-val {
  font-size: 15px;
  font-weight: 700;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 640px) {
  .grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.health-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.health-score {
  font-size: 24px;
  font-weight: 800;
  flex-shrink: 0;
}

.health-unit {
  font-size: 12px;
  font-weight: 500;
  color: var(--iln-hint, #6b7280);
}

.health-summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  text-align: right;
}

.progress-track {
  height: 7px;
  border-radius: 999px;
  background: var(--iln-surface-alt, #e5e7eb);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--iln-brand, #2563eb);
}

.tone-ok {
  color: #15803d;
}
.progress-fill.tone-ok {
  background: #16a34a;
}

.tone-warn {
  color: #b45309;
}
.progress-fill.tone-warn {
  background: #d97706;
}

.tone-danger {
  color: #b91c1c;
}
.progress-fill.tone-danger {
  background: #dc2626;
}

.details-box {
  border-top: 1px solid var(--iln-border-subtle, #e5e7eb);
  padding-top: 10px;
}

.details-box summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--iln-brand, #2563eb);
}

.comp-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.comp-cell {
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
  border-radius: 10px;
  padding: 10px;
}

.comp-name {
  font-size: 11px;
  color: var(--iln-hint, #6b7280);
}

.comp-val {
  font-size: 14px;
  font-weight: 700;
  margin-top: 2px;
}

.comp-sub {
  font-size: 11px;
  color: var(--iln-hint, #6b7280);
  margin-top: 2px;
}

.ai-insight {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--iln-surface-alt, #f9fafb);
}

.ai-list-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-list-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--iln-hint, #4b5563);
}

.ai-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.5;
}

.ai-thinking {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--iln-hint, #6b7280);
  line-height: 1.5;
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--iln-hint, #6b7280);
}
</style>
