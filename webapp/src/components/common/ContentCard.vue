<template>
  <div
    :class="classes"
    @click.self="handleClick"
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
 *
 * Phase 2 (2026-11-17) 收斂：
 * - 新增 size 快捷（sm/md/lg）→ 一次控制 padding + radius，取代 padding+radius 雙屬性
 * - 舊 padding/radius 完全保留（向後兼容，優先級低於 size）
 * - 刪除 radius="xl" 死分支（0 使用）
 */
const props = defineProps({
  variant: {
    type: String,
    default: "default", // 'default' | 'outlined' | 'elevated' | 'flat'
  },
  size: {
    type: String,
    default: null, // null | 'sm' | 'md' | 'lg' — 快捷：同時設定 padding 與 radius
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
  // size 快捷優先：sm → pad-sm + radius-sm；md → pad-md + radius-md；lg → pad-lg + radius-lg
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
  padding: 12px;
}
.content-card--pad-md {
  padding: 16px;
}
.content-card--pad-lg {
  padding: 20px;
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
  border-left-color: var(--iln-ok);
}
.content-card--status-warn {
  border-left-color: var(--iln-warn);
}
.content-card--status-danger {
  border-left-color: var(--iln-danger);
}
.content-card--status-info {
  border-left-color: var(--iln-info);
}

.content-card--tint-ok {
  background: var(--iln-ok-bg);
}
.content-card--tint-warn {
  background: var(--iln-warn-bg);
}
.content-card--tint-danger {
  background: var(--iln-danger-bg);
}
.content-card--tint-info {
  background: var(--iln-info-bg);
}

.content-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.content-card__body {
  flex: 1;
}

.content-card__footer {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.content-card--clickable {
  cursor: pointer;
}
</style>
