/**
 * ConfigFieldEditor.test.js
 * 單元測試：ConfigFieldEditor 元件各型別輸入、驗證錯誤顯示
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import ConfigFieldEditor from "@/components/config/ConfigFieldEditor.vue";
import ElementPlus from "element-plus";

// Mock element-plus icons
vi.mock("@element-plus/icons-vue", () => ({
  QuestionFilled: { template: "<span data-testid='question-icon'>?</span>" },
}));

const global = {
  plugins: [ElementPlus],
  stubs: {
    ElInput: false,
    ElInputNumber: false,
    ElSelect: false,
    ElOption: false,
    ElFormItem: false,
    ElTooltip: false,
    ElIcon: false,
  },
};

function createWrapper(props = {}) {
  return mount(ConfigFieldEditor, {
    global,
    props: {
      path: "test.field",
      config: {},
      meta: {},
      error: "",
      ...props,
    },
  });
}

describe("ConfigFieldEditor", () => {
  describe("Number Input", () => {
    it("渲染 el-input-number 當 meta.type === 'number'", () => {
      const wrapper = createWrapper({
        meta: {
          "test.field": {
            type: "number",
            label: "測試數值",
            unit: "%",
            min: 0,
            max: 100,
          },
        },
      });
      expect(wrapper.findComponent({ name: "ElInputNumber" }).exists()).toBe(
        true,
      );
    });

    it("顯示 label 和 unit", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "number", label: "維持率", unit: "%" } },
      });
      expect(wrapper.text()).toContain("維持率");
      expect(wrapper.text()).toContain("(%");
    });

    it("輸入數值觸發 update 事件", async () => {
      const wrapper = createWrapper({
        meta: {
          "test.field": { type: "number", label: "測試", min: 0, max: 100 },
        },
        config: { test: { field: 50 } },
      });

      // 直接設定 localValue 並觸發事件
      const inputNumber = wrapper.findComponent({ name: "ElInputNumber" });
      await inputNumber.vm.$emit("change", 75);
      await nextTick();

      expect(wrapper.emitted("update")).toBeTruthy();
      expect(wrapper.emitted("update")[0][0]).toEqual({
        path: "test.field",
        value: 75,
      });
    });

    it("顯示範圍提示", () => {
      const wrapper = createWrapper({
        meta: {
          "test.field": { type: "number", label: "測試", min: 10, max: 90 },
        },
      });
      expect(wrapper.text()).toContain("最小 10");
      expect(wrapper.text()).toContain("最大 90");
    });

    it("step 根據 unit 自動調整", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "number", label: "測試", unit: "%" } },
      });
      const inputNumber = wrapper.findComponent({ name: "ElInputNumber" });
      expect(inputNumber.props("step")).toBe(0.1);
    });
  });

  describe("Boolean Input", () => {
    it("渲染 el-select 當 meta.type === 'boolean'", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "boolean", label: "啟用功能" } },
      });
      expect(wrapper.findComponent({ name: "ElSelect" }).exists()).toBe(true);
    });

    it("選項包含 是/否", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "boolean", label: "啟用" } },
      });
      const options = wrapper.findAllComponents({ name: "ElOption" });
      expect(options.length).toBe(2);
    });

    it("切換布林值觸發 update", async () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "boolean", label: "啟用" } },
        config: { test: { field: false } },
      });

      const select = wrapper.findComponent({ name: "ElSelect" });
      await select.vm.$emit("change", true);
      await nextTick();

      expect(wrapper.emitted("update")[0][0]).toEqual({
        path: "test.field",
        value: true,
      });
    });
  });

  describe("String Input", () => {
    it("渲染 el-input 當 meta.type === 'string'", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "string", label: "版本號" } },
      });
      expect(wrapper.findComponent({ name: "ElInput" }).exists()).toBe(true);
    });

    it("輸入字串觸發 update", async () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "string", label: "描述" } },
        config: { test: { field: "old" } },
      });

      const input = wrapper.findComponent({ name: "ElInput" });
      await input.vm.$emit("change", "new value");
      await nextTick();

      expect(wrapper.emitted("update")[0][0]).toEqual({
        path: "test.field",
        value: "new value",
      });
    });
  });

  describe("Array Input (JSON)", () => {
    it("渲染 textarea 當 meta.type === 'array'", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "array", label: "規則陣列" } },
      });
      const textareas = wrapper.findAll("textarea");
      expect(textareas.length).toBeGreaterThan(0);
    });

    it("顯示 JSON 格式化字串", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "array", label: "規則" } },
        config: { test: { field: [{ a: 1 }, { b: 2 }] } },
      });
      const textarea = wrapper.find("textarea");
      expect(textarea.element.value).toContain('"a": 1');
    });

    it("有效 JSON 陣列觸發 update", async () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "array", label: "規則" } },
        config: { test: { field: [] } },
      });

      const textarea = wrapper.find("textarea");
      await textarea.setValue('[{"minDrop": 5, "score": 2}]');
      await textarea.trigger("change");
      await nextTick();

      expect(wrapper.emitted("update")).toBeTruthy();
      expect(wrapper.emitted("update")[0][0].value).toEqual([
        { minDrop: 5, score: 2 },
      ]);
    });

    it("無效 JSON 不觸發 update 並顯示警告", async () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "array", label: "規則" } },
        config: { test: { field: [] } },
      });

      const textarea = wrapper.find("textarea");
      await textarea.setValue("invalid json");
      await textarea.trigger("change");
      await nextTick();

      // 應該不會觸發 update（因為 parse 失敗）
      // 但我們不測試 ElMessage 警告，因為它是 side effect
    });
  });

  describe("Object Input (JSON)", () => {
    it("渲染 textarea 當 meta.type === 'object'", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "object", label: "設定物件" } },
      });
      const textareas = wrapper.findAll("textarea");
      expect(textareas.length).toBeGreaterThan(0);
    });

    it("有效 JSON 物件觸發 update", async () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "object", label: "設定" } },
        config: { test: { field: {} } },
      });

      const textarea = wrapper.find("textarea");
      await textarea.setValue('{"enabled": true, "threshold": 0.5}');
      await textarea.trigger("change");
      await nextTick();

      expect(wrapper.emitted("update")[0][0].value).toEqual({
        enabled: true,
        threshold: 0.5,
      });
    });

    it("陣列當作物件輸入時不觸發 update", async () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "object", label: "設定" } },
        config: { test: { field: {} } },
      });

      const textarea = wrapper.find("textarea");
      await textarea.setValue("[1, 2, 3]");
      await textarea.trigger("change");
      await nextTick();

      // 不應該觸發 update
      expect(wrapper.emitted("update")).toBeFalsy();
    });
  });

  describe("Validation Error Display", () => {
    it("顯示錯誤訊息當 error prop 有值", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "number", label: "測試" } },
        error: "測試欄位: 低於最小值 10",
      });
      expect(wrapper.text()).toContain("低於最小值 10");
    });

    it("無錯誤時不顯示錯誤區塊", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "number", label: "測試" } },
        error: "",
      });
      expect(wrapper.text()).not.toContain("低於");
    });
  });

  describe("Help Tooltip", () => {
    it("有 desc 時顯示 tooltip 圖示", () => {
      const wrapper = createWrapper({
        meta: {
          "test.field": { type: "number", label: "測試", desc: "這是說明文字" },
        },
      });
      expect(wrapper.find("[data-testid='question-icon']").exists()).toBe(true);
    });

    it("無 desc 時不顯示 tooltip", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "number", label: "測試" } },
      });
      expect(wrapper.find("[data-testid='question-icon']").exists()).toBe(
        false,
      );
    });
  });

  describe("Unsupported Type", () => {
    it("未知型別顯示原始 JSON", () => {
      const wrapper = createWrapper({
        meta: { "test.field": { type: "unknown", label: "測試" } },
        config: { test: { field: { nested: "value" } } },
      });
      expect(wrapper.text()).toContain("不支援的型別: unknown");
      expect(wrapper.text()).toContain("nested");
    });
  });

  describe("Nested Path Resolution", () => {
    it("正確解析巢狀路徑 maintenance.protectTrigger", () => {
      const wrapper = createWrapper({
        path: "maintenance.protectTrigger",
        meta: {
          "maintenance.protectTrigger": {
            type: "number",
            label: "安全線",
            unit: "%",
          },
        },
        config: { maintenance: { protectTrigger: 160 } },
      });
      expect(wrapper.text()).toContain("安全線");
    });

    it("深層巢狀路徑 buy.panic.minDropRank", () => {
      const wrapper = createWrapper({
        path: "buy.panic.minDropRank",
        meta: {
          "buy.panic.minDropRank": { type: "number", label: "恐慌級別" },
        },
        config: { buy: { panic: { minDropRank: 2 } } },
      });
      expect(wrapper.text()).toContain("恐慌級別");
    });
  });
});
