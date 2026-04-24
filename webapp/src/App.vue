<template>
  <div class="app-container">
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>

    <FloatingPill />
  </div>
</template>

<script setup>
import { onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTelegram } from './composables/useTelegram.js'
import FloatingPill from './components/FloatingPill.vue'

const { expand, backButton } = useTelegram()
const router = useRouter()
const route = useRoute()

// ── 全域 Telegram 返回鍵管理 ──
const handleBack = () => router.back()

watch(
  () => route.path,
  (path) => {
    if (!backButton) return
    
    // 定義「根路由」清單（這些頁面不顯示返回鍵，顯示「關閉」）
    const rootPaths = ['/', '/dashboard', '/radar', '/macro', '/chart', '/reports', '/news', '/account']
    
    if (rootPaths.includes(path)) {
      backButton.hide()
      backButton.offClick(handleBack)
    } else {
      backButton.show()
      backButton.onClick(handleBack)
    }
  },
  { immediate: true }
)

onMounted(async () => {
  await nextTick()
  expand()
})
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
  padding-bottom: 80px; /* 為懸浮導航留出空間 */
}
</style>
