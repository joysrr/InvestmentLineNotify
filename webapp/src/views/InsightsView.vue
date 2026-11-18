<template>
  <div class="insights-view iln-page">
    <div class="page-header insights-header">
      <div>
        <h2 class="page-title">市場洞察</h2>
        <span class="page-subtitle">雷達訊號與總經多空</span>
      </div>
      <!-- 雙入口卡片：市場雷達 / 多空對決（取代頂部 SegmentedControl） -->
      <div class="insights-entry-cards">
        <div
          class="entry-card entry-card--radar"
          role="button"
          tabindex="0"
          @click="goToTab('radar')"
        >
          <div class="entry-card-header">
            <Icon name="radar" size="md" color="var(--iln-brand)" />
            <span class="entry-card-title">市場雷達</span>
          </div>
          <div class="entry-card-desc">總經環境、VIX、PB/PR、燈號訊號</div>
        </div>
        <div
          class="entry-card entry-card--macro"
          role="button"
          tabindex="0"
          @click="goToTab('macro')"
        >
          <div class="entry-card-header">
            <Icon name="gauge" size="md" color="var(--iln-brand)" />
            <span class="entry-card-title">多空對決</span>
          </div>
          <div class="entry-card-desc">多空積分、核心驅動、事件分析</div>
        </div>
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
import Icon from "@/components/common/Icon.vue";
import MarketRadarView from "./MarketRadarView.vue";
import MacroBattleView from "./MacroBattleView.vue";

const route = useRoute();
const router = useRouter();

const activeTab = computed(() => (route.query.tab === "macro" ? "macro" : "radar"));

const goToTab = (tab) => {
  router.replace({ query: { ...route.query, tab } });
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

/* 雙入口卡片佈局（取代 SegmentedControl） */
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

.insights-panel {
  flex: 1;
}
</style>
