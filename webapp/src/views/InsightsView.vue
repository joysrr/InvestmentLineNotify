<template>
  <div class="insights-view iln-page">
    <header class="page-header insights-header">
      <div>
        <h2 class="page-title">市場洞察</h2>
        <span class="page-subtitle">雷達訊號與總經多空</span>
      </div>
    </header>

    <!-- 單一 Segmented Control 主導航 -->
    <div class="insights-segmented">
      <SegmentedControl
        :modelValue="activeTab"
        :options="insightOptions"
        size="md"
        aria-label="切換市場洞察子頁面"
        @change="goToTab"
      />
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
</style>
