<template>
  <div class="view-container">
    <!-- Summary View (Default) -->
    <div v-if="currentView === 'summary'" class="summary-view">
      <!-- Header -->
      <div class="view-header">
        <h2 class="view-title">🎯 投資健康度儀表板</h2>
        <span v-if="reportDate" class="view-subtitle">數據日期: {{ reportDate }}</span>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="state-box">
        <div class="spinner"></div>
        <p>載入中...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="state-box state-error">
        <p>⚠️ {{ error }}</p>
        <button class="retry-btn" @click="loadData">重試</button>
      </div>

      <!-- Empty State -->
      <div v-else-if="isEmpty" class="state-box">
        <p>📭 尚無理論數據</p>
        <span class="state-hint">非交易日或數據不足</span>
      </div>

      <!-- Summary Cards -->
      <div v-else class="cards-container">
        <!-- Kelly Leverage -->
        <KellyLeverageSummary
          :theory="theory"
          @view-detail="showDetail('kelly')"
        />

        <!-- Exposure -->
        <ExposureSummary
          :theory="theory"
          :portfolio-snapshot="portfolioSnapshot"
          @view-detail="showDetail('exposure')"
        />

        <!-- Lifecycle -->
        <LifecycleSummary
          :theory="theory"
          @view-detail="showDetail('lifecycle')"
        />

        <!-- Input Data -->
        <InputDataSummary
          :inputs="inputs"
          :report-date="reportDate"
          @view-detail="showDetail('inputData')"
        />

        <!-- Disclaimer -->
        <div class="disclaimer-card">
          <p class="disclaimer-title">⚠️ 免責聲明</p>
          <p class="disclaimer-text">
            此分析僅供研究參考，不構成投資建議。實際決策請參考既有風控機制。
          </p>
        </div>
      </div>
    </div>

    <!-- Detail View -->
    <div v-else-if="currentView === 'detail'" class="detail-view">
      <!-- Kelly Leverage Detail -->
      <KellyLeverageDetail
        v-if="detailType === 'kelly'"
        :theory="theory"
        :portfolio-snapshot="portfolioSnapshot"
        @back="showSummary"
      />

      <!-- Exposure Detail -->
      <ExposureDetail
        v-else-if="detailType === 'exposure'"
        :theory="theory"
        :portfolio-snapshot="portfolioSnapshot"
        :inputs="inputs"
        @back="showSummary"
      />

      <!-- Lifecycle Detail -->
      <LifecycleDetail
        v-else-if="detailType === 'lifecycle'"
        :theory="theory"
        @back="showSummary"
      />

      <!-- Input Data Detail -->
      <InputDataDetail
        v-else-if="detailType === 'inputData'"
        :inputs="inputs"
        :report-date="reportDate"
        @back="showSummary"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useTheoryData } from "../composables/useTheoryData.js";
import { waitReady } from "../composables/useTelegram.js";

// Summary Components
import KellyLeverageSummary from "../components/theory/KellyLeverageSummary.vue";
import ExposureSummary from "../components/theory/ExposureSummary.vue";
import LifecycleSummary from "../components/theory/LifecycleSummary.vue";
import InputDataSummary from "../components/theory/InputDataSummary.vue";

// Detail Components
import KellyLeverageDetail from "../components/theory/KellyLeverageDetail.vue";
import ExposureDetail from "../components/theory/ExposureDetail.vue";
import LifecycleDetail from "../components/theory/LifecycleDetail.vue";
import InputDataDetail from "../components/theory/InputDataDetail.vue";

// Composable
const {
  loading,
  error,
  fetch: fetchTheoryData,
  isEmpty,
  theory,
  inputs,
  portfolioSnapshot,
  reportDate,
} = useTheoryData();

// View state
const currentView = ref("summary"); // 'summary' | 'detail'
const detailType = ref(null); // 'kelly' | 'exposure' | 'lifecycle' | 'inputData'

// Load data
async function loadData() {
  await fetchTheoryData();
}

// Show detail view
function showDetail(type) {
  detailType.value = type;
  currentView.value = "detail";
  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Show summary view
function showSummary() {
  currentView.value = "summary";
  detailType.value = null;
  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Mount
onMounted(async () => {
  await waitReady();
  await loadData();
});
</script>

<style scoped>
.view-container {
  min-height: 100vh;
  background: var(--tg-theme-bg-color, #fff);
}

.summary-view {
  padding: 16px;
}

.view-header {
  margin-bottom: 16px;
}

.view-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 4px 0;
}

.view-subtitle {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #999);
}

/* State Box */
.state-box {
  text-align: center;
  padding: 40px 16px;
}

.state-box p {
  font-size: 15px;
  color: var(--tg-theme-hint-color, #999);
  margin: 0 0 8px 0;
}

.state-hint {
  font-size: 13px;
  color: var(--tg-theme-hint-color, #aaa);
}

.state-error p {
  color: #f44336;
}

.retry-btn {
  margin-top: 12px;
  padding: 10px 20px;
  background: var(--tg-theme-button-color, #3390ec);
  color: var(--tg-theme-button-text-color, #fff);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.retry-btn:active {
  opacity: 0.8;
}

/* Spinner */
.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid var(--tg-theme-hint-color, #e0e0e0);
  border-top-color: var(--tg-theme-button-color, #3390ec);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Cards Container */
.cards-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Disclaimer Card */
.disclaimer-card {
  background: rgba(158, 158, 158, 0.08);
  border-left: 3px solid #9e9e9e;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}

.disclaimer-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #222);
  margin: 0 0 6px 0;
}

.disclaimer-text {
  font-size: 12px;
  color: var(--tg-theme-hint-color, #666);
  line-height: 1.6;
  margin: 0;
}

/* Detail View */
.detail-view {
  /* Detail components handle their own styling */
}
</style>
