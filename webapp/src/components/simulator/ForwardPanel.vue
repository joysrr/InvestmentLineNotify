<template>
  <div class="forward-panel">
    <!-- Price Input -->
    <div class="input-section">
      <PriceInput
        :price0050="price0050"
        :priceZ2="priceZ2"
        @update:price0050="$emit('update:price0050', $event)"
        @update:priceZ2="$emit('update:priceZ2', $event)"
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
import { ref, computed, watch } from "vue";
import PriceInput from "./PriceInput.vue";
import ForwardResultCard from "./ForwardResultCard.vue";
import IndicatorComparisonTable from "./Common/IndicatorComparisonTable.vue";
import LoadingSkeleton from "./Common/LoadingSkeleton.vue";
import DataQualityBadges from "./Common/DataQualityBadges.vue";
import DisclaimerBanner from "./Common/DisclaimerBanner.vue";

const props = defineProps({
  price0050: { type: [Number, String, null], default: null },
  priceZ2: { type: [Number, String, null], default: null },
  loading: Boolean,
  result: Object,
  error: String,
  currentPrice0050: Number,
  currentPriceZ2: Number,
});

defineEmits(["update:price0050", "update:priceZ2", "run", "clear"]);

// Debug: watch prop changes
watch(() => props.price0050, (newVal) => {
  console.log('[ForwardPanel] price0050 prop changed:', newVal);
});
watch(() => props.priceZ2, (newVal) => {
  console.log('[ForwardPanel] priceZ2 prop changed:', newVal);
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