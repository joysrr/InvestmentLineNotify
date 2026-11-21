<template>
  <div class="collapsible-section">
    <component
      :is="clickableHeader ? 'button' : 'div'"
      :type="clickableHeader ? 'button' : undefined"
      class="collapsible-header"
      :class="{ 'is-clickable': clickableHeader }"
      :aria-expanded="clickableHeader ? isExpanded : undefined"
      :aria-controls="clickableHeader ? contentId : undefined"
      @click="clickableHeader && toggle()"
    >
      <slot name="header">
        <span class="collapsible-title">{{ title }}</span>
      </slot>
      <span
        class="collapsible-indicator"
        :class="{ 'is-open': indicator === 'chevron' && isExpanded }"
        aria-hidden="true"
      >
        <Icon
          v-if="indicator === 'chevron'"
          name="chevron-down"
          size="sm"
          aria-hidden="true"
        />
        <template v-else-if="indicator === 'plus-minus'">
          {{ isExpanded ? "−" : "+" }}
        </template>
        <template v-else>
          {{ toggleText || (isExpanded ? "收合" : "展開") }}
        </template>
      </span>
    </component>

    <Transition name="collapse">
      <div
        v-if="isExpanded"
        :id="contentId"
        class="collapsible-content"
        role="region"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script>
let uidCounter = 0;
</script>

<script setup>
import { ref, watch } from "vue";
import Icon from "@/components/common/Icon.vue";

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
  indicator: {
    type: String,
    default: "chevron", // 'chevron' | 'text' | 'plus-minus'
  },
  clickableHeader: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["update:expanded"]);

const contentId = `collapsible-content-${++uidCounter}`;
const isExpanded = ref(props.expanded);

watch(
  () => props.expanded,
  (val) => {
    isExpanded.value = val;
  },
);

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
  background: var(--iln-bg);
}

.collapsible-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--iln-space-2);
  width: 100%;
  padding: var(--iln-space-3);
  background: var(--iln-bg);
  border: none;
  text-align: left;
  font: inherit;
  color: inherit;
}

.collapsible-header.is-clickable {
  cursor: pointer;
  transition: background-color var(--iln-duration-fast, 150ms) var(--iln-ease-standard, ease);
}

.collapsible-header.is-clickable:hover {
  background: var(--iln-surface);
}

.collapsible-header.is-clickable:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: -2px;
}

.collapsible-header:not(.is-clickable) {
  cursor: default;
}

.collapsible-title {
  font-weight: 700;
  color: var(--iln-text);
}

.collapsible-indicator {
  display: inline-flex;
  align-items: center;
  color: var(--iln-hint);
  font-size: var(--iln-font-sm);
  transition: transform var(--iln-duration-base, 200ms)
    var(--iln-ease-standard, ease);
}

.collapsible-indicator.is-open {
  transform: rotate(180deg);
}

.collapse-enter-active,
.collapse-leave-active {
  transition:
    opacity var(--iln-duration-base, 200ms) var(--iln-ease-standard, ease),
    transform var(--iln-duration-base, 200ms) var(--iln-ease-standard, ease);
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.collapsible-content {
  padding: var(--iln-space-3);
  border-top: 1px solid var(--iln-border-subtle);
}

@media (prefers-reduced-motion: reduce) {
  .collapsible-header.is-clickable,
  .collapsible-indicator,
  .collapse-enter-active,
  .collapse-leave-active {
    transition: none;
  }
}
</style>
