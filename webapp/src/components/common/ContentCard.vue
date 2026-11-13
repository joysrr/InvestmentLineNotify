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

const props = defineProps({
  variant: {
    type: String,
    default: "default", // 'default' | 'outlined' | 'elevated' | 'flat'
  },
  padding: {
    type: String,
    default: "md", // 'none' | 'sm' | 'md' | 'lg'
  },
  radius: {
    type: String,
    default: "md", // 'sm' | 'md' | 'lg' | 'xl'
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
  const cls = [
    "content-card",
    `content-card--variant-${props.variant}`,
    `content-card--pad-${props.padding}`,
    `content-card--radius-${props.radius}`,
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
.content-card--radius-xl {
  border-radius: var(--iln-radius-xl);
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
