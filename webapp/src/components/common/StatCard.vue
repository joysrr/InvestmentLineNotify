<template>
  <div
    :class="wrapperClasses"
    :aria-label="ariaLabel"
  >
    <div class="stat-card__content">
      <div
        v-if="hasLabelSlot || label"
        class="stat-card__label"
      >
        <slot name="label">{{ label }}</slot>
      </div>
      <div class="stat-card__value" :class="valueClasses">
        <slot name="value">{{ formattedValue }}</slot>
        <Icon
          v-if="trendIcon"
          :name="trendIcon"
          :size="12"
          class="stat-card__trend"
          aria-hidden="true"
        />
      </div>
      <div
        v-if="hasSuffixSlot || unit"
        class="stat-card__unit"
      >
        <slot name="suffix">{{ unit }}</slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, useSlots } from "vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], required: true },
  unit: { type: String, default: "" },
  format: {
    type: String,
    default: "auto", // 'auto' | 'number' | 'percent' | 'currency' | 'raw'
  },
  decimals: { type: Number, default: 1 },
  status: {
    type: String,
    default: null, // null | 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
  },
  trend: {
    type: String,
    default: null, // null | 'up' | 'down' | 'flat'
  },
  size: {
    type: String,
    default: "md", // 'sm' | 'md' | 'lg'
  },
  align: {
    type: String,
    default: "center", // 'left' | 'center' | 'right'
  },
  framed: { type: Boolean, default: true },
});

const slots = useSlots();

const hasLabelSlot = computed(() => !!slots.label);
const hasSuffixSlot = computed(() => !!slots.suffix);

const formattedValue = computed(() => {
  if (props.format === "raw") return String(props.value);
  const num = Number(props.value);
  if (Number.isNaN(num)) return String(props.value);

  switch (props.format) {
    case "auto":
      if (num >= 10000) {
        return `${(num / 10000).toFixed(props.decimals)} 萬`;
      }
      return num.toLocaleString(undefined, {
        minimumFractionDigits: props.decimals,
        maximumFractionDigits: props.decimals,
      });
    case "number":
      return num.toLocaleString(undefined, {
        minimumFractionDigits: props.decimals,
        maximumFractionDigits: props.decimals,
      });
    case "percent":
      return `${(num * 100).toFixed(props.decimals)}%`;
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: props.decimals,
        maximumFractionDigits: props.decimals,
      }).format(num);
    default:
      return String(props.value);
  }
});

const wrapperClasses = computed(() => {
  const cls = ["stat-card", `stat-card--size-${props.size}`, `stat-card--align-${props.align}`];
  if (props.framed) cls.push("stat-card--framed");
  if (props.status) cls.push(`stat-card--status-${props.status}`);
  if (props.trend) cls.push(`stat-card--trend-${props.trend}`);
  return cls;
});

const valueClasses = computed(() => {
  const cls = ["stat-card__value"];
  if (props.status) cls.push(`stat-card__value--status-${props.status}`);
  return cls;
});

const ariaLabel = computed(() => {
  const parts = [props.label, formattedValue.value, props.unit].filter(Boolean);
  return parts.join(" ");
});

const trendIcon = computed(() => {
  if (props.trend === "up") return "arrow-up";
  if (props.trend === "down") return "arrow-down";
  if (props.trend === "flat") return "minus";
  return null;
});
</script>

<style scoped>
.stat-card {
  display: inline-flex;
  flex-direction: column;
  align-items: var(--stat-align-start, center);
  gap: 2px;
}

.stat-card--align-left {
  --stat-align-start: flex-start;
  text-align: left;
}
.stat-card--align-center {
  --stat-align-start: center;
  text-align: center;
}
.stat-card--align-right {
  --stat-align-start: flex-end;
  text-align: right;
}

.stat-card--framed {
  background: var(--iln-bg);
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-3);
  box-sizing: border-box;
}

.stat-card__label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.stat-card--size-sm .stat-card__label {
  font-size: var(--iln-font-xs);
}
.stat-card--size-md .stat-card__label {
  font-size: var(--iln-font-sm);
}
.stat-card--size-lg .stat-card__label {
  font-size: var(--iln-font-sm);
}

.stat-card__value {
  font-weight: 700;
}

.stat-card--size-sm .stat-card__value {
  font-size: var(--iln-font-md);
}
.stat-card--size-md .stat-card__value {
  font-size: var(--iln-font-lg);
}
.stat-card--size-lg .stat-card__value {
  font-size: var(--iln-font-xl);
}

.stat-card__unit {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.stat-card--size-lg .stat-card__unit {
  font-size: var(--iln-font-sm);
}

.stat-card__value--status-ok {
  color: var(--iln-ok-text);
}
.stat-card__value--status-warn {
  color: var(--iln-warn-text);
}
.stat-card__value--status-danger {
  color: var(--iln-danger-text);
}
.stat-card__value--status-info {
  color: var(--iln-info-text);
}
.stat-card__value--status-neutral {
  color: var(--iln-hint);
}

.stat-card__trend {
  margin-left: 4px;
  vertical-align: middle;
  color: var(--iln-hint);
}
</style>
