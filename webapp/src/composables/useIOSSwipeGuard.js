import { onMounted, onBeforeUnmount } from "vue";

/**
 * iOS 邊緣手勢防呆 Composable
 *
 * 在 Tab Bar 等可水平滾動的容器上，偵測觸控起始位置：
 * - 左右各 20px 邊緣內的觸控交還 iOS 系統手勢（返回/前進）
 * - 非邊緣區域的水平滑動則攔截事件冒泡，防止觸發系統導航
 *
 * @param {import('vue').Ref<HTMLElement|null>} targetRef - 要綁定事件的 DOM 元素 ref
 * @param {object} [options]
 * @param {number} [options.edgeGuard=20] - 邊緣保留區域寬度（px）
 */
export function useIOSSwipeGuard(targetRef, options = {}) {
  const EDGE_GUARD = options.edgeGuard ?? 20;

  let startX = 0;
  let startY = 0;
  let isEdgeTouch = false;

  function onTouchStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    // 左右邊緣 20px 內起始的觸控不介入，交還 iOS 系統手勢
    isEdgeTouch =
      startX < EDGE_GUARD || startX > window.innerWidth - EDGE_GUARD;
  }

  function onTouchMove(e) {
    if (isEdgeTouch) return; // 邊緣觸控不擋下，交還 iOS

    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);

    // 確認是水平滑動才阻止事件冒泡
    if (dx > dy && e.cancelable) {
      e.stopPropagation();
    }
  }

  onMounted(() => {
    const el = targetRef.value;
    if (el) {
      el.addEventListener("touchstart", onTouchStart, { passive: true });
      el.addEventListener("touchmove", onTouchMove, { passive: true });
    }
  });

  onBeforeUnmount(() => {
    const el = targetRef.value;
    if (el) {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    }
  });
}
