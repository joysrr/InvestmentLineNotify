<template>
  <div class="insights-light">
    <header class="insights-head">
      <div>
        <h1 class="insights-title">市場洞察</h1>
        <p class="insights-sub tabular">
          雷達訊號與總經多空
          <span v-if="vm.reportDate"> · 報表：{{ vm.reportDate }}</span>
          <span v-if="formattedUpdatedAt"> · 更新：{{ formattedUpdatedAt }}</span>
        </p>
      </div>
      <button
        type="button"
        class="refresh-btn"
        :disabled="loading"
        @click="loadInsights"
      >
        {{ loading ? "載入中..." : "重新整理" }}
      </button>
    </header>

    <div v-if="errorMsg" class="alert-banner" role="alert">
      <span>{{ errorMsg }}</span>
      <button type="button" class="link-btn" @click="loadInsights">重試</button>
    </div>

    <!-- 同一頁雙 Tab 切換（維持 ?tab=radar / ?tab=macro 路由相容） -->
    <nav class="tab-bar" role="tablist" aria-label="洞察分頁">
      <button
        type="button"
        role="tab"
        class="tab-btn"
        :class="{ 'is-active': activeTab === 'radar' }"
        :aria-selected="activeTab === 'radar'"
        @click="switchTab('radar')"
      >
        市場雷達
      </button>
      <button
        type="button"
        role="tab"
        class="tab-btn"
        :class="{ 'is-active': activeTab === 'macro' }"
        :aria-selected="activeTab === 'macro'"
        @click="switchTab('macro')"
      >
        多空對決
      </button>
    </nav>

    <div v-if="loading && !hasAnyLoaded" class="card muted">
      正在載入市場洞察資料...
    </div>

    <MarketRadarView
      v-else-if="activeTab === 'radar'"
      :radar="vm.radar"
      :report-date="vm.reportDate"
      :updated-at="vm.updatedAt"
    />

    <MacroBattleView
      v-else
      :macro="vm.macro"
      :report-date="vm.reportDate"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchStatus,
  fetchReports,
  fetchSocialSentiment,
} from "../api/index.js";
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import {
  extractLatestReport,
  buildInsightsViewModel,
} from "../composables/buildInsightsViewModel.js";
import MarketRadarView from "./MarketRadarView.vue";
import MacroBattleView from "./MacroBattleView.vue";

const route = useRoute();
const router = useRouter();

const activeTab = computed(() =>
  route.query.tab === "macro" ? "macro" : "radar",
);

const switchTab = (tab) => {
  if (activeTab.value === tab) return;
  router.replace({ query: { ...route.query, tab } });
};

const loading = ref(false);
const errorMsg = ref("");
const statusResData = ref(null);
const latestReport = ref(null);
const socialSentimentData = ref(null);

const hasAnyLoaded = computed(
  () =>
    Boolean(statusResData.value) ||
    Boolean(latestReport.value) ||
    Boolean(socialSentimentData.value),
);

const vm = computed(() =>
  buildInsightsViewModel({
    statusResponse: statusResData.value,
    report: latestReport.value,
    socialSentiment: socialSentimentData.value,
  }),
);

const formattedUpdatedAt = computed(() => {
  if (!vm.value.updatedAt) return "";
  const txt = formatDateTimeInTaipei(vm.value.updatedAt);
  return txt === "—" ? "" : txt;
});

async function loadInsights() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const [sRes, rRes, socRes] = await Promise.allSettled([
      fetchStatus(),
      fetchReports(3),
      fetchSocialSentiment(),
    ]);

    if (sRes.status === "fulfilled") statusResData.value = sRes.value;
    if (rRes.status === "fulfilled") {
      latestReport.value = extractLatestReport(rRes.value);
    }
    if (socRes.status === "fulfilled") {
      socialSentimentData.value = socRes.value;
    }

    const allFailed =
      sRes.status === "rejected" &&
      rRes.status === "rejected" &&
      socRes.status === "rejected";

    if (allFailed) {
      errorMsg.value = "無法取得市場洞察資料，請稍後再試。";
    } else if (sRes.status === "rejected" && rRes.status === "rejected") {
      errorMsg.value = "狀態與報表 API 載入失敗，部分指標可能暫缺。";
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadInsights);
</script>

<style scoped>
.insights-light {
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

.insights-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.insights-title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}

.insights-sub {
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

.alert-banner {
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

.tab-bar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  background: var(--iln-surface-alt, #f3f4f6);
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
}

.tab-btn {
  padding: 9px 12px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--iln-hint, #4b5563);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.tab-btn.is-active {
  background: var(--iln-surface, #ffffff);
  color: var(--iln-brand, #2563eb);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.card {
  background: var(--iln-surface, #ffffff);
  border: 1px solid var(--iln-border-subtle, #e5e7eb);
  border-radius: 14px;
  padding: 16px;
}

.muted {
  margin: 0;
  font-size: 13px;
  color: var(--iln-hint, #6b7280);
}
</style>
