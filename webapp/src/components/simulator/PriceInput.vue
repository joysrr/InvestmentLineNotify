<template>
  <div class="price-input">
    <!-- 0050 Price (Required) -->
    <div class="input-group">
      <label class="input-label">
        <span class="label-text">0050 預估價格 <span class="required">*</span></span>
        <span class="label-hint">元</span>
      </label>
      <input
        type="number"
        class="input-field input-primary"
        v-model.number="price0050"
        :placeholder="price0050Placeholder"
        :disabled="disabled"
        min="50"
        max="500"
        step="0.01"
        @blur="validatePrice0050"
      />
      <div v-if="price0050Warning" class="input-warning">{{ price0050Warning }}</div>
      <div v-if="price0050Error" class="input-error">{{ price0050Error }}</div>
    </div>

    <!-- Z2 Price (Optional) -->
    <div class="input-group">
      <label class="input-label">
        <span class="label-text">00675L 預估價格</span>
        <span class="label-hint optional">選填，元</span>
      </label>
      <input
        type="number"
        class="input-field"
        v-model.number="priceZ2"
        :placeholder="priceZ2Placeholder"
        :disabled="disabled"
        min="50"
        max="500"
        step="0.01"
        @blur="validatePriceZ2"
      />
      <div v-if="priceZ2Warning" class="input-warning">{{ priceZ2Warning }}</div>
      <div v-if="priceZ2Error" class="input-error">{{ priceZ2Error }}</div>
      <div v-if="priceZ2 === null && price0050 && currentPrice0050 && currentPriceZ2" class="input-hint">
        自動計算: {{ calculatedZ2.toFixed(2) }} 元 (同比例聯動)
      </div>
    </div>

    <!-- Quick Presets -->
    <div v-if="currentPrice0050 && !disabled" class="preset-buttons">
      <span class="preset-label">快速選擇:</span>
      <button
        v-for="pct in [-10, -5, 5, 10]"
        :key="pct"
        class="preset-btn"
        @click="applyPreset(pct)"
      >
        {{ pct > 0 ? '+' : '' }}{{ pct }}%
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

defineProps({
  modelValue: {
    type: Object,
    default: () => ({ price0050: null, priceZ2: null }),
  },
  disabled: Boolean,
  currentPrice0050: Number,
  currentPriceZ2: Number,
});

defineEmits(["update:modelValue"]);

const price0050 = ref(null);
const priceZ2 = ref(null);
const price0050Warning = ref("");
const price0050Error = ref("");
const priceZ2Warning = ref("");
const priceZ2Error = ref("");

const calculatedZ2 = computed(() => {
  if (!currentPrice0050 || !currentPriceZ2 || !price0050.value) return 0;
  const ratio = currentPriceZ2 / currentPrice0050;
  return price0050.value * ratio;
});

const price0050Deviation = computed(() => {
  if (!currentPrice0050 || !price0050.value) return 0;
  return Math.abs((price0050.value - currentPrice0050) / currentPrice0050);
});

const priceZ2Deviation = computed(() => {
  if (!currentPriceZ2 || !priceZ2.value) return 0;
  return Math.abs((priceZ2.value - currentPriceZ2) / currentPriceZ2);
});

// Computed placeholders
const price0050Placeholder = computed(() => {
  return currentPrice0050 ? `目前: ${currentPrice0050}` : "請輸入 0050 價格";
});

const priceZ2Placeholder = computed(() => {
  return currentPriceZ2 ? `目前: ${currentPriceZ2} (留空按同比例)` : "留空自動按同比例";
});

watch(price0050, () => validatePrice0050());
watch(priceZ2, () => validatePriceZ2());

function validatePrice0050() {
  price0050Warning.value = "";
  price0050Error.value = "";

  if (price0050.value === null || price0050.value === undefined) return;

  if (price0050.value < 50) {
    price0050Error.value = "價格不得低於 50 元";
  } else if (price0050.value > 500) {
    price0050Error.value = "價格不得高於 500 元";
  } else if (currentPrice0050) {
    const dev = price0050Deviation.value;
    if (dev > 0.20) {
      price0050Warning.value = `⚠️ 價格偏離超過 20%，此情境可能代表多日後狀態，指標路徑依賴性增強`;
    } else if (dev > 0.10) {
      price0050Warning.value = `⚠️ 價格偏離超過 10%，結果可能不反映單日情境`;
    }
  }
}

function validatePriceZ2() {
  priceZ2Warning.value = "";
  priceZ2Error.value = "";

  if (priceZ2.value === null || priceZ2.value === undefined) return;

  if (priceZ2.value < 50) {
    priceZ2Error.value = "價格不得低於 50 元";
  } else if (priceZ2.value > 500) {
    priceZ2Error.value = "價格不得高於 500 元";
  } else if (currentPriceZ2) {
    const dev = priceZ2Deviation.value;
    if (dev > 0.20) {
      priceZ2Warning.value = `⚠️ 價格偏離超過 20%`;
    } else if (dev > 0.10) {
      priceZ2Warning.value = `⚠️ 價格偏離超過 10%`;
    }
  }
}

function applyPreset(pct) {
  if (!currentPrice0050) return;
  price0050.value = Math.round(currentPrice0050 * (1 + pct / 100) * 100) / 100;
}
</script>

<style scoped>
.price-input {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.label-text {
  flex: 1;
}

.label-hint {
  font-size: 11px;
  color: #999;
  font-weight: 400;
}

.label-hint.optional {
  color: #aaa;
}

.required {
  color: #e53935;
}

.input-field {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 16px;
  font-family: inherit;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input-field:focus {
  outline: none;
  border-color: #2481cc;
  box-shadow: 0 0 0 3px rgba(36, 129, 204, 0.15);
}

.input-field:disabled {
  background: #f5f5f5;
  color: #999;
}

.input-primary {
  border-width: 2px;
}

.input-warning {
  font-size: 11px;
  color: #f57c00;
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-error {
  font-size: 11px;
  color: #e53935;
}

.input-hint {
  font-size: 11px;
  color: #666;
  padding: 8px 12px;
  background: #f0f8ff;
  border-radius: 8px;
  text-align: center;
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

.preset-label {
  font-size: 11px;
  color: #999;
}

.preset-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  border-color: #2481cc;
  color: #2481cc;
  background: #f0f8ff;
}
</style>