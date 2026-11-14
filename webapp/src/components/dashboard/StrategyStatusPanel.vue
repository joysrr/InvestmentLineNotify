<template>
  <ContentCard variant="outlined" padding="lg" radius="lg">
    <div class="section-header">
      <h3 class="section-title">策略狀態面板</h3>
      <p class="section-subtitle">分數構成、冷卻期、檔位、風控與預度</p>
    </div>

    <div v-if="loading" class="skeleton-list">
      <div class="sk sk-hero" style="height: 100px; margin-bottom: 16px"></div>
      <div class="sk-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div v-for="i in 6" :key="i" class="sk" style="height: 100px"></div>
      </div>
    </div>
    <div v-else-if="error" class="inline-error">
      <Icon name="danger" size="sm" color="var(--iln-danger)" /> {{ error }}
    </div>
    <div v-else-if="!health" class="inline-hint">
      <Icon name="neutral" size="sm" color="var(--iln-hint)" /> 尚無策略狀態資料
    </div>
    <div v-else class="panel-content">
      <!-- Segmented Control Tabs -->
      <div class="segmented-control">
        <button
          class="segmented-btn"
          :class="{ active: activeTab === 'scores' }"
          @click="activeTab = 'scores'"
        >
          <Icon name="chart" size="sm" color="var(--iln-text)" /> 評分與檔位
        </button>
        <button
          class="segmented-btn"
          :class="{ active: activeTab === 'risk' }"
          @click="activeTab = 'risk'"
        >
          <Icon name="shield" size="sm" color="var(--iln-brand)" /> 風控與機制
        </button>
      </div>

      <!-- TAB: 評分與檔位 -->
      <div v-show="activeTab === 'scores'" class="tab-panel">
        <section class="status-section">
          <div class="section-header">
            <h3 class="section-title"><Icon name="chart" size="sm" color="var(--iln-text)" /> 策略分數構成</h3>
            <span class="section-badge">{{ health.weightScore?.total ?? 0 }}pt</span>
          </div>
          <div class="score-value">{{ health.weightScore?.total ?? 0 }}</div>
        </section>
      </div>

      <!-- TAB: 風控與機制 -->
      <div v-show="activeTab === 'risk'" class="tab-panel">
        <section class="status-section">
          <div class="section-header">
            <h3 class="section-title"><Icon name="shield" size="sm" color="var(--iln-hint)" /> 冷卻期狀態</h3>
            <span class="section-badge">{{ cooldownText }}</span>
          </div>
        </section>
      </div>

      <div class="panel-updated" v-if="health.timestamp">
        更新：{{ formatTime(health.timestamp) }}
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import { computed, ref } from "vue";
import { Icon } from "@/components/common/Icon.vue";

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

const formatTime = (ts) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
</script>
