<template>
  <div class="simulator-view">
    <!-- Header -->
    <div class="sim-header">
      <h2 class="sim-title">0050 雙向模擬器</h2>
      <p class="sim-subtitle">股價 ⇄ 策略分數 / 條件反推</p>
    </div>

    <!-- Mode Selector -->
    <SimulatorModeSelector v-model="mode" />

    <!-- Forward Panel (Mode A) -->
    <ForwardPanel
      v-if="mode === 'forward'"
      v-model:price0050="forwardInput.price0050"
      v-model:priceZ2="forwardInput.priceZ2"
      :loading="loading"
      :result="result"
      :error="error"
      :current-price-0050="currentPrice0050"
      :current-price-z2="currentPriceZ2"
      @run="runForward"
      @clear="clearResult"
    />

    <!-- Reverse Panel (Mode B) -->
    <ReversePanel
      v-else-if="mode === 'reverse'"
      v-model:target-type="reverseInput.targetType"
      v-model:target-value="reverseInput.targetValue"
      v-model:target-direction="reverseInput.targetDirection"
      v-model:target-status="reverseInput.targetStatus"
      :loading="loading"
      :result="result"
      :error="error"
      @run="runReverse"
      @clear="clearResult"
    />

    <!-- Data Quality Badges (always visible when result exists) -->
    <DataQualityBadges
      v-if="result && result.dataQuality"
      :data-quality="result.dataQuality"
    />

    <!-- Disclaimer -->
    <DisclaimerBanner v-if="result" :disclaimer="result.disclaimer" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { apiFetch } from "../api/index.js";
import { useTelegram } from "../composables/useTelegram.js";

// Components
import SimulatorModeSelector from "../components/simulator/SimulatorModeSelector.vue";
import ForwardPanel from "../components/simulator/ForwardPanel.vue";
import ReversePanel from "../components/simulator/ReversePanel.vue";
import DataQualityBadges from "../components/simulator/Common/DataQualityBadges.vue";
import DisclaimerBanner from "../components/simulator/Common/DisclaimerBanner.vue";
import LoadingSkeleton from "../components/simulator/Common/LoadingSkeleton.vue";

const { waitReady } = useTelegram();

// State
const mode = ref("forward"); // 'forward' | 'reverse'

// Forward Input
const forwardInput = ref({
  price0050: null,
  priceZ2: null,
});

// Reverse Input
const reverseInput = ref({
  targetType: "maintenanceRatio",
  targetValue: null,
  targetDirection: "golden",
  targetStatus: "green",
});

// Result & Status
const result = ref(null);
const loading = ref(false);
const error = ref(null);

// Current market prices (for deviation warnings)
const currentPrice0050 = ref(null);
const currentPriceZ2 = ref(null);

// Target types for reverse panel
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

// Load current prices on mount
async function loadCurrentPrices() {
  try {
    const status = await apiFetch("/api/status");
    if (status?.data?.marketState) {
      currentPrice0050.value = status.data.marketState.price0050;
      currentPriceZ2.value = status.data.marketState.currentPrice;
    }
  } catch (err) {
    console.warn("Failed to load current prices:", err);
  }
}

async function runForward() {
  if (!forwardInput.value.price0050) {
    error.value = "請輸入 0050 價格";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const payload = {
      price0050: Number(forwardInput.value.price0050),
      priceZ2: forwardInput.value.priceZ2 ? Number(forwardInput.value.priceZ2) : undefined,
    };

    const response = await apiFetch("/api/v1/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    result.value = response;
    currentPrice0050.value = response.currentPrice0050;
    currentPriceZ2.value = response.currentPriceZ2;
  } catch (err) {
    error.value = err.body?.message || err.message || "模擬失敗";
    result.value = null;
  } finally {
    loading.value = false;
  }
}

async function runReverse() {
  const { targetType, targetValue, targetDirection, targetStatus } = reverseInput.value;

  if (!targetValue && targetType !== "kdCross" && targetType !== "macdCross" && targetType !== "portfolioHealth") {
    error.value = "請輸入目標值";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const target = { type: targetType };
    
    if (targetType === "kdCross" || targetType === "macdCross") {
      target.direction = targetDirection;
    } else if (targetType === "portfolioHealth") {
      target.status = targetStatus;
    } else {
      target.value = Number(targetValue);
    }

    const response = await apiFetch("/api/v1/simulate/reverse", {
      method: "POST",
      body: JSON.stringify({ target }),
    });

    result.value = response;
  } catch (err) {
    error.value = err.body?.message || err.message || "反向推導失敗";
    result.value = null;
  } finally {
    loading.value = false;
  }
}

function clearResult() {
  result.value = null;
  error.value = null;
}

onMounted(async () => {
  await loadCurrentPrices();
});
</script>

<style scoped>
.simulator-view {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.sim-header {
  text-align: center;
  margin-bottom: 24px;
}

.sim-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 4px;
}

.sim-subtitle {
  font-size: 13px;
  color: #888;
}
</style>