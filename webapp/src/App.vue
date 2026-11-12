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
import { onMounted, nextTick, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useTelegram } from "./composables/useTelegram.js";
import FloatingPill from "./components/FloatingPill.vue";
import AuthExpiredModal from "./components/common/AuthExpiredModal.vue";

const { expand, backButton } = useTelegram();
const router = useRouter();
const route = useRoute();

// ── 全域 Telegram 返回鍵管理 ──
const handleBack = () => router.back();

watch(
  (() => route.path),
  (path) => {
    if (!backButton) return;

    // 定義 5 大 Bottom Nav 根路由清單
    const rootPaths = [
      "/",
      "/dashboard",
      "/radar",
      "/news",
      "/theory",
      "/account",
    ];

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

onMounted(async () => {
  await nextTick();
  expand();
});
</script>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

/* 內容區僅允許垂直滾動 */
.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)); /* 為懸浮導航留出空間 */
}
</style>
