<template>
  <div class="pareto-panel" data-testid="pareto-panel">
    <!-- Header -->
    <div class="pareto-header">
      <h3 class="pareto-title">Pareto 前沿分析</h3>
      <p class="pareto-subtitle">多目標優化與最佳折衷解識別</p>
    </div>

    <!-- Objective Selector -->
    <div class="objective-selector" data-testid="objective-selector">
      <label>優化目標 (雙目標)</label>
      <el-select
        v-model="objectives"
        multiple
        placeholder="選擇 2-3 個目標"
        style="width: 100%"
        collapse-tags
        :filterable="false"
        data-testid="select-objectives"
      >
        <el-option
          v-for="obj in supportedObjectives"
          :key="obj.value"
          :label="obj.label"
          :value="obj"
        >
          <template #default>
            <span>{{ obj.label }}</span>
            <el-tag size="small" style="margin-left: 8px" :type="obj.direction === 'maximize' ? 'success' : 'warning'">
              {{ obj.direction === 'maximize' ? '最大化' : '最小化' }}
            </el-tag>
          </template>
        </el-option>
      </el-select>
      <p class="hint" v-if="objectives.length !== 2">請選擇恰好 2 個目標進行 Pareto 分析</p>
    </div>

    <!-- Direction indicators -->
        <div class="direction-indicators" v-if="objectives.length === 2" data-testid="direction-indicators">
          <el-tag
            v-for="(obj, idx) in objectives"
            :key="idx"
            :type="getDirectionType(obj)"
            effect="dark"
            class="direction-tag"
            data-testid="direction-tag"
          >
            <el-icon v-if="obj.direction === 'maximize'"><ArrowUp /></el-icon>
            <el-icon v-else><ArrowDown /></el-icon>
            {{ obj.label }}: {{ getDirectionText(obj) }}
          </el-tag>
        </div>

    <!-- Scan Parameters -->
    <div class="scan-params-section" data-testid="scan-params-section">
      <label>掃描參數 (2-5個)</label>
      <div class="scan-params-list" data-testid="scan-params-list">
        <template v-for="(sp, idx) in scanParams" :key="idx">
          <div class="scan-param-row" data-testid="scan-param-row">
            <el-select
              v-model="sp.path"
              :placeholder="`參數 ${idx + 1}`"
              style="width: 40%"
              clearable
              data-testid="select-scan-param-path"
            >
              <el-option
                v-for="param in scannableParams"
                :key="param.path"
                :label="param.label"
                :value="param.path"
              />
            </el-select>
            <el-input-number
              v-model="sp.range[0]"
              :min="getScanParamMin(sp.path)"
              :max="getScanParamMax(sp.path)"
              placeholder="最小"
              style="width: 25%"
              data-testid="input-scan-param-min"
            />
            <el-input-number
              v-model="sp.range[1]"
              :min="getScanParamMin(sp.path)"
              :max="getScanParamMax(sp.path)"
              placeholder="最大"
              style="width: 25%"
              data-testid="input-scan-param-max"
            />
            <el-button
              size="small"
              type="danger"
              @click="removeScanParam(idx)"
              :disabled="scanParams.length <= 2"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </template>
      </div>
      <el-button size="small" @click="addScanParam" :disabled="scanParams.length >= 5" data-testid="btn-add-scan-param">
        <el-icon><Plus /></el-icon> 新增參數
      </el-button>
      <p class="hint">建議 2-3 個參數，最多 5 個</p>
    </div>

    <!-- Weight Sliders -->
    <div class="weight-section" v-if="objectives.length === 2" data-testid="weight-section">
      <label>目標權重 (膝點檢測用)</label>
      <div class="weight-slider" data-testid="weight-slider">
        <el-slider
          v-model="weight1"
          :min="0"
          :max="1"
          :step="0.01"
          show-stops
          @change="onWeightChange"
          data-testid="slider-weight1"
        >
          <template #default="{ value }">
            <span class="slider-label">
              {{ objectives[0]?.label || '目標 1' }}: {{ (value * 100).toFixed(0) }}%
            </span>
          </template>
        </el-slider>
        <span class="weight-display" data-testid="weight-display">
          {{ objectives[0]?.label }}: {{ (weight1 * 100).toFixed(0) }}% |
          {{ objectives[1]?.label }}: {{ (weight2 * 100).toFixed(0) }}%
        </span>
      </div>
    </div>

    <!-- Sampling Config -->
    <el-collapse v-model="samplingCollapse" class="sampling-section" data-testid="sampling-collapse">
      <el-collapse-item name="1" title="採樣設定">
        <div class="sampling-config" data-testid="sampling-config">
          <el-form-item label="採樣方法" prop="method">
            <el-select v-model="sampling.method" style="width: 100%" data-testid="select-sampling-method">
              <el-option label="Latin Hypercube (推薦)" value="lhs" />
              <el-option label="隨機採樣" value="random" />
              <el-option label="網格採樣" value="grid" />
            </el-select>
          </el-form-item>
          <el-form-item label="採樣點數" prop="samples">
            <el-input-number
              v-model="sampling.samples"
              :min="10"
              :max="500"
              :step="10"
              style="width: 100%"
              data-testid="input-sampling-samples"
            />
            <span class="hint">更多點 = 更精確但更慢 (建議 200-300)</span>
          </el-form-item>
        </div>
      </el-collapse-item>
    </el-collapse>

    <!-- Execute Button -->
    <div class="execute-section" data-testid="execute-section">
      <el-button
        type="primary"
        size="large"
        :loading="loading"
        :disabled="!canExecute"
        @click="executePareto"
        class="execute-btn"
        data-testid="btn-execute"
      >
        <el-icon v-if="loading"><Loading /></el-icon>
        <el-icon v-else><Collection /></el-icon>
        <span>{{ loading ? `計算中...` : '計算 Pareto 前沿' }}</span>
      </el-button>
    </div>

    <!-- Progress -->
    <div v-if="loading" class="progress-section" data-testid="progress-section">
      <el-progress :percentage="progress" :stroke-width="12" show-text data-testid="progress-bar" />
    </div>

    <!-- Result -->
    <div v-if="result" class="result-section" data-testid="result-section">
      <!-- Knee Point Highlight -->
      <div v-if="result.kneePoint" class="knee-point-card" data-testid="knee-point-card">
        <h4>🎯 膝點 (最佳折衷解)</h4>
        <div class="knee-details" data-testid="knee-details">
          <div class="knee-objectives" data-testid="knee-objectives">
            <span v-for="(val, key) in result.kneePoint.objectives" :key="key">
              {{ formatObjective(key, val) }}
            </span>
          </div>
          <div class="knee-weights" data-testid="knee-weights">
            權重分佈: {{ result.kneePoint.weights.map((w, i) => `${(w * 100).toFixed(0)}%`).join(' / ') }}
          </div>
        </div>
      </div>

      <!-- Pareto Scatter Chart -->
      <ParetoScatterChart ref="paretoChart" :data="result" :objectives="objectives" :knee-point="result.kneePoint" data-testid="pareto-scatter-chart" />

      <!-- Pareto Front Table -->
      <div class="pareto-table-section" data-testid="pareto-table-section">
        <h4>Pareto 前沿解 ({{ result.paretoFront?.length || 0 }} 個)</h4>
        <el-table
          :data="paretoTableData"
          border
          stripe
          style="width: 100%"
          max-height="300"
          data-testid="pareto-table"
        >
          <el-table-column prop="rank" label="序號" width="60" align="center" />
          <el-table-column
            v-for="obj in objectives"
            :key="obj.metric"
            :prop="`obj_${obj.metric}`"
            :label="obj.label"
            width="120"
            align="center"
          />
          <el-table-column
            v-for="(sp, idx) in scanParams"
            :key="idx"
            :prop="`param_${sp.path.replace(/\\./g, '_')}`"
            :label="sp.path"
            width="120"
            align="center"
          />
        </el-table>
      </div>

      <!-- Export -->
      <div class="export-section" data-testid="export-section">
        <ExportButton
          :csvData="paretoTableData"
          :jsonData="result"
          :chartInstance="$refs.paretoChart?.chartInstance"
          :filename="'pareto-result'"
          data-testid="export-btn"
        />
      </div>
    </div>

    <!-- Disclaimer -->
    <div v-if="result" class="disclaimer" data-testid="disclaimer">
      {{ result.disclaimer }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { ArrowUp, ArrowDown, Plus, Delete, Loading, Collection, Download } from "@element-plus/icons-vue";
import { apiFetch } from "@/api/index.js";
import ParetoScatterChart from "./ParetoScatterChart.vue";
import ExportButton from "@/components/common/ExportButton.vue";
import { SCANNABLE_PARAMS } from "@/constants/simulator.js";

const props = defineProps({
  currentPrice0050: { type: Number, default: null },
  currentPriceZ2: { type: Number, default: null },
});

const emit = defineEmits(["update:params"]);

// State
const objectives = ref([]);
const scanParams = ref([{ path: "", range: [140, 180] }, { path: "", range: [3, 8] }]);
const weight1 = ref(0.5);
const sampling = ref({ method: "lhs", samples: 200 });
const samplingCollapse = ref([]);
const loading = ref(false);
const result = ref(null);
const progress = ref(0);

// Computed
const scannableParams = computed(() => SCANNABLE_PARAMS);

const supportedObjectives = computed(() => [
  { value: { metric: "strategyScore", direction: "maximize", label: "策略分數" }, label: "策略分數 (最大化)" },
  { value: { metric: "maintenanceMargin", direction: "maximize", label: "維持率" }, label: "維持率 (最大化)" },
  { value: { metric: "simulatedPrice0050", direction: "minimize", label: "推導 0050 價格" }, label: "推導 0050 價格 (最小化)" },
  { value: { metric: "simulatedPriceZ2", direction: "minimize", label: "推導 00675L 價格" }, label: "推導 00675L 價格 (最小化)" },
]);

const weight2 = computed(() => 1 - weight1.value);

const canExecute = computed(() => {
  if (objectives.value.length !== 2) return false;
  if (scanParams.value.length < 2) return false;
  return scanParams.value.every(
    (sp) => sp.path && sp.range[0] != null && sp.range[1] != null && sp.range[0] < sp.range[1]
  );
});

const paretoTableData = computed(() => {
  if (!result.value?.paretoFront) return [];
  return result.value.paretoFront.map((p, idx) => {
    const row = { rank: idx + 1 };
    objectives.value.forEach((obj) => {
      row[`obj_${obj.metric}`] = p.objectives[obj.metric]?.toFixed(2) ?? '—';
    });
    scanParams.value.forEach((sp) => {
      row[`param_${sp.path.replace(/\./g, '_')}`] = p.params[sp.path]?.toFixed(2) ?? '—';
    });
    return row;
  });
});

// Methods
function getScanParamMin(path) {
  const def = SCANNABLE_PARAMS.find((p) => p.path === path);
  return def?.min ?? 50;
}

function getScanParamMax(path) {
  const def = SCANNABLE_PARAMS.find((p) => p.path === path);
  return def?.max ?? 500;
}

function addScanParam() {
  if (scanParams.value.length >= 5) return;
  scanParams.value.push({ path: "", range: [140, 180] });
}

function removeScanParam(idx) {
  if (scanParams.value.length <= 2) return;
  scanParams.value.splice(idx, 1);
}

function onWeightChange(val) {
  weight1.value = val;
}

function formatObjective(key, val) {
  if (val === null || val === undefined) return `${key}: —`;
  const obj = objectives.value.find((o) => o.metric === key);
  const suffix = obj?.direction === "maximize" ? " ↑" : " ↓";
  return `${obj?.label || key}: ${val.toFixed(2)}${suffix}`;
}

function getDirectionType(obj) {
  return obj.direction === "maximize" ? "success" : "warning";
}

function getDirectionText(obj) {
  return obj.direction === "maximize" ? "最大化" : "最小化";
}

async function executePareto() {
  if (!canExecute.value) {
    ElMessage.warning("請選擇 2 個目標、至少 2 個掃描參數並設定範圍");
    return;
  }

  loading.value = true;
  progress.value = 0;
  result.value = null;

  // 模擬進度
  const progressInterval = setInterval(() => {
    progress.value = Math.min(90, progress.value + 5);
  }, 300);

  try {
    const payload = {
      baseParams: {
        price0050: props.currentPrice0050 || 175,
        priceZ2: props.currentPriceZ2 || 275,
      },
      scanParams: scanParams.value.map((sp) => ({
        path: sp.path,
        range: sp.range,
      })),
      objectives: objectives.value,
      weights: [weight1.value, weight2.value],
      sampling: sampling.value,
    };

    const response = await apiFetch("/api/v1/simulate/pareto", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    result.value = response;
    progress.value = 100;
    ElMessage.success("Pareto 前沿計算完成");
  } catch (err) {
    ElMessage.error("計算失敗: " + (err.body?.message || err.message));
  } finally {
    clearInterval(progressInterval);
    loading.value = false;
    progress.value = 0;
  }
}

function exportCSV() {
  if (!result.value?.paretoFront) return;
  
  const headers = [
    "Rank",
    ...objectives.value.map((o) => o.label),
    ...scanParams.value.map((sp) => sp.path),
  ];
  
  const rows = result.value.paretoFront.map((p, idx) => [
    idx + 1,
    ...objectives.value.map((o) => p.objectives[o.metric]?.toFixed(2) ?? ''),
    ...scanParams.value.map((sp) => p.params[sp.path]?.toFixed(2) ?? ''),
  ]);
  
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pareto-front-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success("CSV 已匯出");
}

function exportJSON() {
  if (!result.value) return;
  
  const blob = new Blob([JSON.stringify(result.value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pareto-result-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success("JSON 已匯出");
}

// Initialize
onMounted(() => {
  if (scanParams.value.length === 0) {
    scanParams.value = [
      { path: "maintenance.protectTrigger", range: [140, 180] },
      { path: "buy.minDropPercentToConsider", range: [3, 8] },
    ];
  }
});
</script>

<style scoped>
.pareto-panel {
  padding: 16px;
  max-width: 1000px;
  margin: 0 auto;
}

.pareto-header {
  text-align: center;
  margin-bottom: 24px;
}

.pareto-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 4px;
}

.pareto-subtitle {
  font-size: 13px;
  color: #888;
}

.objective-selector,
.scan-params-section,
.weight-section,
.sampling-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #eee;
}

.objective-selector label,
.scan-params-section label,
.weight-section label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.direction-indicators {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.direction-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.scan-params-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scan-param-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.weight-slider {
  display: flex;
  align-items: center;
  gap: 16px;
}

.weight-slider .el-slider {
  flex: 1;
  max-width: 400px;
}

.weight-display {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  min-width: 200px;
}

.sampling-config {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 8px 0;
}

.execute-section {
  display: flex;
  justify-content: center;
  margin: 24px 0;
}

.execute-btn {
  min-width: 220px;
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

.knee-point-card {
  background: linear-gradient(135deg, #fff8e1 0%, #fff3c4 100%);
  border: 1px solid #ffe082;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.knee-point-card h4 {
  margin: 0 0 12px;
  color: #e65100;
}

.knee-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.knee-objectives {
  display: flex;
  gap: 24px;
  font-size: 14px;
  font-weight: 500;
}

.knee-weights {
  font-size: 12px;
  color: #bf360c;
}

.pareto-table-section {
  margin-top: 24px;
}

.export-section {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
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