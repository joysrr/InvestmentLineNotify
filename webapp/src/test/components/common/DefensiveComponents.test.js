import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import SkeletonLoader from "@/components/common/SkeletonLoader.vue";
import EmptyState from "@/components/common/EmptyState.vue";
import GlobalErrorBoundary from "@/components/common/GlobalErrorBoundary.vue";

describe("Defensive UI Components", () => {
  describe("SkeletonLoader.vue", () => {
    it("renders SkeletonLoader with correct lines and height", () => {
      const wrapper = mount(SkeletonLoader, {
        props: { lines: 3, height: "20px" },
      });
      const lines = wrapper.findAll(".skeleton-line");
      expect(lines).toHaveLength(3);
      expect(lines[0].attributes("style")).toContain("height: 20px");
    });

    it("supports default rows/lines fallback", () => {
      const wrapper = mount(SkeletonLoader);
      expect(wrapper.find(".skeleton-loader").exists()).toBe(true);
    });
  });

  describe("EmptyState.vue", () => {
    it("renders EmptyState with custom title and message", () => {
      const wrapper = mount(EmptyState, {
        props: { title: "無資料", message: "請稍後再試", icon: "Document" },
      });
      expect(wrapper.text()).toContain("無資料");
      expect(wrapper.text()).toContain("請稍後再試");
    });

    it("falls back to description if title is not provided", () => {
      const wrapper = mount(EmptyState, {
        props: { description: "暫無新聞資料" },
      });
      expect(wrapper.text()).toContain("暫無新聞資料");
    });

    it("emits action event on button click", async () => {
      const wrapper = mount(EmptyState, {
        props: { actionText: "重新整理" },
      });
      const btn = wrapper.find("button");
      await btn.trigger("click");
      expect(wrapper.emitted("action")).toBeTruthy();
    });
  });

  describe("GlobalErrorBoundary.vue", () => {
    it("renders slot content when no error", () => {
      const wrapper = mount(GlobalErrorBoundary, {
        slots: { default: "<div class='child'>正常內容</div>" },
      });
      expect(wrapper.find(".child").text()).toBe("正常內容");
      expect(wrapper.find(".error-fallback").exists()).toBe(false);
    });

    it("captures child error and renders fallback UI with retry button", async () => {
      const ThrowError = {
        template: "<div>{{ errorTrigger }}</div>",
        computed: {
          errorTrigger() {
            throw new Error("元件渲染失敗");
          },
        },
      };

      const wrapper = mount(GlobalErrorBoundary, {
        slots: { default: ThrowError },
      });

      await nextTick();

      expect(wrapper.find(".error-fallback").exists()).toBe(true);
      expect(wrapper.text()).toContain("頁面載入失敗");
      expect(wrapper.find("button").exists()).toBe(true);
    });

    it("calls onRetry callback when retry button clicked", async () => {
      const onRetry = vi.fn();
      const ThrowError = {
        template: "<div>{{ errorTrigger }}</div>",
        computed: {
          errorTrigger() {
            throw new Error("元件渲染失敗");
          },
        },
      };

      const wrapper = mount(GlobalErrorBoundary, {
        props: { onRetry },
        slots: { default: ThrowError },
      });

      await nextTick();

      const btn = wrapper.find("button");
      await btn.trigger("click");
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });
});
