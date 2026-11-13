<template>
  <div class="collapsible-section">
    <div class="collapsible-header">
      <span class="collapsible-title">{{ title }}</span>
      <button
        type="button"
        class="toggle-btn"
        :aria-expanded="isExpanded"
        @click="toggle"
      >
        {{ toggleText || (isExpanded ? "收合" : "展開") }}
      </button>
    </div>
    <div v-if="isExpanded" class="collapsible-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  toggleText: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:expanded"]);

const isExpanded = ref(props.expanded);

const toggle = () => {
  isExpanded.value = !isExpanded.value;
  emit("update:expanded", isExpanded.value);
};
</script>

<style scoped>
.collapsible-section {
  border: 1px solid var(--iln-border-subtle);
  border-radius: var(--iln-radius-md);
  overflow: hidden;
}

.collapsible-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--iln-space-3);
  background: var(--iln-bg);
  cursor: pointer;
}

.collapsible-title {
  font-weight: 600;
  color: var(--iln-text);
}

.collapsible-toggle {
  background: none;
  border: none;
  color: var(--iln-hint);
  font-size: var(--iln-font-sm);
  cursor: pointer;
  padding: var(--iln-space-1);
  border-radius: var(--iln-radius-sm);
}

.collapsible-toggle:hover {
  background: var(--iln-surface);
}

.collapsible-content {
  padding: var(--iln-space-3);
  border-top: 1px solid var(--iln-border-subtle);
}
</style>
