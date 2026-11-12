---

type: reference
status: current
created: 2026-11-12
last_updated: 2026-11-12
tags:

· design-system
· design-principles
· tokens
· ui-ux
  wiki_links:
· [[Telegram Mini App]]
· [[Design Tokens]]
· [[Component Library]]

---

InvestmentLineNotify 設計原則（Design Principles）

1. 品牌性格

定位：Telegram 原生感 × 品牌藍 #2481cc

· 互動慣例：遵循 Telegram Mini App 平台慣例（底部滑出、返回鍵、觸覺回饋）
· 視覺個性：品牌藍作為唯一識別色，其他顏色皆為語意色（狀態、警示）
· 密度：中等密度，行動端優先，觸控目標 44px

設計三原則：

1. 一眼即懂：首屏回答「現在該做什麼」，不需要解釋
2. 狀態即顏色：顏色只用於語意（ok / warn / danger / info），不用於裝飾
3. 原生優先：能借用 Telegram 既有能力的地方不重造

---

2. Design Tokens

檔案位置：webapp/src/styles/tokens.css（新建，於 main.js import）

命名規則：一律 --iln- 前綴，避免與 Telegram --tg-theme-* 衝突。

2.1 顏色 Token

```css
:root {
  /* ── 品牌色（單一識別色）── */
  --iln-brand: #2481cc;
  --iln-brand-hover: #1c6699;
  --iln-brand-soft: rgba(36, 129, 204, 0.08);
  --iln-brand-strong: rgba(36, 129, 204, 0.15);

  /* ── 語意色（狀態用）── */
  --iln-ok: #10b981;
  --iln-warn: #f59e0b;
  --iln-danger: #ef4444;
  --iln-info: #3b82f6;
  --iln-neutral: #94a3b8;

  /* ── 語意背景（卡片底色）── */
  --iln-ok-bg: rgba(16, 185, 129, 0.1);
  --iln-warn-bg: rgba(245, 158, 11, 0.1);
  --iln-danger-bg: rgba(239, 68, 68, 0.1);
  --iln-info-bg: rgba(59, 130, 246, 0.1);

  /* ── 語意文字（深色模式安全）── */
  --iln-ok-text: #059669;
  --iln-warn-text: #b45309;
  --iln-danger-text: #dc2626;
  --iln-info-text: #1d4ed8;

  /* ── 語意邊框 ── */
  --iln-border-subtle: rgba(0, 0, 0, 0.06);
  --iln-border-default: rgba(0, 0, 0, 0.1);
  --iln-border-strong: rgba(0, 0, 0, 0.15);
}
```

深色模式覆寫（Telegram 深色主題時）：

```css
@media (prefers-color-scheme: dark) {
  :root {
    --iln-brand-soft: rgba(36, 129, 204, 0.15);
    --iln-brand-strong: rgba(36, 129, 204, 0.25);
    --iln-ok-bg: rgba(16, 185, 129, 0.15);
    --iln-warn-bg: rgba(245, 158, 11, 0.15);
    --iln-danger-bg: rgba(239, 68, 68, 0.15);
    --iln-info-bg: rgba(59, 130, 246, 0.15);
    --iln-ok-text: #34d399;
    --iln-warn-text: #fbbf24;
    --iln-danger-text: #f87171;
    --iln-info-text: #60a5fa;
    --iln-border-subtle: rgba(255, 255, 255, 0.08);
    --iln-border-default: rgba(255, 255, 255, 0.12);
    --iln-border-strong: rgba(255, 255, 255, 0.18);
  }
}
```

2.2 字型 Token

```css
:root {
  /* 7 級字型 scale（取代目前 15 種混用） */
  --iln-font-xs: 10px;    /* 極小標籤、caption */
  --iln-font-sm: 12px;    /* 次要文字、section-title */
  --iln-font-base: 14px;  /* 主要內文 */
  --iln-font-md: 16px;    /* 卡片標題 */
  --iln-font-lg: 20px;    /* 頁面副標、KPI */
  --iln-font-xl: 24px;    /* 頁面主標題 */
  --iln-font-2xl: 32px;   /* Hero 主數值 */

  /* 4 級字重 */
  --iln-weight-normal: 400;
  --iln-weight-medium: 500;
  --iln-weight-semibold: 600;
  --iln-weight-bold: 700;

  /* 行高 */
  --iln-leading-tight: 1.2;   /* 標題 */
  --iln-leading-normal: 1.5;  /* 內文 */
  --iln-leading-relaxed: 1.6; /* 長文 */

  /* 字族（Telegram 平台標準） */
  --iln-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
  --iln-font-mono: "SF Mono", Monaco, Consolas, monospace;
}
```

2.3 間距 Token（8pt grid，允許 4px 半格）

```css
:root {
  --iln-space-1: 4px;
  --iln-space-2: 8px;
  --iln-space-3: 12px;
  --iln-space-4: 16px;
  --iln-space-5: 20px;
  --iln-space-6: 24px;
  --iln-space-8: 32px;
  --iln-space-10: 40px;
  --iln-space-12: 48px;
}
```

規則：

· 元件內 padding：space-2 至 space-4
· 元件間 gap：space-2 或 space-3
· 區塊間 margin：space-4 或 space-6
· 頁面 padding：space-4

2.4 圓角 Token

```css
:root {
  --iln-radius-sm: 8px;     /* 按鈕、小標籤 */
  --iln-radius-md: 12px;    /* 卡片、輸入框 */
  --iln-radius-lg: 16px;    /* 大卡片、抽屜 */
  --iln-radius-xl: 24px;    /* Hero 卡片、Bottom Sheet */
  --iln-radius-full: 9999px;/* Pill、頭像 */
}
```

2.5 陰影 Token（3 級 elevation）

```css
:root {
  --iln-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.05);   /* 平面卡片 */
  --iln-shadow-2: 0 4px 12px rgba(0, 0, 0, 0.08);  /* 浮起卡片 */
  --iln-shadow-3: 0 8px 24px rgba(0, 0, 0, 0.12);  /* 抽屜、Modal */
}
```

規則：禁止使用彩色陰影（現有 HealthPanel 的彩色陰影一律改為 shadow-2）。

2.6 動效 Token

```css
:root {
  --iln-duration-fast: 150ms;
  --iln-duration-base: 200ms;
  --iln-duration-slow: 300ms;
  --iln-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --iln-ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
}
```

規則：所有 transition 時長從 fast 或 base 選一；禁止 0.6s 以上的過渡（除了 drawer）。

2.7 觸控目標

```css
:root {
  --iln-touch-min: 44px;   /* iOS HIG 最小觸控目標 */
  --iln-touch-comfort: 48px;
}
```

規則：所有可點擊元件（按鈕、tab、icon-button、list-item）的可點擊範圍至少 --iln-touch-min。

---

3. 組件規範

3.1 Tab

只有 2 種，其餘淘汰。

Primary Tab（頁面級切換）

用於「頁面內的不同大區塊」。取代現有 RadarSubtabs、StrategyStatusView segmented、ReportsView tabs。

視覺：灰底圓角條 + 白色 active 底 + 品牌藍 active 文字

範例：

```vue
<div class="iln-tabs-primary">
  <button class="iln-tab" :class="{ 'is-active': active === 'a' }">A</button>
  <button class="iln-tab" :class="{ 'is-active': active === 'b' }">B</button>
</div>
```

```css
.iln-tabs-primary {
  display: flex;
  background: var(--tg-theme-secondary-bg-color, rgba(0, 0, 0, 0.05));
  padding: var(--iln-space-1);
  border-radius: var(--iln-radius-md);
  gap: var(--iln-space-1);
}

.iln-tab {
  flex: 1;
  min-height: var(--iln-touch-min);
  padding: var(--iln-space-2) var(--iln-space-3);
  font-size: var(--iln-font-base);
  font-weight: var(--iln-weight-semibold);
  color: var(--tg-theme-hint-color, #777);
  background: transparent;
  border: none;
  border-radius: var(--iln-radius-sm);
  transition: all var(--iln-duration-fast) var(--iln-ease-standard);
}

.iln-tab.is-active {
  background: var(--tg-theme-bg-color, #fff);
  color: var(--iln-brand);
  box-shadow: var(--iln-shadow-1);
}
```

Secondary Tab（區塊內切換）

用於「列表或篩選」，取代現有 NewsView subtabs、StrategyConfigEditor tabs。

視覺：底線式

```css
.iln-tabs-secondary {
  display: flex;
  border-bottom: 1px solid var(--iln-border-subtle);
}

.iln-tabs-secondary .iln-tab {
  min-height: var(--iln-touch-min);
  padding: var(--iln-space-3) var(--iln-space-4);
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  color: var(--tg-theme-hint-color, #999);
  font-size: var(--iln-font-base);
  font-weight: var(--iln-weight-medium);
}

.iln-tabs-secondary .iln-tab.is-active {
  color: var(--iln-brand);
  border-bottom-color: var(--iln-brand);
  font-weight: var(--iln-weight-semibold);
}
```

3.2 Drawer / Bottom Sheet

統一使用 el-drawer（direction="btt"、size="75%"）。移除 SocialSentimentCard 的自訂 sheet。

深色模式安全：所有 drawer 的背景使用 var(--tg-theme-bg-color)。

3.3 Loading State

只有 1 套：Spinner + 骨架並存，依場景選一：

· 區塊級：Spinner + 提示文字（用 SkeletonLoader.vue 的 lines 模式）
· 列表級：Skeleton（用 SkeletonLoader.vue 的 list variant）
· 圖表級：Skeleton（用 SkeletonLoader.vue 的 chart variant）

淘汰：各 view 手寫的 sk-* class 保留為 fallback，但新程式碼一律用 SkeletonLoader.vue。

Spinner 統一規格：

```css
.iln-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--tg-theme-hint-color, #ddd);
  border-top-color: var(--iln-brand);
  border-radius: 50%;
  animation: iln-spin 0.8s linear infinite;
}

@keyframes iln-spin {
  to { transform: rotate(360deg); }
}
```

3.4 Error State

只有 2 套：

Inline Error（無 retry）

用於「區塊載入失敗但頁面可繼續使用」：

```vue
<p class="iln-error-inline">⚠️ {{ message }}</p>
```

```css
.iln-error-inline {
  padding: var(--iln-space-3) var(--iln-space-4);
  font-size: var(--iln-font-base);
  color: var(--iln-danger-text);
  background: var(--iln-danger-bg);
  border-radius: var(--iln-radius-md);
}
```

Block Error（有 retry）

用於「整頁或整區塊失敗」：

使用 ErrorAlert.vue：

```vue
<ErrorAlert
  :visible="!!error"
  :description="error"
  :show-retry="true"
  @retry="load"
/>
```

3.5 Empty State

只有 1 套：使用 EmptyState.vue（需擴充 emoji prop）。

```vue
<EmptyState
  emoji="📭"
  title="尚無資料"
  message="資料將於每日分析完成後更新"
/>
```

3.6 Button

三種尺寸，全部使用 Element Plus el-button 或原生 <button> 搭配 class：

· size="small"：高度 32px（僅限表格內操作）
· size="default"：高度 40px（一般按鈕）
· size="large"：高度 44px（主要操作，符合觸控標準）

主按鈕：

```css
.iln-btn-primary {
  min-height: var(--iln-touch-min);
  padding: var(--iln-space-2) var(--iln-space-4);
  background: var(--iln-brand);
  color: var(--tg-theme-button-text-color, #fff);
  border: none;
  border-radius: var(--iln-radius-sm);
  font-size: var(--iln-font-base);
  font-weight: var(--iln-weight-semibold);
  transition: opacity var(--iln-duration-fast) var(--iln-ease-standard);
}

.iln-btn-primary:active {
  opacity: 0.8;
}
```

3.7 Icon 系統（3C：混合）

用途 系統 範例
狀態指示（成功/失敗/警告） Emoji 🟢🔴🟡⚡⏸️
動作圖標（按鈕、導航） SVG FloatingPill 現有 SVG、el-icon
資料圖表（箭頭、趨勢） Emoji 📈📉➖

禁用：文字與 emoji 混用作 icon（如 "★ 收藏"）。一律用 [icon] 文字 或純文字。

3.8 Toast

全部使用 ElMessage（Element Plus 原生），不建立自訂 toast。

---

4. 深色模式規則

4.1 硬編碼禁用清單

以下寫法一律禁止：

```css
/* ❌ 禁止 */
background: #fef3c7;
background: #f5f5f5;
background: #ffffff;
color: #333;
color: #999;
```

以下寫法允許：

```css
/* ✅ 允許 */
background: var(--tg-theme-bg-color, #fff);
background: var(--tg-theme-secondary-bg-color, #f5f5f5);
color: var(--tg-theme-text-color, #222);
color: var(--tg-theme-hint-color, #999);
background: var(--iln-ok-bg);
color: var(--iln-ok-text);
```

Fallback 值必須存在（var(--xxx, fallback)），因為 Telegram Web 環境若 SDK 未就緒，變數可能未定義。

4.2 禁止彩色陰影

```css
/* ❌ 禁止 */
box-shadow: 0 12px 32px rgba(36, 129, 204, 0.25);

/* ✅ 允許 */
box-shadow: var(--iln-shadow-2);
```

---

5. 可及性（a11y）

5.1 對比度

· 主要文字：var(--tg-theme-text-color) on var(--tg-theme-bg-color)（由 Telegram 主題保證）
· 次要文字：var(--tg-theme-hint-color) 對比度約 2.85:1，僅用於 caption，不用於可點擊文字
· 按鈕文字：使用 var(--iln-ok-text) / var(--iln-warn-text) / var(--iln-danger-text)（這些是深一檔的語意色，可達 4.5:1 以上）

5.2 ARIA 標籤

所有 icon-only 按鈕必須有 aria-label：

```vue
<button aria-label="關閉" @click="close">✕</button>
```

Tab 必須有 role="tablist" + role="tab" + aria-selected：

```vue
<div role="tablist">
  <button role="tab" :aria-selected="active === 'a'">A</button>
</div>
```

5.3 焦點樣式

禁止 outline: none 而無替代。若移除，須補：

```css
.iln-focusable:focus-visible {
  outline: 2px solid var(--iln-brand);
  outline-offset: 2px;
}
```

---

6. Telegram 原生整合清單

在 useTelegram.js 需補的 7 個能力：

# 能力 API 觸發時機
1 Viewport 監聽 WebApp.onEvent('viewportChanged', cb) 鍵盤彈出、旋轉
2 Theme 監聽 WebApp.onEvent('themeChanged', cb) 主題切換
3 MainButton WebApp.MainButton 表單頁
4 BackButton 已有 —
5 Haptic WebApp.HapticFeedback.impactOccurred('light') 按鈕點擊
6 Header 色 WebApp.setHeaderColor() 啟動
7 關閉確認 WebApp.enableClosingConfirmation() 有未保存變更

---

7. 禁用清單（Anti-patterns）

# 禁用 原因
1 硬編碼顏色 #xxxxxx 深色模式失效
2 彩色陰影 視覺權重失衡
3 自訂 bottom sheet 動畫節奏不一致，用 el-drawer
4 手寫 sk-* skeleton 於新程式碼 用 SkeletonLoader.vue
5 手寫 .state-box error 於新程式碼 用 ErrorAlert.vue
6 手寫 inline empty 於新程式碼 用 EmptyState.vue
7 字型大小非 token 值 15 種 → 7 種
8 間距非 8pt grid 維持視覺節奏
9 padding: 6px 8px 這類無 grid 對齊寫法 同上
10 Icon 與文字混排如 "★ 收藏" 用 [icon] 文字 或純文字