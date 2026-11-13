<script setup>
defineProps({
  variant: {
    type: String,
    default: "card",
    validator: (v) => ["card", "list", "grid"].includes(v),
  },
  rows: { type: Number, default: 3 },
  gridCols: { type: Number, default: 2 },
});
</script>

<template>
  <div class="loading-skeleton" :class="`loading-skeleton--${variant}`">
    <template v-if="variant === 'card'">
      <div v-for="i in rows" :key="i" class="sk-card">
        <div class="sk-line sk-line--title" />
        <div class="sk-line sk-line--text" />
        <div class="sk-line sk-line--text sk-line--short" />
      </div>
    </template>

    <template v-else-if="variant === 'list'">
      <div v-for="i in rows" :key="i" class="sk-list-item">
        <div class="sk-avatar" />
        <div class="sk-list-content">
          <div class="sk-line sk-line--title" />
          <div class="sk-line sk-line--text" />
        </div>
      </div>
    </template>

    <template v-else>
      <div
        v-for="i in rows * gridCols"
        :key="i"
        class="sk-grid-item"
      />
    </template>
  </div>
</template>

<style scoped>
.loading-skeleton {
  width: 100%;
}

.loading-skeleton--card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-skeleton--list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loading-skeleton--grid {
  display: grid;
  grid-template-columns: repeat(v-bind(gridCols), 1fr);
  gap: 12px;
}

.sk-card {
  padding: 16px;
  border-radius: 8px;
  background: var(--color-bg-card, var(--iln-bg));
  border: 1px solid var(--color-border);
}

.sk-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--color-skeleton-base) 25%,
    var(--color-skeleton-shine) 37%,
    var(--color-skeleton-base) 63%
  );
  background-size: 400% 100%;
  animation: sk-shimmer 1.4s ease infinite;
}

.sk-line--title {
  width: 40%;
  height: 14px;
  margin-bottom: 12px;
}

.sk-line--text {
  width: 100%;
  margin-bottom: 8px;
}

.sk-line--short {
  width: 60%;
  margin-bottom: 0;
}

.sk-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sk-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--color-skeleton-base);
}

.sk-list-content {
  flex: 1;
}

.sk-grid-item {
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    var(--color-skeleton-base) 25%,
    var(--color-skeleton-shine) 37%,
    var(--color-skeleton-base) 63%
  );
  background-size: 400% 100%;
  animation: sk-shimmer 1.4s ease infinite;
}

@keyframes sk-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
