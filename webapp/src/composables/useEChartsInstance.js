/**
 * ECharts 實例生命週期管理 composable
 * 統一處理：初始化、更新、銷毀、錯誤處理
 * 供 SensitivityChart、ParetoScatterChart、TornadoChart 共用
 */

import { ref, onBeforeUnmount, watch } from "vue";
import { init } from "echarts/core";

export function useEChartsInstance(
  chartRef,
  optionsBuilder,
  dependencies = [],
) {
  const chartInstance = ref(null);
  const isInitialized = ref(false);
  const initError = ref(null);

  // 初始化圖表
  const initialize = () => {
    if (!chartRef.value) {
      initError.value = "Chart ref not available";
      return false;
    }

    try {
      if (chartInstance.value) {
        chartInstance.value.dispose();
      }
      chartInstance.value = init(chartRef.value);
      isInitialized.value = true;
      initError.value = null;
      return true;
    } catch (err) {
      initError.value = err.message;
      console.error("[useEChartsInstance] 初始化失敗:", err);
      return false;
    }
  };

  // 更新圖表選項
  const update = () => {
    if (!chartInstance.value || !isInitialized.value) {
      if (!initialize()) return false;
    }

    try {
      const option = optionsBuilder();
      if (option) {
        chartInstance.value.setOption(option, true); // true = not merge, replace
      }
      return true;
    } catch (err) {
      console.error("[useEChartsInstance] 更新失敗:", err);
      return false;
    }
  };

  // 手動觸發 resize (容器尺寸變化時)
  const resize = () => {
    if (chartInstance.value) {
      chartInstance.value.resize();
    }
  };

  // 獲取實例 (供外部需要直接操作時使用)
  const getInstance = () => chartInstance.value;

  // 銷毀實例
  const dispose = () => {
    if (chartInstance.value) {
      chartInstance.value.dispose();
      chartInstance.value = null;
      isInitialized.value = false;
    }
  };

  // 監聽依賴變化自動更新
  if (dependencies.length > 0) {
    watch(
      dependencies,
      () => {
        if (isInitialized.value) {
          update();
        }
      },
      { deep: true },
    );
  }

  // 生命週期：組件卸載時銷毀
  onBeforeUnmount(dispose);

  return {
    chartInstance,
    isInitialized,
    initError,
    initialize,
    update,
    resize,
    getInstance,
    dispose,
  };
}

/**
 * 便利函數：建立標準化的圖表初始化邏輯
 * 用於 onMounted 中
 */
export function useChartLifecycle(chartRef, optionsBuilder, dependencies = []) {
  const { initialize, update, resize, dispose, isInitialized, initError } =
    useEChartsInstance(chartRef, optionsBuilder, dependencies);

  return {
    initialize,
    update,
    resize,
    dispose,
    isInitialized,
    initError,
  };
}
