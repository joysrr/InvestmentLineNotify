<template>
  <div class="forward-panel" data-testid="forward-panel">
    <div class="input-section">
      <div class="price-inputs">
        <PriceInput
          v-model="localPrice0050"
          label="0050 預估價格"
          placeholder="請輸入 0050 預估價格"
          :disabled="loading"
          data-testid="input-price0050"
        />
        <PriceInput
          v-model="localPriceZ2"
          label="00675L (Z2) 預估價格"
          placeholder="請輸入 00675L 預估價格"
          :disabled="loading"
          data-testid="input-pricez2"
        />
      </div>
    </div>

    <div class="action-buttons">
      <el-button
        type="primary"
        :loading="loading"
        :disabled="!localPrice0050 || !localPriceZ2 || loading"
        @click="run"
        data-testid="btn-run-forward"
      >
        {{ loading ? '計算中...' : '開始計算' }}
      </el-button>
      <el-button
        v-if="result"
        @click="clear"
        data-testid="btn-clear-forward"
      >
        清除結果
      </el-button>
    </div>

    <LoadingSkeleton v-if="loading" data-testid="loading-skeleton" />

    <div v-else-if="error" class="error-message" data-testid="error-message">
      {{ error }}
    </div>

    <div v-else-if="result" class="result-section" data-testid="result-section">
      <ForwardResultCard
        :result="result"
        :current-price-0050="currentPrice0050"
        :current-price-z2="currentPriceZ2"
        data-testid="result-card"
      />
      <IndicatorComparisonTable
        :indicators="result.indicators"
        data-testid="indicators-table"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import PriceInput from "@/components/simulator/PriceInput.vue";
import ForwardResultCard from "@/components/simulator/ForwardResultCard.vue";
import IndicatorComparisonTable from "@/components/simulator/Common/IndicatorComparisonTable.vue";
import LoadingSkeleton from "@/components/simulator/Common/LoadingSkeleton.vue";

const props = defineProps({
  price0050: { type: [Number, String], default: "" },
  priceZ2: { type: [Number, String], default: "" },
  loading: { type: Boolean, default: false },
  result: { type: Object, default: null },
  error: { type: String, default: null },
  currentPrice0050: { type: [Number, String], default: "" },
  currentPriceZ2: { type: [Number, String], default: "" },
});

const emit = defineEmits(["update:price0050", "update:priceZ2", "run", "clear"]);

// Local refs to avoid v-model on props directly
const localPrice0050 = computed({
  get: () => props.price0050,
  set: (val) => emit("update:price0050", val),
});

const localPriceZ2 = computed({
  get: () => props.priceZ2,
  set: (val) => emit("update:priceZ2", val),
});

const run = () => emit("run");
const clear = () => emit("clear");
</script>

<style scoped>
.forward-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-section {
  padding: 16px;
  background: var(--tg-theme-bg-color, #fafafa);
  border-radius: 12px;
}

.price-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-start;
}

.error-message {
  color: var(--tg-theme-destructive-color, #f44336);
  padding: 12px;
  background: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  text-align: center;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>