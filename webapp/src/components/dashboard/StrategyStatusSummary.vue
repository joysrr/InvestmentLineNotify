<template>
  <ContentCard variant="outlined" padding="lg" radius="lg">
    <div class="section-header">
      <h3 class="section-title">策略狀態摘要</h3>
    </div>

    <div v-if="loading" class="skeleton-list">
      <div class="sk sk-hero" style="height: 80px; margin-bottom: 12px"></div>
      <div class="sk-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div v-for="i in 4" :key="i" class="sk" style="height: 70px"></div>
      </div>
    </div>
    <div v-else-if="error" class="inline-error">
      <Icon name="danger" size="sm" color="var(--iln-danger)" /> {{ error }}
    </div>
    <div v-else-if="!health" class="inline-hint">
      <Icon name="neutral" size="sm" color="var(--iln-hint)" /> 尚無策略狀態資料
    </div>
    <div v-else class="status-summary-content">
      <div class="summary-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px">
        <div class="summary-card">
          <div class="summary-label">策略總分</div>
          <div class="summary-value">{{ health.weightScore?.total ?? 0 }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">冷卻期</div>
          <div class="summary-value">{{ cooldownText }}</div>
        </div>
      </div>
      <div class="summary-updated" v-if="health.timestamp">
        更新：{{ formatTime(health.timestamp) }}
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import { Icon } from "@/components/common/Icon.vue";

const props = defineProps({
  health: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
});

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
