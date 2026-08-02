<template>
  <div class="forward-panel">
    <!-- Price Input -->
    <div class="input-section">
      <PriceInput
        v-model:price0050="price0050"
        v-model:priceZ2="priceZ2"
        :current-price-0050="currentPrice0050"
        :current-price-z2="currentPriceZ2"
        :disabled="loading"
      />

      <div class="action-buttons">
        <button
          class="btn btn-primary btn-lg"
          :disabled="loading || !price0050"
          @click="$emit('run')"
        >
          <span v-if="loading" class="btn-spinner"></span>
          <span v-else>執行模擬</span>
        </button>
        <button
          class="btn btn-secondary"
          :disabled="loading"
          @click="$emit('clear')"
        >
          清除結果
        </button>
      </div>
    </div>

    <!-- Result -->
    <div v-if="result" class="result-section">
      <ForwardResultCard :result="result" />
      <IndicatorComparisonTable
        v-if="result.indicators"
        :current="{
          rsi: result.indicators.rsi,
          kd: result.indicators.kd,
          macd: result.indicators.macd,
          ma20: result.indicators.ma20,
          ma60: result.indicators.ma60,
          ma240: result.indicators.ma240,
          bias240: result.indicators.bias240,
          atr: result.indicators.atr,
          maintenanceMargin: result.maintenanceMargin,
          portfolioHealth: result.portfolioHealth,
          lifecycleStage: result.lifecycleStage,
          strategyScore: result.strategyScore,
          strategyStatus: result.strategyStatus,
          strategyTarget: result.strategyTarget,
          strategySuggestion: result.strategySuggestion,
        }"
        :simulated="{
          rsi: result.indicators.rsi,
          kd: result.indicators.kd,
          macd: result.indicators.macd,
          ma20: result.indicators.ma20,
          ma60: result.indicators.ma60,
          ma240: result.indicators.ma240,
          bias240: result.indicators.bias240,
          atr: result.indicators.atr,
          maintenanceMargin: result.maintenanceMargin,
          portfolioHealth: result.portfolioHealth,
          lifecycleStage: result.lifecycleStage,
          strategyScore: result.strategyScore,
          strategyStatus: result.strategyStatus,
          strategyTarget: result.strategyTarget,
          strategySuggestion: result.strategySuggestion,
        }"
      />
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
import PriceInput from "./PriceInput.vue";
import ForwardResultCard from "./ForwardResultCard.vue";
import IndicatorComparisonTable from "./Common/IndicatorComparisonTable.vue";
import LoadingSkeleton from "./Common/LoadingSkeleton.vue";

defineProps({
  modelValue: {
    type: Object,
    default: () => ({ price0050: null, priceZ2: null }),
  },
  loading: Boolean,
  result: Object,
  error: String,
  currentPrice0050: Number,
  currentPriceZ2: Number,
});

defineEmits(["update:modelValue", "run", "clear"]);

const price0050 = ref(null);
const priceZ2 = ref(null);

// Watch props to sync with modelValue
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      price0050.value = val.price0050;
      priceZ2.value = val.priceZ2;
    }
  },
  { deep: true }
);

// Emit changes to parent
watch([price0050, priceZ2], () => {
  emit("update:modelValue", { price0050: price0050.value, priceZ2: priceZ2.value });
});
</script>

<style scoped>
.forward-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-section {
  background: #fafafa;
  border-radius: 16px;
  padding: 20px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
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

.btn-primary:not(:disabled):active {
  background: #1a6bb8;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:not(:disabled):active {
  background: #e0e0e0;
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