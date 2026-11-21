<template>
  <GlobalErrorBoundary>
    <div class="view-container iln-page">
      <!-- ── Header ── -->
      <header class="page-header">
        <div class="page-header-top">
          <div>
            <h1 class="page-title">新聞資訊</h1>
            <p class="page-subtitle">每日精選報告 ＆ 新聞池</p>
          </div>
          <button
            type="button"
            class="refresh-btn"
            :disabled="isCurrentTabLoading"
            @click="refreshCurrentTab"
          >
            {{ isCurrentTabLoading ? "更新中..." : "重新整理" }}
          </button>
        </div>
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
          <span v-if="vm.totalFeaturedCount" class="subtab-badge tabular">
            {{ vm.totalFeaturedCount }}
          </span>
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
          <span v-if="vm.totalPoolCount" class="subtab-badge tabular">
            {{ vm.totalPoolCount }}
          </span>
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
          @retry="loadReport(true)"
        />

        <EmptyState
          v-else-if="!vm.hasReportNews"
          title="今日尚無精選報告，請稍後再試"
          message="每日早上自動更新"
        />

        <div v-else class="report-content">
          <!-- 台灣區塊 -->
          <section v-if="vm.twItems.length" class="region-section" aria-label="台灣市場動態">
            <div class="region-header">
              <span class="region-flag">
                <Icon name="chart" size="sm" color="var(--iln-hint)" />
              </span>
              <h2 class="region-title">台灣市場動態</h2>
              <span class="region-count tabular">{{ vm.twItems.length }} 則</span>
            </div>
            <div class="news-list">
              <component
                :is="NewsCard"
                v-for="(item, i) in vm.twItems"
                :key="'tw-' + i"
                :article="item"
                :is-featured="true"
                @article-click="openArticle"
              />
            </div>
          </section>

          <!-- 國際區塊 -->
          <section v-if="vm.usItems.length" class="region-section" aria-label="國際總經與趨勢">
            <div class="region-header">
              <span class="region-flag">
                <Icon name="chart" size="sm" color="var(--iln-hint)" />
              </span>
              <h2 class="region-title">國際總經與趨勢</h2>
              <span class="region-count tabular">{{ vm.usItems.length }} 則</span>
            </div>
            <div class="news-list">
              <component
                :is="NewsCard"
                v-for="(item, i) in vm.usItems"
                :key="'us-' + i"
                :article="item"
                :is-featured="true"
                @article-click="openArticle"
              />
            </div>
          </section>

          <p class="report-generated tabular">
            <Icon name="clock" size="sm" color="var(--iln-hint)" />
            <span>產生時間：{{ vm.generatedAtDisplay }}</span>
          </p>
        </div>
      </div>

      <!-- ── 新聞池 tab ── -->
      <div v-if="activeTab === 'pool'">
        <LoadingSkeleton v-if="poolLoading && !vm.totalPoolCount" variant="card" :rows="3" />

        <ErrorAlert
          v-else-if="poolError && !vm.totalPoolCount"
          :visible="true"
          :description="poolError"
          :show-retry="true"
          @retry="loadPool(true)"
        />

        <EmptyState
          v-else-if="!vm.totalPoolCount"
          title="新聞池目前為空，排程可能尚未執行"
        />

        <template v-else>
          <div class="pool-toolbar">
            <div class="pool-header">
              <span class="view-subtitle tabular">
                顯示 {{ vm.filteredItems.length }} / {{ vm.totalPoolCount }} 則
              </span>
              <button
                v-if="vm.hasActiveSearchOrFilter"
                type="button"
                class="reset-filter-btn"
                @click="resetPoolFilters"
              >
                清除篩選
              </button>
            </div>

            <div class="pool-search-wrap">
              <input
                v-model="searchQuery"
                type="search"
                class="pool-search-input"
                placeholder="搜尋標題、來源或摘要..."
                aria-label="搜尋新聞"
              />
            </div>

            <div class="pool-filters" role="group" aria-label="新聞篩選">
              <button
                v-for="filter in POOL_FILTERS"
                :key="filter.id"
                type="button"
                :data-testid="`news-filter-${filter.id}`"
                class="pool-filter"
                :class="{ active: activePoolFilter === filter.id }"
                :aria-pressed="activePoolFilter === filter.id"
                @click="setPoolFilter(filter.id)"
              >
                <span>{{ filter.label }}</span>
                <span class="filter-count tabular">{{ vm.filterCounts[filter.id] }}</span>
              </button>
            </div>
          </div>

          <div v-if="vm.filteredItems.length === 0" class="filter-empty-box">
            <p class="filter-empty">目前沒有符合條件的新聞</p>
            <button type="button" class="reset-filter-btn" @click="resetPoolFilters">
              重設條件
            </button>
          </div>

          <div v-else class="news-list pool-list">
            <component
              :is="NewsCard"
              v-for="entry in vm.filteredItems"
              :key="entry.article.id || entry.article.link || entry.article.url"
              :article="entry.article"
              :show-age-band="true"
              :is-picked="entry.isFeatured"
              @article-click="openArticle"
            />
          </div>
        </template>
      </div>
    </div>
  </GlobalErrorBoundary>
</template>

<script setup>
import { computed, onMounted } from "vue";
import NewsCard from "@/components/dashboard/NewsCard.vue";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";
import ErrorAlert from "@/components/common/ErrorAlert.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import LoadingSkeleton from "@/components/common/LoadingSkeleton.vue";
import { useTelegram, waitReady } from "../composables/useTelegram.js";
import { POOL_FILTERS, useNewsViewModel } from "../composables/useNewsViewModel.js";

const {
  activeTab,
  reportLoading,
  reportError,
  activePoolFilter,
  searchQuery,
  poolLoading,
  poolError,
  vm,
  loadReport,
  loadPool,
  refreshCurrentTab,
  switchTab,
  setPoolFilter,
  resetPoolFilters,
} = useNewsViewModel();

const isCurrentTabLoading = computed(() =>
  activeTab.value === "report" ? reportLoading.value : poolLoading.value,
);

const { openLink } = useTelegram();

function openArticle(article) {
  if (article) openLink(article.link || article.url);
}

onMounted(async () => {
  await waitReady();
  loadReport();
});
</script>

<style scoped>
.view-container {
  padding: 0 0 calc(var(--bottom-nav-height, 88px) + env(safe-area-inset-bottom, 0px));
  min-height: 100%;
}

.tabular {
  font-variant-numeric: tabular-nums;
}

/* ── Page header ── */
.page-header {
  padding: var(--iln-space-4) var(--iln-space-4) var(--iln-space-2);
  margin-bottom: var(--iln-space-2);
}
.page-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-3);
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
.refresh-btn {
  padding: 7px 12px;
  border-radius: var(--iln-radius-md, 10px);
  border: 1px solid var(--iln-border-subtle);
  background: var(--iln-surface);
  color: var(--iln-text);
  font-size: var(--iln-font-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.refresh-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
.subtab-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--iln-radius-full, 999px);
  background: var(--iln-surface-alt, var(--iln-surface));
  color: var(--iln-hint);
}
.subtab-btn.active .subtab-badge {
  background: rgba(59, 130, 246, 0.14);
  color: var(--iln-brand);
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

/* ── 新聞池 header、搜尋與篩選器 ── */
.pool-toolbar {
  margin-bottom: var(--iln-space-1);
}

.pool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--iln-space-4) var(--iln-space-2);
  min-height: 24px;
}

.view-subtitle {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.reset-filter-btn {
  padding: 2px 8px;
  border-radius: var(--iln-radius-full, 999px);
  border: 1px solid var(--iln-border-subtle);
  background: var(--iln-surface);
  color: var(--iln-brand);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.pool-search-wrap {
  padding: 0 var(--iln-space-4) var(--iln-space-2);
}

.pool-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: var(--iln-radius-md, 10px);
  border: 1px solid var(--iln-border-subtle);
  background: var(--iln-surface);
  color: var(--iln-text);
  font-size: var(--iln-font-sm);
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

.filter-empty-box {
  padding: var(--iln-space-4);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--iln-space-2);
}

.filter-empty {
  margin: 0;
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
