<template>
  <div class="batch-panel" data-testid="batch-panel">
    <!-- Header -->
    <div class="batch-header">
      <h3 class="batch-title">批次模擬</h3>
      <p class="batch-subtitle">多組參數並行模擬，快速比較結果</p>
    </div>

    <!-- Job Configuration -->
    <div class="job-config-section">
      <div class="section-header">
        <h4>任務配置</h4>
        <div class="header-actions">
          <el-button type="primary" size="small" @click="addJobFromTemplate">
            <el-icon><Plus /></el-icon> 從模板新增
          </el-button>
          <el-button size="small" @click="addJob">
            <el-icon><Plus /></el-icon> 新增任務
          </el-button>
        </div>
      </div>

      <div class="jobs-list">
        <template v-for="(job, index) in jobs" :key="index">
          <div class="job-card" :class="{ 'has-error': jobErrors[index]?.length }" data-testid="job-card">
            <div class="job-header">
              <span class="job-number">任務 {{ index + 1 }}</span>
              <div class="job-actions">
                <el-tooltip content="複製任務" placement="top">
                  <el-button size="small" link @click="duplicateJob(index)">
                    <el-icon><DocumentCopy /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip content="刪除任務" placement="top">
                  <el-button size="small" link type="danger" @click="removeJob(index)" :disabled="jobs.length <= 1">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
            </div>

            <div class="job-fields">
              <el-form-item label="0050 價格" prop="price0050" :error="jobErrors[index]?.price0050">
                <el-input-number
                  v-model="job.price0050"
                  :min="50"
                  :max="500"
                  :step="0.01"
                  :precision="2"
                  placeholder="請輸入 0050 價格"
                  style="width: 100%"
                  @change="validateJob(index)"
                  data-testid="job-price0050"
                />
              </el-form-item>

              <el-form-item label="00675L 價格 (選填)" prop="priceZ2" :error="jobErrors[index]?.priceZ2">
                <el-input-number
                  v-model="job.priceZ2"
                  :min="50"
                  :max="500"
                  :step="0.01"
                  :precision="2"
                  placeholder="留空則自動按比例計算"
                  style="width: 100%"
                  @change="validateJob(index)"
                  data-testid="job-priceZ2"
                />
              </el-form-item>
            </div>

            <div v-if="jobErrors[index]?.length" class="job-errors">
              <span v-for="err in jobErrors[index]" :key="err" class="error-text">{{ err }}</span>
            </div>
          </div>
        </template>
      </div>

      <div v-if="jobs.length === 0" class="empty-state" data-testid="empty-state">
        <el-icon><Document /></el-icon>
        <p>暫無任務，請點擊「新增任務」開始配置</p>
      </div>
    </div>

    <!-- Execution Options -->
    <el-collapse v-model="optionsCollapse" class="options-section" data-testid="options-collapse">
      <el-collapse-item name="1" title="執行選項">
        <div class="options-grid">
          <el-form-item label="併發數" prop="concurrency">
            <el-input-number
              v-model="options.concurrency"
              :min="1"
              :max="16"
              :step="1"
              style="width: 100%"
              data-testid="option-concurrency"
            />
            <span class="help-text">同時執行的任務數量 (1-16)</span>
          </el-form-item>

          <el-form-item label="重試次數" prop="retryAttempts">
            <el-input-number
              v-model="options.retryAttempts"
              :min="0"
              :max="5"
              :step="1"
              style="width: 100%"
              data-testid="option-retryAttempts"
            />
            <span class="help-text">失敗時的重試次數 (0-5)</span>
          </el-form-item>

          <el-form-item label="重試間隔 (ms)" prop="retryDelayMs">
            <el-input-number
              v-model="options.retryDelayMs"
              :min="0"
              :max="10000"
              :step="100"
              style="width: 100%"
              data-testid="option-retryDelayMs"
            />
            <span class="help-text">重試間隔毫秒數 (0-10000)</span>
          </el-form-item>
        </div>
      </el-collapse-item>
    </el-collapse>

    <!-- Import/Export -->
    <div class="import-export-section" data-testid="import-export-section">
      <el-button @click="importJobs" :disabled="importing" data-testid="btn-import">
        <el-icon><Upload /></el-icon> 匯入 JSON
      </el-button>
      <ExportButton
        :jsonData="{ jobs: jobs.map(j => ({ price0050: j.price0050, priceZ2: j.priceZ2 })), options: options }"
        :filename="'batch-config'"
        type="default"
        size="small"
        data-testid="export-config-btn"
      />
      <input type="file" ref="fileInput" @change="handleFileImport" accept=".json" style="display: none" />
    </div>

    <!-- Execute Button -->
    <div class="execute-section" data-testid="execute-section">
      <el-button
        type="primary"
        size="large"
        :loading="executing"
        :disabled="jobs.length === 0 || executing || !isValid"
        @click="executeBatch"
        class="execute-btn"
        data-testid="btn-execute"
      >
        <el-icon v-if="executing"><Loading /></el-icon>
        <el-icon v-else><VideoPlay /></el-icon>
        <span>{{ executing ? `執行中... ${completedCount}/${jobs.length}` : '開始批次模擬' }}</span>
      </el-button>
      <el-button v-if="executing" @click="cancelExecution" class="cancel-btn" data-testid="btn-cancel">
        <el-icon><Close /></el-icon> 取消
      </el-button>
    </div>

    <!-- Progress -->
    <div v-if="executing || (lastResult && lastResult.totalJobs > 0)" class="progress-section" data-testid="progress-section">
      <div class="progress-header">
        <span class="progress-title">執行進度</span>
        <span class="progress-stats">{{ completedCount }} / {{ jobs.length }} 完成</span>
      </div>
      <el-progress
        :percentage="progressPercent"
        :status="executing ? undefined : (lastResult?.failed > 0 ? 'exception' : 'success')"
        :stroke-width="12"
        show-text
        data-testid="progress-bar"
      />
      <div class="progress-details">
        <span :class="['stat', 'success']">成功: {{ lastResult?.successful || 0 }}</span>
        <span :class="['stat', 'failed']">失敗: {{ lastResult?.failed || 0 }}</span>
        <span :class="['stat', 'pending']">進行中: {{ Math.max(0, jobs.length - (lastResult?.successful || 0) - (lastResult?.failed || 0)) }}</span>
      </div>
    </div>

    <!-- Results Table -->
    <div v-if="lastResult && lastResult.results && lastResult.results.length > 0" class="results-section" data-testid="results-section">
      <div class="results-header">
        <h4>批次結果 ({{ lastResult.totalJobs }} 任務, 成功 {{ lastResult.successful }}, 失敗 {{ lastResult.failed }})</h4>
        <div class="results-actions">
          <ExportButton
            :csvData="tableData"
            :jsonData="lastResult"
            :filename="'batch-result'"
            type="primary"
            size="small"
            data-testid="export-results-btn"
          />
          <el-button size="small" @click="clearResults" data-testid="btn-clear-results">
            <el-icon><Delete /></el-icon> 清除結果
          </el-button>
        </div>
      </div>

      <el-table
        :data="tableData"
        border
        stripe
        style="width: 100%"
        max-height="400"
        data-testid="results-table"
      >
        <el-table-column prop="jobIndex" label="任務" width="80" align="center" />
        <el-table-column prop="price0050" label="0050 價格" width="120" align="center" />
        <el-table-column prop="priceZ2" label="00675L 價格" width="120" align="center" />
        <el-table-column prop="status" label="狀態" width="100" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.success ? 'success' : 'danger'">
              {{ scope.row.success ? '成功' : '失敗' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="simulatedPrice0050" label="Derived 0050" width="120" align="center" />
        <el-table-column prop="strategyScore" label="Strategy Score" width="100" align="center" />
        <el-table-column prop="maintenanceMargin" label="Maintenance Rate" width="100" align="center" />
        <el-table-column prop="error" label="Error" min-width="200" />
        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.success"
              size="small"
              type="primary"
              link
              @click="viewDetail(scope.row)"
              data-testid="btn-view-detail"
            >
              查看詳情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Detail Dialog -->
    <el-dialog
      v-model="detailVisible"
      :title="detailTitle"
      width="800"
      :fullscreen="false"
      data-testid="detail-dialog"
    >
      <div v-if="detailData" class="detail-content">
        <ReverseResultCard :result="detailData.result" />
      </div>
      <template #footer>
        <el-button @click="detailVisible = false" data-testid="btn-close-detail">關閉</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Delete, DocumentCopy, Upload, VideoPlay, Loading, Close } from "@element-plus/icons-vue";
import { apiFetch } from "@/api/index.js";
import ReverseResultCard from "./ReverseResultCard.vue";
import ExportButton from "@/components/common/ExportButton.vue";

const props = defineProps({
  currentPrice0050: { type: Number, default: null },
  currentPriceZ2: { type: Number, default: null },
});

const emit = defineEmits(["update:jobs"]);

// State
const jobs = ref([]);
const jobErrors = ref([]);
const options = ref({
  concurrency: 4,
  retryAttempts: 2,
  retryDelayMs: 1000,
});
const optionsCollapse = ref([]);
const executing = ref(false);
const completedCount = ref(0);
const lastResult = ref(null);
const detailVisible = ref(false);
const detailData = ref(null);
const importing = ref(false);
const fileInput = ref(null);
const abortController = ref(null);

// Computed
const isValid = computed(() => {
  if (jobs.value.length === 0) return false;
  return jobs.value.every((job, i) =>
    job.price0050 != null &&
    Number.isFinite(job.price0050) &&
    job.price0050 > 0 &&
    !jobErrors.value[i]?.length
  );
});

const progressPercent = computed(() => {
  if (jobs.value.length === 0) return 0;
  return Math.round((completedCount.value / jobs.value.length) * 100);
});

const tableData = computed(() => {
  if (!lastResult.value?.results) return [];
  return lastResult.value.results.map((r, idx) => ({
    jobIndex: idx + 1,
    price0050: r.input?.price0050 ?? '—',
    priceZ2: r.input?.priceZ2 ?? '—',
    success: r.success,
    result: r.result,
    error: r.error,
  }));
});

// Methods
function addJob() {
  const newJob = {
    price0050: props.currentPrice0050 || 175,
    priceZ2: null,
  };
  jobs.value.push(newJob);
  jobErrors.value.push([]);
  nextTick(() => {
    // Scroll to new job
  });
}

function addJobFromTemplate() {
  const templates = [
    { name: "當前價格", price0050: props.currentPrice0050 || 175, priceZ2: props.currentPriceZ2 || 275 },
    { name: "上漲 5%", price0050: (props.currentPrice0050 || 175) * 1.05, priceZ2: (props.currentPriceZ2 || 275) * 1.05 },
    { name: "下跌 5%", price0050: (props.currentPrice0050 || 175) * 0.95, priceZ2: (props.currentPriceZ2 || 275) * 0.95 },
    { name: "上漲 10%", price0050: (props.currentPrice0050 || 175) * 1.10, priceZ2: (props.currentPriceZ2 || 275) * 1.10 },
    { name: "下跌 10%", price0050: (props.currentPrice0050 || 175) * 0.90, priceZ2: (props.currentPriceZ2 || 275) * 0.90 },
  ];

  ElMessageBox.prompt("選擇模板或自訂", "從模板新增", {
    confirmButtonText: "確定",
    cancelButtonText: "取消",
    inputPattern: /^.+$/,
    inputValidator: (val) => templates.some(t => t.name === val),
    inputErrorMessage: "請選擇有效模板名稱",
  }).then(({ value }) => {
    const template = templates.find(t => t.name === value);
    if (template) {
      jobs.value.push({ ...template });
      jobErrors.value.push([]);
      ElMessage.success(`已新增模板：${template.name}`);
    }
  }).catch(() => {});
}

function duplicateJob(index) {
  jobs.value.splice(index + 1, 0, { ...jobs.value[index] });
  jobErrors.value.splice(index + 1, 0, []);
}

function removeJob(index) {
  if (jobs.value.length <= 1) {
    ElMessage.warning("至少保留一個任務");
    return;
  }
  jobs.value.splice(index, 1);
  jobErrors.value.splice(index, 1);
}

function validateJob(index) {
  const job = jobs.value[index];
  const errors = [];

  if (job.price0050 == null || !Number.isFinite(job.price0050) || job.price0050 <= 0) {
    errors.push("0050 價格必須為有效正數");
  } else if (job.price0050 < 50 || job.price0050 > 500) {
    errors.push("0050 價格必須在 50-500 之間");
  }

  if (job.priceZ2 != null) {
    if (!Number.isFinite(job.priceZ2) || job.priceZ2 <= 0) {
      errors.push("00675L 價格必須為有效正數");
    } else if (job.priceZ2 < 50 || job.priceZ2 > 500) {
      errors.push("00675L 價格必須在 50-500 之間");
    }
  }

  jobErrors.value[index] = errors;
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  importing.value = true;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.jobs && Array.isArray(data.jobs)) {
        jobs.value = data.jobs.map(j => ({
          price0050: j.price0050,
          priceZ2: j.priceZ2 ?? null,
        }));
        jobErrors.value = jobs.value.map(() => []);

        if (data.options) {
          options.value = { ...options.value, ...data.options };
        }
        ElMessage.success(`已匯入 ${jobs.value.length} 個任務`);
      } else {
        ElMessage.error("無效的檔案格式");
      }
    } catch (err) {
      ElMessage.error("檔案解析失敗: " + err.message);
    } finally {
      importing.value = false;
      fileInput.value.value = "";
    }
  };
  reader.readAsText(file);
}

function importJobs() {
  fileInput.value?.click();
}

function clearResults() {
  lastResult.value = null;
  completedCount.value = 0;
}

function viewDetail(row) {
  detailData.value = row;
  detailVisible.value = true;
  // detailTitle 沒有被定義為 ref，可以直接忽略，因為 detailDialog 使用了靜態 title="模擬詳情"
}

async function executeBatch() {
  // Validate all jobs
  let allValid = true;
  jobs.value.forEach((job, i) => {
    validateJob(i);
    if (jobErrors.value[i].length > 0) allValid = false;
  });

  if (!allValid) {
    ElMessage.error("請修正所有錯誤後再執行");
    return;
  }

  executing.value = true;
  completedCount.value = 0;
  lastResult.value = null;
  abortController.value = new AbortController();

  try {
    const response = await apiFetch("/api/v1/simulate/batch", {
      method: "POST",
      body: JSON.stringify({
        jobs: jobs.value.map(j => ({
          price0050: j.price0050,
          priceZ2: j.priceZ2,
        })),
        options: options.value,
      }),
      signal: abortController.value.signal,
    });

    lastResult.value = response;
    completedCount.value = response.totalJobs;

    if (response.failed > 0) {
      ElMessage.warning(`批次完成：成功 ${response.successful}，失敗 ${response.failed}`);
    } else {
      ElMessage.success(`批次完成：全部 ${response.successful} 個任務成功`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      ElMessage.info("已取消執行");
    } else {
      ElMessage.error("批次執行失敗: " + (err.body?.message || err.message));
    }
  } finally {
    executing.value = false;
    abortController.value = null;
  }
}

function cancelExecution() {
  if (abortController.value) {
    abortController.value.abort();
  }
}

// Watch for job changes
watch(jobs, (newJobs) => {
  emit("update:jobs", newJobs);
}, { deep: true });

// Initialize with one job if empty
if (jobs.value.length === 0) {
  addJob();
}
</script>

<style scoped>
.batch-panel {
  padding: 16px;
  max-width: 1000px;
  margin: 0 auto;
}

.batch-header {
  text-align: center;
  margin-bottom: 24px;
}

.batch-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 4px;
}

.batch-subtitle {
  font-size: 13px;
  color: #888;
}

.job-config-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h4 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.jobs-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.job-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 16px;
  transition: box-shadow 0.2s;
}

.job-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.job-card.has-error {
  border-color: #f56c6c;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.job-number {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.job-actions {
  display: flex;
  gap: 4px;
}

.job-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.job-errors {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef0f0;
  border-radius: 6px;
  border: 1px solid #fde2e2;
}

.error-text {
  display: block;
  font-size: 12px;
  color: #f56c6c;
  margin-bottom: 4px;
}

.error-text:last-child {
  margin-bottom: 0;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #999;
}

.empty-state .el-icon {
  font-size: 48px;
  margin-bottom: 12px;
  display: block;
}

.options-section {
  margin-bottom: 16px;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 8px 0;
}

.help-text {
  display: block;
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.import-export-section {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.execute-section {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin: 24px 0;
}

.execute-btn {
  min-width: 200px;
}

.cancel-btn {
  margin-top: 8px;
}

.progress-section {
  margin: 24px 0;
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #eee;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
}

.progress-stats {
  color: #666;
}

.progress-details {
  display: flex;
  justify-content: space-around;
  margin-top: 12px;
  font-size: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat.success { color: #2e7d32; }
.stat.failed { color: #c62828; }
.stat.pending { color: #e65100; }

.results-section {
  margin-top: 24px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.results-header h4 {
  margin: 0;
  font-size: 16px;
}

.results-actions {
  display: flex;
  gap: 8px;
}

.detail-content {
  padding: 8px 0;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
}
</style>