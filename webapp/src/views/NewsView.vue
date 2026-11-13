<template>
    <GlobalErrorBoundary>
    <div class="view-container">
    <!-- Sub-tab bar -->
    <div class="subtab-bar">
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'report' }"
        @click="switchTab('report')"
      >        <Icon name="default" size="sm" color="var(--iln-hint)" /> 精選報告
      </button>
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'pool' }"
        @click="switchTab('pool')"
      >        <Icon name="default" size="sm" color="var(--iln-hint)" /> 新聞池
      </button>
    </div>

    <!-- ── 精選報告 tab ── -->
    <div v-if="activeTab === 'report'">
      <EmptyState v-if="reportLoading" emoji="⏳" title="載入中..." />

      <ErrorAlert v-else-if="reportError" :visible="true" :description="reportError" :show-retry="true" @retry="loadReport" />

      <EmptyState v-else-if="!reportNews.tw.length && !reportNews.us.length" emoji="📭" title="今日精選報告尚未產生" message="每日早上自動更新" />

      <div v-else class="report-content">
        <!-- 台灣區塊 -->
        <div v-if="reportNews.tw.length" class="region-section">
          <div class="region-header">
            <span class="region-flag"><Icon name="default" size="sm" color="var(--iln-hint)" /></span>
            <span class="region-title">台灣市場動態</span>
            <span class="region-count">{{ reportNews.tw.length }} 則</span>
          </div>
          <div class="news-list">
            <div
              v-for="(item, i) in reportNews.tw"
              :key="'tw-' + i"
              class="news-card"
              @click="openArticle(item.link || item.url)"
            >
              <div class="news-header">
                <span class="news-source">{{ item.source }}</span>
                <span class="news-time">{{ formatDate(item.pubDate) }}</span>
              </div>
              <p class="news-title">{{ item.title }}</p>
              <p v-if="item.summary" class="news-summary">{{ item.summary }}</p>
            </div>
          </div>
        </div>

        <!-- 國際區塊 -->
        <div v-if="reportNews.us.length" class="region-section">
          <div class="region-header">
            <span class="region-flag"><Icon name="default" size="sm" color="var(--iln-hint)" /></span>
            <span class="region-title">國際總經與趨勢</span>
            <span class="region-count">{{ reportNews.us.length }} 則</span>
          </div>
          <div class="news-list">
            <div
              v-for="(item, i) in reportNews.us"
              :key="'us-' + i"
              class="news-card"
              @click="openArticle(item.link || item.url)"
            >
              <div class="news-header">
                <span class="news-source">{{ item.source }}</span>
                <span class="news-time">{{ formatDate(item.pubDate) }}</span>
              </div>
              <p class="news-title">{{ item.title }}</p>
              <p v-if="item.summary" class="news-summary">{{ item.summary }}</p>
            </div>
          </div>
        </div>

        <p class="report-generated">          <Icon name="default" size="sm" color="var(--iln-hint)" /> 產生時間：{{ reportNews.generatedAt || "—" }}
        </p>
      </div>
    </div>

    <!-- ── 新聞池 tab ── -->
    <div v-if="activeTab === 'pool'">
      <div class="pool-header">
        <span class="view-subtitle" v-if="articles.length"
          >共 {{ articles.length }} 則</span
        >
      </div>

      <EmptyState v-if="poolLoading" emoji="⏳" title="載入中..." />

      <ErrorAlert v-else-if="poolError" :visible="true" :description="poolError" :show-retry="true" @retry="loadPool" />

      <EmptyState v-else-if="articles.length === 0" emoji="📭" title="目前新聞池為空" />

      <div v-else class="news-list">
        <div
          v-for="article in articles"
          :key="article.id"
          class="news-card"
          @click="openArticle(article.link || article.url)"
        >
          <div class="news-header">
            <span class="news-age" :class="ageBandClass(article.age_band)">
              <Icon :name="ageBandIcon(article.age_band)" size="sm" />
              {{ ageBandLabel(article.age_band) }}
            </span>
            <span class="news-region"><Icon :name="regionFlag(article._region)" size="sm" /></span>
            <span class="news-source">{{ article.source }}</span>
            <span class="news-time">{{ formatDate(article.pubDate) }}</span>
          </div>
          <p class="news-title">{{ article.title }}</p>
          <p v-if="article.summary" class="news-summary">
            {{ article.summary }}
          </p>
        </div>
      </div>
    </div>

  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, onMounted } from "vue";
import Icon from "@/components/common/Icon.vue";
import { fetchNews, fetchReportNews } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import { useTelegram, waitReady } from "../composables/useTelegram.js";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import EmptyState from "@/components/common/EmptyState.vue";

// ── sub-tab 狀態 ──────────────────────────────────────────
const activeTab = ref("report");

function switchTab(tab) {
  activeTab.value = tab;
  if (tab === "report" && !reportLoaded.value) loadReport();
  if (tab === "pool" && !poolLoaded.value) loadPool();
}

// ── 精選報告 ──────────────────────────────────────────────
const reportNews = ref({ tw: [], us: [], generatedAt: "" });
const reportLoading = ref(false);
const reportError = ref(null);
const reportLoaded = ref(false);

async function loadReport() {
  reportLoading.value = true;
  reportError.value = null;
  try {
    const data = await fetchReportNews();
    reportNews.value = {
      tw: data?.tw ?? [],
      us: data?.us ?? [],
      generatedAt: data?.generatedAt ?? "",
    };
  } catch (e) {
    reportError.value = e.message;
  } finally {
    reportLoaded.value = true;
    reportLoading.value = false;
  }
}

// ── 新聞池 ────────────────────────────────────────────────
const articles = ref([]);
const poolLoading = ref(false);
const poolError = ref(null);
const poolLoaded = ref(false);

async function loadPool() {
  poolLoading.value = true;
  poolError.value = null;
  try {
    const data = await fetchNews();
    const list = Array.isArray(data) ? data : (data?.articles ?? []);
    articles.value = list;
  } catch (e) {
    poolError.value = e.message;
  } finally {
    poolLoaded.value = true;
    poolLoading.value = false;
  }
}

// ── 共用工具 ──────────────────────────────────────────────
const { openLink } = useTelegram();

function openArticle(url) {
  if (url) openLink(url);
}

function ageBandClass(band) {
  if (band === "fresh") return "age-fresh";
  if (band === "recent") return "age-recent";
  return "age-old";
}

function ageBandIcon(band) {
  if (band === "fresh") return "danger";
  if (band === "recent") return "warn";
  return "neutral";
}

function ageBandLabel(band) {
  if (band === "fresh") return "最新";
  if (band === "recent") return "近期";
  return "舊聞";
}

function regionFlag(region) {
  if (region === "TW") return "default";
  if (region === "US") return "default";
  return "default";
}

function formatDate(pubDate) {
  if (!pubDate) return "—";
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return pubDate;
  }
}

// ── 初始化：預設載入精選報告 ──────────────────────────────
onMounted(async () => {
  await waitReady();
  loadReport();
});
</script>

<style scoped>
.view-container {
  padding: 0 0 calc(112px + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

/* ── Sub-tab bar ── */
.subtab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--iln-hint);
  margin-bottom: 12px;
  padding: 0 16px;
  position: sticky;
  top: 0;
  background: var(--iln-bg);
  z-index: 10;
}

.subtab-btn {
  flex: 1;
  padding: 12px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--iln-hint);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color 0.18s,
    border-color 0.18s;
  margin-bottom: -1px;
}

.subtab-btn.active {
  color: var(--iln-link);
  border-bottom-color: var(--iln-link);
  font-weight: 600;
}

/* ── Region section (精選報告) ── */
.report-content {
  padding: 0 16px;
}

.region-section {
  margin-bottom: 20px;
}

.region-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.region-flag {
  font-size: 16px;
}

.region-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--iln-text);
  flex: 1;
}

.region-count {
  font-size: 11px;
  color: var(--iln-hint);
}

.report-generated {
  font-size: 11px;
  color: var(--iln-hint);
  text-align: center;
  margin-top: 8px;
  padding-bottom: 8px;
}

/* ── 新聞池 header ── */
.pool-header {
  padding: 0 16px 4px;
  min-height: 20px;
}

/* ── 共用新聞列表 ── */
.news-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px;
}

.region-section .news-list {
  padding: 0;
}

.news-card {
  background: var(--iln-surface);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
}

.news-card:active {
  opacity: 0.7;
}

.news-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.news-age {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}

.age-fresh {
  background: var(--iln-danger-bg);
  color: var(--iln-danger-text);
}
.age-recent {
  background: var(--iln-warn-bg);
  color: var(--iln-warn-text);
}
.age-old {
  background: var(--iln-hint);
  color: var(--iln-hint);
  opacity: 0.6;
}

.news-region {
  font-size: 13px;
}

.news-source {
  font-size: 11px;
  color: var(--iln-hint);
  flex: 1;
}

.news-time {
  font-size: 11px;
  color: var(--iln-hint);
}

.news-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--iln-text);
  line-height: 1.45;
  margin-bottom: 4px;
}

.news-summary {
  font-size: 12px;
  color: var(--iln-hint);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── 狀態 ── */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  color: var(--iln-hint);
  font-size: 14px;
  padding: 0 16px;
}

.state-hint {
  font-size: 12px;
  color: var(--iln-hint);
  margin-top: -6px;
}

.state-error {
  color: var(--iln-danger-text);
}

.retry-btn {
  padding: 8px 20px;
  background: var(--iln-brand);
  color: var(--iln-text-on-brand);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--iln-hint);
  border-top-color: var(--iln-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
