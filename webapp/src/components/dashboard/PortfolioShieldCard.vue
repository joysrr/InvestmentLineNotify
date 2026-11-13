<template>
  <ContentCard
    variant="outlined"
    padding="lg"
    radius="lg"
    clickable
    :class="shieldStatus.cardClass"
    @click="emit('open-drawer')"
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
        <span class="chevron"><Icon name="chevron-down" size="sm" color="var(--iln-hint)" /></span>
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import Icon from "@/components/common/Icon.vue";
import ContentCard from "@/components/common/ContentCard.vue";

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

const emit = defineEmits(["open-drawer"]);

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
  /* 佈局由 ContentCard 提供 */
}
.cockpit-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cockpit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.cockpit-tag {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.status-badge {
  font-size: var(--iln-font-xs);
  padding: 2px 6px;
  border-radius: var(--iln-radius-full);
  background: var(--iln-surface);
}
.cockpit-title {
  font-size: var(--iln-font-xl);
  font-weight: 700;
  color: var(--iln-text);
}
.cockpit-sub {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}
.cockpit-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.shield-meter {
  width: 120px;
  height: 8px;
  background: var(--iln-surface);
  border-radius: var(--iln-radius-full);
  overflow: hidden;
}
.meter-track {
  width: 100%;
  height: 100%;
}
.meter-fill {
  height: 100%;
  border-radius: var(--iln-radius-full);
  transition: width 0.3s ease;
}
.meter-fill.fill-ok { background: var(--iln-ok); }
.meter-fill.fill-warn { background: var(--iln-warn); }
.meter-fill.fill-danger { background: var(--iln-danger); }
.cockpit-action {
  margin-top: 12px;
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.drawer-hint {
  display: block;
  margin-bottom: 4px;
}
.chevron {
  font-size: var(--iln-font-sm);
}
</style>