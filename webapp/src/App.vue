<template>
  <div class="app-container">
    <main class="app-main">
      <router-view v-slot="{ Component }">
			  <keep-alive>
			    <component :is="Component" />
			  </keep-alive>
			</router-view>
    </main>

    <nav class="tab-bar">
      <router-link
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="tab-item"
        active-class="tab-item--active"
        :exact="tab.exact"
      >
        <span class="tab-indicator"></span>
        <span class="tab-icon" v-html="tab.icon"></span>
        <span class="tab-label">{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { onMounted, nextTick } from "vue";
import { useTelegram } from "./composables/useTelegram.js";

const { expand } = useTelegram();

onMounted(async () => {
  await nextTick();
  expand();
});

const tabs = [
  {
    to: "/dashboard",
    exact: true,
    label: "總覽",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>`,
  },
  {
    to: "/chart",
    exact: false,
    label: "圖表",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>`,
  },
  {
    to: "/reports",
    exact: false,
    label: "報告",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>`,
  },
  {
    to: "/news",
    exact: false,
    label: "新聞",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
      <path d="M18 14h-8"/>
      <path d="M15 18h-5"/>
      <path d="M10 6h8v4h-8V6z"/>
    </svg>`,
  },
  {
    to: "/account",
    exact: false,
    label: "設定",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>`,
  },
];
</script>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

/* ── Tab Bar ── */
.tab-bar {
  display: flex;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  background: var(--tg-theme-bg-color, rgba(255, 255, 255, 0.92));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.tab-item {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0 6px;
  text-decoration: none;
  color: var(--tg-theme-hint-color, #aaa);
  gap: 3px;
  transition: color 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.tab-item--active {
  color: var(--tg-theme-button-color, #2481cc);
}

/* Active indicator bar at top */
.tab-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 24px;
  height: 2.5px;
  border-radius: 0 0 3px 3px;
  background: var(--tg-theme-button-color, #2481cc);
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tab-item--active .tab-indicator {
  transform: translateX(-50%) scaleX(1);
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  transition: transform 0.18s ease;
}
.tab-item--active .tab-icon {
  transform: translateY(-1px);
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.2px;
}
</style>
