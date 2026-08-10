<template>
  <div class="sensitivity-chart-container" ref="chartRef"></div>
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
  
  const { points = [], slope = 0, correlation = 0 } = props.data;
  
  const option = {
    title: { text: "敏感度曲線", left: "center" },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", name: "參數值" },
    yAxis: { type: "value", name: "指標值" },
    series: [{
      type: "line",
      data: points,
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
    }],
  };
  
  chartInstance.setOption(option);
}

onBeforeUnmount(() => {
  if (chartInstance) chartInstance.dispose();
});
</script>

<style scoped>
.sensitivity-chart-container {
  width: 100%;
  height: 300px;
}
</style>