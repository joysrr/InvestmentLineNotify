<template>
  <ContentCard
    variant="outlined"
    padding="md"
    radius="lg"
    @click="emit('click')"
  >
    <div class="section-header">
      <h3 class="section-title">策略狀態摘要</h3>
    </div>

    <div v-if="loading" class="skeleton-list">
      <div class="sk sk-hero" style="height: 80px; margin-bottom: 12px"></div>
    </div>
    <div v-else-if="error" class="inline-error">
      <Icon name="danger" size="sm" color="var(--iln-viz-bear)" /> {{ error }}
    </div>
    <div v-else-if="!health" class="inline-hint">
      <Icon name="info" size="sm" color="var(--iln-hint)" /> 尚無策略狀態資料
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
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import { computed } from "vue";
import Icon from "@/components/common/Icon.vue";

const emit = defineEmits(["click"]);

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

const formatTime = (ts) => formatDateTimeInTaipei(ts);
</script>

<style scoped>
/* 摘要內容容器 */
.status-summary-content {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
}

/* 摘要網格 */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--iln-space-4);
}

/* 摘要卡片 */
.summary-card {
  background: var(--iln-surface);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-4);
  box-shadow: var(--iln-shadow-1);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-1);
}

/* 標籤標題 */
.summary-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

/* 分數顯示 */
.summary-value {
  font-size: var(--iln-font-lg);
  font-weight: var(--iln-weight-bold);
  color: var(--iln-text);
}

/* 更新時間 */
.summary-updated {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
  margin-top: var(--iln-space-2);
}

/* 行內錯誤 */
.inline-error {
  font-size: var(--iln-font-sm);
  color: var(--iln-viz-bear-text);
  display: flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-3);
}

/* 行內提示 */
.inline-hint {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  display: flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-3);
}

/* 分區標題 */
.section-header {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-4);
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-medium);
  color: var(--iln-text);
}
</style>
