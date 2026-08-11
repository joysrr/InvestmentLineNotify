<template>
  <div class="sensitivity-panel">
    <!-- Header -->
    <div class="sensitivity-header">
      <h3 class="sensitivity-title">敏感度分析</h3>
      <p class="sensitivity-subtitle">參數影響度分析與關鍵驅動因子識別</p>
    </div>

    <!-- Parameter Selector -->
    <div class="param-selector">
      <label>目標參數</label>
      <el-select
        v-model="targetParam"
        placeholder="選擇要分析的參數"
        style="width: 100%"
        clearable
      >
        <el-option
          v-for="param in scannableParams"
          :key="param.path"
          :label="param.label"
          :value="param.path"
        />
      </el-select>
    </div>

    <!-- Scan Range Config -->
    <div class="range-config">
      <div class="range-row">
        <el-form-item label="最小值" prop="min">
          <el-input-number
            v-model="scanRange.min"
            :min="getParamMin()"
            :max="getParamMax()"
            :step="scanRange.step"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="最大值" prop="max">
          <el-input-number
            v-model="scanRange.max"
            :min="getParamMin()"
            :max="getParamMax()"
            :step="scanRange.step"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="步長" prop="step">
          <el-input-number
            v-model="scanRange.step"
            :min="0.1"
            :max="100"
            :step="0.1"
            style="width: 100%"
          />
        </el-form-item>
      </div>
      <div class="points-info">
        掃描點數: {{ scanPointsCount }} / 200
      </div>
    </div>

    <!-- Metric Selector -->
    <div class="metric-selector">
      <label>觀測指標</label>
      <el-select
        v-model="metrics"
        multiple
        placeholder="選擇觀測指標"
        style="width: 100%"
        collapse-tags
      >
        <el-option
          v-for="m in supportedMetrics"
          :key="m.value"
          :label="m.label"
          :value="m.value"
        />
      </el-select>
    </div>

    <!-- Chart Toggle -->
    <div class="chart-toggle">
      <el-tabs v-model="chartType" type="card">
        <el-tab-pane label="敏感度曲線" name="sensitivity" />
        <el-tab-pane label="Tornado 圖" name="tornado" />
      </el-tabs>
    </div>

    <!-- Multi-params for Tornado (collapsible) -->
    <el-collapse v-model="multiParamsCollapse" class="multi-params-section">
      <el-collapse-item name="1" title="Tornado 圖參數 (多參數掃描)">
        <div class="multi-params-list">
          <template v-for="(mp, idx) in multiParams" :key="idx">
            <div class="multi-param-row">
              <el-select
                v-model="mp.path"
                :placeholder="`參數 ${idx + 1}`"
                style="width: 40%"
                clearable
              >
                <el-option
                  v-for="param in scannableParams"
                  :key="param.path"
                  :label="param.label"
                  :value="param.path"
                />
              </el-select>
              <el-input-number
                v-model="mp.range[0]"
                :min="getMultiParamMin(mp.path)"
                :max="getMultiParamMax(mp.path)"
                placeholder="最小"
                style="width: 25%"
              />
              <el-input-number
                v-model="mp.range[1]"
                :min="getMultiParamMin(mp.path)"
                :max="getMultiParamMax(mp.path)"
                placeholder="最大"
                style="width: 25%"
              />
              <el-button
                size="small"
                type="danger"
                @click="removeMultiParam(idx)"
                :disabled="multiParams.length <= 1"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </template>
        </div>
        <el-button size="small" @click="addMultiParam">
          <el-icon><Plus /></el-icon> 新增參數
        </el-button>
      </el-collapse-item>
    </el-collapse>

    <!-- Execute Button -->
    <div class="execute-section">
      <el-button
        type="primary"
        size="large"
        :loading="loading"
        :disabled="!canExecute"
        @click="executeAnalysis"
        class="execute-btn"
      >
        <el-icon v-if="loading"><Loading /></el-icon>
        <el-icon v-else><TrendCharts /></el-icon>
        <span>{{ loading ? `分析中...` : '開始分析' }}</span>
      </el-button>
    </div>

    <!-- Progress -->
    <div v-if="loading" class="progress-section">
      <el-progress :percentage="progress" :stroke-width="12" show-text />
    </div>

    <!-- Result Charts -->
    <div v-if="result" class="result-section">
      <!-- Stats -->
      <div class="chart-stats">
        <span v-if="result.singleParam" class="stat">
          斜率: {{ result.singleParam.slope }}
        </span>
        <span v-if="result.singleParam" class="stat">
          相關係數: {{ result.singleParam.correlation }}
        </span>
      </div>

      <!-- Sensitivity Chart -->
      <div v-if="chartType === 'sensitivity' && result.singleParam">
        <SensitivityChart ref="sensitivityChart" :data="result.singleParam" />
      </div>

      <!-- Tornado Chart -->
      <div v-if="chartType === 'tornado' && result.multiParam">
        <TornadoChart ref="tornadoChart" :data="result.multiParam" />
      </div>

      <!-- Key Drivers Panel -->
      <div v-if="result.multiParam?.keyDrivers?.length" class="key-drivers-panel">
        <h4>關鍵驅動因子 (Top 3)</h4>
        <ul>
          <li v-for="(driver, idx) in result.multiParam.keyDrivers" :key="idx">
            {{ idx + 1 }}. {{ driver }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Disclaimer -->
    <div v-if="result" class="disclaimer">
      {{ result.disclaimer }}
    </div>

    <!-- Export -->
    <div v-if="result" class="export-section">
      <ExportButton
        :csvData="result.singleParam ? [result.singleParam] : []"
        :jsonData="result"
        :chartInstance="chartType === 'sensitivity' ? $refs.sensitivityChart?.chartInstance : $refs.tornadoChart?.chartInstance"
        :filename="'sensitivity-result'"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { TrendCharts, Loading, Plus, Delete } from "@element-plus/icons-vue";
import { apiFetch } from "@/api/index.js";
import SensitivityChart from "./SensitivityChart.vue";
import TornadoChart from "./TornadoChart.vue";
import ExportButton from "@/components/common/ExportButton.vue";
import { SCANNABLE_PARAMS } from "@/constants/simulator.js";

const props = defineProps({
  currentPrice0050: { type: Number, default: null },
  currentPriceZ2: { type: Number, default: null },
});

const emit = defineEmits(["update:params"]);

// State
const targetParam = ref("");
const scanRange = ref({ min: 140, max: 180, step: 1 });
const metrics = ref(["strategyScore", "maintenanceMargin"]);
const chartType = ref("sensitivity");
const multiParams = ref([{ path: "", range: [140, 180] }]);
const multiParamsCollapse = ref([]);
const loading = ref(false);
const result = ref(null);
const progress = ref(0);

// Computed
const scannableParams = computed(() => SCANNABLE_PARAMS);

const supportedMetrics = computed(() => [
  { value: "strategyScore", label: "策略分數" },
  { value: "maintenanceMargin", label: "維持率" },
  { value: "simulatedPrice0050", label: "推導 0050 價格" },
  { value: "simulatedPriceZ2", label: "推導 00675L 價格" },
]);

const getParamDef = computed(() => {
  return SCANNABLE_PARAMS.find((p) => p.path === targetParam.value);
});

const canExecute = computed(() => {
  if (chartType.value === "tornado") {
    return multiParams.value.length > 0 && multiParams.value.every(
      mp => mp.path && mp.range[0] != null && mp.range[1] != null && mp.range[0] < mp.range[1]
    );
  }
  return targetParam.value && 
    scanRange.value.min != null && 
    scanRange.value.max != null && 
    scanRange.value.step > 0 &&
    scanRange.value.min < scanRange.value.max &&
    metrics.value.length > 0;
});

const scanPointsCount = computed(() => {
  const { min, max, step } = scanRange.value;
  if (!min || !max || !step || step <= 0) return 0;
  return Math.floor((max - min) / step) + 1;
});

// Methods
function getParamMin() {
  return getParamDef.value?.min ?? 50;
}

function getParamMax() {
  return getParamDef.value?.max ?? 500;
}

function getMultiParamMin(path) {
  const def = SCANNABLE_PARAMS.find(p => p.path === path);
  return def?.min ?? 50;
}

function getMultiParamMax(path) {
  const def = SCANNABLE_PARAMS.find(p => p.path === path);
  return def?.max ?? 500;
}

function addMultiParam() {
  multiParams.value.push({ path: "", range: [140, 180] });
}

function removeMultiParam(idx) {
  if (multiParams.value.length <= 1) return;
  multiParams.value.splice(idx, 1);
}

async function executeAnalysis() {
  if (!canExecute.value) {
    ElMessage.warning("請填寫完整參數");
    return;
  }

  loading.value = true;
  progress.value = 0;
  result.value = null;

  // 模擬進度
  const progressInterval = setInterval(() => {
    progress.value = Math.min(90, progress.value + 10);
  }, 500);

  try {
    const payload = {
      baseParams: {
        price0050: props.currentPrice0050 || 175,
        priceZ2: props.currentPriceZ2 || 275,
      },
      targetParam: targetParam.value,
      scanRange: scanRange.value,
      metrics: metrics.value,
      multiParams: chartType.value === "tornado" ? multiParams.value.map(mp => ({
        path: mp.path,
        range: mp.range,
      })) : undefined,
    };

    const response = await apiFetch("/api/v1/simulate/sensitivity", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    result.value = response;
    progress.value = 100;
    ElMessage.success("敏感度分析完成");
  } catch (err) {
    ElMessage.error("分析失敗: " + (err.body?.message || err.message));
  } finally {
    clearInterval(progressInterval);
    loading.value = false;
    progress.value = 0;
  }
}

// Watch targetParam to update scanRange defaults
watch(targetParam, (newVal) => {
  const def = SCANNABLE_PARAMS.find(p => p.path === newVal);
  if (def) {
    const range = def.max - def.min;
    scanRange.value = {
      min: def.min,
      max: def.max,
      step: Math.max(1, range / 20),
    };
  }
});

// Initialize with first param if empty
onMounted(() => {
  if (!targetParam.value && SCANNABLE_PARAMS.length > 0) {
    targetParam.value = SCANNABLE_PARAMS[0].path;
  }
});
</script>

<style scoped>
.sensitivity-panel {
  padding: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.sensitivity-header {
  text-align: center;
  margin-bottom: 24px;
}

.sensitivity-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 4px;
}

.sensitivity-subtitle {
  font-size: 13px;
  color: #888;
}

.param-selector,
.range-config,
.metric-selector,
.chart-toggle,
.multi-params-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #eee;
}

.param-selector label,
.range-config label,
.metric-selector label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.range-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.points-info {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
  text-align: right;
}

.chart-toggle {
  padding: 8px 0;
}

.multi-params-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.multi-param-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.execute-section {
  display: flex;
  justify-content: center;
  margin: 24px 0;
}

.execute-btn {
  min-width: 200px;
}

.progress-section {
  margin: 16px 0;
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
}

.result-section {
  margin-top: 24px;
  animation: fadeIn 0.3s ease;
}

.chart-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.stat {
  color: #2481cc;
}

.key-drivers-panel {
  margin-top: 24px;
  padding: 16px;
  background: #fff8e1;
  border: 1px solid #ffe0b2;
  border-radius: 12px;
}

.key-drivers-panel h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #e65100;
}

.key-drivers-panel ul {
  margin: 0;
  padding-left: 20px;
}

.key-drivers-panel li {
  margin-bottom: 4px;
  font-size: 13px;
}

.disclaimer {
  margin-top: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 12px;
  color: #999;
  text-align: center;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>