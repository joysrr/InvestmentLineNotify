<template>
  <div class="number-counter" :style="{ color: textColor }">
    {{ formattedValue }}
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";

/**
 * NumberCounter — 數字計數動畫組件
 * 掛載後從 0 線性計數至目標值（支援 prefers-reduced-motion 立即顯示最終值）。
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
const formattedValue = computed(() => Math.round(currentValue.value).toLocaleString("zh-TW"));
const textColor = computed(() => "var(--iln-text)");

let timer = null;
let elapsed = 0;

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
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (props.target === 0 || prefersReduced) {
    currentValue.value = props.target;
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
  font-weight: 700;
  transition: color var(--iln-duration-base) var(--iln-ease-standard);
}
</style>
