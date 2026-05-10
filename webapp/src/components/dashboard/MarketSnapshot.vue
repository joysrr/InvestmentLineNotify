<template>
  <section class="section">
    <h3 class="section-title">市場快照</h3>
    <div v-if="loading" class="snapshot-grid snapshot-grid--4">
      <div v-for="i in 4" :key="i" class="snapshot-card skeleton-card">
        <div class="sk sk-label"></div>
        <div class="sk sk-value"></div>
        <div class="sk sk-sub"></div>
      </div>
    </div>
    <div v-else-if="error" class="inline-error">⚠️ 快照載入失敗</div>
    <div v-else class="snapshot-grid snapshot-grid--4">
      <!-- Regime / VIX -->
      <div class="snapshot-card" :class="regimeLevel.cardClass">
        <span class="snap-label">市場環境 (VIX)</span>
        <span class="snap-value">{{ status?.data?.rawUsMarket?.vix ?? "—" }}</span>
        <span class="snap-sub" :class="regimeLevel.textClass">
          {{ regimeLevel.label }}
          <span v-if="vixOverrideActive" title="VIX 短路保護生效">⚡</span>
        </span>
      </div>
      <!-- PB PR -->
      <div class="snapshot-card" :class="pbPrLevel.cardClass">
        <span class="snap-label">PB 分位數</span>
        <span class="snap-value">{{ pbPrValue }}%</span>
        <span class="snap-sub" :class="pbPrLevel.textClass">{{ pbPrLevel.label }}</span>
      </div>
      <!-- GL -->
      <div class="snapshot-card" :class="glLevel.cardClass">
        <span class="snap-label">總曝險 GL</span>
        <span class="snap-value">{{ glValue }}x</span>
        <span class="snap-sub" :class="glLevel.textClass">{{ glLevel.label }}</span>
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
  lightText: String
});
</script>

<style scoped>
.snapshot-grid {
  display: grid;
  gap: 10px;
}
.snapshot-grid--4 {
  grid-template-columns: repeat(2, 1fr);
}
@media (min-width: 600px) {
  .snapshot-grid--4 {
    grid-template-columns: repeat(4, 1fr);
  }
}
.snapshot-card {
  background: var(--tg-theme-bg-color, #fff);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--tg-theme-secondary-bg-color, #f0f0f0);
}
.snap-label {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #999);
  margin-bottom: 4px;
}
.snap-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #222);
}
.snap-sub {
  font-size: 11px;
  margin-top: 2px;
  font-weight: 600;
}
.snap-light { font-size: 20px; }
.card-danger { border-left: 3px solid #e84855; }
.card-warn { border-left: 3px solid #d4ac0d; }
.card-ok { border-left: 3px solid #26a17b; }
</style>
