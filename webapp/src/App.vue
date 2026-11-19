<template>
  <div
    class="app-container"
    :style="{
      '--tg-stable-height': `${viewportStableHeight}px`,
      '--tg-safe-bottom': `${safeAreaInset.bottom}px`,
    }"
  >
    <main class="app-main">
      <router-view v-slot="{ Component, route: viewRoute }">
        <Transition name="route-fade" mode="out-in">
          <keep-alive :max="5">
            <Suspense>
              <component :is="Component" :key="viewRoute.path" />
              <template #fallback>
                <RouteLoading />
              </template>
            </Suspense>
          </keep-alive>
        </Transition>
      </router-view>
      <ErrorAlert
        v-if="routeLoadError"
        title="頁面載入失敗"
        description="請點擊重試按鈕重新載入"
        show-retry
        @retry="retryRoute"
      />
    </main>

    <FloatingPill />
    <OfflineBanner @retry="retryRoute" />
    <AuthExpiredModal />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, nextTick, watch, ref, onErrorCaptured } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useTelegram } from "./composables/useTelegram.js";
import FloatingPill from "./components/FloatingPill.vue";
import OfflineBanner from "./components/common/OfflineBanner.vue";
import AuthExpiredModal from "./components/common/AuthExpiredModal.vue";
import RouteLoading from "./components/common/RouteLoading.vue";
import ErrorAlert from "./components/common/ErrorAlert.vue";

const router = useRouter();
const route = useRoute();

const routeLoadError = ref(false);

const retryRoute = () => {
  routeLoadError.value = false;
  router.push(route.path);
};

onErrorCaptured((err) => {
  console.warn("[Route Load Error]", err);
  routeLoadError.value = true;
  return false;
});

const { expand, haptic, backButton, viewportHeight, viewportStableHeight, safeAreaInset } =
  useTelegram();

// ── Telegram 返回鍵管理 ──
const handleBack = () => router.back();

watch(
  (() => route.path),
  (path, prevPath) => {
    if (!backButton) return;
    // 路由切換時輕微觸覺回饋（非首次掛載）
    if (prevPath && prevPath !== path) {
      haptic("light");
    }
    const rootPaths = ["/dashboard", "/insights", "/chart", "/account"];
    if (rootPaths.includes(path)) {
      backButton.hide();
      backButton.offClick(handleBack);
    } else {
      backButton.show();
      backButton.onClick(handleBack);
    }
  },
  { immediate: true },
);

// ── Viewport 高度 → CSS 變數（Phase 5 A2） ──
const applyViewport = (h) => {
  if (typeof h === "number" && h > 0) {
    document.documentElement.style.setProperty("--app-height", `${h}px`);
  }
};

watch(viewportHeight, applyViewport, { immediate: true });

// ── 主題 → header/background 色 ──
// 由 useTelegram handleThemeChanged 統一處理（onMounted 主動觸發，無需重複呼叫）

onMounted(async () => {
  await nextTick();
  expand();
});

onUnmounted(() => {
  document.documentElement.style.removeProperty("--app-height");
});
</script>

<style>
.app-container {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: var(--app-height, 100dvh);
  overflow: hidden;
}

/* 內容區僅允許垂直滾動 */
.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding-bottom: calc(
    var(--bottom-nav-height, 80px) + var(--tg-safe-bottom, 0px)
  );
}

/* Phase 4.3 · 路由切換 fade（搭配 <Transition name="route-fade">） */
.route-fade-enter-active,
.route-fade-leave-active {
  transition:
    opacity var(--iln-duration-base) var(--iln-ease-standard),
    transform var(--iln-duration-base) var(--iln-ease-standard);
  will-change: opacity, transform;
}
.route-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.route-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .route-fade-enter-active,
  .route-fade-leave-active {
    transition: none;
  }
}
</style>
