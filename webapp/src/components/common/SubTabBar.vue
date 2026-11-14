<template>
  <div class="sub-tab-bar" role="tablist" aria-label="子分頁">
    <button
      v-for="tab in tabs"
      :key="tab.label"
      type="button"
      role="tab"
      :aria-selected="isActive(tab)"
      :class="[
        'sub-tab',
        { 'sub-tab--active': isActive(tab) },
      ]"
      @click="selectTab(tab)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  tabs: {
    type: Array,
    required: true,
  },
  activeTab: {
    type: String,
    required: false,
    default: null,
  },
});

const emit = defineEmits(["tab-change"]);

const internalActive = ref(props.activeTab || (props.tabs[0]?.label ?? null));

watch(
  () => props.activeTab,
  (val) => {
    if (val !== null) internalActive.value = val;
  }
);

const activeKey = computed(() => internalActive.value);

const isActive = (tab) => tab.label === activeKey.value;

const selectTab = (tab) => {
  if (!isActive(tab)) {
    internalActive.value = tab.label;
    emit("tab-change", tab.label);
  }
};
</script>

<style scoped>
.sub-tab-bar {
  display: flex;
  gap: var(--iln-space-1);
  border-bottom: 1px solid var(--iln-border-subtle);
  margin-bottom: var(--iln-space-4);
}

.sub-tab {
  padding: var(--iln-space-2) var(--iln-space-3);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--iln-hint);
  font-size: var(--iln-font-sm);
  font-weight: var(--iln-weight-medium);
  cursor: pointer;
  transition: all var(--iln-duration-base) var(--iln-ease-standard);
}

.sub-tab:hover {
  color: var(--iln-text);
}

.sub-tab--active {
  color: var(--iln-brand);
  border-bottom-color: var(--iln-brand);
}
</style>
