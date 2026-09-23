<template>
    <GlobalErrorBoundary>
    <div class="view-container">
    <!-- Sub-tab bar -->
    <div class="subtab-bar">
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'report' }"
        @click="switchTab('report')"
      >
        🗞️ 精選報告
      </button>
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'pool' }"
        @click="switchTab('pool')"
      >
        📦 新聞池
      </button>
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'periodic' }"
        @click="switchTab('periodic')"
        data-testid="subtab-periodic"
      >
        📊 歷史簡報
      </button>
    </div>

    <!-- ── 精選報告 tab ── -->
    <div v-if="activeTab === 'report'">
      <div v-if="reportLoading" class="state-box">
        <div class="spinner"></div>
        <p>載入中...</p>
      </div>

      <div v-else-if="reportError" class="state-box state-error">
        <p>⚠️ {{ reportError }}</p>
        <button class="retry-btn" @click="loadReport">重試</button>
      </div>

      <div
        v-else-if="!reportNews.tw.length && !reportNews.us.length"
        class="state-box"
      >
        <p>📭 今日精選報告尚未產生</p>
        <p class="state-hint">每日早上自動更新</p>
      </div>

      <div v-else class="report-content">
        <!-- 台灣區塊 -->
        <div v-if="reportNews.tw.length" class="region-section">
          <div class="region-header">
            <span class="region-flag">🇹🇼</span>
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
            <span class="region-flag">🌎</span>
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

        <p class="report-generated">
          📅 產生時間：{{ reportNews.generatedAt || "—" }}
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

      <div v-if="poolLoading" class="state-box">
        <div class="spinner"></div>
        <p>載入中...</p>
      </div>

      <div v-else-if="poolError" class="state-box state-error">
        <p>⚠️ {{ poolError }}</p>
        <button class="retry-btn" @click="loadPool">重試</button>
      </div>

      <div v-else-if="articles.length === 0" class="state-box">
        <p>📭 目前新聞池為空</p>
      </div>

      <div v-else class="news-list">
        <div
          v-for="article in articles"
          :key="article.id"
          class="news-card"
          @click="openArticle(article.link || article.url)"
        >
          <div class="news-header">
            <span class="news-age" :class="ageBandClass(article.age_band)">
              {{ ageBandLabel(article.age_band) }}
            </span>
            <span class="news-region">{{ regionFlag(article._region) }}</span>
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

    <!-- ── 歷史簡報 tab (日/週/月報) ── -->
    <div v-else-if="activeTab === 'periodic'">
      <ReportsView />
    </div>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { fetchNews, fetchReportNews } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import ReportsView from "./ReportsView.vue";
import { useTelegram, waitReady } from "../composables/useTelegram.js";

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

function ageBandLabel(band) {
  if (band === "fresh") return "🔴 最新";
  if (band === "recent") return "🟡 近期";
  return "⚪ 舊聞";
}

function regionFlag(region) {
  if (region === "TW") return "🇹🇼";
  if (region === "US") return "🇺🇸";
  return "🌐";
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
  border-bottom: 1px solid var(--tg-theme-hint-color, #e0e0e0);
  margin-bottom: 12px;
  padding: 0 16px;
  position: sticky;
  top: 0;
  background: var(--tg-theme-bg-color, #fff);
  z-index: 10;
}

.subtab-btn {
  flex: 1;
  padding: 12px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--tg-theme-hint-color, #999);
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
  color: var(--tg-theme-link-color, #2481cc);
  border-bottom-color: var(--tg-theme-link-color, #2481cc);
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
  color: var(--tg-theme-text-color, #222);
  flex: 1;
}

.region-count {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
}

.report-generated {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #bbb);
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
  background: var(--tg-theme-secondary-bg-color, #f5f5f5);
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
  background: #fdecea;
  color: #e84855;
}
.age-recent {
  background: #fef9e7;
  color: #d4ac0d;
}
.age-old {
  background: var(--tg-theme-hint-color, #eee);
  color: var(--tg-theme-hint-color, #999);
  opacity: 0.6;
}

.news-region {
  font-size: 13px;
}

.news-source {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
  flex: 1;
}

.news-time {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #aaa);
}

.news-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--tg-theme-text-color, #222);
  line-height: 1.45;
  margin-bottom: 4px;
}

.news-summary {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #888);
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
  color: var(--tg-theme-hint-color, #999);
  font-size: 14px;
  padding: 0 16px;
}

.state-hint {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #bbb);
  margin-top: -6px;
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
</style>
