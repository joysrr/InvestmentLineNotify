/**
 * StrategyConfigEditor.test.js
 * 整合測試：StrategyConfigEditor 頁面核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import StrategyConfigEditor from "@/views/StrategyConfigEditor.vue";
import ElementPlus from "element-plus";
import { createRouter, createWebHistory } from "vue-router";

// Mock apiFetch using vi.hoisted
const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
}));

vi.mock("@/api/index.js", () => ({
  apiFetch: mockApiFetch,
}));

// Mock useTelegram
vi.mock("@/composables/useTelegram.js", () => ({
  useTelegram: () => ({ openLink: vi.fn() }),
  waitReady: vi.fn().mockResolvedValue(undefined),
}));

// Mock element-plus
vi.mock("element-plus", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ElMessageBox: {
      confirm: vi.fn().mockResolvedValue("confirm"),
    },
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
});

import { apiFetch } from "@/api/index.js";

const global = {
  plugins: [ElementPlus],
  stubs: {
    ElButton: true,
    ElTabs: true,
    ElTabPane: true,
    ElAlert: true,
    ElCollapse: true,
    ElCollapseItem: true,
    ElMessageBox: true,
    ElIcon: true,
    ConfigSectionEditor: {
      template:
        '<div class="mock-config-section-editor" @update="$emit(\'update\', $event)"></div>',
      props: ["section", "config", "meta", "errors"],
      emits: ["update"],
    },
  },
};

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", component: { template: "<div>Home</div>" } }],
});

function createWrapper(props = {}) {
  return mount(StrategyConfigEditor, {
    global: {
      ...global,
      plugins: [...global.plugins, router],
    },
    props,
    attachTo: document.body,
  });
}

describe("StrategyConfigEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("載入流程", () => {
    it("onMounted 時呼叫 apiFetch 載入 meta 和 config", async () => {
      const mockMeta = {
        "maintenance.protectTrigger": {
          type: "number",
          label: "安全線",
          unit: "%",
        },
      };
      const mockConfig = {
        strategy: {
          content: { version: "2.8", maintenance: { protectTrigger: 160 } },
        },
      };

      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: mockMeta })
        .mockResolvedValueOnce(mockConfig)
        .mockResolvedValueOnce({ valid: true, errors: [] });

      const wrapper = createWrapper();
      await flushPromises();

      expect(mockApiFetch).toHaveBeenCalledWith("/api/strategy-config/meta");
      expect(mockApiFetch).toHaveBeenCalledWith("/api/strategy-config");
    });

    it("載入成功後設定 currentConfig 和 editableConfig", async () => {
      const mockConfig = {
        strategy: {
          content: { version: "2.8", maintenance: { protectTrigger: 160 } },
        },
      };

      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce(mockConfig)
        .mockResolvedValueOnce({ valid: true, errors: [] });

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.vm.currentConfig).toEqual(mockConfig.strategy.content);
      expect(wrapper.vm.editableConfig).toEqual(mockConfig.strategy.content);
    });

    it("載入失敗不拋出錯誤", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ valid: true, errors: [] });

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.vm.currentConfig).toEqual({});
    });
  });

  describe("驗證流程", () => {
    it("validateCurrentConfig 設定 validationErrors", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } })
        .mockResolvedValueOnce({ valid: true, errors: [] }); // initial validate

      const wrapper = createWrapper();
      await flushPromises();

      // Directly test the validation logic by calling the function and mocking its internal apiFetch
      // Since validateCurrentConfig is internal, we test the outcome via the validate endpoint
      await wrapper.vm.validateCurrentConfig();
      await flushPromises();

      // The validationErrors should be set based on the validate response
      // In this case it should be empty (valid)
      expect(Array.isArray(wrapper.vm.validationErrors)).toBe(true);
    });

    it("isValid 反映驗證狀態", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } })
        .mockResolvedValueOnce({ valid: true, errors: [] });

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.vm.isValid).toBe(true);
    });
  });

  describe("儲存流程", () => {
    it("saveConfig 驗證通過後呼叫 POST /strategy-config", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } })
        .mockResolvedValueOnce({ valid: true, errors: [] }) // initial validate
        .mockResolvedValueOnce({ success: true }); // save

      const wrapper = createWrapper();
      await flushPromises();

      await wrapper.vm.saveConfig();
      await flushPromises();

      const saveCalls = mockApiFetch.mock.calls.filter(
        (call) =>
          call[0] === "/api/strategy-config" && call[1]?.method === "POST",
      );
      expect(saveCalls.length).toBe(1);
      expect(saveCalls[0][1].body).toContain("2.8");
    });

    it("儲存成功更新 currentConfig 並清除 hasChanges", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } })
        .mockResolvedValueOnce({ valid: true, errors: [] })
        .mockResolvedValueOnce({ success: true });

      const wrapper = createWrapper();
      await flushPromises();

      // Modify editableConfig by replacing the entire object (avoid computed readonly warning)
      wrapper.vm.editableConfig = {
        ...wrapper.vm.editableConfig,
        version: "2.9",
      };
      expect(wrapper.vm.hasChanges).toBe(true);

      await wrapper.vm.saveConfig();
      await flushPromises();

      expect(wrapper.vm.currentConfig.version).toBe("2.9");
      expect(wrapper.vm.hasChanges).toBe(false);
    });
  });

  describe("重置流程", () => {
    it("resetToDefault 確認後載入預設設定", async () => {
      const mockDefaultConfig = {
        version: "2.8",
        maintenance: { protectTrigger: 160 },
      };

      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } })
        .mockResolvedValueOnce({ success: true, config: mockDefaultConfig })
        .mockResolvedValueOnce({ valid: true, errors: [] });

      const wrapper = createWrapper();
      await flushPromises();

      // First call opens dialog
      await wrapper.vm.resetToDefault();
      await flushPromises();
      expect(wrapper.vm.resetConfirmVisible).toBe(true);

      // Second call (confirm) triggers API
      await wrapper.vm.confirmResetToDefault();
      await flushPromises();
      expect(mockApiFetch).toHaveBeenCalledWith("/api/strategy-config/default");
      expect(wrapper.vm.currentConfig).toEqual(mockDefaultConfig);
      expect(wrapper.vm.editableConfig).toEqual(mockDefaultConfig);
    });

    it("取消重置不觸發 API", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } });

      const wrapper = createWrapper();
      await flushPromises();

      await wrapper.vm.resetToDefault();
      await flushPromises();
      expect(wrapper.vm.resetConfirmVisible).toBe(true);

      // Cancel - just close dialog, don't call API
      wrapper.vm.resetConfirmVisible = false;
      await flushPromises();
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("hasChanges 計算", () => {
    it("editableConfig 不同 currentConfig 時 hasChanges 為 true", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } })
        .mockResolvedValueOnce({ valid: true, errors: [] });

      const wrapper = createWrapper();
      await flushPromises();

      wrapper.vm.editableConfig.version = "2.9";
      await nextTick();

      expect(wrapper.vm.hasChanges).toBe(true);
    });

    it("editableConfig 相同 currentConfig 時 hasChanges 為 false", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } })
        .mockResolvedValueOnce({ valid: true, errors: [] });

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.vm.hasChanges).toBe(false);
    });
  });

  describe("getSectionErrors", () => {
    it("正確過濾屬於該 section 的錯誤", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({ strategy: { content: { version: "2.8" } } })
        .mockResolvedValueOnce({
          valid: false,
          errors: [
            "maintenance.protectTrigger: error1",
            "maintenance.protectTarget: error2",
            "trading.minAction: error3",
          ],
        });

      const wrapper = createWrapper();
      await flushPromises();

      // Manually set validationErrors for testing getSectionErrors
      wrapper.vm.validationErrors = [
        "maintenance.protectTrigger: error1",
        "maintenance.protectTarget: error2",
        "trading.minAction: error3",
      ];

      const maintenanceErrors = wrapper.vm.getSectionErrors("maintenance");
      expect(maintenanceErrors.length).toBe(2);
      expect(maintenanceErrors[0]).toContain("maintenance.protectTrigger");

      const tradingErrors = wrapper.vm.getSectionErrors("trading");
      expect(tradingErrors.length).toBe(1);
      expect(tradingErrors[0]).toContain("trading.minAction");
    });
  });

  describe("formattedJson", () => {
    it("正確格式化 JSON", async () => {
      mockApiFetch
        .mockResolvedValueOnce({ success: true, meta: {} })
        .mockResolvedValueOnce({
          strategy: { content: { version: "2.8", nested: { a: 1 } } },
        })
        .mockResolvedValueOnce({ valid: true, errors: [] });

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.vm.formattedJson).toContain('"version": "2.8"');
      expect(wrapper.vm.formattedJson).toContain('"nested":');
      expect(wrapper.vm.formattedJson).toContain('"a": 1');
    });
  });
});
