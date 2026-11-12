<template>
  <div class="app-container">
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

const { expand, backButton, viewportHeight, setHeaderColor, setBackgroundColor } =
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
const applyTheme = () => {
  try {
    setHeaderColor("bg_color");
    setBackgroundColor("bg_color");
  } catch (_e) {
    void _e;
  }
};

onMounted(async () => {
  await nextTick();
  expand();
  applyTheme();
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
    var(--bottom-nav-height, 96px) + env(safe-area-inset-bottom, 0px)
  );
}
</style>
