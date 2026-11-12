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
        <span class="drawer-icon">🛡️</span>
        <h3>資產風控與維持率明細</h3>
      </div>
    </template>

    <div class="drawer-body">
      <!-- 1. 當前維持率與安全緩衝 -->
      <div class="metric-row">
        <div class="row-left">
          <span class="row-label">質押整戶維持率</span>
          <span class="row-desc">追繳警戒門檻 {{ warningThreshold }}%</span>
        </div>
        <div class="row-right">
          <span class="row-val text-ok">{{ Math.round(Number(marginRatio) || 0) }}%</span>
          <span class="row-tag text-ok">耐跌空間 {{ dropBufferPercent }}%</span>
        </div>
      </div>

      <!-- 2. 總槓桿率 (Gross Leverage) -->
      <div class="metric-row">
        <div class="row-left">
          <span class="row-label">當前總槓桿倍率</span>
          <span class="row-desc">硬上限 {{ Number(hardCapLeverage || 3).toFixed(2) }}x</span>
        </div>
        <div class="row-right">
          <span class="row-val">{{ Number(grossLeverage || 1).toFixed(2) }}x</span>
          <span class="row-tag">常態上限 2.50x</span>
        </div>
      </div>

      <!-- 3. 風控原則提示卡 -->
      <div class="risk-info-card">
        <div class="info-title">💡 質押與槓桿風控原則</div>
        <ul class="info-list">
          <li><strong>P0 優先級防守</strong>：維持率低於 {{ warningThreshold }}% 即刻停止戰術加碼，啟動補保或減碼。</li>
          <li><strong>利息配對倉</strong>：00740B 債券部位作為利息現金流壓艙石，不因短期波動調倉。</li>
          <li><strong>單日撥款上限</strong>：單日戰術借貸額度嚴格限制在 5% 內，防止過度追高。</li>
        </ul>
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
  marginRatio: {
    type: [Number, String],
    default: 0,
  },
  grossLeverage: {
    type: [Number, String],
    default: 1.0,
  },
  hardCapLeverage: {
    type: Number,
    default: 3.0,
  },
  warningThreshold: {
    type: Number,
    default: 160,
  },
  dropBufferPercent: {
    type: Number,
    default: 0,
  },
});

defineEmits(["update:visible"]);
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
  color: var(--tg-theme-hint-color, #64748b);
}

.text-ok {
  color: var(--iln-ok-text);
}

.risk-info-card {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(37, 99, 235, 0.05);
  border: 1px dashed rgba(37, 99, 235, 0.2);
}

.info-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--iln-brand);
  margin-bottom: 6px;
}

.info-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--tg-theme-text-color, #334155);
}
</style>
