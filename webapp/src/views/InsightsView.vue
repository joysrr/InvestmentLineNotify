<template>
  <div class="insights-view iln-page">
    <header class="page-header insights-header">
      <div>
        <h2 class="page-title">市場洞察</h2>
        <span class="page-subtitle">雷達訊號與總經多空</span>
      </div>
    </header>

    <!-- 頂部 Segmented Control 主導航 -->
    <div class="insights-segmented">
      <SegmentedControl
        :modelValue="activeTab"
        :options="insightOptions"
        size="md"
        aria-label="切換市場洞察子頁面"
        @change="goToTab"
      />
    </div>

    <!-- 次要快速入口卡片（與 SegmentedControl 同步狀態） -->
    <div class="insights-entry-cards insights-entry-cards--secondary" role="group" aria-label="快速切換洞察視圖">
      <div
        class="entry-card entry-card--radar entry-card--secondary"
        :class="{ 'entry-card--active': activeTab === 'radar' }"
        role="button"
        tabindex="0"
        :aria-pressed="activeTab === 'radar'"
        @click="goToTab('radar')"
        @keydown.enter.prevent="goToTab('radar')"
        @keydown.space.prevent="goToTab('radar')"
        :aria-label="'快速進入市場雷達：' + radarDesc"
      >
        <div class="entry-card-header">
          <Icon name="radar" size="sm" color="var(--iln-brand)" />
          <span class="entry-card-title">市場雷達</span>
        </div>
        <div class="entry-card-desc">{{ radarDesc }}</div>
      </div>

      <div
        class="entry-card entry-card--macro entry-card--secondary"
        :class="{ 'entry-card--active': activeTab === 'macro' }"
        role="button"
        tabindex="0"
        :aria-pressed="activeTab === 'macro'"
        @click="goToTab('macro')"
        @keydown.enter.prevent="goToTab('macro')"
        @keydown.space.prevent="goToTab('macro')"
        :aria-label="'快速進入多空對決：' + macroDesc"
      >
        <div class="entry-card-header">
          <Icon name="gauge" size="sm" color="var(--iln-brand)" />
          <span class="entry-card-title">多空對決</span>
        </div>
        <div class="entry-card-desc">{{ macroDesc }}</div>
      </div>
    </div>

    <div class="insights-panel">
      <MarketRadarView v-if="activeTab === 'radar'" />
      <MacroBattleView v-else />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import SegmentedControl from "@/components/common/SegmentedControl.vue";
import Icon from "@/components/common/Icon.vue";
import MarketRadarView from "./MarketRadarView.vue";
import MacroBattleView from "./MacroBattleView.vue";

const route = useRoute();
const router = useRouter();

const activeTab = computed(() => (route.query.tab === "macro" ? "macro" : "radar"));

const insightOptions = [
  {
    value: "radar",
    label: "市場雷達",
    testId: "insights-tab-radar",
    icon: "radar",
  },
  {
    value: "macro",
    label: "多空對決",
    testId: "insights-tab-macro",
    icon: "gauge",
  },
];

const goToTab = (tab) => {
  router.replace({ query: { ...route.query, tab } });
};

const radarDesc = "總經環境、VIX、PB/PR、燈號訊號";
const macroDesc = "多空積分、核心驅動、事件分析";
</script>

<style scoped>
.insights-view {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-4);
  padding-bottom: calc(var(--iln-space-6) + env(safe-area-inset-bottom, 0px));
}

.insights-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--iln-space-3);
  flex-wrap: wrap;
  margin-bottom: 0;
}

.insights-segmented {
  width: 100%;
}

.insights-entry-cards {
  display: flex;
  gap: var(--iln-space-3);
  flex-wrap: wrap;
}

.entry-card {
  flex: 1 1 calc(50% - var(--iln-space-2));
  min-width: 140px;
  min-height: var(--iln-space-8);
  padding: var(--iln-space-5);
  border: 1px solid var(--iln-border-default, var(--iln-border-subtle));
  border-radius: var(--iln-radius-lg);
  background: var(--iln-surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
  transition:
    transform var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    border-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease),
    background var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.entry-card:hover {
  border-color: var(--iln-brand);
}

.entry-card:active {
  transform: scale(0.985);
}

.entry-card:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.entry-card-header {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
}

.entry-card-title {
  font-size: var(--iln-font-lg);
  font-weight: var(--iln-weight-semibold, 600);
  color: var(--iln-text);
}

.entry-card-desc {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  line-height: 1.4;
}

/* 次要入口卡片：尺寸收斂、與目前選中分頁連動 */
.entry-card--secondary {
  min-height: var(--iln-space-7);
  padding: var(--iln-space-3) var(--iln-space-4);
  border-color: var(--iln-border-subtle);
  opacity: 0.85;
}

.entry-card--secondary.entry-card--active {
  opacity: 1;
  border-color: var(--iln-brand);
  background: var(--iln-brand-soft);
}

.entry-card--secondary .entry-card-title {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
}

.entry-card--secondary.entry-card--active .entry-card-title {
  color: var(--iln-brand);
}

.entry-card--secondary .entry-card-desc {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.insights-panel {
  flex: 1;
  min-width: 0;
}

/* 內嵌子視圖時收斂重複的外層容器留白 */
.insights-panel :deep(.view-container) {
  padding-left: 0;
  padding-right: 0;
  padding-bottom: 0;
  min-height: auto;
}

@media (prefers-reduced-motion: reduce) {
  .entry-card {
    transition: none;
  }
  .entry-card:active {
    transform: none;
  }
}
</style>
