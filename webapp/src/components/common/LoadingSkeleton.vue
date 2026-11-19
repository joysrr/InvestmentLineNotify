<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'card' },
  rows: { type: Number, default: 3 },
  gridCols: { type: Number, default: 2 }
})

const isCard = computed(() => props.variant === 'card')
const isList = computed(() => props.variant === 'list')
</script>

<template>
  <div class="loading-skeleton" :class="`loading-skeleton--${variant}`">
    <div v-if="isCard">
      <div class="sk-line sk-card sk-line--title" />
      <div class="sk-line sk-card sk-line--sub" />
      <div class="sk-line sk-card sk-line--short" />
    </div>
    <div v-else-if="isList">
      <div v-for="i in rows" :key="i" class="sk-list-item">
        <div class="sk-avatar" />
        <div class="sk-list-content">
          <div class="sk-line sk-line--title" />
          <div class="sk-line sk-line--sub" />
        </div>
      </div>
    </div>
    <div v-else>
      <div class="sk-grid">
        <div v-for="i in rows * gridCols" :key="i" class="sk-grid-item" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── 骨架屏 → 內容淡出過渡 ── */
/* 父元件以 <Transition name="sk-fade"> 包住 skeleton + 內容即可 */
.sk-fade-enter-active,
.sk-fade-leave-active {
  transition: opacity var(--iln-duration-base) var(--iln-ease-standard);
}
.sk-fade-enter-from,
.sk-fade-leave-to {
  opacity: 0;
}

.sk-line {
  height: 12px;
  border-radius: 4px;
  background: var(--iln-surface);
  animation: sk-pulse 1.4s ease infinite;
}

.sk-line--title {
  width: 40%;
  height: 14px;
  margin-bottom: 12px;
}

.sk-line--sub {
  width: 100%;
  margin-bottom: 8px;
}

.sk-line--short {
  width: 60%;
  margin-bottom: 0;
}

.sk-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sk-list-content {
  flex: 1;
}

.sk-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--iln-surface);
}

.sk-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.sk-grid-item {
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    var(--iln-surface) 25%,
    var(--iln-border-default) 50%,
    var(--iln-surface) 75%
  );
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s ease infinite;
}

@keyframes sk-pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

@keyframes sk-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
