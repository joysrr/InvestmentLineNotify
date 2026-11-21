<template>
  <div
    :class="classes"
    @click="handleClick"
  >
    <header v-if="$slots.header" class="content-card__header">
      <slot name="header" />
    </header>
    <div class="content-card__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="content-card__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup>
import { computed } from "vue";

/**
 * ContentCard — 統一卡片容器
 * - 支援 size 快捷（sm/md/lg）同時控制 padding 與 radius，亦相容既有 padding/radius 屬性
 */
const props = defineProps({
  variant: {
    type: String,
    default: "default", // 'default' | 'outlined' | 'elevated' | 'flat'
  },
  size: {
    type: String,
    default: null, // null | 'sm' | 'md' | 'lg'
  },
  padding: {
    type: String,
    default: "md", // 'none' | 'sm' | 'md' | 'lg'
  },
  radius: {
    type: String,
    default: "md", // 'sm' | 'md' | 'lg'
  },
  status: {
    type: String,
    default: null, // null | 'ok' | 'warn' | 'danger' | 'info'
  },
  statusStyle: {
    type: String,
    default: "left-border", // 'left-border' | 'tint' | 'none'
  },
  clickable: {
    type: Boolean,
    default: false,
  },
  fullWidth: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["click"]);

const classes = computed(() => {
  const pad = props.size || props.padding;
  const rad = props.size || props.radius;

  const cls = [
    "content-card",
    `content-card--variant-${props.variant}`,
    `content-card--pad-${pad}`,
    `content-card--radius-${rad}`,
  ];
  if (props.status && props.statusStyle === "left-border") {
    cls.push("content-card--status-left", `content-card--status-${props.status}`);
  }
  if (props.status && props.statusStyle === "tint") {
    cls.push(`content-card--tint-${props.status}`);
  }
  if (props.fullWidth) cls.push("content-card--full-width");
  if (props.clickable) cls.push("content-card--clickable");
  return cls;
});

const handleClick = (event) => {
  if (props.clickable) {
    emit("click", event);
  }
};
</script>

<style scoped>
.content-card {
  background: var(--iln-bg);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  box-sizing: border-box;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.content-card--variant-outlined {
  background: transparent;
}
.content-card--variant-elevated {
  box-shadow: var(--iln-shadow-2);
  border-color: transparent;
}
.content-card--variant-flat {
  background: var(--iln-surface);
  border-color: transparent;
}

.content-card--pad-none {
  padding: 0;
}
.content-card--pad-sm {
  padding: var(--iln-space-3);
}
.content-card--pad-md {
  padding: var(--iln-space-4);
}
.content-card--pad-lg {
  padding: var(--iln-space-5);
}

.content-card--radius-sm {
  border-radius: var(--iln-radius-sm);
}
.content-card--radius-md {
  border-radius: var(--iln-radius-md);
}
.content-card--radius-lg {
  border-radius: var(--iln-radius-lg);
}

.content-card--status-left {
  border-left-width: 5px;
  border-left-style: solid;
}
.content-card--status-ok {
  border-left-color: var(--iln-viz-bull-border);
}
.content-card--status-warn {
  border-left-color: var(--iln-viz-alert-border);
}
.content-card--status-danger {
  border-left-color: var(--iln-viz-bear-border);
}
.content-card--status-info {
  border-left-color: var(--iln-info);
}

.content-card--tint-ok {
  background: var(--iln-viz-bull-bg);
}
.content-card--tint-warn {
  background: var(--iln-viz-alert-bg);
}
.content-card--tint-danger {
  background: var(--iln-viz-bear-bg);
}
.content-card--tint-info {
  background: var(--iln-info-bg);
}

.content-card__header {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-2);
}

.content-card__body {
  flex: 1;
}

.content-card__footer {
  margin-top: var(--iln-space-2);
  display: flex;
  justify-content: flex-end;
  gap: var(--iln-space-2);
}

.content-card--clickable {
  cursor: pointer;
  transition:
    box-shadow var(--iln-duration-fast) var(--iln-ease-standard),
    transform var(--iln-duration-fast) var(--iln-ease-standard);
}
.content-card--clickable:hover {
  box-shadow: var(--iln-shadow-2);
  transform: translateY(-2px);
}
.content-card--clickable:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}
.content-card--clickable:active {
  transform: scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .content-card--clickable,
  .content-card--clickable:hover,
  .content-card--clickable:active {
    transition: none;
    transform: none;
  }
}
</style>
