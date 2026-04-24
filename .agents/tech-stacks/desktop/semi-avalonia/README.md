# Tech Stack: Semi.Avalonia（Avalonia UI 主題庫）

> 資料夾模式 tech-stack（骨架）；LLM 規範的**唯一權威**為本 README.md。
> `upstream/` 下為 vendor 原文（待 User 提供後補），**不作為** LLM 規則來源。
>
> 依賴：`avalonia-ui`（必先 installed）
> Vendor：[Semi.Avalonia by irihitech](https://github.com/irihitech/Semi.Avalonia)
> 由 PROPOSAL_20260423_017 Phase F.2 建立骨架；`installed: false` 預設。

---

## 一、什麼是 Semi.Avalonia？

Semi Design（字節跳動設計語言）於 Avalonia UI 的實作：提供主題（Light/Dark）+ 色盤 + 控制項樣式（Button / Input / Select 等）。
與 `avalonia-ui` stack 搭配；本 stack 只定義**主題套用與擴充規範**。

---

## 二、導入原則

1. **必先** installed `avalonia-ui`（本 stack `depends_on: [avalonia-ui]`）
2. NuGet 套件：`Semi.Avalonia`（版本需 User 確認；本文件撰寫時以 latest stable 為準）
3. 於 `App.axaml` 匯入 `SemiTheme`；**禁**同時匯入 `FluentTheme` / `SimpleTheme`（衝突）
4. 預設主題色由 `SemiTheme` 提供；專案自訂色盤應走 override `ResourceDictionary` 覆蓋而非改 SemiTheme

---

## 三、樣式擴充規範（Adapted Rules）

1. 全域樣式新增（按鈕 / 表單）放 `App.axaml`
2. 單頁特殊樣式放該 View 的 `<UserControl.Styles>`
3. 自訂控制項先檢查 `Semi.Avalonia.Controls` 是否已有等價項（例 `Toast` / `Notification`）；避免重造
4. 所有尺寸 / padding 使用 `DynamicResource` 綁定至 Semi.Avalonia 提供的 token（`SemiSpacingMedium` 等）

---

## 四、常用元件對應

> 骨架版本僅列原則；具體元件清單待 User 提供 vendor 文件後於 `adapted/components.md` 補齊。

| 類型 | Semi.Avalonia 元件 | 原生 Avalonia |
|------|-------------------|--------------|
| 按鈕 | `semi:Button` | `Button` |
| 輸入 | `semi:TextInput` | `TextBox` |
| 選單 | `semi:Select` | `ComboBox` |
| 彈窗 | `semi:Dialog` | `Window` (modal) |
| 通知 | `semi:Toast` | （無原生） |

---

## 五、§專案特化參照（F2）

| tech-stack 變數 | 參照 workspace 欄位 | 例 |
|-----------------|---------------------|-----|
| Semi 主題變體 | `TECH_STACK.semi_theme_variant` | `Light` / `Dark` / `Auto` |
| Semi 色盤覆寫檔 | `PATHS.semi_palette_override` | `src/Assets/semi-palette.axaml` |

**Fallback**：若未填，預設 `Auto`（跟隨系統主題）+ 無色盤覆寫（使用原廠色盤）。

---

## 六、Vendor 審核 trail

- **Source URL**：https://github.com/irihitech/Semi.Avalonia（見 SOURCE.md 取得 commit hash + 日期）
- **原文位置**：`upstream/`（檔案由 User 提供後補）
- **審核人**：待填（User 提供時簽名）
- **審核日期**：待填（對應 MANIFEST `vendor_last_vetted`）
- **可疑內容**：無（初版骨架）

---

## MACHINE_READABLE

```yaml
tech_stack_id: semi-avalonia
category: desktop
class: F2
mode: folder
depends_on: [avalonia-ui]
vendor_source: https://github.com/irihitech/Semi.Avalonia
vendor_vetted: false
theme_variants: [Light, Dark, Auto]
rules_hash: 20260424-phase-f2-skeleton
```

---

**維護紀錄**：
- 2026-04-24：PROPOSAL_20260423_017 Phase F.2 建立資料夾骨架；upstream/ 空（待 User 提供）
