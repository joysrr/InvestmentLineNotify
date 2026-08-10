<template>
  <div class="backtest-report-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <h2 class="view-title">回測報表</h2>
        <span class="view-subtitle">策略歷史表現分析</span>
      </div>
      <div class="header-right">
        <el-select v-model="selectedJobId" placeholder="選擇回測任務" style="width: 220px" @change="loadReport">
          <el-option
            v-for="job in jobList"
            :key="job.jobId"
            :label="job.name"
            :value="job.jobId"
          />
        </el-select>
        <el-button type="primary" @click="exportCSV" :disabled="!currentReport">
          <el-icon><Download /></el-icon> 匯出 CSV
        </el-button>
        <el-button @click="exportJSON" :disabled="!currentReport">
          <el-icon><Document /></el-icon> 匯出 JSON
        </el-button>
      </div>
    </div>

    <!-- Loading / Error / Empty -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>載入回測報表中...</p>
    </div>
    <div v-else-if="error" class="state-box state-error">
      <p>⚠️ {{ error }}</p>
      <el-button @click="loadReport">重試</el-button>
    </div>
    <div v-else-if="!currentReport" class="state-box">
      <p>📭 請選擇回測任務</p>
    </div>

    <!-- Report Content -->
    <div v-else class="report-content">
      <!-- Overview Cards -->
      <div class="metrics-grid">
        <MetricCard title="總報酬率" :value="formatPct(summary.returnPct)" :trend="summary.returnPct >= 0 ? 'up' : 'down'" icon="📈" />
        <MetricCard title="最大回撤" :value="formatPct(maxDrawdown)" trend="down" icon="📉" />
        <MetricCard title="最終淨值" :value="formatNumber(summary.finalNetAsset)" icon="💰" />
        <MetricCard title="最終槓桿" :value="summary.finalLeverage.toFixed(2) + 'x'" icon="⚖️" />
        <MetricCard title="最低維持率" :value="summary.minMm === 999 ? 'N/A' : summary.minMm.toFixed(1) + '%'" icon="🛡️" />
        <MetricCard title="勝率" :value="formatPct(overallWinRate)" icon="🎯" />
      </div>

      <!-- Tabs -->
      <div class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Equity Curve -->
        <div v-if="activeTab === 'equity'" class="chart-container">
          <div class="chart-header">
            <h3>權益曲線</h3>
            <el-checkbox v-model="showBenchmark" @change="renderEquityChart">顯示基準 (0050 Buy & Hold)</el-checkbox>
          </div>
          <div class="chart-wrapper" style="height: 400px">
            <v-chart ref="equityChart" :option="equityOption" autoresize />
          </div>
        </div>

        <!-- Drawdown -->
        <div v-else-if="activeTab === 'drawdown'" class="chart-container">
          <div class="chart-header">
            <h3>回撤分析</h3>
          </div>
          <div class="chart-wrapper" style="height: 400px">
            <v-chart ref="drawdownChart" :option="drawdownOption" autoresize />
          </div>
          <div class="dd-stats">
            <div class="dd-stat">
              <span class="dd-label">最大回撤</span>
              <span class="dd-value text-danger">{{ formatPct(maxDrawdown) }}</span>
            </div>
            <div class="dd-stat">
              <span class="dd-label">最長回撤天數</span>
              <span class="dd-value">{{ maxDrawdownDays }} 天</span>
            </div>
            <div class="dd-stat">
              <span class="dd-label">當前回撤</span>
              <span class="dd-value" :class="currentDrawdown <= -5 ? 'text-danger' : 'text-warn'">{{ formatPct(currentDrawdown) }}</span>
            </div>
          </div>
        </div>

        <!-- SignalCategory -->
        <div v-else-if="activeTab === 'signalCategory'" class="chart-container">
          <div class="chart-header">
            <h3>SignalCategory 分組統計</h3>
          </div>
          <div class="chart-wrapper" style="height: 400px">
            <v-chart ref="signalCategoryChart" :option="signalCategoryOption" autoresize />
          </div>
          <SignalCategoryTable :stats="signalCategoryStats" />
        </div>

        <!-- Detail Table -->
        <div v-else-if="activeTab === 'detail'" class="chart-container">
          <div class="chart-header">
            <h3>逐日明細</h3>
            <el-input v-model="tableFilter" placeholder="篩選日期/訊號..." class="filter-input" />
          </div>
          <div class="table-wrapper">
            <table class="detail-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>淨資產</th>
                  <th>0050持股</th>
                  <th>00675L持股</th>
                  <th>總借款</th>
                  <th>槓桿</th>
                  <th>維持率</th>
                  <th>SignalCategory</th>
                  <th>SignalType</th>
                  <th>0050價格</th>
                  <th>00675L價格</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in filteredResults" :key="r.date">
                  <td>{{ r.date }}</td>
                  <td>{{ formatNumber(r.netAsset) }}</td>
                  <td>{{ r.qty0050 }}</td>
                  <td>{{ r.qtyZ2 }}</td>
                  <td>{{ formatNumber(r.totalLoan) }}</td>
                  <td>{{ r.actualLeverage.toFixed(2) }}</td>
                  <td>{{ r.maintenanceMargin === 999 ? 'N/A' : r.maintenanceMargin.toFixed(1) + '%' }}</td>
                  <td><span class="badge" :class="categoryClass(r.signalCategory)">{{ r.signalCategory }}</span></td>
                  <td><span class="badge badge-type">{{ r.signalType }}</span></td>
                  <td>{{ r.price0050.toFixed(2) }}</td>
                  <td>{{ r.priceZ2.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
// import { ElMessage } from "element-plus"; // REMOVED - not installed
// import { Download, Document } from "@element-plus/icons-vue"; // REMOVED - not installed
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import MetricCard from "@/components/dashboard/MetricCard.vue";
import SignalCategoryTable from "@/views/BacktestReportView/components/SignalCategoryTable.vue";

use([
  LineChart, BarChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  CanvasRenderer
]);

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref(null);
const jobList = ref([]);
const selectedJobId = ref(route.query.jobId || null);
const currentReport = ref(null);
const activeTab = ref("equity");
const showBenchmark = ref(true);
const tableFilter = ref("");

const equityChart = ref(null);
const drawdownChart = ref(null);
const signalCategoryChart = ref(null);

const tabs = [
  { key: "equity", label: "權益曲線" },
  { key: "drawdown", label: "回撤分析" },
  { key: "signalCategory", label: "SignalCategory" },
  { key: "detail", label: "逐日明細" },
];

// Summary computed
const summary = computed(() => currentReport.value?.summary || {});
const results = computed(() => currentReport.value?.results || []);
const signalCategoryStats = computed(() => currentReport.value?.summary?.signalCategoryStats || null);

// Charts
const equityOption = ref({});
const drawdownOption = ref({});
const signalCategoryOption = ref({});

// Load job list
async function loadJobList() {
  try {
    const res = await fetch("/api/backtest/results");
    const data = await res.json();
    jobList.value = data;
    if (!selectedJobId.value && data.length > 0) {
      selectedJobId.value = data[0].jobId;
    }
  } catch (e) {
    console.error("載入任務列表失敗:", e);
  }
}

// Load report
async function loadReport() {
  if (!selectedJobId.value) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const res = await fetch(`/api/backtest/results/${selectedJobId.value}`);
    if (!res.ok) throw new Error("載入失敗");
    const data = await res.json();
    currentReport.value = data;
    renderAllCharts();
  } catch (e) {
    error.value = e.message;
    ElMessage.error("載入回測報表失敗: " + e.message);
  } finally {
    loading.value = false;
  }
}

// Render charts
function renderAllCharts() {
  if (!currentReport.value) return;
  
  // Equity
  const equityData = generateChartData(results.value, "equity");
  equityOption.value = {
    title: { text: "權益曲線", left: "center" },
    tooltip: { trigger: "axis" },
    legend: { data: ["策略淨值", "基準 (0050 Buy & Hold)"], top: 30 },
    grid: { left: 50, right: 30, bottom: 50, top: 60 },
    xAxis: { type: "category", data: equityData.labels },
    yAxis: { type: "value", name: "淨資產" },
    series: equityData.datasets.map(d => ({
      name: d.label,
      type: "line",
      data: d.data,
      smooth: true,
      lineStyle: { color: d.borderColor },
      areaStyle: d.fill ? { color: d.backgroundColor } : {},
    })),
  };
  
  // Drawdown
  const ddData = generateChartData(results.value, "drawdown");
  const maxDD = Math.min(...ddData.datasets[0].data);
  const maxDDIndex = ddData.datasets[0].data.indexOf(maxDD);
  let peakIdx = 0;
  let maxDDDays = 0;
  let peak = -Infinity;
  for (let i = 0; i < results.value.length; i++) {
    if (results.value[i].netAsset > peak) {
      peak = results.value[i].netAsset;
      peakIdx = i;
    }
    const dd = peak > 0 ? ((results.value[i].netAsset - peak) / peak) * 100 : 0;
    if (dd <= maxDD * 1.01) {
      maxDDDays = i - peakIdx;
    }
  }
  
  maxDrawdown.value = maxDD / 100;
  maxDrawdownDays.value = maxDDDays;
  currentDrawdown.value = results.value.length > 0 ? ((results.value[results.value.length - 1].netAsset - peak) / peak) * 100 : 0;
  
  drawdownOption.value = {
    title: { text: "回撤分析", left: "center" },
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 30, bottom: 50, top: 60 },
    xAxis: { type: "category", data: ddData.labels },
    yAxis: { type: "value", name: "回撤 %", axisLabel: { formatter: "{value}%" } },
    series: [{
      name: "回撤 %",
      type: "line",
      data: ddData.datasets[0].data,
      areaStyle: { color: "rgba(232, 72, 85, 0.2)" },
      lineStyle: { color: "#e84855" },
    }],
  };
  
  // SignalCategory
  if (signalCategoryStats.value) {
    const scData = generateChartData(currentReport.value.summary, "signalCategory");
    signalCategoryOption.value = {
      title: { text: "SignalCategory 分布", left: "center" },
      tooltip: { trigger: "axis" },
      legend: { data: ["天數", "勝率 %", "平均分數"], top: 30 },
      grid: { left: 50, right: 30, bottom: 50, top: 60 },
      xAxis: { type: "category", data: scData.labels },
      yAxis: [
        { type: "value", name: "天數", position: "left" },
        { type: "value", name: "勝率/分數", position: "right" },
      ],
      series: scData.datasets.map((d, idx) => ({
        name: d.label,
        type: idx === 0 ? "bar" : "line",
        data: d.data,
        yAxisIndex: idx === 0 ? 0 : 1,
        itemStyle: { color: d.backgroundColor },
        lineStyle: { color: d.borderColor, type: d.borderDash ? "dashed" : "solid" },
      })),
    };
  }
}

// Filters
const filteredResults = computed(() => {
  if (!tableFilter.value) return results.value;
  const f = tableFilter.value.toLowerCase();
  return results.value.filter(r => 
    r.date.includes(f) || 
    r.signalCategory.toLowerCase().includes(f) ||
    r.signalType.toLowerCase().includes(f)
  );
});

// Stats
const maxDrawdown = ref(0);
const maxDrawdownDays = ref(0);
const currentDrawdown = ref(0);
const overallWinRate = computed(() => {
  if (!signalCategoryStats.value) return 0;
  const cats = signalCategoryStats.value.categories;
  let total = 0, wins = 0;
  Object.values(cats).forEach(c => {
    total += c.count;
    wins += Math.round(c.count * (c.winRate || 0) / 100);
  });
  return total > 0 ? wins / total : 0;
});

// Helpers
function formatPct(val) {
  if (val === null || val === undefined) return "—";
  return (val >= 0 ? "+" : "") + val.toFixed(2) + "%";
}

function formatNumber(val) {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString();
}

function categoryClass(cat) {
  const map = {
    baseline: "badge-baseline",
    deep_drop: "badge-deep-drop",
    panic: "badge-panic",
    take_profit: "badge-take-profit",
    rebalance: "badge-rebalance",
  };
  return map[cat] || "";
}

function generateChartData(data, type) {
  // This would call the actual API in production, but we use the imported function for testing
  // For now, compute locally
  if (type === "equity") {
    const labels = data.map(r => r.date);
    const equityData = data.map(r => r.netAsset);
    let benchmarkData = [];
    if (data.length > 0 && data[0].price0050 && data[0].qty0050 > 0) {
      const initialPrice = data[0].price0050;
      const initialQty = data[0].qty0050;
      benchmarkData = data.map(r => (r.price0050 || initialPrice) * initialQty);
    }
    const datasets = [{
      label: "策略淨值",
      data: equityData,
      borderColor: "#26a17b",
      backgroundColor: "rgba(38, 161, 123, 0.1)",
      fill: true,
    }];
    if (benchmarkData.length > 0) {
      datasets.push({
        label: "基準 (0050 Buy & Hold)",
        data: benchmarkData,
        borderColor: "#3498db",
        borderDash: [5, 5],
        fill: false,
      });
    }
    return { labels, datasets };
  }
  
  if (type === "drawdown") {
    const labels = data.map(r => r.date);
    let peak = -Infinity;
    const drawdownData = data.map(r => {
      if (r.netAsset > peak) peak = r.netAsset;
      const dd = peak > 0 ? ((r.netAsset - peak) / peak) * 100 : 0;
      return Math.min(0, dd);
    });
    return {
      labels,
      datasets: [{ label: "回撤 %", data: drawdownData, borderColor: "#e84855" }],
    };
  }
  
  return { labels: [], datasets: [] };
}

// Export
async function exportCSV() {
  if (!currentReport.value) return;
  try {
    const res = await fetch(`/api/backtest/results/export?jobId=${selectedJobId.value}&format=csv`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backtest_${selectedJobId.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success("CSV 匯出成功");
  } catch (e) {
    ElMessage.error("匯出失敗: " + e.message);
  }
}

async function exportJSON() {
  if (!currentReport.value) return;
  try {
    const res = await fetch(`/api/backtest/results/export?jobId=${selectedJobId.value}&format=json`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backtest_${selectedJobId.value}.json`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success("JSON 匯出成功");
  } catch (e) {
    ElMessage.error("匯出失敗: " + e.message);
  }
}

// Watch
watch(selectedJobId, (newId) => {
  if (newId) {
    router.replace({ query: { ...route.query, jobId: newId } });
    loadReport();
  }
});

onMounted(async () => {
  await loadJobList();
  if (selectedJobId.value) {
    await loadReport();
  } else {
    loading.value = false;
  }
});
</script>

<style scoped>
.backtest-report-view {
  padding: 16px;
  max-width: 100%;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.view-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.view-subtitle {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}

.header-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.tab-bar {
  display: flex;
  background: #f0f0f0;
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
  margin-bottom: 16px;
}

.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #888;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: #e8e8e8;
}

.tab-btn.tab-btn--active {
  background: #fff;
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.chart-container {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.chart-wrapper {
  width: 100%;
  height: 100%;
}

.dd-stats {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
}

.dd-stat {
  flex: 1;
  text-align: center;
}

.dd-label {
  display: block;
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.dd-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
}

.text-danger { color: #e84855; }
.text-warn { color: #f39c12; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.badge-baseline { background: #e3f2fd; color: #1976d2; }
.badge-deep-drop { background: #fff3e0; color: #e65100; }
.badge-panic { background: #fce4ec; color: #c62828; }
.badge-take-profit { background: #e8f5e9; color: #2e7d32; }
.badge-rebalance { background: #f3e5f5; color: #7b1fa2; }
.badge-type { background: #f5f5f5; color: #666; }

.filter-input {
  width: 250px;
}

.table-wrapper {
  overflow-x: auto;
  margin-top: 12px;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.detail-table th,
.detail-table td {
  padding: 8px 12px;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.detail-table th {
  background: #fafafa;
  font-weight: 600;
  color: #666;
  font-size: 11px;
  text-transform: uppercase;
}

.detail-table tr:hover td {
  background: #fafafa;
}

.state-box {
  padding: 40px;
  text-align: center;
  color: #999;
}

.state-error {
  color: #e84855;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top-color: #26a17b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>