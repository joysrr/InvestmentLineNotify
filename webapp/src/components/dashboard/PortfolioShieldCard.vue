<template>
  <div
    class="cockpit-card"
    :class="shieldStatus.cardClass"
    @click="$emit('open-drawer')"
    data-testid="portfolio-shield-card"
  >
    <div class="cockpit-left">
      <div class="cockpit-header">
        <span class="cockpit-tag">資產安全防護</span>
        <span class="status-badge" :class="shieldStatus.textClass">
          {{ shieldStatus.label }}
        </span>
      </div>
      <div class="cockpit-title" :class="shieldStatus.textClass">
        {{ formatPercent(marginRatio) }}
      </div>
      <div class="cockpit-sub">
        耐跌 {{ dropBufferPercent }}% ｜ 槓桿 {{ formatLeverage(grossLeverage) }}
      </div>
    </div>

    <div class="cockpit-right">
      <div class="shield-meter">
        <div class="meter-track">
          <div
            class="meter-fill"
            :class="shieldStatus.fillClass"
            :style="{ width: `${meterFillPercent}%` }"
          ></div>
        </div>
      </div>
      <div class="cockpit-action">
        <span class="drawer-hint">點擊查看風控明細</span>
        <span class="chevron">❯</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  marginRatio: {
    type: [Number, String],
    default: 0,
  },
  warningThreshold: {
    type: Number,
    default: 160,
  },
  grossLeverage: {
    type: [Number, String],
    default: 1.0,
  },
});

defineEmits(["open-drawer"]);

const numMargin = computed(() => Number(props.marginRatio) || 0);

const dropBufferPercent = computed(() => {
  if (numMargin.value <= props.warningThreshold) return 0;
  // 緩衝耐跌空間公式：(當前維持率 - 警戒線) / 當前維持率
  const buffer = ((numMargin.value - props.warningThreshold) / numMargin.value) * 100;
  return Math.round(buffer);
});

const meterFillPercent = computed(() => {
  // 將維持率映射至 0~100% (以 300% 為上限標竿)
  const clamped = Math.max(0, Math.min(300, numMargin.value));
  return Math.round((clamped / 300) * 100);
});

const shieldStatus = computed(() => {
  const m = numMargin.value;
  if (m <= 0) {
    return { label: "無部位", cardClass: "", textClass: "", fillClass: "" };
  }
  if (m < props.warningThreshold) {
    return {
      label: "警戒",
      cardClass: "card-danger",
      textClass: "text-danger",
      fillClass: "fill-danger",
    };
  }
  if (m < props.warningThreshold + 30) {
    return {
      label: "關注",
      cardClass: "card-warn",
      textClass: "text-warn",
      fillClass: "fill-warn",
    };
  }
  return {
    label: "安全",
    cardClass: "card-ok",
    textClass: "text-ok",
    fillClass: "fill-ok",
  };
});

function formatPercent(val) {
  if (val == null || val === 0) return "—";
  return `${Math.round(Number(val))}%`;
}

function formatLeverage(val) {
  if (val == null) return "—";
  const n = Number(val);
  return isNaN(n) ? "—" : `${n.toFixed(2)}x`;
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
  gap: 6px;
}

.cockpit-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
}

.cockpit-title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
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
  gap: 8px;
  width: 90px;
}

.shield-meter {
  width: 100%;
}

.meter-track {
  width: 100%;
  height: 6px;
  background: var(--iln-surface);
  border-radius: 3px;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.fill-ok {
  background: var(--iln-ok);
}

.fill-warn {
  background: var(--iln-warn);
}

.fill-danger {
  background: var(--iln-danger);
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
