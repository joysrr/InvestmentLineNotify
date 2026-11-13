<template>
  <section class="section">
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
  </section>
</template>

<script setup>
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
  gap: 10px;
}
.snapshot-grid--3 {
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 480px) {
  .snapshot-grid--3 {
    grid-template-columns: repeat(3, 1fr);
  }
}
.snapshot-card {
  background: var(--iln-bg);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--iln-surface);
}
.snap-label {
  font-size: 11px;
  color: var(--iln-hint);
  margin-bottom: 4px;
}
.snap-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--iln-text);
}
.snap-sub {
  font-size: 11px;
  margin-top: 2px;
  font-weight: 600;
}
.snap-hint {
  font-size: 10px;
  color: var(--iln-hint);
  margin-top: 2px;
  line-height: 1.2;
}
.snap-light {
  font-size: 20px;
}
.card-danger {
  border-left: 3px solid var(--iln-danger-text);
}
.card-warn {
  border-left: 3px solid var(--iln-warn-text);
}
.card-ok {
  border-left: 3px solid var(--iln-ok-text);
}
</style>
