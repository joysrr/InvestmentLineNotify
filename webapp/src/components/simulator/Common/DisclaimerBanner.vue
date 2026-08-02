<template>
  <div class="disclaimer-banner">
    <span class="disclaimer-icon">⚠️</span>
    <span class="disclaimer-text">{{ disclaimer }}</span>
  </div>
</template>

<script setup>
defineProps({
  disclaimer: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
.disclaimer-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 11px;
  color: #888;
  line-height: 1.6;
}

.disclaimer-icon {
  font-size: 12px;
  flex-shrink: 0;
  margin-top: 1px;
}

.disclaimer-text {
  flex: 1;
}
</style>