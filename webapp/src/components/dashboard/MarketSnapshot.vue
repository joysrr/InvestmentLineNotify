<template>
  <ContentCard variant="outlined" size="lg">
    <h3 class="section-title">市場快照</h3>
    <div v-if="loading" class="snapshot-grid snapshot-grid--3" aria-busy="true">
      <div v-for="i in 3" :key="i" class="snapshot-card skeleton-card">
        <div class="sk sk-label"></div>
        <div class="sk sk-value"></div>
        <div class="sk sk-sub"></div>
      </div>
    </div>
    <div v-else-if="error" class="inline-error">
      <Icon name="danger" size="sm" color="var(--iln-viz-bear)" /> <span>快照載入失敗</span>
    </div>
    <div v-else class="snapshot-grid snapshot-grid--3">
      <!-- Regime / VIX -->
      <div class="snapshot-card" :class="regimeLevel.cardClass">
        <span class="snap-label">總經狀態 (Macro Regime)</span>
        <span class="snap-value tabular">{{
          status?.data?.rawUsMarket?.vix ?? "—"
        }}</span>
        <span class="snap-sub" :class="regimeLevel.textClass">
          <span>{{ regimeLevel.label }}</span>
          <span v-if="vixOverrideActive" class="snap-trigger" title="VIX 短路保護生效">
            <Icon name="trigger" size="sm" color="var(--iln-viz-alert)" />
          </span>
        </span>
        <span v-if="regimeLevel.subLabel" class="snap-hint">
          {{ regimeLevel.subLabel }}
        </span>
      </div>
      <!-- PB PR -->
      <div class="snapshot-card" :class="pbPrLevel.cardClass">
        <span class="snap-label">PB 分位數</span>
        <span class="snap-value tabular">{{ pbPrValue }}%</span>
        <span class="snap-sub" :class="pbPrLevel.textClass">{{
          pbPrLevel.label
        }}</span>
      </div>
      <!-- Light -->
      <div class="snapshot-card">
        <span class="snap-label">景氣燈號</span>
        <span class="snap-value snap-light">{{ lightEmoji }}</span>
        <span class="snap-sub snap-sub--neutral">{{ lightText }}</span>
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import ContentCard from "@/components/common/ContentCard.vue";
import Icon from "@/components/common/Icon.vue";

defineProps({
  status: Object,
  loading: Boolean,
  error: Boolean,
  regimeLevel: Object,
  vixOverrideActive: Boolean,
  pbPrLevel: Object,
  pbPrValue: [Number, String],
  glLevel: Object,
  glValue: [Number, String],
  lightEmoji: String,
  lightText: String,
});
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--iln-space-3);
}

.snapshot-grid--3 {
  gap: var(--iln-space-4);
}

.snapshot-card {
  background: var(--iln-bg);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-3);
  border: 1px solid var(--iln-border-subtle);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-1);
}

.skeleton-card {
  background: var(--iln-surface);
  border-radius: var(--iln-radius-md);
  padding: var(--iln-space-3);
  border: 1px solid var(--iln-border-subtle);
}

.snap-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.snap-value {
  font-size: var(--iln-font-xl);
  font-weight: 700;
  color: var(--iln-text);
}

.snap-value.snap-light {
  font-size: var(--iln-font-lg);
}

.snap-sub {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.snap-sub.snap-sub--neutral {
  color: var(--iln-text);
}

.snap-trigger {
  display: inline-flex;
  align-items: center;
}

.snap-hint {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.section-title {
  font-size: var(--iln-font-base);
  color: var(--iln-text);
  margin: 0 0 var(--iln-space-3);
}

.card-ok .snap-sub { color: var(--iln-viz-bull-text); }
.card-warn .snap-sub { color: var(--iln-viz-alert-text); }
.card-danger .snap-sub { color: var(--iln-viz-bear-text); }

.border-left-danger {
  border-left: 3px solid var(--iln-viz-bear-text);
}
.border-left-warn {
  border-left: 3px solid var(--iln-viz-alert-text);
}
.border-left-ok {
  border-left: 3px solid var(--iln-viz-bull-text);
}

.inline-error {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  color: var(--iln-viz-bear-text);
}

.sk {
  height: 16px;
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface-alt);
}

.sk-label {
  width: 60%;
}

.sk-sub {
  width: 45%;
}

.sk-value {
  height: 22px;
  width: 80%;
}
</style>
