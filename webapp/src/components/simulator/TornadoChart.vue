<template>
  <div class="tornado-chart-container" ref="chartRef"></div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import VChart from "vue-echarts";
import { use, init } from "echarts/core";
import { BarChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useEChartsInstance } from "@/composables/useEChartsInstance.js";

use([BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const props = defineProps({
  data: { type: Object, required: true },
  paramLabels: { type: Object, default: () => ({}) },
});

const chartRef = ref(null);

// 使用統一的 ECharts 實例管理
const { initialize, update, isInitialized } = useEChartsInstance(
  chartRef,
  () => buildOption(props.data, props.paramLabels),
  [() => props.data, () => props.paramLabels]
);

onMounted(() => {
  initialize();
});

function buildOption(data, paramLabels) {
  if (!data || !data.multiParam?.results?.length) return null;
  
  const { results, keyDrivers } = data.multiParam;
  
  // 準備 Tornado 圖資料：每個參數的影響範圍
  const tornadoData = results.map(r => {
    const minImpact = Math.min(...r.impacts.map(i => i.value));
    const maxImpact = Math.max(...r.impacts.map(i => i.value));
    const baseImpact = r.baseValue || 0;
    
    return {
      paramPath: r.paramPath,
      label: paramLabels[r.paramPath] || r.paramPath,
      min: minImpact - baseImpact,
      max: maxImpact - baseImpact,
      base: baseImpact,
      range: maxImpact - minImpact,
    };
  });
  
  // 按範圍大小排序 (最大影響在上)
  tornadoData.sort((a, b) => Math.abs(b.range) - Math.abs(a.range));
  
  const yAxisData = tornadoData.map(d => d.label);
  const minData = tornadoData.map(d => d.min);
  const maxData = tornadoData.map(d => d.max);
  
  return {
    title: {
      text: 'Tornado 圖 - 多參數敏感度分析',
      subtext: '參數對觀測指標的影響範圍 (越長越敏感)',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = params[0];
        return `${p.name}<br/>基準值: ${tornadoData[p.dataIndex].base.toFixed(2)}<br/>影響範圍: ${tornadoData[p.dataIndex].min.toFixed(2)} ~ ${tornadoData[p.dataIndex].max.toFixed(2)}`;
      },
    },
    legend: {
      data: ['負向影響', '正向影響'],
      bottom: 0,
    },
    grid: {
      left: '25%',
      right: '10%',
      bottom: '15%',
      top: '15%',
    },
    xAxis: {
      type: 'value',
      name: '影響度 (相對基準值)',
      axisLine: { onZero: true },
    },
    yAxis: {
      type: 'category',
      data: yAxisData,
      inverse: true, // 最大影響在最上
    },
    series: [
      {
        name: '負向影響',
        type: 'bar',
        stack: 'tornado',
        data: minData,
        itemStyle: { color: '#F56C6C' },
      },
      {
        name: '正向影響',
        type: 'bar',
        stack: 'tornado',
        data: maxData,
        itemStyle: { color: '#67C23A' },
      },
    ],
  };
}
</script>

<style scoped>
.tornado-chart-container {
  width: 100%;
  height: 400px;
}
</style>