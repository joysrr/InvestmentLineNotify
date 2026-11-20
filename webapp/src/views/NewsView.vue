<template>
    <GlobalErrorBoundary>
    <div class="view-container iln-page">
    <!-- ── Header ── -->
    <div class="page-header">
      <h1 class="page-title">新聞資訊</h1>
      <p class="page-subtitle">每日精選報告 ＆ 新聞池</p>
    </div>

    <!-- Sub-tab bar -->
    <div class="subtab-bar">
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'report' }"
        @click="switchTab('report')"
      >        <Icon name="news" size="sm" color="var(--iln-hint)" /> 精選報告
      </button>
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'pool' }"
        @click="switchTab('pool')"
      >        <Icon name="chart" size="sm" color="var(--iln-hint)" /> 新聞池
      </button>
    </div>

    <p class="featured-note">
      每日精選由系統依主題篩選，完整新聞請見新聞池
    </p>

    <!-- ── 精選報告 tab ── -->
    <div v-if="activeTab === 'report'">
      <LoadingSkeleton v-if="reportLoading" variant="card" :rows="3" />

      <ErrorAlert v-else-if="reportError" :visible="true" :description="reportError" :show-retry="true" @retry="loadReport" />

      <EmptyState v-else-if="!reportNews.tw.length && !reportNews.us.length" title="今日尚無精選報告，請稍後再試" message="每日早上自動更新" />

      <div v-else class="report-content">
        <!-- 台灣區塊 -->
        <div v-if="reportNews.tw.length" class="region-section">
          <div class="region-header">
            <span class="region-flag"><Icon name="chart" size="sm" color="var(--iln-hint)" /></span>
            <span class="region-title">台灣市場動態</span>
            <span class="region-count">{{ reportNews.tw.length }} 則</span>
          </div>
          <div class="news-list">
          <component :is="NewsCard"
            v-for="(item, i) in reportNews.tw"
            :key="'tw-' + i"
            :article="item"
            :is-featured="true"
            @article-click="openArticle"
        ></component>
        </div>
        </div>

        <!-- 國際區塊 -->
        <div v-if="reportNews.us.length" class="region-section">
          <div class="region-header">
            <span class="region-flag"><Icon name="chart" size="sm" color="var(--iln-hint)" /></span>
            <span class="region-title">國際總經與趨勢</span>
            <span class="region-count">{{ reportNews.us.length }} 則</span>
          </div>
          <div class="news-list">
          <component :is="NewsCard"
            v-for="(item, i) in reportNews.us"
            :key="'us-' + i"
            :article="item"
            :is-featured="true"
            @article-click="openArticle"
        ></component>
        </div>
        </div>

        <p class="report-generated">          <Icon name="clock" size="sm" color="var(--iln-hint)" /> 產生時間：{{ generatedAtDisplay }}
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
      <div v-if="articles.length" class="pool-filters" role="group" aria-label="新聞篩選">
        <button
          v-for="filter in poolFilters"
          :key="filter.id"
          :data-testid="`news-filter-${filter.id}`"
          class="pool-filter"
          :class="{ active: activePoolFilter === filter.id }"
          :aria-pressed="activePoolFilter === filter.id"
          @click="activePoolFilter = filter.id"
        >{{ filter.label }}<span class="filter-count">{{ filterCounts[filter.id] }}</span></button>
      </div>
      <p v-if="articles.length && filteredArticles.length === 0" class="filter-empty">目前沒有符合條件的新聞</p>

      <LoadingSkeleton v-if="poolLoading" variant="card" :rows="3" />

      <ErrorAlert v-else-if="poolError" :visible="true" :description="poolError" :show-retry="true" @retry="loadPool" />

      <EmptyState v-else-if="articles.length === 0" title="新聞池目前為空，排程可能尚未執行" />

      <div v-else-if="filteredArticles.length" class="news-list pool-list">
        <component :is="NewsCard"
          v-for="article in filteredArticles"
          :key="article.id"
          :article="article"
          :show-age-band="true"
          :is-picked="matchFeatured(article, featuredNews)"
          @article-click="openArticle"
        ></component>
      </div>
    </div>
  </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { dedupeByUrl, isTaiwanMarket, matchFeatured } from "@/utils/newsMatch.js";
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import NewsCard from "@/components/dashboard/NewsCard.vue";
import { fetchNews, fetchReportNews } from "../api/index.js";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import { useTelegram, waitReady } from "../composables/useTelegram.js";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import LoadingSkeleton from "@/components/common/LoadingSkeleton.vue";

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

// 報告生成時間顯示：已為「YYYY-MM-DD HH:mm」則保留台北語義不二次轉換；
// 否則經 formatDateTimeInTaipei（固定 Asia/Taipei）；無效值顯示「—」
const generatedAtDisplay = computed(() => {
  const v = reportNews.value?.generatedAt;
  if (!v) return "—";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(v)) return v;
  return formatDateTimeInTaipei(v);
});

// 精選列表：供新聞池 tab 做 matchFeatured 比對，標記 isPicked
const featuredNews = ref([]);

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
    featuredNews.value = [...(data?.tw ?? []), ...(data?.us ?? [])];
  } catch (e) {
    reportError.value = e.message;
  } finally {
    reportLoaded.value = true;
    reportLoading.value = false;
  }
}

// ── 新聞池 ────────────────────────────────────────────────
const articles = ref([]);
const activePoolFilter = ref("all");
const poolFilters = [
  { id: "all", label: "全部" },
  { id: "featured", label: "精選" },
  { id: "taiwan", label: "台灣市場" },
  { id: "unclassified", label: "未分類" },
];
const filterCounts = computed(() => ({
  all: articles.value.length,
  featured: articles.value.filter((article) => matchFeatured(article, featuredNews.value)).length,
  taiwan: articles.value.filter((article) => isTaiwanMarket(article)).length,
  unclassified: articles.value.filter((article) => !isTaiwanMarket(article)).length,
}));
const filteredArticles = computed(() => articles.value.filter((article) => {
  if (activePoolFilter.value === "all") return true;
  if (activePoolFilter.value === "featured") return matchFeatured(article, featuredNews.value);
  if (activePoolFilter.value === "taiwan") return isTaiwanMarket(article);
  return !article.source || (!isTaiwanMarket(article) && !article._knownInternational);
}));
const poolLoading = ref(false);
const poolError = ref(null);
const poolLoaded = ref(false);

async function loadPool() {
  poolLoading.value = true;
  poolError.value = null;
  try {
    const data = await fetchNews();
    const rawList = Array.isArray(data) ? data : (data?.articles ?? []);
    const list = dedupeByUrl(rawList);
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

function openArticle(article) {
  if (article) openLink(article.link || article.url);
}

// ── 初始化：預設載入精選報告 ──────────────────────────────
onMounted(async () => {
  await waitReady();
  loadReport();
});
</script>

<style scoped>
/* ── Page header（對齊 AccountView / StrategyConfigEditor） ── */
.page-header {
  padding: var(--iln-space-4) var(--iln-space-4) var(--iln-space-2);
  margin-bottom: var(--iln-space-2);
}
.page-title {
  font-size: var(--iln-font-2xl, 22px);
  font-weight: 700;
  color: var(--iln-text);
  margin: 0 0 var(--iln-space-1);
  line-height: 1.25;
}
.page-subtitle {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin: 0;
}
/* NewsView — Phase 3 現代化（2026-11-17）
   只動 CSS：
   - px → --iln-space-* / --iln-font-* / --iln-radius-*
   - 移除死 selector：news-card / news-card:active / news-header / news-age /
     age-fresh / age-recent / age-old / news-region / news-source / news-time /
     news-title / news-summary（實際由子組件 NewsCard.vue 自帶 scoped）
     state-box / state-hint / state-error / retry-btn / spinner / @keyframes spin
     （模板改用 ErrorAlert / EmptyState 組件） */

.view-container {
  padding: 0 0 env(safe-area-inset-bottom, 0px);
  min-height: 100%;
}

/* ── Sub-tab bar ── */
.subtab-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--iln-border-subtle);
  margin-bottom: var(--iln-space-3);
  padding: 0 var(--iln-space-4);
  position: sticky;
  top: 0;
  background: var(--iln-bg);
  z-index: 10;
}

.subtab-btn {
  flex: 1;
  padding: var(--iln-space-3) 0;
  font-size: var(--iln-font-sm);
  font-weight: 500;
  color: var(--iln-hint);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color var(--iln-duration-base) var(--iln-ease-standard),
    border-color var(--iln-duration-base) var(--iln-ease-standard);
  margin-bottom: -1px;
}
.subtab-btn.active {
  color: var(--iln-brand);
  border-bottom-color: var(--iln-brand);
  font-weight: 600;
}
.subtab-btn:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: -2px;
}

/* ── Region section（精選報告） ── */
.report-content {
  padding: 0 var(--iln-space-4);
}

.region-section {
  margin-bottom: var(--iln-space-5);
}

.region-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: var(--iln-space-2);
}

.region-flag {
  font-size: var(--iln-font-md);
}

.region-title {
  font-size: var(--iln-font-base);
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
  margin-top: var(--iln-space-2);
  padding-bottom: var(--iln-space-2);
}

/* ── 新聞池 header ── */
.pool-header {
  padding: 0 var(--iln-space-4) var(--iln-space-1);
  min-height: 20px;
}

/* ── 共用新聞列表（卡片由 NewsCard.vue 提供） ── */
.news-list {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
  padding: 0 var(--iln-space-4);
}
.region-section .news-list {
  padding: 0;
}

/* 精選註記 */
.featured-note {
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-medium);
  color: var(--iln-brand);
  margin-top: var(--iln-space-2);
}

/* 視圖副標題 */
.view-subtitle {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin-bottom: var(--iln-space-4);
}

/* ── P3：新聞列表寬屏兩列（≥1024px）── */
@media (min-width: 1024px) {
  .pool-list.news-list,
  .news-pool .news-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--iln-space-3);
  }
}
</style>
