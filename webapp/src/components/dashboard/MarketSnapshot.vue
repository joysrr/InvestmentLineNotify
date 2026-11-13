<template>
  <ContentCard variant="outlined" padding="lg" radius="lg">
    <h3 class="section-title">市場快照</h3>
    <div v-if="loading" class="snapshot-grid snapshot-grid--3">
      <div v-for="i in 3" :key="i" class="snapshot-card skeleton-card">
        <div class="sk sk-label"></div>
        <div class="sk sk-value"></div>
        <div class="sk sk-sub"></div>
      </div>
    </div>
    <div v-else-if="error" class="inline-error">⚠️ 快照載入失敗</div>
    <div v-else class="snapshot-grid snapshot-grid--3">
      <!-- Regime / VIX -->
      <div class="snapshot-card" :class="regimeLevel.cardClass">
        <span class="snap-label">總經狀態 (Macro Regime)</span>
        <span class="snap-value">{{
          status?.data?.rawUsMarket?.vix ?? "—"
        }}</span>
        <span class="snap-sub" :class="regimeLevel.textClass">
          {{ regimeLevel.label }}
          <span v-if="vixOverrideActive" title="VIX 短路保護生效">⚡</span>
        </span>
        <span v-if="regimeLevel.subLabel" class="snap-hint">
          {{ regimeLevel.subLabel }}
        </span>
      </div>
      <!-- PB PR -->
      <div class="snapshot-card" :class="pbPrLevel.cardClass">
        <span class="snap-label">PB 分位數</span>
        <span class="snap-value">{{ pbPrValue }}%</span>
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
.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.snapshot-card {
  background: var(--iln-bg);
  border-radius: var(--iln-radius-md);
  padding: 12px;
  border: 1px solid var(--iln-surface);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.skeleton-card {
  background: var(--iln-surface);
  border-radius: var(--iln-radius-md);
  padding: 12px;
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
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.snap-sub.snap-sub--neutral {
  color: var(--iln-text);
}
.snap-hint {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}
.section-title {
  font-size: var(--iln-font-base);
  color: var(--iln-text);
  margin: 0 0 12px;
}
.card-ok .snap-sub { color: var(--iln-ok-text); }
.card-warn .snap-sub { color: var(--iln-warn-text); }
.card-danger .snap-sub { color: var(--iln-danger-text); }
.border-left-danger {
  border-left: 3px solid var(--iln-danger-text);
}
.border-left-warn {
  border-left: 3px solid var(--iln-warn-text);
}
.border-left-ok {
  border-left: 3px solid var(--iln-ok-text);
}
</style>