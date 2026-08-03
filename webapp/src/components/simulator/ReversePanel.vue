<template>
  <div class="reverse-panel">
    <!-- Target Selector -->
    <TargetSelector
      :model-value="targetType"
      @update:model-value="$emit('update:targetType', $event)"
      :target-types="targetTypes"
    />

    <!-- Target Input -->
    <TargetInput
      :target-type="targetType"
      :target-value="targetValue"
      :target-direction="targetDirection"
      :target-status="targetStatus"
      @update:targetValue="$emit('update:targetValue', $event)"
      @update:targetDirection="$emit('update:targetDirection', $event)"
      @update:targetStatus="$emit('update:targetStatus', $event)"
    />

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button
        class="btn btn-primary btn-lg"
        :disabled="loading || !canRun"
        @click="$emit('run')"
      >
        <span v-if="loading" class="btn-spinner"></span>
        <span v-else>反向推導</span>
      </button>
      <button
        class="btn btn-secondary"
        :disabled="loading"
        @click="$emit('clear')"
      >
        清除結果
      </button>
    </div>

    <!-- Result -->
    <div v-if="result" class="result-section">
      <ReverseResultCard :result="result" />
    </div>

    <!-- Error -->
    <div v-if="error && !result" class="error-banner">
      {{ error }}
    </div>

    <!-- Loading Skeleton -->
    <LoadingSkeleton v-if="loading" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import TargetSelector from "./TargetSelector.vue";
import TargetInput from "./TargetInput.vue";
import ReverseResultCard from "./ReverseResultCard.vue";
import LoadingSkeleton from "./Common/LoadingSkeleton.vue";

const props = defineProps({
  targetType: { type: String, default: "maintenanceRatio" },
  targetValue: { type: [Number, String, null], default: null },
  targetDirection: { type: String, default: "golden" },
  targetStatus: { type: String, default: "green" },
  loading: Boolean,
  result: Object,
  error: String,
});

defineEmits(["update:targetType", "update:targetValue", "update:targetDirection", "update:targetStatus", "run", "clear"]);

const targetTypes = [
  { value: "maintenanceRatio", label: "維持率", input: "number", placeholder: "目標維持率 (%)" },
  { value: "rsi", label: "RSI", input: "number", placeholder: "目標 RSI (1-99)" },
  { value: "ma20", label: "MA20", input: "number", placeholder: "目標 MA20 價格" },
  { value: "ma60", label: "MA60", input: "number", placeholder: "目標 MA60 價格" },
  { value: "ma240Bias", label: "MA240 偏離", input: "number", placeholder: "目標偏離 (%)" },
  { value: "kdCross", label: "KD 交叉", input: "select", options: ["golden", "dead"] },
  { value: "macdCross", label: "MACD 交叉", input: "select", options: ["golden", "dead"] },
  { value: "strategyScore", label: "策略總分", input: "number", placeholder: "目標分數" },
  { value: "portfolioHealth", label: "Portfolio Health", input: "select", options: ["green", "yellow", "red"] },
];

const canRun = computed(() => {
  if (props.loading) return false;
  if (!props.targetValue && props.targetType !== "kdCross" && props.targetType !== "macdCross" && props.targetType !== "portfolioHealth") {
    return false;
  }
  return true;
});

// Emit changes to parent
watch(() => props.targetType, (val) => {
  emit("update:targetType", val);
});

watch(() => props.targetValue, (val) => {
  emit("update:targetValue", val);
});

watch(() => props.targetDirection, (val) => {
  emit("update:targetDirection", val);
});

watch(() => props.targetStatus, (val) => {
  emit("update:targetStatus", val);
});
</script>

<style scoped>
.reverse-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  flex: 1;
  padding: 14px 0;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2481cc;
  color: #fff;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-lg {
  padding: 16px 0;
  font-size: 16px;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-section {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.error-banner {
  background: #ffe6e6;
  border: 1px solid #ffcccc;
  color: #cc0000;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 13px;
}
</style>