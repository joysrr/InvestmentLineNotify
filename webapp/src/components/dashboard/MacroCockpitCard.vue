<template>
  <div
    class="cockpit-card"
    :class="regimeLevel?.cardClass || 'card-ok'"
    @click="$emit('open-drawer')"
    data-testid="macro-cockpit-card"
  >
    <div class="cockpit-left">
      <div class="cockpit-header">
        <span class="cockpit-tag">總經象限</span>
        <span v-if="vixOverrideActive" class="cockpit-flash" title="VIX 短路保護生效">⚡</span>
      </div>
      <div class="cockpit-title" :class="regimeLevel?.textClass">
        {{ regimeLevel?.label || "正常" }}
      </div>
      <div v-if="regimeLevel?.subLabel" class="cockpit-sub">
        {{ regimeLevel.subLabel }}
      </div>
    </div>

    <div class="cockpit-right">
      <div class="cockpit-metric">
        <span class="metric-label">CBOE VIX 指數</span>
        <span class="metric-value">{{ formatNumber(vix) }}</span>
      </div>
      <div class="cockpit-action">
        <span class="drawer-hint">點擊查看市場明細</span>
        <span class="chevron">❯</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  regimeLevel: {
    type: Object,
    default: () => ({
      label: "正常",
      cardClass: "card-ok",
      textClass: "text-ok",
      subLabel: "常態運作",
    }),
  },
  vix: {
    type: [Number, String],
    default: "—",
  },
  vixOverrideActive: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["open-drawer"]);

function formatNumber(val) {
  if (val == null || val === "—") return "—";
  const n = Number(val);
  return isNaN(n) ? "—" : n.toFixed(1);
}
</script>

<style scoped>
.cockpit-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--iln-bg);
  border: 1px solid var(--iln-surface);
  margin-bottom: 12px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.cockpit-card:active {
  transform: scale(0.985);
}

.cockpit-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cockpit-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cockpit-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cockpit-flash {
  font-size: 12px;
}

.cockpit-title {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
}

.cockpit-sub {
  font-size: 12px;
  color: var(--iln-hint);
  margin-top: 2px;
}

.cockpit-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.cockpit-metric {
  text-align: right;
}

.metric-label {
  font-size: 10px;
  color: var(--iln-hint);
  display: block;
}

.metric-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--iln-text);
}

.cockpit-action {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--iln-brand);
}

.chevron {
  font-size: 10px;
}

.card-ok {
  border-left: 5px solid var(--iln-ok);
}

.card-warn {
  border-left: 5px solid var(--iln-warn);
}

.card-danger {
  border-left: 5px solid var(--iln-danger);
}

.text-ok {
  color: var(--iln-ok-text);
}

.text-warn {
  color: var(--iln-warn-text);
}

.text-danger {
  color: var(--iln-danger-text);
}
</style>
