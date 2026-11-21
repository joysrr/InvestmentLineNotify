<template>
  <GlobalErrorBoundary>
    <div class="view-container iln-page">
      <!-- ── Header ── -->
      <header class="page-header">
        <h1 class="page-title">新聞資訊</h1>
        <p class="page-subtitle">每日精選報告 ＆ 新聞池</p>
      </header>

      <!-- Sub-tab bar -->
      <div class="subtab-bar" role="tablist" aria-label="新聞資訊分頁">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'report'"
          class="subtab-btn"
          :class="{ active: activeTab === 'report' }"
          @click="switchTab('report')"
        >
          <Icon name="news" size="sm" color="var(--iln-hint)" />
          <span>精選報告</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'pool'"
          class="subtab-btn"
          :class="{ active: activeTab === 'pool' }"
          @click="switchTab('pool')"
        >
          <Icon name="chart" size="sm" color="var(--iln-hint)" />
          <span>新聞池</span>
        </button>
      </div>

      <p class="featured-note">
        每日精選由系統依主題篩選，完整新聞請見新聞池
      </p>

      <!-- ── 精選報告 tab ── -->
      <div v-if="activeTab === 'report'">
        <LoadingSkeleton v-if="reportLoading" variant="card" :rows="3" />

        <ErrorAlert
          v-else-if="reportError"
          :visible="true"
          :description="reportError"
          :show-retry="true"
          @retry="loadReport"
        />

        <EmptyState
          v-else-if="!reportNews.tw.length && !reportNews.us.length"
          title="今日尚無精選報告，請稍後再試"
          message="每日早上自動更新"
        />

        <div v-else class="report-content">
          <!-- 台灣區塊 -->
          <section v-if="reportNews.tw.length" class="region-section" aria-label="台灣市場動態">
            <div class="region-header">
              <span class="region-flag">
                <Icon name="chart" size="sm" color="var(--iln-hint)" />
              </span>
              <h2 class="region-title">台灣市場動態</h2>
              <span class="region-count tabular">{{ reportNews.tw.length }} 則</span>
            </div>
            <div class="news-list">
              <component
                :is="NewsCard"
                v-for="(item, i) in reportNews.tw"
                :key="'tw-' + i"
                :article="item"
                :is-featured="true"
                @article-click="openArticle"
              />
            </div>
          </section>

          <!-- 國際區塊 -->
          <section v-if="reportNews.us.length" class="region-section" aria-label="國際總經與趨勢">
            <div class="region-header">
              <span class="region-flag">
                <Icon name="chart" size="sm" color="var(--iln-hint)" />
              </span>
              <h2 class="region-title">國際總經與趨勢</h2>
              <span class="region-count tabular">{{ reportNews.us.length }} 則</span>
            </div>
            <div class="news-list">
              <component
                :is="NewsCard"
                v-for="(item, i) in reportNews.us"
                :key="'us-' + i"
                :article="item"
                :is-featured="true"
                @article-click="openArticle"
              />
            </div>
          </section>

          <p class="report-generated tabular">
            <Icon name="clock" size="sm" color="var(--iln-hint)" />
            <span>產生時間：{{ generatedAtDisplay }}</span>
          </p>
        </div>
      </div>

      <!-- ── 新聞池 tab ── -->
      <div v-if="activeTab === 'pool'">
        <div class="pool-header">
          <span v-if="articles.length" class="view-subtitle tabular">
            共 {{ articles.length }} 則
          </span>
        </div>

        <div v-if="articles.length" class="pool-filters" role="group" aria-label="新聞篩選">
          <button
            v-for="filter in poolFilters"
            :key="filter.id"
            type="button"
            :data-testid="`news-filter-${filter.id}`"
            class="pool-filter"
            :class="{ active: activePoolFilter === filter.id }"
            :aria-pressed="activePoolFilter === filter.id"
            @click="activePoolFilter = filter.id"
          >
            <span>{{ filter.label }}</span>
            <span class="filter-count tabular">{{ filterCounts[filter.id] }}</span>
          </button>
        </div>

        <p v-if="articles.length && filteredArticles.length === 0" class="filter-empty">
          目前沒有符合條件的新聞
        </p>

        <LoadingSkeleton v-if="poolLoading" variant="card" :rows="3" />

        <ErrorAlert
          v-else-if="poolError"
          :visible="true"
          :description="poolError"
          :show-retry="true"
          @retry="loadPool"
        />

        <EmptyState
          v-else-if="articles.length === 0"
          title="新聞池目前為空，排程可能尚未執行"
        />

        <div v-else-if="filteredArticles.length" class="news-list pool-list">
          <component
            :is="NewsCard"
            v-for="article in filteredArticles"
            :key="article.id"
            :article="article"
            :show-age-band="true"
            :is-picked="matchFeatured(article, featuredNews)"
            @article-click="openArticle"
          />
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
.view-container {
  padding: 0 0 calc(var(--iln-space-6) + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

/* ── Page header（對齊 AccountView / StrategyConfigEditor） ── */
.page-header {
  padding: var(--iln-space-4) var(--iln-space-4) var(--iln-space-2);
  margin-bottom: var(--iln-space-2);
}
.page-title {
  font-size: var(--iln-font-2xl, 22px);
  font-weight: 800;
  color: var(--iln-text);
  margin: 0 0 var(--iln-space-1);
  line-height: 1.25;
}
.page-subtitle {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin: 0;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-3) var(--iln-space-2);
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-hint);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color var(--iln-duration-base, 200ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-base, 200ms) var(--iln-ease-standard, ease);
  margin-bottom: -1px;
}
.subtab-btn.active {
  color: var(--iln-brand);
  border-bottom-color: var(--iln-brand);
  font-weight: 700;
}
.subtab-btn:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: -2px;
}

/* 精選註記 */
.featured-note {
  padding: 0 var(--iln-space-4);
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-medium, 500);
  color: var(--iln-brand);
  margin: 0 0 var(--iln-space-3);
  line-height: 1.5;
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
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-2);
}

.region-flag {
  display: inline-flex;
  align-items: center;
  font-size: var(--iln-font-md);
}

.region-title {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
  margin: 0;
  flex: 1;
}

.region-count {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.report-generated {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--iln-space-1);
  width: 100%;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  text-align: center;
  margin-top: var(--iln-space-2);
  padding-bottom: var(--iln-space-2);
}

/* ── 新聞池 header 與篩選器 ── */
.pool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--iln-space-4) var(--iln-space-2);
  min-height: 20px;
}

.view-subtitle {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.pool-filters {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
  overflow-x: auto;
  padding: 0 var(--iln-space-4) var(--iln-space-3);
  scrollbar-width: none;
}
.pool-filters::-webkit-scrollbar {
  display: none;
}

.pool-filter {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-1) var(--iln-space-3);
  min-height: 32px;
  border-radius: var(--iln-radius-full, 999px);
  border: 1px solid var(--iln-border-subtle);
  background: var(--iln-surface);
  color: var(--iln-text-muted, var(--iln-hint));
  font-size: var(--iln-font-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}
.pool-filter.active {
  background: var(--iln-brand);
  border-color: var(--iln-brand);
  color: var(--iln-text-on-brand);
}
.pool-filter:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.filter-count {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--iln-radius-full, 999px);
  background: var(--iln-surface-alt, var(--iln-bg));
  color: var(--iln-text);
}
.pool-filter.active .filter-count {
  background: rgba(255, 255, 255, 0.22);
  color: var(--iln-text-on-brand);
}

.filter-empty {
  padding: var(--iln-space-4);
  text-align: center;
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
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

/* ── 新聞列表寬屏兩列（≥1024px）── */
@media (min-width: 1024px) {
  .pool-list.news-list,
  .news-pool .news-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--iln-space-3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .subtab-btn,
  .pool-filter {
    transition: none;
  }
}
</style>
