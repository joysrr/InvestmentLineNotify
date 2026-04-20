<template>
  <div class="app-container">
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>

    <TabBar />
  </div>
</template>

<script setup>
import { onMounted, nextTick } from 'vue'
import { useTelegram } from './composables/useTelegram.js'
import TabBar from './components/TabBar.vue'

const { expand } = useTelegram()

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
}
</style>
