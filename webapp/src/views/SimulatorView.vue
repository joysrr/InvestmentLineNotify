<template>
  <div class="simulator-view">
    <!-- Header -->
    <div class="sim-header">
      <h2 class="sim-title">0050 雙向模擬器</h2>
      <p class="sim-subtitle">股價 ⇄ 策略分數 / 條件反推 / 批次模擬</p>
    </div>

    <!-- Mode Selector -->
    <SimulatorModeSelector v-model="mode" />

    <!-- Forward Panel (Mode A) -->
    <ForwardPanel
      v-if="mode === 'forward'"
      :price0050="price0050"
      :priceZ2="priceZ2"
      @update:price0050="updatePrice0050"
      @update:priceZ2="updatePriceZ2"
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
      :target-type="targetType"
      :target-value="targetValue"
      :target-direction="targetDirection"
      :target-status="targetStatus"
      @update:target-type="updateTargetType"
      @update:target-value="updateTargetValue"
      @update:target-direction="updateTargetDirection"
      @update:target-status="updateTargetStatus"
      :loading="loading"
      :result="result"
      :error="error"
      @run="runReverse"
      @clear="clearResult"
    />

    <!-- Batch Panel (Mode C) -->
    <BatchPanel
      v-else-if="mode === 'batch'"
      :current-price-0050="currentPrice0050"
      :current-price-z2="currentPriceZ2"
    />

    <!-- Sensitivity Panel (Mode D) -->
    <SensitivityPanel
      v-else-if="mode === 'sensitivity'"
      :current-price-0050="currentPrice0050"
      :current-price-z2="currentPriceZ2"
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
import { useTelegram, waitReady } from "../composables/useTelegram.js";

// Components
import SimulatorModeSelector from "@/components/simulator/SimulatorModeSelector.vue";
import ForwardPanel from "@/components/simulator/ForwardPanel.vue";
import ReversePanel from "@/components/simulator/ReversePanel.vue";
import BatchPanel from "@/components/simulator/BatchPanel.vue";
import SensitivityPanel from "@/components/simulator/SensitivityPanel.vue";
import DataQualityBadges from "@/components/simulator/Common/DataQualityBadges.vue";
import DisclaimerBanner from "@/components/simulator/Common/DisclaimerBanner.vue";
import LoadingSkeleton from "@/components/simulator/Common/LoadingSkeleton.vue";

// State
const mode = ref("forward"); // 'forward' | 'reverse'

// Forward Input - 使用獨立 ref 確保 template 自動解包 (Vue 3 官方建議)
const price0050 = ref(null);
const priceZ2 = ref(null);

// Reverse Input - 使用獨立 ref
const targetType = ref("maintenanceRatio");
const targetValue = ref(null);
const targetDirection = ref("golden");
const targetStatus = ref("green");

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
    const report = await apiFetch("/api/reports?limit=1");
    // Get prices from latest report (has price0050 and currentPrice fields)
    if (report && report.length > 0) {
      currentPrice0050.value = report[0].price0050;
      currentPriceZ2.value = report[0].currentPrice;
    }
  } catch (err) {
    console.warn("Failed to load current prices:", err);
  }
}

async function runForward() {
  if (!price0050.value) {
    error.value = "請輸入 0050 價格";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const payload = {
      price0050: Number(price0050.value),
      priceZ2: priceZ2.value ? Number(priceZ2.value) : undefined,
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
  const { value: tType } = targetType;
  const { value: tValue } = targetValue;
  const { value: tDirection } = targetDirection;
  const { value: tStatus } = targetStatus;

  if (!tValue && tType !== "kdCross" && tType !== "macdCross" && tType !== "portfolioHealth") {
    error.value = "請輸入目標值";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const target = { type: tType };
   
    if (tType === "kdCross" || tType === "macdCross") {
      target.direction = tDirection;
    } else if (tType === "portfolioHealth") {
      target.status = tStatus;
    } else {
      target.value = Number(tValue);
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

// Event handlers for v-model compatibility
const updatePrice0050 = (val) => { price0050.value = val; };
const updatePriceZ2 = (val) => { priceZ2.value = val; };
const updateTargetType = (val) => { targetType.value = val; };
const updateTargetValue = (val) => { targetValue.value = val; };
const updateTargetDirection = (val) => { targetDirection.value = val; };
const updateTargetStatus = (val) => { targetStatus.value = val; };

onMounted(async () => {
  await waitReady();
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