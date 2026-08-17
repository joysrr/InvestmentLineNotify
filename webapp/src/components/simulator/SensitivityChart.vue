<template>
  <div class="sensitivity-chart-container" ref="chartRef"></div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import VChart from "vue-echarts";
import { use, init } from "echarts/core";
import { LineChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useEChartsInstance } from "@/composables/useEChartsInstance.js";

use([LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const props = defineProps({
  data: { type: Object, required: true },
});

const chartRef = ref(null);

// 使用統一的 ECharts 實例管理
const { initialize, update, isInitialized } = useEChartsInstance(
  chartRef,
  () => buildOption(props.data),
  [() => props.data]
);

onMounted(() => {
  initialize();
});

function buildOption(data) {
  if (!data) return null;
  
  const { points, slope, correlation, paramPath, metric, scanRange } = data;
  
  // 解析 CSV 格式的 points
  const lines = points.trim().split('\n');
  const headers = lines[0].split(',');
  const pointData = lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      maintenanceMargin: parseFloat(values[0]),
      strategyScore: parseFloat(values[1]),
      x: parseFloat(values[2]),
    };
  });

  const xData = pointData.map(p => p.x);
  const yData = pointData.map(p => p.strategyScore !== undefined ? p.strategyScore : p[metric] || p.strategyScore);

  return {
    title: {
      text: '敏感度曲線',
      subtext: `參數: ${paramPath} → 指標: ${metric}`,
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0];
        return `${p.name}<br/>${metric}: ${p.value[1].toFixed(2)}<br/>參數值: ${p.value[0].toFixed(2)}`;
      },
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '15%',
    },
    xAxis: {
      type: 'value',
      name: '參數值',
      min: scanRange?.min,
      max: scanRange?.max,
    },
    yAxis: {
      type: 'value',
      name: metric === 'strategyScore' ? '策略分數' : metric,
    },
    series: [{
      name: metric === 'strategyScore' ? '策略分數' : metric,
      type: 'line',
      data: pointData.map(p => [p.x, p.strategyScore !== undefined ? p.strategyScore : p[metric] || p.strategyScore]),
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { color: '#409EFF', width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(64, 158, 255, 0.3)' }, { offset: 1, color: 'rgba(64, 158, 255, 0)' }] }},
    }],
  };
}
</script>

<style scoped>
.sensitivity-chart-container {
  width: 100%;
  height: 400px;
}
</style>