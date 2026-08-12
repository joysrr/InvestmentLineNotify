import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ExportButton from "@/components/common/ExportButton.vue";
import { Download, Document, Picture, ArrowDown } from "@element-plus/icons-vue";
import * as exportUtility from "@/utils/exportUtility.js";

// Mock exportUtility
vi.mock("@/utils/exportUtility.js", () => ({
  exportCSV: vi.fn(),
  exportJSON: vi.fn(),
  exportChartAsImage: vi.fn().mockResolvedValue(undefined),
  exportAllFormats: vi.fn().mockResolvedValue(["csv", "json"]),
}));

// Mock ElMessage
vi.mock("element-plus", () => ({
  ElMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ExportButton.vue", () => {
  const mockChartInstance = {
    getDataURL: vi.fn().mockReturnValue("data:image/png;base64,mock"),
  };

  const defaultProps = {
    csvData: [{ a: 1, b: 2 }, { a: 3, b: 4 }],
    jsonData: { key: "value", nested: { num: 42 } },
    chartInstance: mockChartInstance,
    filename: "test-export",
  };

  let wrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["mock"], { type: "image/png" })),
    });
  });

  function mountComponent(props = {}) {
    return mount(ExportButton, {
      props: { ...defaultProps, ...props },
      global: {
        stubs: {
          ElDropdown: {
            template: `
              <div class="el-dropdown">
                <slot />
                <div class="el-dropdown-menu">
                  <slot name="dropdown" />
                </div>
              </div>
            `,
          },
          ElDropdownMenu: {
            template: '<div class="el-dropdown-menu"><slot /></div>',
          },
          ElDropdownItem: {
            template: '<div class="el-dropdown-item" @click="$emit(\'command\', command)"><slot /></div>',
            props: ["command", "disabled", "divided"],
            emits: ["command"],
          },
          ElButton: {
            template: '<button class="el-button" @click="$emit(\'click\')"><slot /></button>',
            props: ["type", "size", "disabled", "loading"],
            emits: ["click"],
          },
          ElIcon: { template: '<span class="el-icon"><slot /></span>' },
          ElTag: { template: '<span class="el-tag"><slot /></span>', props: ["type", "size"] },
          ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
        },
        components: {
          Download,
          Document,
          Picture,
          ArrowDown,
        },
      },
    });
  }

  it("renders export button with correct text", () => {
    wrapper = mountComponent();
    expect(wrapper.find(".export-btn").text()).toContain("匯出");
  });

  it("calls exportCSV when exportCSV method called", async () => {
    wrapper = mountComponent();
    const { exportCSV } = await import("@/utils/exportUtility.js");
    
    wrapper.vm.exportCSV();
    await nextTick();
    
    expect(exportCSV).toHaveBeenCalledWith(
      defaultProps.csvData,
      "test-export",
      {}
    );
  });

  it("calls exportJSON when exportJSON method called", async () => {
    wrapper = mountComponent();
    const { exportJSON } = await import("@/utils/exportUtility.js");
    
    wrapper.vm.exportJSON();
    await nextTick();
    
    expect(exportJSON).toHaveBeenCalledWith(
      defaultProps.jsonData,
      "test-export"
    );
  });

  it("calls exportChartAsImage when exportPNG method called", async () => {
    wrapper = mountComponent();
    const { exportChartAsImage } = await import("@/utils/exportUtility.js");
    
    await wrapper.vm.exportPNG();
    await nextTick();
    
    expect(exportChartAsImage).toHaveBeenCalledWith(
      mockChartInstance,
      "test-export",
      {}
    );
  });

  it("calls exportAllFormats when exportAll method called", async () => {
    wrapper = mountComponent();
    const { exportAllFormats } = await import("@/utils/exportUtility.js");
    
    await wrapper.vm.exportAll();
    await nextTick();
    
    expect(exportAllFormats).toHaveBeenCalledWith(
      { csv: defaultProps.csvData, json: defaultProps.jsonData },
      "test-export",
      ["csv", "json", "png"],
      mockChartInstance
    );
  });

  it("does not call exportCSV when csvData is empty", async () => {
    wrapper = mountComponent({ csvData: [] });
    const { exportCSV } = await import("@/utils/exportUtility.js");
    const { ElMessage } = await import("element-plus");
    
    wrapper.vm.exportCSV();
    await nextTick();
    
    expect(exportCSV).not.toHaveBeenCalled();
    expect(ElMessage.warning).toHaveBeenCalledWith("無 CSV 資料可匯出");
  });

  it("does not call exportJSON when jsonData is empty", async () => {
    wrapper = mountComponent({ jsonData: {} });
    const { exportJSON } = await import("@/utils/exportUtility.js");
    const { ElMessage } = await import("element-plus");
    
    wrapper.vm.exportJSON();
    await nextTick();
    
    expect(exportJSON).not.toHaveBeenCalled();
    expect(ElMessage.warning).toHaveBeenCalledWith("無 JSON 資料可匯出");
  });

  it("does not call exportChartAsImage when chartInstance is null", async () => {
    wrapper = mountComponent({ chartInstance: null });
    const { exportChartAsImage } = await import("@/utils/exportUtility.js");
    const { ElMessage } = await import("element-plus");
    
    await wrapper.vm.exportPNG();
    await nextTick();
    
    expect(exportChartAsImage).not.toHaveBeenCalled();
    expect(ElMessage.warning).toHaveBeenCalledWith("無圖表可匯出");
  });

  it("shows success message after CSV export", async () => {
    wrapper = mountComponent();
    const { ElMessage } = await import("element-plus");
    
    wrapper.vm.exportCSV();
    await nextTick();
    
    expect(ElMessage.success).toHaveBeenCalledWith("CSV 已匯出: test-export.csv");
  });

  it("emits export-start and export-complete events", async () => {
    wrapper = mountComponent();
    
    wrapper.vm.exportCSV();
    await nextTick();
    
    expect(wrapper.emitted("export-start")).toBeTruthy();
    expect(wrapper.emitted("export-start")[0]).toEqual(["csv"]);
    expect(wrapper.emitted("export-complete")).toBeTruthy();
    expect(wrapper.emitted("export-complete")[0][0]).toBe("csv");
  });

  it("handles export error and emits export-error", async () => {
    const { exportCSV } = await import("@/utils/exportUtility.js");
    exportCSV.mockImplementationOnce(() => { throw new Error("Export failed"); });
    
    wrapper = mountComponent();
    const { ElMessage } = await import("element-plus");
    
    wrapper.vm.exportCSV();
    await nextTick();
    
    expect(ElMessage.error).toHaveBeenCalledWith("匯出失敗: Export failed");
    expect(wrapper.emitted("export-error")).toBeTruthy();
  });

  it("uses custom filenames when provided", async () => {
    wrapper = mountComponent({
      csvFilename: "custom-csv",
      jsonFilename: "custom-json",
      pngFilename: "custom-png",
    });
    const { exportCSV, exportJSON, exportChartAsImage } = await import("@/utils/exportUtility.js");
    
    wrapper.vm.exportCSV();
    await nextTick();
    expect(exportCSV).toHaveBeenCalledWith(defaultProps.csvData, "custom-csv", {});
    
    wrapper.vm.exportJSON();
    await nextTick();
    expect(exportJSON).toHaveBeenCalledWith(defaultProps.jsonData, "custom-json");
    
    await wrapper.vm.exportPNG();
    await nextTick();
    expect(exportChartAsImage).toHaveBeenCalledWith(mockChartInstance, "custom-png", {});
  });

  it("passes csvOptions to exportCSV", async () => {
    wrapper = mountComponent({
      csvOptions: { delimiter: ";", includeHeader: false },
    });
    const { exportCSV } = await import("@/utils/exportUtility.js");
    
    wrapper.vm.exportCSV();
    await nextTick();
    
    expect(exportCSV).toHaveBeenCalledWith(
      defaultProps.csvData,
      "test-export",
      { delimiter: ";", includeHeader: false }
    );
  });

  it("passes pngOptions to exportChartAsImage", async () => {
    wrapper = mountComponent({
      pngOptions: { type: "jpeg", pixelRatio: 3 },
    });
    const { exportChartAsImage } = await import("@/utils/exportUtility.js");
    
    await wrapper.vm.exportPNG();
    await nextTick();
    
    expect(exportChartAsImage).toHaveBeenCalledWith(
      mockChartInstance,
      "test-export",
      { type: "jpeg", pixelRatio: 3 }
    );
  });

  it("exposes export methods via defineExpose", () => {
    wrapper = mountComponent();
    
    expect(typeof wrapper.vm.exportCSV).toBe("function");
    expect(typeof wrapper.vm.exportJSON).toBe("function");
    expect(typeof wrapper.vm.exportPNG).toBe("function");
    expect(typeof wrapper.vm.exportAll).toBe("function");
  });
});