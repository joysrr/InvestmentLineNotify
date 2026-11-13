<template>
  <el-drawer
    :model-value="visible"
    direction="btt"
    size="75%"
    :append-to-body="true"
    :show-close="true"
    custom-class="mobile-bottom-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="drawer-header-title">
        <span class="drawer-icon"><Icon name="neutral" size="sm" color="var(--iln-hint)" /></span>
        <h3>市場總經環境明細</h3>
      </div>
    </template>

    <div class="drawer-body">
      <!-- 1. VIX 波動率 -->
      <ContentCard variant="flat" padding="sm" radius="md">
        <div class="row-left">
          <span class="row-label">美股 VIX 恐慌指數</span>
          <span class="row-desc">警戒線 20 / 危機線 35</span>
        </div>
        <div class="row-right">
          <span class="row-val">{{ formatNumber(vix) }}</span>
        </div>
      </ContentCard>

      <!-- 2. PB PR 分位數 -->
      <ContentCard variant="flat" padding="sm" radius="md">
        <div class="row-left">
          <span class="row-label">台股大盤 PB 歷史分位 (PR)</span>
          <span class="row-desc">近 10 年本淨比位階</span>
        </div>
        <div class="row-right">
          <span class="row-val">{{ pbPrValue }}%</span>
          <span class="row-tag" :class="pbPrLevel?.textClass">{{ pbPrLevel?.label || "合理" }}</span>
        </div>
      </ContentCard>

      <!-- 3. 國發會景氣燈號 -->
      <ContentCard variant="flat" padding="sm" radius="md">
        <div class="row-left">
          <span class="row-label">景氣對策信號</span>
          <span class="row-desc">國發會總體景氣狀態</span>
        </div>
        <div class="row-right">
          <span class="row-val"><Icon :name="lightEmoji" size="sm" /></span>
          <span class="row-tag">{{ lightText }}</span>
        </div>
      </ContentCard>

      <!-- 4. 散戶融資增減比率 -->
      <ContentCard variant="flat" padding="sm" radius="md">
        <div class="row-left">
          <span class="row-label">全市場融資 5 日增減</span>
          <span class="row-desc">散戶槓桿熱度與浮額監控</span>
        </div>
        <div class="row-right">
          <span class="row-val" :class="marginOverheated ? 'text-danger' : ''">
            {{ formatMarginChange(marginChange5d) }}
          </span>
          <span class="row-tag" :class="marginOverheated ? 'text-danger' : 'text-ok'">
            {{ marginOverheated ? "散戶過熱阻尼" : "未過熱" }}
          </span>
        </div>
      </ContentCard>

      <!-- 底部連結 (Phase 3) -->
      <router-link
        to="/radar"
        class="drawer-footer-link"
        @click="$emit('update:visible', false)"
      >
        <Icon name="neutral" size="sm" color="var(--iln-hint)" /> 查看完整市場雷達 →
      </router-link>
    </div>
  </el-drawer>
</template>

<script setup>
import Icon from "@/components/common/Icon.vue";

defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  vix: {
    type: [Number, String],
    default: "—",
  },
  pbPrValue: {
    type: [Number, String],
    default: "—",
  },
  pbPrLevel: {
    type: Object,
    default: () => ({ label: "合理", textClass: "" }),
  },
  lightEmoji: {
    type: String,
    default: "ok",
  },
  lightText: {
    type: String,
    default: "綠燈",
  },
  marginChange5d: {
    type: Number,
    default: 0,
  },
  marginOverheated: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["update:visible"]);

function formatNumber(val) {
  if (val == null || val === "—") return "—";
  const n = Number(val);
  return isNaN(n) ? "—" : n.toFixed(1);
}

function formatMarginChange(val) {
  if (val == null) return "0.0%";
  const n = Number(val);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}
</script>

<style scoped>
.drawer-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-header-title h3 {
  margin: 0;
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
}

.drawer-icon {
  font-size: 18px;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.row-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-label {
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-text);
}

.row-desc {
  font-size: var(--iln-font-xs);
  color: var(--iln-hint);
}

.row-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.row-val {
  font-size: var(--iln-font-base);
  font-weight: 700;
  color: var(--iln-text);
}

.row-tag {
  font-size: var(--iln-font-xs);
  font-weight: 600;
}

.text-ok {
  color: var(--iln-ok-text);
}

.text-warn {
  color: var(--iln-warn-text);
}

.text-danger {
  color: var(--iln-danger-text);
}

/* ── Footer Link (Phase 3) ── */
.drawer-footer-link {
  display: block;
  text-align: center;
  padding: 14px;
  margin-top: 4px;
  font-size: var(--iln-font-sm);
  font-weight: 600;
  color: var(--iln-brand);
  text-decoration: none;
  border-radius: var(--iln-radius-md);
  border: 1px solid var(--iln-border-subtle);
  background: var(--iln-surface);
  transition: background 0.15s ease;
}
.drawer-footer-link:active {
  background: var(--iln-brand-hover-bg);
}
</style>
