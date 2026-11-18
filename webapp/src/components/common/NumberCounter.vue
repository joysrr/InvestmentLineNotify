<template>
  <div class="number-counter" :style="{ color: textColor }">
    {{ formattedValue }}
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";

/**
 * NumberCounter — 數字計數動畫組件（P3）
 * 掛載後從 0 線性計數至目標值，僅使用 transform/opacity 友善屬性，無硬編碼顏色。
 */
const props = defineProps({
  target: {
    type: Number,
    default: 0,
  },
  duration: {
    type: Number,
    default: 1000,
  },
});

const currentValue = ref(0);
const formattedValue = computed(() => currentValue.value.toLocaleString("zh-TW"));
const textColor = computed(() => "var(--iln-text-primary)");

let timer = null;
let elapsed = 0;

function formatNum(num) {
  return Math.floor(num).toLocaleString("zh-TW");
}

function animate() {
  elapsed += 16;
  const progress = Math.min(elapsed / props.duration, 1);
  currentValue.value = props.target * progress;

  if (progress < 1) {
    timer = setTimeout(animate, 16);
  } else {
    currentValue.value = props.target;
  }
}

onMounted(() => {
  if (props.target === 0) {
    currentValue.value = 0;
    return;
  }
  elapsed = 0;
  timer = setTimeout(animate, 16);
});

onUnmounted(() => {
  if (timer) {
    clearTimeout(timer);
  }
});
</script>

<style scoped>
.number-counter {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  transition: color var(--iln-duration-base) ease-out;
}
</style>
