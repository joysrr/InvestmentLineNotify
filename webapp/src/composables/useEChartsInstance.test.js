import { defineComponent, nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEChartsInstance, useChartLifecycle } from "./useEChartsInstance.js";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("echarts/core", () => ({ init }));

const createChart = () => ({
  dispose: vi.fn(),
  resize: vi.fn(),
  setOption: vi.fn(),
});

const mountComposable = (factory) => {
  let value;
  const wrapper = mount(
    defineComponent({
      setup() {
        value = factory();
        return () => null;
      },
    }),
  );
  return { value, wrapper };
};

describe("useEChartsInstance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    init.mockReturnValue(createChart());
  });

  it("initializes a chart and exposes its instance", () => {
    const chartRef = ref({ nodeType: 1 });
    const optionsBuilder = vi.fn(() => ({ series: [] }));
    const chart = createChart();
    init.mockReturnValue(chart);
    const { value: composable, wrapper } = mountComposable(() =>
      useEChartsInstance(chartRef, optionsBuilder),
    );

    expect(composable.initialize()).toBe(true);
    expect(composable.isInitialized.value).toBe(true);
    expect(composable.getInstance()).toEqual(chart);
    expect(init).toHaveBeenCalledWith(chartRef.value);
    wrapper.unmount();
  });

  it("reports an error when the chart ref is unavailable", () => {
    const { value: composable, wrapper } = mountComposable(() =>
      useEChartsInstance(ref(null), () => ({})),
    );

    expect(composable.initialize()).toBe(false);
    expect(composable.initError.value).toBe("Chart ref not available");
    wrapper.unmount();
  });

  it("updates, resizes, and disposes the chart instance", () => {
    const chartRef = ref({ nodeType: 1 });
    const chart = createChart();
    init.mockReturnValue(chart);
    const { value: composable, wrapper } = mountComposable(() =>
      useEChartsInstance(chartRef, () => ({ series: [1] })),
    );

    composable.initialize();
    expect(composable.update()).toBe(true);
    composable.resize();
    composable.dispose();

    expect(chart.setOption).toHaveBeenCalledWith({ series: [1] }, true);
    expect(chart.resize).toHaveBeenCalledOnce();
    expect(chart.dispose).toHaveBeenCalledOnce();
    expect(composable.isInitialized.value).toBe(false);
    expect(composable.getInstance()).toBe(null);
    wrapper.unmount();
  });

  it("updates when a dependency changes", async () => {
    const chartRef = ref({ nodeType: 1 });
    const dependency = ref(1);
    const { value: composable, wrapper } = mountComposable(() =>
      useEChartsInstance(chartRef, () => ({ value: dependency.value }), [
        dependency,
      ]),
    );

    composable.initialize();
    dependency.value = 2;
    await nextTick();

    expect(composable.getInstance().setOption).toHaveBeenCalledWith(
      { value: 2 },
      true,
    );
    wrapper.unmount();
  });
});

describe("useChartLifecycle", () => {
  it("returns the shared chart lifecycle API", () => {
    const { value: lifecycle, wrapper } = mountComposable(() =>
      useChartLifecycle(ref({ nodeType: 1 }), () => null),
    );

    expect(lifecycle).toEqual(
      expect.objectContaining({
        initialize: expect.any(Function),
        update: expect.any(Function),
        resize: expect.any(Function),
        dispose: expect.any(Function),
      }),
    );
    wrapper.unmount();
  });
});
