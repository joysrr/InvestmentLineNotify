<template>
  <div class="pareto-scatter-chart-container" ref="chartRef"></div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { use } from "echarts/core";
import { ScatterChart, LineChart } from "echarts/charts";
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useEChartsInstance } from "@/composables/useEChartsInstance.js";

use([ScatterChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const props = defineProps({
  data: { type: Object, required: true },
  objectives: { type: Array, required: true },
  kneePoint: { type: Object, default: null },
});

const chartRef = ref(null);

// 使用統一的 ECharts 實例管理
const { initialize } = useEChartsInstance(
  chartRef,
  () => buildOption(props.data, props.objectives, props.kneePoint),
  [() => props.data, () => props.objectives, () => props.kneePoint]
);

onMounted(() => {
  initialize();
});

function buildOption(data, objectives, kneePoint) {
  if (!data) return null;
  
  const { allPoints = [], paretoFront = [], kneePoint: propKneePoint = null } = data;
  const { objectives: propObjectives } = { objectives };
  const finalKneePoint = kneePoint || propKneePoint;
  
  if (propObjectives.length < 2) return null;
  
  const obj1 = propObjectives[0];
  const obj2 = propObjectives[1];
  
  // 準備所有點的資料
  const allPointsData = allPoints
    .filter(p => p.objectives[obj1.metric] != null && p.objectives[obj2.metric] != null)
    .map((p) => ({
      value: [
        p.objectives[obj1.metric],
        p.objectives[obj2.metric],
      ],
      itemStyle: {
        color: p.rank === 0 ? '#4CAF50' : p.dominated ? '#9E9E9E' : '#FFC107',
        opacity: p.rank === 0 ? 0.8 : p.dominated ? 0.3 : 0.5,
      },
      symbolSize: p.rank === 0 ? 8 : 5,
    }));
  
  // Pareto 前沿線資料 (已排序)
  const frontLineData = paretoFront
    .filter(p => p.objectives[obj1.metric] != null && p.objectives[obj2.metric] != null)
    .map(p => [p.objectives[obj1.metric], p.objectives[obj2.metric]]);
  
  // 膝點
  const kneeData = finalKneePoint && finalKneePoint.objectives[obj1.metric] != null && finalKneePoint.objectives[obj2.metric] != null
    ? [[finalKneePoint.objectives[obj1.metric], finalKneePoint.objectives[obj2.metric]]]
    : [];
  
  return {
    title: {
      text: 'Pareto 前沿分析',
      subtext: `目標: ${obj1.label} vs ${obj2.label}`,
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (params.dataType === 'knee') {
          return `🎯 膝點<br/>${obj1.label}: ${params.value[0].toFixed(2)}<br/>${obj2.label}: ${params.value[1].toFixed(2)}`;
        } else if (params.dataType === 'front') {
          return `⭐ Pareto 前沿<br/>${obj1.label}: ${params.value[0].toFixed(2)}<br/>${obj2.label}: ${params.value[1].toFixed(2)}`;
        } else {
          return `• 採樣點<br/>${obj1.label}: ${params.value[0].toFixed(2)}<br/>${obj2.label}: ${params.value[1].toFixed(2)}<br/>Rank: ${params.data.rank ?? 'N/A'}`;
        }
      },
    },
    legend: {
      data: ['採樣點 (被支配)', '採樣點 (非支配)', 'Pareto 前沿', '膝點'],
      bottom: 0,
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '15%',
    },
    xAxis: {
      type: 'value',
      name: obj1.label + (obj1.direction === 'maximize' ? ' (最大化)' : ' (最小化)'),
      min: 'dataMin',
      max: 'dataMax',
    },
    yAxis: {
      type: 'value',
      name: obj2.label + (obj2.direction === 'maximize' ? ' (最大化)' : ' (最小化)'),
      min: 'dataMin',
      max: 'dataMax',
    },
    series: [
      {
        name: '採樣點 (被支配)',
        type: 'scatter',
        data: allPointsData.filter(d => d.itemStyle.color === '#9E9E9E'),
        symbol: 'circle',
        symbolSize: (d) => d.symbolSize,
        itemStyle: { color: '#9E9E9E', opacity: 0.3 },
        large: allPointsData.length > 1000,
        largeThreshold: 1000,
      },
      {
        name: '採樣點 (非支配)',
        type: 'scatter',
        data: allPointsData.filter(d => d.itemStyle.color === '#FFC107'),
        symbol: 'circle',
        symbolSize: (d) => d.symbolSize,
        itemStyle: { color: '#FFC107', opacity: 0.5 },
      },
      {
        name: 'Pareto 前沿',
        type: 'scatter',
        data: allPointsData.filter(d => d.itemStyle.color === '#4CAF50'),
        symbol: 'circle',
        symbolSize: (d) => d.symbolSize,
        itemStyle: { color: '#4CAF50', opacity: 0.8 },
      },
      {
        name: 'Pareto 前沿線',
        type: 'line',
        data: frontLineData,
        lineStyle: { color: '#4CAF50', width: 3, type: 'dashed' },
        showSymbol: false,
        smooth: true,
        z: 10,
      },
      {
        name: '膝點',
        type: 'scatter',
        data: kneeData.map(d => ({
          value: d,
          itemStyle: { color: '#FF5722', borderColor: '#FFF', borderWidth: 3 },
          symbol: 'star',
          symbolSize: 24,
          dataType: 'knee',
        })),
        z: 20,
      },
    ],
  };
}
</script>

<style scoped>
.pareto-scatter-chart-container {
  width: 100%;
  height: 450px;
}
</style>