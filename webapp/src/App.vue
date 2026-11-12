<template>
  <div
    class="app-container"
    :style="{
      '--tg-stable-height': `${viewportStableHeight}px`,
      '--tg-safe-bottom': `${safeAreaInset.bottom}px`,
    }"
  >
    <main class="app-main">
      <keep-alive :max="5">
        <router-view />
      </keep-alive>
    </main>

    <FloatingPill />
    <AuthExpiredModal />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, nextTick, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useTelegram } from "./composables/useTelegram.js";
import FloatingPill from "./components/FloatingPill.vue";
import AuthExpiredModal from "./components/common/AuthExpiredModal.vue";

const { expand, backButton, viewportHeight, viewportStableHeight, safeAreaInset } =
  useTelegram();
const router = useRouter();
const route = useRoute();

// ── Telegram 返回鍵管理 ──
const handleBack = () => router.back();

watch(
  (() => route.path),
  (path) => {
    if (!backButton) return;
    const rootPaths = ["/", "/dashboard", "/radar", "/news", "/theory", "/account"];
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
</style>
