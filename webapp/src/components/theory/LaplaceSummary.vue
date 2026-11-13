<template>
  <div class="theory-card">
    <div class="theory-card-header">
      <h3 class="theory-card-title"><Icon name="neutral" size="sm" color="var(--iln-hint)" /> 拉普拉斯準則 (Laplace)</h3>
      <span
        class="theory-status-badge"
        :class="`status-${theory.laplaceCriterion?.status?.toLowerCase()}`"
      >
        {{ theory.laplaceCriterion?.status }}
      </span>
    </div>

    <!-- UNAVAILABLE State -->
    <div v-if="!theory || !theory.laplaceCriterion" class="theory-unavailable">
      <p><Icon name="warn" size="sm" color="var(--iln-warn)" /> 理論數據未計算</p>
      <span class="theory-hint">非交易日或壓力情境數據不足</span>
    </div>

    <!-- AVAILABLE State -->
    <div v-else class="theory-card-content">
      <div v-if="theory.laplaceCriterion.status === 'UNAVAILABLE'" class="theory-unavailable">
        <p><Icon name="warn" size="sm" color="var(--iln-warn)" /> 拉普拉斯數據不可用</p>
        <span class="theory-hint">{{ theory.laplaceCriterion.reason }}</span>
      </div>

      <div v-else class="theory-card-content">
        <!-- Minimax Loss -->
        <div class="exposure-row">
          <span class="exposure-label">最小最大損失</span>
          <span class="exposure-value">{{ formatPercent(minimaxLoss) }}</span>
        </div>

        <!-- Worst Scenario -->
        <div class="exposure-row">
          <span class="exposure-label">最壞情境</span>
          <span class="exposure-value">{{ worstScenario }}</span>
        </div>

        <!-- Status Badge -->
        <div class="status-badge" :class="statusClass">
          {{ theory.laplaceCriterion.status }}
        </div>

        <!-- View Detail Button -->
        <button class="view-detail-btn" @click="$emit('view-detail')">          <Icon name="neutral" size="sm" color="var(--iln-hint)" /> 查看詳情
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  theory: { type: Object, required: true },
});

const minimaxLoss = computed(() => props.theory.laplaceCriterion?.minimaxLoss ?? 0);
const worstScenario = computed(() => props.theory.laplaceCriterion?.worstScenario ?? "—");
const statusClass = computed(() => {
  const status = props.theory.laplaceCriterion?.status;
  if (status === "OK") return "status-ok";
  if (status === "ESTIMATED") return "status-estimated";
  return "status-unavailable";
});

function formatPercent(value) {
  if (value == null) return "—";
  return (value * 100).toFixed(0) + "%";
}
</script>

<style scoped>
.theory-card {
  border: 1px solid var(--tg-theme-border-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
}

.theory-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.theory-card-title {
  margin: 0;
  font-size: 16px;
  color: var(--tg-theme-text-color);
}

.theory-unavailable {
  padding: 12px;
  background: rgba(128, 128, 128, 0.1);
  border: 1px dashed var(--tg-theme-border-color);
  border-radius: 6px;
  color: var(--tg-theme-text-color);
  font-size: 14px;
}

.theory-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.7;
}

.theory-card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exposure-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.exposure-label {
  color: var(--tg-theme-text-color);
  opacity: 0.7;
}

.exposure-value {
  font-weight: 600;
  color: var(--tg-theme-text-color);
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 8px;
  align-self: flex-start;
}

.status-ok {
  background: rgba(76, 175, 80, 0.1);
  color: var(--tg-theme-text-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.status-estimated {
  background: rgba(255, 152, 0, 0.1);
  color: var(--tg-theme-text-color);
  border: 1px solid rgba(255, 152, 0, 0.3);
}

.status-unavailable {
  background: rgba(158, 158, 158, 0.1);
  color: var(--tg-theme-text-color);
  border: 1px solid rgba(158, 158, 158, 0.3);
}

.view-detail-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--tg-theme-button-bg);
  color: var(--tg-theme-button-text);
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  align-self: flex-start;
}

.view-detail-btn:hover {
  opacity: 0.9;
}
</style>
