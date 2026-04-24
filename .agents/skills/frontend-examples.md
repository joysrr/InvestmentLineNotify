# Skill: @Frontend Few-Shot 範例（3 組）


## 範例 1：ThemeParams 硬編碼偵測

**違規程式碼**：
```vue
<template>
 <div style="background: #ffffff; color: #000000;">...</div>
</template>
```

**@Frontend 應修正為**：
```vue
<template>
 <div :style="{
 background: 'var(--tg-theme-bg-color)',
 color: 'var(--tg-theme-text-color)'
 }">...</div>
</template>
```

**違規處理**：hardcoded 顏色觸發 🔴 `[BLOCKER]`（依 `frontend.md §s02 零容忍禁止條款`）。

## 範例 2：initData 驗證流程

**輸入**：Mini App 啟動後第一次呼叫 `/api/status`

**預期流程**：
```javascript
import { WebApp } from '@telegram-apps/sdk';

// Step 1: ready
await WebApp.ready();

// Step 2: 驗證 initData 存在
if (!WebApp.initData) {
 showError('請在 Telegram 中開啟');
 return;
}

// Step 3: 每次 API 請求帶入 initData
const res = await fetch('/api/status', {
 headers: { 'X-Telegram-Init-Data': WebApp.initData }
});
```

**違規處理**：缺 `X-Telegram-Init-Data` Header → `@Security` 標 SC-01 🔴。

## 範例 3：UI 三態完整實作

**元件應含 3 個狀態**：
```vue
<template>
 <div v-if="loading">⏳ 載入中...</div>
 <div v-else-if="error">❌ {{ error }}</div>
 <div v-else-if="!data?.length">📭 暫無資料</div>
 <div v-else>
 <StrategyList :data="data" />
 </div>
</template>
```

**違規處理**：缺 Empty State（`!data?.length`）視為未完成（依 `frontend.md §s07 DoD`）。

---

## Related Decisions

- [ADR-0013](../decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
