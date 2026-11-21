<template>
  <ContentCard variant="outlined" size="lg" class="hero-card-wrapper">
    <Transition name="hero-fade" mode="out-in">
      <div v-if="loading" key="skeleton" class="hero-card skeleton-card">
        <div class="sk sk-title"></div>
        <div class="sk sk-label"></div>
        <div class="sk sk-value"></div>
      </div>
      <div
        v-else-if="error"
        key="error"
        class="inline-error"
      ><Icon name="danger" size="sm" color="var(--iln-viz-bear)" /> 報告載入失敗</div>
      <div
        v-else-if="!report"
        key="hint"
        class="inline-hint"
      ><Icon name="info" size="sm" color="var(--iln-hint)" /> 尚無報告資料</div>
      <div v-else key="content" class="hero-card">
        <div class="hero-top">
          <span class="hero-date tabular">{{ report.date }}</span>
          <span class="priority-tag" v-if="activePriority">{{
            activePriority
          }}</span>
        </div>

        <!-- Primary Action Area -->
        <div class="hero-cta-area">
          <div
            class="hero-target iln-num-tabular tabular"
            :class="[targetClass, { 'is-rolling': rollTarget }]"
            :data-value="report.signals?.target"
          >
            {{ report.signals?.target ?? "—" }}
          </div>
          <div class="hero-suggestion">
            {{ report.signals?.suggestion || "分析中..." }}
          </div>
        </div>

        <CollapsibleSection title="查看風險與詳情" :expanded="expanded" class="hero-details">
          <div class="hero-badges tabular">
            <span
              class="badge iln-num-tabular"
              :class="[pctClass, { 'is-rolling': rollPct }]"
              :data-value="pctText"
            >
              {{ pctText }}
            </span>
            <span
              class="badge badge-score iln-num-tabular"
              :class="{ 'is-rolling': rollScore }"
              :data-value="report.signals?.score"
            >
              評分 {{ report.signals?.score ?? "—" }}
            </span>
          </div>
          <div class="hero-route">
            <div class="hero-route-main">
              <span class="route-label">核心路由：</span>
              <span class="route-path">{{ routingPath || "—" }}</span>
            </div>
            <router-link v-if="showTrendLink" to="/chart" class="hero-trend-link">
              <Icon name="chart" size="sm" color="var(--iln-brand)" /> <span>資產趨勢 →</span>
            </router-link>
          </div>
        </CollapsibleSection>
      </div>
    </Transition>
  </ContentCard>
</template>

<script setup>
import { ref, watch } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import CollapsibleSection from "@/components/common/CollapsibleSection.vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  report: Object,
  loading: Boolean,
  error: Boolean,
  activePriority: String,
  targetClass: String,
  pctClass: String,
  pctText: String,
  routingPath: String,
  expanded: {
    type: Boolean,
    default: false,
  },
  showTrendLink: {
    type: Boolean,
    default: true,
  },
});

const rollTarget = ref(false);
const rollPct = ref(false);
const rollScore = ref(false);

const clearRoll = (ref_) => {
  ref_.value = false;
};

watch(
  () => props.report,
  (newReport, oldReport) => {
    if (!newReport) return;
    const sig = newReport.signals || {};
    const oldSig = oldReport?.signals || {};

    rollTarget.value = sig.target !== oldSig.target;
    rollPct.value = props.pctText !== (oldReport ? oldReport.pctText : undefined);
    rollScore.value = sig.score !== oldSig.score;

    if (rollTarget.value) setTimeout(() => clearRoll(rollTarget), 600);
    if (rollPct.value) setTimeout(() => clearRoll(rollPct), 600);
    if (rollScore.value) setTimeout(() => clearRoll(rollScore), 600);
  },
  { deep: true },
);
</script>

<style scoped>
.tabular {
  font-variant-numeric: tabular-nums;
}

.hero-card-wrapper {
  transition:
    box-shadow var(--iln-duration-fast) var(--iln-ease-standard),
    transform var(--iln-duration-fast) var(--iln-ease-standard);
}
.hero-card-wrapper:hover {
  box-shadow: var(--iln-shadow-2);
  transform: translateY(-2px);
}
.hero-card-wrapper:active {
  transform: scale(0.985);
}

.hero-cta-area {
  background: var(--iln-brand-soft);
  padding: var(--iln-space-5);
  border-radius: var(--iln-radius-lg);
  margin-bottom: var(--iln-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-2);
}

.hero-target {
  font-size: var(--iln-font-base);
  color: var(--iln-text);
  font-weight: var(--iln-weight-bold);
}

.hero-suggestion {
  font-size: var(--iln-font-xl);
  color: var(--iln-text);
  font-weight: var(--iln-weight-bold);
  line-height: 1.3;
}

.hero-details {
  border-top: 1px solid var(--iln-border-subtle);
  padding-top: var(--iln-space-4);
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-5);
}

.hero-date {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--iln-space-2);
  margin-bottom: var(--iln-space-5);
}

.hero-route {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--iln-space-2);
  margin-top: var(--iln-space-4);
}

.hero-route-main {
  display: flex;
  align-items: center;
  gap: var(--iln-space-2);
}

.hero-trend-link {
  display: inline-flex;
  align-items: center;
  gap: var(--iln-space-1);
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-semibold);
  color: var(--iln-brand);
  text-decoration: none;
  border-radius: var(--iln-radius-sm);
}
.hero-trend-link:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}

.route-label {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.route-path {
  font-size: var(--iln-font-sm);
  color: var(--iln-text);
}

.badge {
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-semibold);
  padding: var(--iln-space-1) var(--iln-space-2);
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface);
}

.badge-score {
  color: var(--iln-text);
}

.priority-tag {
  font-size: var(--iln-font-xs);
  font-weight: var(--iln-weight-semibold);
  padding: 2px var(--iln-space-2);
  border-radius: var(--iln-radius-sm);
  background: var(--iln-brand-soft);
  color: var(--iln-brand);
}

.skeleton-card {
  padding: var(--iln-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--iln-space-3);
}

.sk-title {
  height: 20px;
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface-alt);
}

.sk-label {
  height: 14px;
  width: 40%;
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface-alt);
}

.sk-value {
  height: 24px;
  width: 60%;
  border-radius: var(--iln-radius-sm);
  background: var(--iln-surface-alt);
}

.inline-error,
.inline-hint {
  display: flex;
  align-items: center;
  gap: var(--iln-space-1-5, 6px);
  padding: var(--iln-space-3);
  font-size: var(--iln-font-sm);
  color: var(--iln-text);
}

.hero-fade-enter-active,
.hero-fade-leave-active {
  transition:
    opacity var(--iln-duration-base) var(--iln-ease-standard),
    transform var(--iln-duration-base) var(--iln-ease-standard);
}
.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.is-rolling {
  display: inline-block;
  animation:
    numRoll var(--iln-duration-base) var(--iln-ease-standard) forwards;
}
@keyframes numRoll {
  0% {
    transform: translateY(100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-card-wrapper:hover,
  .hero-card-wrapper:active,
  .is-rolling,
  .hero-fade-enter-active,
  .hero-fade-leave-active {
    transition: none;
    animation: none;
    transform: none;
  }
  .hero-fade-enter-from,
  .hero-fade-leave-to {
    opacity: 0;
    transform: none;
  }
}
</style>
