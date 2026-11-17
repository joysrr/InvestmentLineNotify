<template>
  <div class="insights-view iln-page">
    <div class="page-header insights-header">
      <div>
        <h2 class="page-title">市場洞察</h2>
        <span class="page-subtitle">雷達訊號與總經多空</span>
      </div>
      <SegmentedControl
        v-model="activeTab"
        :options="tabOptions"
        aria-label="洞察子頁切換"
        @change="onTabChange"
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
import SegmentedControl from "../components/common/SegmentedControl.vue";
import MarketRadarView from "./MarketRadarView.vue";
import MacroBattleView from "./MacroBattleView.vue";

const route = useRoute();
const router = useRouter();

const tabOptions = [
  { value: "radar", label: "市場雷達", icon: "radar" },
  { value: "macro", label: "多空對決", icon: "gauge" },
];

const activeTab = computed(() => (route.query.tab === "macro" ? "macro" : "radar"));

const onTabChange = (val) => {
  router.replace({ query: { ...route.query, tab: val } });
};
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

.insights-panel {
  flex: 1;
}
</style>
