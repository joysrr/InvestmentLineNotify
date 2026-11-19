<template>
  <div
    class="seg-control"
    :class="[`seg-control--${size}`]"
    role="radiogroup"
    :aria-label="ariaLabel"
  >
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="radio"
      :aria-checked="opt.value === modelValue"
      :class="['seg-item', { 'seg-item--active': opt.value === modelValue }]"
      :data-testid="opt.testId"
      @click="select(opt.value)"
      @keydown.left.prevent="move(-1)"
      @keydown.right.prevent="move(1)"
      @keydown.home.prevent="select(options[0].value)"
      @keydown.end.prevent="select(options[options.length - 1].value)"
    >
      <Icon v-if="opt.icon" :name="opt.icon" size="sm" class="seg-icon" />
      <span class="seg-label">{{ opt.label }}</span>
    </button>
  </div>
</template>

<script setup>
import Icon from "./Icon.vue";
import { selectionChanged } from "@/composables/useTelegram.js";

const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true },
  size: { type: String, default: "md" },
  ariaLabel: { type: String, default: "切換選項" },
});

const emit = defineEmits(["update:modelValue", "change"]);

const select = (val) => {
  if (val === props.modelValue) return;
  emit("update:modelValue", val);
  emit("change", val);
  selectionChanged();
};

const move = (delta) => {
  const idx = props.options.findIndex((o) => o.value === props.modelValue);
  const next = Math.min(
    props.options.length - 1,
    Math.max(0, (idx === -1 ? 0 : idx) + delta),
  );
  select(props.options[next].value);
};
</script>

<style scoped>
.seg-control {
  display: inline-flex;
  gap: var(--iln-space-1);
  padding: var(--iln-space-1);
  background: var(--iln-secondary-bg);
  border-radius: var(--iln-radius-full);
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.seg-control::-webkit-scrollbar { display: none; }

.seg-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--iln-space-1);
  min-height: var(--iln-touch-min, 44px);
  padding: 0 var(--iln-space-3);
  border: none;
  background: transparent;
  color: var(--iln-hint);
  font-size: var(--iln-font-base);
  font-weight: var(--iln-weight-medium);
  border-radius: var(--iln-radius-full);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--iln-duration-fast) var(--iln-ease-standard),
              color var(--iln-duration-fast) var(--iln-ease-standard),
              transform var(--iln-duration-fast) var(--iln-ease-standard);
}
.seg-item:hover { color: var(--iln-text); }
.seg-item:active { transform: scale(0.97); }

.seg-item--active {
  background: var(--iln-bg);
  color: var(--iln-brand);
  font-weight: var(--iln-weight-semibold);
  box-shadow: var(--iln-shadow-1);
}

.seg-control--sm .seg-item {
  min-height: 36px;
  padding: 0 var(--iln-space-2);
  font-size: var(--iln-font-sm);
}

.seg-icon { flex: 0 0 auto; }

@media (prefers-reduced-motion: reduce) {
  .seg-item { transition: none; }
  .seg-item:active { transform: none; }
}
</style>
