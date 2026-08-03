<template>
  <div class="mode-selector">
    <div class="mode-tabs">
      <button
        class="mode-tab"
        :class="{ active: modelValue === 'forward' }"
        @click="$emit('update:modelValue', 'forward')"
      >
        <span class="mode-icon">📈</span>
        <span class="mode-label">股價 → 分數</span>
        <span class="mode-desc">輸入預估價格，看策略結果</span>
      </button>
      <button
        class="mode-tab"
        :class="{ active: modelValue === 'reverse' }"
        @click="$emit('update:modelValue', 'reverse')"
      >
        <span class="mode-icon">🎯</span>
        <span class="mode-label">目標 → 價格</span>
        <span class="mode-desc">想達到某指標，反推所需價格</span>
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
});

defineEmits(["update:modelValue"]);
</script>

<style scoped>
.mode-selector {
  margin-bottom: 24px;
}

.mode-tabs {
  display: flex;
  background: #f5f5f5;
  border-radius: 16px;
  padding: 4px;
  gap: 4px;
}

.mode-tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 14px 12px;
  border-radius: 12px;
  text-align: left;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-tab.active {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.mode-icon {
  font-size: 18px;
}

.mode-label {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
}

.mode-desc {
  font-size: 11px;
  color: #888;
}
</style>