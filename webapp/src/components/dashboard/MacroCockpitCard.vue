<template>
  <ContentCard
    variant="default"
    padding="md"
    radius="lg"
    :status="statusKey"
    status-style="left-border"
    clickable
    @click="$emit('open-drawer')"
    data-testid="macro-cockpit-card"
  >
    <template #header>
      <div class="cockpit-header">
        <span class="cockpit-tag">總經象限</span>
        <span
          v-if="vixOverrideActive"
          class="cockpit-flash"
          title="VIX 短路保護生效"
        >
          <Icon name="trigger" size="sm" color="var(--iln-warn)" />
        </span>
      </div>
      <div class="cockpit-title" :class="regimeLevel?.textClass">
        {{ regimeLevel?.label || "正常" }}
      </div>
      <div v-if="regimeLevel?.subLabel" class="cockpit-sub">
        {{ regimeLevel.subLabel }}
      </div>
    </template>

    <div class="cockpit-body">
      <div class="cockpit-metric">
        <StatCard
          label="CBOE VIX 指數"
          :value="formatNumber(vix)"
          :framed="false"
          size="md"
          align="right"
        />
      </div>
      <div class="cockpit-action">
        <span class="drawer-hint">點擊查看市場明細</span>
        <span class="chevron"><Icon name="default" size="sm" color="var(--iln-hint)" /></span>
      </div>
    </div>
  </ContentCard>
</template>

<script setup>
import { computed } from "vue";
import ContentCard from "@/components/common/ContentCard.vue";
import StatCard from "@/components/common/StatCard.vue";
import Icon from "@/components/common/Icon.vue";

const props = defineProps({
  regimeLevel: {
    type: Object,
    default: () => ({
      label: "正常",
      cardClass: "card-ok",
      textClass: "text-ok",
      subLabel: "常態運作",
    }),
  },
  vix: {
    type: [Number, String],
    default: "—",
  },
  vixOverrideActive: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["open-drawer"]);

const statusKey = computed(() => {
  const cls = props.regimeLevel?.cardClass || "card-ok";
  return cls.replace("card-", "");
});

function formatNumber(val) {
  if (val == null || val === "—") return "—";
  const n = Number(val);
  return isNaN(n) ? "—" : n.toFixed(1);
}
</script>

<style scoped>
.cockpit-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.cockpit-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cockpit-tag {
  font-size: var(--iln-font-xs);
  font-weight: 600;
  color: var(--iln-hint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cockpit-flash {
  font-size: var(--iln-font-sm);
}

.cockpit-title {
  font-size: var(--iln-font-md);
  font-weight: 700;
  line-height: 1.25;
}

.cockpit-sub {
  font-size: var(--iln-font-sm);
  color: var(--iln-hint);
  margin-top: 2px;
}

.cockpit-metric {
  text-align: right;
}

.cockpit-action {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: var(--iln-font-xs);
  font-weight: 600;
  color: var(--iln-brand);
}

.chevron {
  font-size: var(--iln-font-xs);
}

/* 保留互動效果（ContentCard 未提供） */
.content-card--clickable:active {
  transform: scale(0.985);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
</style>
