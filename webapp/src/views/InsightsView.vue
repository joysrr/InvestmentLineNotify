<template>
  <div class="insights-view iln-page">
    <div class="page-header insights-header">
      <div>
        <h2 class="page-title">市場洞察</h2>
        <span class="page-subtitle">雷達訊號與總經多空</span>
      </div>
    </div>

    <!-- P2-1：頂部 Segmented Control 取代雙入口卡片作為主導航 -->
    <div class="insights-segmented">
      <SegmentedControl
        :modelValue="activeTab"
        :options="insightOptions"
        size="md"
        aria-label="切換市場洞察子頁面"
        @change="goToTab"
      />
    </div>

    <!-- 入口卡片保留但標記為次要（P2-1） -->
    <div class="insights-entry-cards insights-entry-cards--secondary">
      <div
        class="entry-card entry-card--radar entry-card--secondary"
        role="button"
        tabindex="0"
        @click="goToTab('radar')"
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
        role="button"
        tabindex="0"
        @click="goToTab('macro')"
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
import { useSmartMainButton } from "@/composables/useSmartMainButton.js";

const route = useRoute();
const router = useRouter();

// 智慧 MainButton（依路由顯示不同文字/導向，點擊觸覺回饋）
useSmartMainButton();

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
  gap: var(--iln-space-4);
  flex-wrap: wrap;
}

.entry-card {
  flex: 1 1 calc(50% - var(--iln-space-2));
  min-height: var(--iln-space-8);
  padding: var(--iln-space-5);
  border: 1px solid var(--iln-border-default);
  border-radius: var(--iln-radius-lg);
  background: var(--iln-surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
  transition: transform var(--iln-duration-fast) var(--iln-ease-standard);
}

.entry-card:active {
  transform: scale(0.985);
}

.entry-card-header {
  display: flex;
  align-items: center;
  gap: var(--iln-space-3);
}

.entry-card-title {
  font-size: var(--iln-font-lg);
  font-weight: var(--iln-weight-semibold);
  color: var(--iln-text);
}

.entry-card-desc {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

/* 次要入口卡片：尺寸縮小、淡化（P2-1） */
.entry-card--secondary {
  min-height: var(--iln-space-7);
  padding: var(--iln-space-4);
  border-color: var(--iln-border-subtle);
  opacity: 0.85;
}
.entry-card--secondary .entry-card-title {
  font-size: var(--iln-font-base);
  color: var(--iln-text);
}
.entry-card--secondary .entry-card-desc {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

.insights-panel {
  flex: 1;
}
</style>
