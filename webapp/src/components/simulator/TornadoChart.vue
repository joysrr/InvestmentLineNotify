<template>
  <div class="tornado-chart-container" ref="chartRef"></div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import * as echarts from "echarts";

const props = defineProps({
  data: { type: Object, required: true },
});

const chartRef = ref(null);
let chartInstance = null;

onMounted(() => {
  initChart();
});

watch(() => props.data, () => {
  if (chartInstance) updateChart();
}, { deep: true });

function initChart() {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  updateChart();
}

function updateChart() {
  if (!chartInstance || !props.data) return;
  
  const { results = [], keyDrivers = [] } = props.data;
  
  // 依影響度排序
  const sorted = [...results].sort((a, b) => b.impact - a.impact);
  
  const yData = sorted.map((r) => r.paramPath);
  const positiveData = sorted.map((r) => (r.direction === "positive" ? r.impact : 0));
  const negativeData = sorted.map((r) => (r.direction === "negative" ? r.impact : 0));
  
  const option = {
    title: { text: "Tornado 圖 - 參數影響度", left: "center" },
    tooltip: { trigger: "axis" },
    legend: { data: ["正向影響", "負向影響"], bottom: 0 },
    grid: { left: "25%", right: "10%", bottom: "15%" },
    xAxis: { type: "value", name: "影響度" },
    yAxis: { type: "category", data: yData, inverse: true },
    series: [
      { name: "正向影響", type: "bar", stack: "total", data: positiveData, itemStyle: { color: "#4CAF50" } },
      { name: "負向影響", type: "bar", stack: "total", data: negativeData, itemStyle: { color: "#F44336" } },
    ],
  };
  
  chartInstance.setOption(option);
}

onBeforeUnmount(() => {
  if (chartInstance) chartInstance.dispose();
});
</script>

<style scoped>
.tornado-chart-container {
  width: 100%;
  height: 350px;
}
</style>