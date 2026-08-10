<template>
  <div class="signal-category-table">
    <div class="table-header">
      <h4>SignalCategory 詳細統計</h4>
    </div>
    
    <div class="table-wrapper">
      <table class="sc-table">
        <thead>
          <tr>
            <th>類別</th>
            <th>天數</th>
            <th>買入</th>
            <th>賣出</th>
            <th>持有</th>
            <th>勝率</th>
            <th>平均分數</th>
            <th>平均報酬</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in categoryOrder" :key="cat" v-if="stats?.categories[cat]?.count > 0">
            <td>
              <span class="badge" :class="categoryClass(cat)">{{ cat }}</span>
            </td>
            <td>{{ stats.categories[cat].count }}</td>
            <td>{{ stats.categories[cat].buyCount }}</td>
            <td>{{ stats.categories[cat].sellCount }}</td>
            <td>{{ stats.categories[cat].holdCount }}</td>
            <td>{{ stats.categories[cat].winRate?.toFixed(1) || 0 }}%</td>
            <td>{{ stats.categories[cat].avgScore?.toFixed(1) || 0 }}</td>
            <td>{{ formatPct(stats.categories[cat].avgReturn) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Monthly Breakdown -->
    <div v-if="stats?.categories" class="monthly-breakdown">
      <h5>月度明細</h5>
      <div class="monthly-grid">
        <div v-for="month in sortedMonths" :key="month" class="month-card">
          <div class="month-title">{{ formatMonthLabel(month) }}</div>
          <table class="mini-table">
            <thead>
              <tr>
                <th>類別</th>
                <th>天數</th>
                <th>佔比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cat in categoryOrder" :key="cat" v-if="stats.categories[cat]?.monthlyBreakdown?.[month]">
                <td><span class="badge" :class="categoryClass(cat)">{{ cat }}</span></td>
                <td>{{ stats.categories[cat].monthlyBreakdown[month].count }}</td>
                <td>{{ ((stats.categories[cat].monthlyBreakdown[month].count / monthlyTotals[month]) * 100).toFixed(1) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps } from "vue";

const props = defineProps({
  stats: {
    type: Object,
    default: null,
  },
});

const categoryOrder = ["baseline", "deep_drop", "panic", "take_profit", "rebalance"];

const monthlyTotals = computed(() => {
  const totals = {};
  if (!props.stats?.monthlyData) return totals;
  
  Object.entries(props.stats.monthlyData).forEach(([month, data]) => {
    totals[month] = data.totalDays;
  });
  return totals;
});

const sortedMonths = computed(() => {
  return Object.keys(props.stats?.monthlyData || {}).sort().reverse();
});

const categoryClass = (cat) => {
  const map = {
    baseline: "badge-baseline",
    deep_drop: "badge-deep-drop",
    panic: "badge-panic",
    take_profit: "badge-take-profit",
    rebalance: "badge-rebalance",
  };
  return map[cat] || "";
};

function formatMonthLabel(month) {
  const [year, m] = month.split("-");
  return `${year}年${m}月`;
}
</script>

<style scoped>
.signal-category-table {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.table-header h4 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 700;
  color: #333;
}

.sc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 24px;
}

.sc-table th,
.sc-table td {
  padding: 10px 12px;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.sc-table th {
  background: #fafafa;
  font-weight: 600;
  color: #666;
  font-size: 11px;
  text-transform: uppercase;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.badge-baseline { background: #e3f2fd; color: #1976d2; }
.badge-deep-drop { background: #fff3e0; color: #e65100; }
.badge-panic { background: #fce4ec; color: #c62828; }
.badge-take-profit { background: #e8f5e9; color: #2e7d32; }
.badge-rebalance { background: #f3e5f5; color: #7b1fa2; }

.monthly-breakdown h5 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
}

.monthly-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.month-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
}

.month-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 12px;
  color: #333;
}

.mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.mini-table th,
.mini-table td {
  padding: 6px 8px;
  text-align: center;
  border-bottom: 1px solid #eee;
}

.mini-table th {
  background: #f0f0f0;
  font-size: 10px;
  text-transform: uppercase;
}
</style>