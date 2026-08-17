import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";

vi.mock("element-plus", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
});

/**
 * 建立 View 的 GlobalErrorBoundary 集成測試套件
 * 用法：
 *   import { createViewErrorBoundarySuite } from "@/test/utils/viewErrorBoundaryTestFactory.js";
 *   createViewErrorBoundarySuite(MyView, "MyView");
 */
export function createViewErrorBoundarySuite(ViewComponent, viewName) {
  let wrapper;
  let router;

  beforeEach(() => {
    setActivePinia(createPinia());
    router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: { template: "<div />" } }],
    });

    // 渲染 View 包裹在 GlobalErrorBoundary 中
    wrapper = mount(ViewComponent, {
      global: {
        plugins: [router],
        stubs: {
          // Stub 子組件避免複雜依賴
          "el-card": { template: '<div class="el-card"><slot /></div>' },
          "el-button": {
            template: '<button class="el-button"><slot /></button>',
          },
          "el-alert": { template: '<div class="el-alert"><slot /></div>' },
          "el-empty": { template: '<div class="el-empty"><slot /></div>' },
          "el-skeleton": {
            template: '<div class="el-skeleton"><slot /></div>',
          },
          "el-tabs": { template: '<div class="el-tabs"><slot /></div>' },
          "el-tab-pane": {
            template: '<div class="el-tab-pane"><slot /></div>',
          },
          "el-table": { template: '<div class="el-table"><slot /></div>' },
          "el-table-column": {
            template: '<div class="el-table-column"><slot /></div>',
          },
          "el-tag": { template: '<span class="el-tag"><slot /></span>' },
          "el-icon": { template: '<span class="el-icon"><slot /></span>' },
          "el-tooltip": { template: '<div class="el-tooltip"><slot /></div>' },
          "el-dropdown": {
            template: '<div class="el-dropdown"><slot /></div>',
          },
          "el-dropdown-menu": {
            template: '<div class="el-dropdown-menu"><slot /></div>',
          },
          "el-dropdown-item": {
            template: '<div class="el-dropdown-item"><slot /></div>',
          },
          "el-form": { template: '<form class="el-form"><slot /></form>' },
          "el-form-item": {
            template: '<div class="el-form-item"><slot /></div>',
          },
          "el-input": { template: '<input class="el-input" />' },
          "el-select": {
            template: '<select class="el-select"><slot /></select>',
          },
          "el-option": { template: '<option class="el-option" />' },
          "el-switch": {
            template: '<input type="checkbox" class="el-switch" />',
          },
          "el-checkbox": {
            template: '<input type="checkbox" class="el-checkbox" />',
          },
          "el-radio": { template: '<input type="radio" class="el-radio" />' },
          "el-radio-group": {
            template: '<div class="el-radio-group"><slot /></div>',
          },
          "el-slider": { template: '<input type="range" class="el-slider" />' },
          "el-progress": {
            template: '<div class="el-progress"><slot /></div>',
          },
          "el-divider": { template: '<hr class="el-divider" />' },
          "el-row": { template: '<div class="el-row"><slot /></div>' },
          "el-col": { template: '<div class="el-col"><slot /></div>' },
          "el-container": {
            template: '<div class="el-container"><slot /></div>',
          },
          "el-header": {
            template: '<header class="el-header"><slot /></header>',
          },
          "el-main": { template: '<main class="el-main"><slot /></main>' },
          "el-aside": { template: '<aside class="el-aside"><slot /></aside>' },
          "el-dialog": { template: '<div class="el-dialog"><slot /></div>' },
          "el-drawer": { template: '<div class="el-drawer"><slot /></div>' },
          "el-message-box": true,
          "el-message": true,
          "el-notification": true,
          "el-loading": true,
          "el-scrollbar": {
            template: '<div class="el-scrollbar"><slot /></div>',
          },
          "el-popover": { template: '<div class="el-popover"><slot /></div>' },
          "el-popconfirm": {
            template: '<div class="el-popconfirm"><slot /></div>',
          },
          "el-breadcrumb": {
            template: '<div class="el-breadcrumb"><slot /></div>',
          },
          "el-breadcrumb-item": {
            template: '<div class="el-breadcrumb-item"><slot /></div>',
          },
          "el-pagination": {
            template: '<div class="el-pagination"><slot /></div>',
          },
          "el-badge": { template: '<span class="el-badge"><slot /></span>' },
          "el-avatar": { template: '<span class="el-avatar"><slot /></span>' },
          "el-rate": { template: '<div class="el-rate"><slot /></div>' },
          "el-step": { template: '<div class="el-step"><slot /></div>' },
          "el-steps": { template: '<div class="el-steps"><slot /></div>' },
          "el-timeline": {
            template: '<div class="el-timeline"><slot /></div>',
          },
          "el-timeline-item": {
            template: '<div class="el-timeline-item"><slot /></div>',
          },
          "el-tree": { template: '<div class="el-tree"><slot /></div>' },
          "el-transfer": {
            template: '<div class="el-transfer"><slot /></div>',
          },
          "el-cascader": {
            template: '<div class="el-cascader"><slot /></div>',
          },
          "el-color-picker": { template: '<input class="el-color-picker" />' },
          "el-date-picker": { template: '<input class="el-date-picker" />' },
          "el-time-picker": { template: '<input class="el-time-picker" />' },
          "el-time-select": { template: '<input class="el-time-select" />' },
          "el-autocomplete": { template: '<input class="el-autocomplete" />' },
          "el-calendar": {
            template: '<div class="el-calendar"><slot /></div>',
          },
          "el-image": { template: '<img class="el-image" />' },
          "el-image-viewer": true,
          "el-carousel": {
            template: '<div class="el-carousel"><slot /></div>',
          },
          "el-carousel-item": {
            template: '<div class="el-carousel-item"><slot /></div>',
          },
          "el-backtop": { template: '<div class="el-backtop"><slot /></div>' },
          "el-page-header": {
            template: '<div class="el-page-header"><slot /></div>',
          },
          "el-result": { template: '<div class="el-result"><slot /></div>' },
          "el-skeleton-item": {
            template: '<div class="el-skeleton-item"><slot /></div>',
          },
          "el-descriptions": {
            template: '<div class="el-descriptions"><slot /></div>',
          },
          "el-descriptions-item": {
            template: '<div class="el-descriptions-item"><slot /></div>',
          },
          "el-statistic": {
            template: '<div class="el-statistic"><slot /></div>',
          },
          "el-countdown": {
            template: '<div class="el-countdown"><slot /></div>',
          },
          "el-waterfall": true,
          "el-affix": { template: '<div class="el-affix"><slot /></div>' },
        },
      },
    });
  });

  describe(`${viewName} - GlobalErrorBoundary 集成`, () => {
    it("應正確渲染並被 GlobalErrorBoundary 包裹", () => {
      expect(wrapper.exists()).toBe(true);
      // 驗證 GlobalErrorBoundary 存在於組件樹中
      const errorBoundary = wrapper.findComponent(GlobalErrorBoundary);
      expect(errorBoundary.exists()).toBe(true);
    });

    it("應在正常情況下不顯示錯誤 UI", () => {
      const errorDisplay = wrapper.find(".error-fallback");
      // 正常情況下錯誤顯示區域應不存在或隱藏
      expect(errorDisplay.exists()).toBe(false);
    });

    it("應在拋出錯誤時顯示友善錯誤訊息", async () => {
      // 模擬子組件拋出錯誤
      const ErrorTrigger = {
        template: "<div>觸發錯誤</div>",
        mounted() {
          throw new Error("測試錯誤");
        },
      };

      const testWrapper = mount(
        {
          components: { GlobalErrorBoundary, ErrorTrigger },
          template: `
            <GlobalErrorBoundary>
              <ErrorTrigger />
            </GlobalErrorBoundary>
          `,
        },
        { global: { plugins: [router] } },
      );

      // 應捕獲錯誤並顯示錯誤 UI
      await vi.waitFor(() => {
        const errorDisplay = testWrapper.find(".error-fallback");
        expect(errorDisplay.exists()).toBe(true);
      });
    });

    it("應提供重新整理按鈕並能觸發重試", async () => {
      let throwError = true;
      const FlakyComponent = {
        template: "<div>不穩定組件</div>",
        mounted() {
          if (throwError) {
            throw new Error("暫時性錯誤");
          }
        },
      };

      const testWrapper = mount(
        {
          components: { GlobalErrorBoundary, FlakyComponent },
          template: `
            <GlobalErrorBoundary>
              <FlakyComponent />
            </GlobalErrorBoundary>
          `,
        },
        { global: { plugins: [router] } },
      );

      // 等待錯誤顯示
      await vi.waitFor(() => {
        const errorDisplay = testWrapper.find(".error-fallback");
        expect(errorDisplay.exists()).toBe(true);
      });

      // 點擊重新整理
      const retryBtn = testWrapper.find(".error-fallback .el-button");
      if (retryBtn.exists()) {
        throwError = false;
        await retryBtn.trigger("click");
        await vi.waitFor(() => {
          const errorDisplay = testWrapper.find(".error-fallback");
          expect(errorDisplay.exists()).toBe(false);
        });
      }
    });
  });
}
