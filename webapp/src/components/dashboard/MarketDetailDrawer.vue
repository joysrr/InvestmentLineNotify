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
        <span class="drawer-icon">🌐</span>
        <h3>市場總經環境明細</h3>
      </div>
    </template>

    <div class="drawer-body">
      <!-- 1. VIX 波動率 -->
      <div class="metric-row">
        <div class="row-left">
          <span class="row-label">美股 VIX 恐慌指數</span>
          <span class="row-desc">警戒線 20 / 危機線 35</span>
        </div>
        <div class="row-right">
          <span class="row-val">{{ formatNumber(vix) }}</span>
        </div>
      </div>

      <!-- 2. PB PR 分位數 -->
      <div class="metric-row">
        <div class="row-left">
          <span class="row-label">台股大盤 PB 歷史分位 (PR)</span>
          <span class="row-desc">近 10 年本淨比位階</span>
        </div>
        <div class="row-right">
          <span class="row-val">{{ pbPrValue }}%</span>
          <span class="row-tag" :class="pbPrLevel?.textClass">{{ pbPrLevel?.label || "合理" }}</span>
        </div>
      </div>

      <!-- 3. 國發會景氣燈號 -->
      <div class="metric-row">
        <div class="row-left">
          <span class="row-label">景氣對策信號</span>
          <span class="row-desc">國發會總體景氣狀態</span>
        </div>
        <div class="row-right">
          <span class="row-val">{{ lightEmoji }}</span>
          <span class="row-tag">{{ lightText }}</span>
        </div>
      </div>

      <!-- 4. 散戶融資增減比率 -->
      <div class="metric-row">
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
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
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
    default: "🟢",
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
  font-size: 16px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #1e293b);
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

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--tg-theme-secondary-bg-color, #f8fafc);
}

.row-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tg-theme-text-color, #1e293b);
}

.row-desc {
  font-size: 11px;
  color: var(--tg-theme-hint-color, #94a3b8);
}

.row-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.row-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--tg-theme-text-color, #1e293b);
}

.row-tag {
  font-size: 11px;
  font-weight: 600;
}

.text-ok {
  color: #10b981;
}

.text-warn {
  color: #f59e0b;
}

.text-danger {
  color: #ef4444;
}
</style>
