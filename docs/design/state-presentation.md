---
type: explanation
status: current
last_updated: 2026-11-14
tags:
  - auto-generated
wiki_links: []
---

# 四態呈現規格 (State Presentation)

> 階段五 CARD-5.0 產出。規範 `loading / empty / error / ready` 四態的跨頁呈現標準。

## 1. 設計原則

- 每頁的「一眼可見」與「需要時可見」要分明；主行動（primary action）不超過 2 個。
- 四態跨頁一致，同一概念使用相同令牌、相同措辭。
- 不新增裸 hex/rgba；一律使用 `--iln-*` 設計令牌。
- 360px 為設計基準；新增元素先過 360px 驗證。

## 2. 四態定義

| 狀態      | 觸發條件               | 呈現內容                    | 主要命令按鈕            |
| --------- | ---------------------- | --------------------------- | ----------------------- |
| `loading` | 資料擷取中             | LoadingSkeleton（佈位骨架） | 無                      |
| `empty`   | 資料擷取成功但陣列為空 | EmptyState + 動作按鈕       | 1 個（重新整理 / 新增） |
| `error`   | 擷取失敗               | ErrorAlert + 動作按鈕       | 1 個（重試）            |
| `ready`   | 資料正常顯示           | 實際內容區塊                | ≤ 2 個                  |

## 3. 共用組件複用規則

| 狀態      | 複用組件              | 路徑                                    | 備註                       |
| --------- | --------------------- | --------------------------------------- | -------------------------- |
| `loading` | `LoadingSkeleton.vue` | `components/common/LoadingSkeleton.vue` | 佈位骨架，不顯示內容       |
| `empty`   | `EmptyState.vue`      | `components/common/EmptyState.vue`      | 空圖 + 標題 + 動作按鈕     |
| `error`   | `ErrorAlert.vue`      | `components/common/ErrorAlert.vue`      | 錯誤圖示 + 訊息 + 重試按鈕 |
| `ready`   | 各頁內容組件          | 各 view 自行實作                        | 正常資料顯示               |

**StateBlock.vue 未建立**：三個現有組件已分別覆蓋 loading / empty / error，建立新的 StateBlock 會造成重複。狀態邏輯由 `usePageState.js` 統一管理，視覺層複用現有組件。

## 4. `usePageState.js` 狀態機

```js
const { state, data, error, run } = usePageState();
```

- `state`：`'loading' \| 'empty' \| 'error' \| 'ready'`（computed，優先順序 loading > error > empty > ready）
- `run(fetcher)`：自動管理狀態轉換，fetcher 成功→`ready`，失敗→`error`，空陣列→`empty`

### 狀態優先順序

```
loading > error > empty > ready
```

若同時滿足多個條件（如 error 與 empty），取最高優先級的狀態呈現。

## 5. 視覺令牌

| 狀態      | 文字色                | 邊框色 | 背景色 | 圖示      |
| --------- | --------------------- | ------ | ------ | --------- |
| `loading` | `--iln-text-muted`    | —      | —      | `spinner` |
| `empty`   | `--iln-text-muted`    | —      | —      | `inbox`   |
| `error`   | `--iln-status-danger` | —      | —      | `alert`   |
| `ready`   | 正常內容              | —      | —      | 無        |

## 6. 跨頁驗收清單

- [ ] 每頁載入 / 空 / 錯誤 / 正常 四態皆有明確呈現
- [ ] 四態採用同一組共用組件（LoadingSkeleton / EmptyState / ErrorAlert）
- [ ] 主行動按鈕不超過 2 個
- [ ] 無裸 hex/rgba，全部使用 `--iln-*` 令牌
- [ ] 360px 寬下四態不溢出、不換行
- [ ] `usePageState.js` 測試覆蓋 loading→ready、error、empty、reset、優先順序
