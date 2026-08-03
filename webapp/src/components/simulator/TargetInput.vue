<template>
  <div class="target-input">
    <!-- Number Input -->
    <div v-if="inputType === 'number'" class="input-group">
      <label class="input-label">
        <span class="label-text">{{ targetTypeLabel }}</span>
        <span class="label-hint">{{ unit }}</span>
      </label>
      <input
        type="number"
        class="input-field"
        :value="localValue"
        @input="updateValue($event.target.value)"
        :placeholder="placeholder"
        :disabled="disabled"
        :min="min"
        :max="max"
        :step="step"
      />
      <div v-if="warning" class="input-warning">{{ warning }}</div>
      <div v-if="error" class="input-error">{{ error }}</div>
    </div>

    <!-- Select Input -->
    <div v-if="inputType === 'select'" class="input-group">
      <label class="input-label">
        <span class="label-text">{{ targetTypeLabel }}</span>
      </label>
      <select
        class="selector-field"
        :value="localValue"
        @change="updateValue($event.target.value)"
        :disabled="disabled"
      >
        <option v-for="opt in options" :key="opt" :value="opt">
          {{ formatOption(opt) }}
        </option>
      </select>
    </div>

    <!-- Validation -->
    <div v-if="showValidation" class="validation-hint">
      {{ validationMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  targetType: {
    type: String,
    required: true,
  },
  targetValue: {
    type: [String, Number],
    default: null,
  },
  targetDirection: {
    type: String,
    default: "golden",
  },
  targetStatus: {
    type: String,
    default: "green",
  },
  disabled: Boolean,
});

defineEmits(["update:targetValue", "update:targetDirection", "update:targetStatus"]);

// Local value that syncs with prop
const localValue = computed({
  get() {
    return props.targetValue;
  },
  set(val) {
    emit("update:targetValue", val);
  },
});

// Target type configurations
const targetConfigs = {
  maintenanceRatio: {
    label: "維持率",
    input: "number",
    placeholder: "目標維持率 (%)",
    unit: "%",
    min: 1,
    max: 500,
    step: 0.1,
    validation: (v) => v > 0 && v <= 500,
    warning: (v) => v < 100 ? "維持率低於 100% 可能觸發強制平倉" : v < 130 ? "維持率低於 130% 處於警戒區" : "",
  },
  rsi: {
    label: "RSI",
    input: "number",
    placeholder: "目標 RSI (1-99)",
    unit: "",
    min: 1,
    max: 99,
    step: 1,
    validation: (v) => v >= 1 && v <= 99,
    warning: (v) => v < 30 ? "RSI 低於 30 為超賣區" : v > 70 ? "RSI 高於 70 為超買區" : "",
  },
  ma20: {
    label: "MA20",
    input: "number",
    placeholder: "目標 MA20 價格",
    unit: "元",
    min: 1,
    max: 1000,
    step: 0.01,
    validation: (v) => v > 0,
    warning: "",
  },
  ma60: {
    label: "MA60",
    input: "number",
    placeholder: "目標 MA60 價格",
    unit: "元",
    min: 1,
    max: 1000,
    step: 0.01,
    validation: (v) => v > 0,
    warning: "",
  },
  ma240Bias: {
    label: "MA240 偏離",
    input: "number",
    placeholder: "目標偏離 (%)",
    unit: "%",
    min: -100,
    max: 100,
    step: 0.1,
    validation: (v) => v >= -100 && v <= 100,
    warning: (v) => v > 20 ? "偏離超過 20% 為極度過熱" : v < -20 ? "偏離低於 -20% 為極度超賣" : "",
  },
  kdCross: {
    label: "KD 交叉",
    input: "select",
    options: ["golden", "dead"],
    formatOption: (v) => v === "golden" ? "黃金交叉 (買入訊號)" : "死叉 (賣出訊號)",
  },
  macdCross: {
    label: "MACD 交叉",
    input: "select",
    options: ["golden", "dead"],
    formatOption: (v) => v === "golden" ? "黃金交叉 (買入訊號)" : "死叉 (賣出訊號)",
  },
  strategyScore: {
    label: "策略總分",
    input: "number",
    placeholder: "目標分數",
    unit: "分",
    min: -100,
    max: 200,
    step: 1,
    validation: (v) => v >= -100 && v <= 200,
    warning: (v) => v < 0 ? "負分數極罕見" : v > 100 ? "分數超過 100 極罕見" : "",
  },
  portfolioHealth: {
    label: "Portfolio Health",
    input: "select",
    options: ["green", "yellow", "red"],
    formatOption: (v) => v === "green" ? "綠燈 (健康)" : v === "yellow" ? "黃燈 (注意)" : "紅燈 (風險)",
  },
};

const config = computed(() => targetConfigs[props.targetType] || {});

const inputType = computed(() => config.value.input || "number");

const targetTypeLabel = computed(() => config.value.label || props.targetType);

const unit = computed(() => config.value.unit || "");

const placeholder = computed(() => config.value.placeholder || "");

const min = computed(() => config.value.min);

const max = computed(() => config.value.max);

const step = computed(() => config.value.step || 1);

const options = computed(() => config.value.options || []);

const formatOption = (opt) => {
  if (config.value.formatOption) return config.value.formatOption(opt);
  return opt.charAt(0).toUpperCase() + opt.slice(1);
};

const validation = (v) => {
  const fn = config.value.validation;
  return fn ? fn(v) : true;
};

const warning = computed(() => {
  const fn = config.value.warning;
  const val = Number(localValue.value);
  if (fn && !isNaN(val)) return fn(val);
  return "";
});

const error = ref("");

const showValidation = computed(() => {
  return inputType.value === "number" && localValue.value !== null && localValue.value !== undefined;
});

const validationMessage = computed(() => {
  if (!showValidation.value) return "";
  const val = Number(localValue.value);
  if (isNaN(val)) return "請輸入有效數字";
  if (!validation(val)) return `數值必須在 ${min.value} 到 ${max.value} 之間`;
  if (warning.value) return warning.value;
  return "";
});

function updateValue(val) {
  if (inputType.value === "number") {
    emit("update:targetValue", val === "" ? null : Number(val));
  } else {
    emit("update:targetValue", val);
  }
}
</script>

<style scoped>
.target-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.selector-field {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  background: #fff;
  transition: all 0.2s;
}

.selector-field:focus {
  outline: none;
  border-color: #2481cc;
  box-shadow: 0 0 0 3px rgba(36, 129, 204, 0.15);
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
  color: #e53935.
}

.validation-hint {
  font-size: 11px;
  color: #666;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>