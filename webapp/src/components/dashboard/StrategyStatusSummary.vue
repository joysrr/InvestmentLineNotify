<template>
  <ContentCard
    variant="outlined"
    padding="md"
    radius="lg"
    clickable
    @click="emit('click')"
  >
    <div v-if="loading" class="skeleton-list" aria-busy="true">
      <div class="sk sk-hero"></div>
    </div>
    <div v-else-if="error" class="inline-error">
      <Icon name="danger" size="sm" color="var(--iln-viz-bear)" /> <span>{{ error }}</span>
    </div>
    <div v-else-if="!health" class="inline-hint">
      <Icon name="info" size="sm" color="var(--iln-hint)" /> <span>尚無策略狀態資料</span>
    </div>
    <div v-else class="status-summary-content">
      <div class="summary-main">
        <div class="summary-title-row">
          <h3 class="section-title">策略狀態摘要</h3>
          <span class="summary-pill tabular">總分 {{ health.weightScore?.total ?? 0 }}</span>
          <span class="summary-pill tabular">{{ cooldownText }}</span>
        </div>
        <div class="summary-updated tabular" v-if="health.timestamp">
          更新：{{ formatTime(health.timestamp) }}
        </div>
      </div>
      <div class="summary-action">
        <span>檢視</span>
        <Icon name="arrow-right" size="sm" color="var(--iln-brand)" />
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import { formatDateTimeInTaipei } from "@/utils/formatDate.js";
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
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
.tabular {
  font-variant-numeric: tabular-nums;
}

.status-summary-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-3);
}

.summary-main {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-1);
  min-width: 0;
}

.summary-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--iln-space-2);
}

.section-title {
  margin: 0;
  font-size: var(--iln-font-sm);
  font-weight: 700;
  color: var(--iln-text);
}

.summary-pill {
  font-size: var(--iln-font-xs);
  font-weight: 600;
  color: var(--iln-text);
  background: var(--iln-surface-alt);
  padding: 2px var(--iln-space-2);
  border-radius: var(--iln-radius-full);
}

.summary-updated {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.summary-action {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--iln-font-xs);
  font-weight: 700;
  color: var(--iln-brand);
  flex-shrink: 0;
}

.inline-error {
  font-size: var(--iln-font-sm);
  color: var(--iln-viz-bear-text);
  display: flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-2);
}

.inline-hint {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  display: flex;
  align-items: center;
  gap: var(--iln-space-1);
  padding: var(--iln-space-2);
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}

.sk-hero {
  height: 44px;
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface);
}
</style>
