/**
 * ConfigSectionEditor.test.js
 * 單元測試：ConfigSectionEditor 區塊編輯容器
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import ConfigSectionEditor from "@/components/config/ConfigSectionEditor.vue";
import ConfigFieldEditor from "@/components/config/ConfigFieldEditor.vue";
import ElementPlus from "element-plus";

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
  return mount(ConfigSectionEditor, {
    global,
    props: {
      section: { key: "test", label: "測試區塊", fields: ["field1", "field2"] },
      config: {},
      meta: {},
      errors: [],
      ...props,
    },
  });
}

describe("ConfigSectionEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("基本渲染", () => {
    it("渲染兩個 ConfigFieldEditor 當 section.fields 有兩個欄位", () => {
      const wrapper = createWrapper({
        section: {
          key: "maintenance",
          label: "維持率防禦",
          fields: ["protectTrigger", "protectTarget"],
        },
        meta: {
          "maintenance.protectTrigger": {
            type: "number",
            label: "安全線",
            unit: "%",
          },
          "maintenance.protectTarget": {
            type: "number",
            label: "還款目標",
            unit: "%",
          },
        },
        config: { maintenance: { protectTrigger: 160, protectTarget: 180 } },
      });

      const fieldEditors = wrapper.findAllComponents(ConfigFieldEditor);
      expect(fieldEditors.length).toBe(2);
    });

    it("正確傳遞 path 給 ConfigFieldEditor (section.key + field)", () => {
      const wrapper = createWrapper({
        section: {
          key: "trading",
          label: "交易設定",
          fields: ["minAction", "cooldownDays"],
        },
        meta: {
          "trading.minAction": { type: "number", label: "最小操作金額" },
          "trading.cooldownDays": { type: "number", label: "冷卻天數" },
        },
        config: { trading: { minAction: 10000, cooldownDays: 10 } },
      });

      const fieldEditors = wrapper.findAllComponents(ConfigFieldEditor);
      expect(fieldEditors[0].props("path")).toBe("trading.minAction");
      expect(fieldEditors[1].props("path")).toBe("trading.cooldownDays");
    });

    it("正確傳遞 config 和 meta 給 ConfigFieldEditor", () => {
      const wrapper = createWrapper({
        section: {
          key: "buy",
          label: "買入設定",
          fields: ["minDropPercentToConsider"],
        },
        meta: {
          "buy.minDropPercentToConsider": {
            type: "number",
            label: "最低跌幅",
            unit: "%",
          },
        },
        config: { buy: { minDropPercentToConsider: 5 } },
      });

      const fieldEditor = wrapper.findComponent(ConfigFieldEditor);
      expect(fieldEditor.props("config")).toEqual({
        buy: { minDropPercentToConsider: 5 },
      });
      expect(fieldEditor.props("meta")).toEqual({
        "buy.minDropPercentToConsider": {
          type: "number",
          label: "最低跌幅",
          unit: "%",
        },
      });
    });
  });

  describe("錯誤傳遞", () => {
    it("依 field path 過濾並傳遞對應錯誤", () => {
      const wrapper = createWrapper({
        section: {
          key: "maintenance",
          label: "維持率",
          fields: ["protectTrigger", "protectTarget"],
        },
        meta: {
          "maintenance.protectTrigger": { type: "number", label: "安全線" },
          "maintenance.protectTarget": { type: "number", label: "還款目標" },
        },
        config: { maintenance: { protectTrigger: 160, protectTarget: 180 } },
        errors: [
          "maintenance.protectTrigger: 低於最小值 100",
          "maintenance.protectTarget: 超過最大值 300",
          "trading.minAction: 低於最小值 1000",
        ],
      });

      const fieldEditors = wrapper.findAllComponents(ConfigFieldEditor);
      expect(fieldEditors[0].props("error")).toBe(
        "maintenance.protectTrigger: 低於最小值 100",
      );
      expect(fieldEditors[1].props("error")).toBe(
        "maintenance.protectTarget: 超過最大值 300",
      );
    });

    it("無相關錯誤時傳遞空字串", () => {
      const wrapper = createWrapper({
        section: {
          key: "buy",
          label: "買入",
          fields: ["minDropPercentToConsider"],
        },
        meta: {
          "buy.minDropPercentToConsider": { type: "number", label: "最低跌幅" },
        },
        config: { buy: { minDropPercentToConsider: 5 } },
        errors: ["maintenance.protectTrigger: 錯誤"],
      });

      const fieldEditor = wrapper.findComponent(ConfigFieldEditor);
      expect(fieldEditor.props("error")).toBe("");
    });
  });

  describe("空區塊處理", () => {
    it("fields 為空陣列時顯示空狀態提示", () => {
      const wrapper = createWrapper({
        section: { key: "leverage", label: "槓桿設定", fields: [] },
        meta: {},
        config: { leverage: {} },
      });

      expect(wrapper.text()).toContain("此區塊暫無可編輯欄位");
      expect(wrapper.findComponent(ConfigFieldEditor).exists()).toBe(false);
    });

    it("fields 為 undefined 時也顯示空狀態", () => {
      const wrapper = createWrapper({
        section: { key: "empty", label: "空區塊" }, // 沒有 fields
        meta: {},
        config: {},
      });

      expect(wrapper.text()).toContain("此區塊暫無可編輯欄位");
    });
  });

  describe("事件傳遞", () => {
    it("ConfigFieldEditor 觸發 update 時向上傳遞", async () => {
      const wrapper = createWrapper({
        section: { key: "sell", label: "賣出", fields: ["minUpPercentToSell"] },
        meta: {
          "sell.minUpPercentToSell": {
            type: "number",
            label: "最小漲幅",
            unit: "%",
          },
        },
        config: { sell: { minUpPercentToSell: 80 } },
      });

      const fieldEditor = wrapper.findComponent(ConfigFieldEditor);
      await fieldEditor.vm.$emit("update", {
        path: "sell.minUpPercentToSell",
        value: 90,
      });
      await nextTick();

      expect(wrapper.emitted("update")).toBeTruthy();
      expect(wrapper.emitted("update")[0][0]).toEqual({
        path: "sell.minUpPercentToSell",
        value: 90,
      });
    });

    it("多欄位更新都正確傳遞 path", async () => {
      const wrapper = createWrapper({
        section: {
          key: "threshold",
          label: "閾值",
          fields: ["z2TargetRatio", "vixLowComplacency"],
        },
        meta: {
          "threshold.z2TargetRatio": { type: "number", label: "正二目標比" },
          "threshold.vixLowComplacency": { type: "number", label: "VIX自滿" },
        },
        config: { threshold: { z2TargetRatio: 0.4, vixLowComplacency: 12 } },
      });

      const fieldEditors = wrapper.findAllComponents(ConfigFieldEditor);
      await fieldEditors[0].vm.$emit("update", {
        path: "threshold.z2TargetRatio",
        value: 0.5,
      });
      await fieldEditors[1].vm.$emit("update", {
        path: "threshold.vixLowComplacency",
        value: 15,
      });
      await nextTick();

      const updates = wrapper.emitted("update");
      expect(updates.length).toBe(2);
      expect(updates[0][0].path).toBe("threshold.z2TargetRatio");
      expect(updates[1][0].path).toBe("threshold.vixLowComplacency");
    });
  });

  describe("複雜巢狀欄位", () => {
    it("支援深層路徑 buy.entryGate.tiers", () => {
      const wrapper = createWrapper({
        section: { key: "buy", label: "買入", fields: ["entryGate.tiers"] },
        meta: { "buy.entryGate.tiers": { type: "array", label: "進擊矩陣" } },
        config: { buy: { entryGate: { tiers: [{ minDrop: 5 }] } } },
      });

      const fieldEditor = wrapper.findComponent(ConfigFieldEditor);
      expect(fieldEditor.props("path")).toBe("buy.entryGate.tiers");
    });

    it("支援 valuationGuard.trailingStop.enabled", () => {
      const wrapper = createWrapper({
        section: {
          key: "valuationGuard",
          label: "估值守衛",
          fields: ["trailingStop.enabled"],
        },
        meta: {
          "valuationGuard.trailingStop.enabled": {
            type: "boolean",
            label: "啟用追蹤",
          },
        },
        config: { valuationGuard: { trailingStop: { enabled: true } } },
      });

      const fieldEditor = wrapper.findComponent(ConfigFieldEditor);
      expect(fieldEditor.props("path")).toBe(
        "valuationGuard.trailingStop.enabled",
      );
    });
  });
});
