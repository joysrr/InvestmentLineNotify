<template>
  <div class="insights-view">
    <MarketRadarView />
    <MacroBattleView />
  </div>
</template>

<script setup>
import MarketRadarView from "./MarketRadarView.vue";
import MacroBattleView from "./MacroBattleView.vue";
</script>

<style scoped>
.insights-view {
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-4);
}
</style>
