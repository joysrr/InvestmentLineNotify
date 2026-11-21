<template>
  <ContentCard variant="outlined" size="lg">
    <div class="panel-header">
      <h3 class="panel-title">策略狀態面板</h3>
      <p class="panel-subtitle">分數構成、冷卻期、檔位、風控與預度</p>
    </div>

    <div v-if="loading" class="skeleton-list" aria-busy="true">
      <div class="sk sk-hero"></div>
      <div class="sk-grid">
        <div v-for="i in 6" :key="i" class="sk sk-cell"></div>
      </div>
    </div>
    <div v-else-if="error" class="inline-error">
      <Icon name="danger" size="sm" color="var(--iln-viz-bear)" /> <span>{{ error }}</span>
    </div>
    <div v-else-if="!health" class="inline-hint">
      <Icon name="info" size="sm" color="var(--iln-hint)" /> <span>尚無策略狀態資料</span>
    </div>
    <div v-else class="panel-content">
      <!-- Segmented Control Tabs -->
      <div class="segmented-control" role="tablist" aria-label="策略狀態分頁">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'scores'"
          class="segmented-btn"
          :class="{ active: activeTab === 'scores' }"
          @click="activeTab = 'scores'"
        >
          <Icon name="chart" size="sm" color="currentColor" /> <span>評分與檔位</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === 'risk'"
          class="segmented-btn"
          :class="{ active: activeTab === 'risk' }"
          @click="activeTab = 'risk'"
        >
          <Icon name="shield" size="sm" color="currentColor" /> <span>風控與機制</span>
        </button>
      </div>

      <!-- TAB: 評分與檔位 -->
      <div v-show="activeTab === 'scores'" class="tab-panel">
        <section class="status-section">
          <div class="section-header">
            <h4 class="section-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> <span>策略分數構成</span></h4>
            <span class="section-badge tabular">{{ health.weightScore?.total ?? 0 }}pt</span>
          </div>
          <div class="score-value tabular">{{ health.weightScore?.total ?? 0 }}</div>
        </section>
      </div>

      <!-- TAB: 風控與機制 -->
      <div v-show="activeTab === 'risk'" class="tab-panel">
        <section class="status-section">
          <div class="section-header">
            <h4 class="section-title"><Icon name="shield" size="sm" color="var(--iln-hint)" /> <span>冷卻期狀態</span></h4>
            <span class="section-badge tabular">{{ cooldownText }}</span>
          </div>
        </section>
      </div>

      <div class="panel-updated tabular" v-if="health.timestamp">
        更新：{{ formatTime(health.timestamp) }}
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import { computed, ref } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  health: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
});

const activeTab = ref("scores");

const cooldownText = computed(() => {
  if (!props.health) return "—";
  const c = props.health.cooldown;
  if (c?.inCooldown) return `剩餘 ${c.daysLeft ?? 0} 天`;
  return "無冷卻期";
});

const formatTime = (ts) => formatDateTimeInTaipei(ts);
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.panel-header {
  margin-bottom: var(--iln-space-3);
}

.panel-title {
  margin: 0;
  font-size: var(--iln-font-md);
  font-weight: 700;
  color: var(--iln-text);
}

.panel-subtitle {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin: var(--iln-space-1) 0 0;
}

.status-section {
  margin-bottom: var(--iln-space-4);
}

.status-section:last-child {
  margin-bottom: 0;
}

.tab-panel {
  padding: var(--iln-space-4);
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
}

.score-value {
  font-size: var(--iln-font-xl);
  font-weight: var(--iln-weight-bold);
  color: var(--iln-text);
}

.section-badge {
  font-size: var(--iln-font-xs);
  padding: 2px var(--iln-space-2);
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface-alt);
  color: var(--iln-hint);
}

.segmented-control {
  display: inline-flex;
  align-self: flex-start;
  gap: var(--iln-space-1);
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: 2px;
}

.segmented-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-1-5, 6px) var(--iln-space-3);
  border: none;
  border-radius: var(--iln-radius-sm);
  background: transparent;
  color: var(--iln-hint);
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-medium);
  cursor: pointer;
}

.segmented-btn.active {
  background: var(--iln-bg);
  color: var(--iln-brand);
  font-weight: var(--iln-weight-semibold);
  box-shadow: var(--iln-shadow-1);
}

.segmented-btn:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
}

.sk {
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface);
}

.sk-hero {
  height: 100px;
}

.sk-cell {
  height: 100px;
}

.sk-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--iln-space-4);
}

.inline-error {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  color: var(--iln-viz-bear-text);
}

.inline-hint {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.panel-updated {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-top: var(--iln-space-3);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-3);
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  margin: 0;
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-semibold);
  color: var(--iln-text);
}
</style>
