<template>
  <div class="insights-view">
    <SubTabBar
      :tabs="tabs"
      :active-tab="activeTabLabel"
      @tab-change="onTabChange"
    />
    <div class="insights-panel">
      <MarketRadarView v-if="activeTabLabel === '市場雷達'" />
      <MacroBattleView v-else />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import SubTabBar from "../components/common/SubTabBar.vue";
import MarketRadarView from "./MarketRadarView.vue";
import MacroBattleView from "./MacroBattleView.vue";

const route = useRoute();
const router = useRouter();

const tabs = [
  { label: "市場雷達", query: { tab: "radar" } },
  { label: "多空對決", query: { tab: "macro" } },
];

const activeTabLabel = computed(() => {
  const tab = route.query.tab;
  return tab === "macro" ? "多空對決" : "市場雷達";
});

const onTabChange = (label) => {
  const query = label === "多空對決" ? { tab: "macro" } : { tab: "radar" };
  router.replace({ query });
};
</script>

<style scoped>
.insights-view {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}

.insights-panel {
  flex: 1;
}
</style>
