# Tech Stack: Semi.Avalonia（Avalonia UI 主題庫）

> 資料夾模式 tech-stack；**本 README.md 為 LLM 規範唯一權威**。
> `upstream/` 為 vendor 原文 audit snapshot，**不作為** LLM 規則來源（§八 安全準則）。
>
> 依賴：`avalonia-ui`（必先 installed）
> Vendor：[Semi.Avalonia by irihitech](https://github.com/irihitech/Semi.Avalonia)（MIT License）
> 鎖定版本：**Semi.Avalonia 12.0.1**（Avalonia >= 12.0.1 + .NET 8+）
> 由 PROPOSAL_20260423_017 Phase F.3 補實際規範；`installed: false` 預設，新 Avalonia 專案 opt-in。

---

## 一、什麼是 Semi.Avalonia？

Semi Design（字節跳動設計語言）於 Avalonia UI 的**主題移植**，由 irihitech 維護。

**定位**：**主題庫**，**不是元件庫**

- 為 Avalonia 內建控制項（`Button` / `TextBox` / `DataGrid` 等）提供 Semi Design 風格樣式
- 不新增自訂控制項（仍使用 `Button` 而非 `semi:Button`）
- 若需要「Semi 風格的額外控制項」（如 Toast / Notification 等 Semi React 才有的元件）→ 改用 **[Ursa](https://github.com/irihitech/Ursa.Avalonia)**（同團隊的控制項庫）

---

## 二、套件安裝

### 2.1 主套件（必裝）

```bash
dotnet add package Semi.Avalonia --version 12.0.1
```

### 2.2 子套件（按需；NuGet 與 Styles 需搭配）

| 子套件                       | 用途                    | 授權                | XAML Style 名稱                  |
| ---------------------------- | ----------------------- | ------------------- | -------------------------------- |
| `Semi.Avalonia.ColorPicker`  | ColorPicker 主題        | MIT                 | `<semi:ColorPickerSemiTheme />`  |
| `Semi.Avalonia.DataGrid`     | DataGrid 主題           | MIT                 | `<semi:DataGridSemiTheme />`     |
| `Semi.Avalonia.TreeDataGrid` | TreeDataGrid 主題       | MIT                 | `<semi:TreeDataGridSemiTheme />` |
| `Semi.Avalonia.Dock`         | Dock 布局主題           | ⚠️ **閉源（免費）** | `<semi:DockSemiTheme />`         |
| `Semi.Avalonia.Tabalonia`    | Tabalonia 頁籤主題      | ⚠️ **閉源（免費）** | `<semi:TabaloniaSemiTheme />`    |
| `Semi.Avalonia.AvaloniaEdit` | AvaloniaEdit 編輯器主題 | ⚠️ **閉源（免費）** | `<semi:AvaloniaEditSemiTheme />` |

**重要**：`Dock` / `Tabalonia` / `AvaloniaEdit` 三個子套件雖 NuGet 免費，但**不開源**（原始碼需聯繫 `contact@irihi.tech`）。商業專案如需稽核源碼請評估可接受性。

---

## 三、App.axaml 必要設定（鐵律）

### 3.1 命名空間

```xml
<Application
    xmlns="https://github.com/avaloniaui"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:semi="https://irihi.tech/semi"
    ...>
```

**鐵律**：

- `xmlns:semi="https://irihi.tech/semi"` **必填**（不含此命名空間則樣式標籤無法解析）
- **禁止** 同時匯入 `FluentTheme` / `SimpleTheme`（主題衝突；Semi 已覆蓋控制項預設樣式）

### 3.2 Styles 匯入順序（鐵律）

```xml
<Application.Styles>
    <semi:SemiTheme Locale="zh-CN" />         <!-- 必須在最前 -->
    <semi:SemiPopupAnimations />              <!-- 推薦；彈窗動畫 -->
    <semi:ColorPickerSemiTheme />             <!-- 按需 -->
    <semi:DataGridSemiTheme />                <!-- 按需 -->
    <!-- 其他子套件... -->
</Application.Styles>
```

**Locale 選項**（17 種；官方 `src/Semi.Avalonia/Locale/` 目錄下 `<code>.axaml` 檔名即為支援碼）：

| 區分 | 支援 Locale                                                                              |
| ---- | ---------------------------------------------------------------------------------------- |
| 英文 | `en-US`, `en-GB`                                                                         |
| 中文 | `zh-CN`（簡體）, **`zh-TW`（繁體）**                                                     |
| 日韓 | `ja-JP`, `ko-KR`                                                                         |
| 歐洲 | `de-DE`, `es-ES`, `fr-FR`, `it-IT`, `it-CH`, `nl-NL`, `nl-BE`, `pl-PL`, `ru-RU`, `uk-UA` |

**鐵律**：

- API 大小寫為 **`region uppercase`**（例 `zh-TW` 而非 `zh-tw`；與檔名小寫 `zh-tw.axaml` 不同）
- 本專案預設 Locale = **`zh-TW`**（繁體中文；見 §七 Fallback）
- 未支援的 locale 會回退英文（en-US）；要新增需 fork repo 自行提 PR

**鐵律**：子套件的 Style 匯入**必須** App.axaml，不可在單一 View；否則主題不一致。

### 3.3 主題模式與切換

Semi.Avalonia 支援 Light / Dark 雙主題；切換透過 Avalonia 內建 `RequestedThemeVariant`：

**靜態設定（App.axaml 預設主題）**：

```xml
<Application
    RequestedThemeVariant="Default">  <!-- Default / Light / Dark -->
```

**執行時動態切換（ViewModel / Code-behind）**：

```csharp
Application.Current!.RequestedThemeVariant = isDark
    ? ThemeVariant.Dark
    : ThemeVariant.Light;
```

**鐵律**：

- 使用 `RequestedThemeVariant` 切換；**禁**手動替換整個 `Application.Styles`（會破壞子套件樣式註冊順序）
- 樣式內取色請用 `{DynamicResource <TokenName>}`，例：`Background="{DynamicResource SemiColorBg0}"`；**禁**硬編色碼（主題切換時不會重繪）

### 3.4 Icon 使用

Semi.Avalonia 不內建 icon pack。**本專案採用 FontAwesome**（透過 `Projektanker.Icons.Avalonia.FontAwesome` 社群套件）：

**安裝**：

```bash
dotnet add package Projektanker.Icons.Avalonia.FontAwesome
```

**App 初始化**（`Program.cs` 或 `App.axaml.cs`）：

```csharp
using Projektanker.Icons.Avalonia;
using Projektanker.Icons.Avalonia.FontAwesome;

public static AppBuilder BuildAvaloniaApp()
    => AppBuilder.Configure<App>()
        .UsePlatformDetect()
        .WithIcons(container => container
            .Register<FontAwesomeIconProvider>())
        .LogToTrace();
```

**XAML 使用**：

```xml
<Icon Value="fa-solid fa-house" />
<Button>
    <StackPanel Orientation="Horizontal" Spacing="4">
        <Icon Value="fa-solid fa-save" />
        <TextBlock Text="儲存" />
    </StackPanel>
</Button>
```

**鐵律**：

- Icon 值格式為 `"fa-<style> fa-<name>"`（style = solid / regular / brands；name 見 fontawesome.com/icons）
- **授權**：FontAwesome Free 為 CC BY 4.0；Pro 需付費（本專案用 Free 即可）
- 若未來擴增需求（Material / 動畫 icon）→ 評估改用 `Material.Icons.Avalonia` 或追加 provider

---

## 四、MVVM 整合

本 stack 對 MVVM 不強制特定框架；但 `avalonia-ui` 父 stack 規定「ReactiveUI 或 CommunityToolkit.Mvvm 擇一不混用」。以下提供兩種整合範例。

### 4.1 CommunityToolkit.Mvvm 模式（推薦入門專案）

**ViewModel**（`ObservableObject` + `[ObservableProperty]` source generator）：

```csharp
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Avalonia;
using Avalonia.Styling;

public partial class ThemeViewModel : ObservableObject
{
    [ObservableProperty]
    private bool _isDarkMode;

    partial void OnIsDarkModeChanged(bool value)
    {
        Application.Current!.RequestedThemeVariant = value
            ? ThemeVariant.Dark
            : ThemeVariant.Light;
    }

    [RelayCommand]
    private void ToggleTheme() => IsDarkMode = !IsDarkMode;
}
```

**View 綁定**：

```xml
<ToggleSwitch
    IsChecked="{Binding IsDarkMode}"
    Content="Dark Mode" />
<Button Command="{Binding ToggleThemeCommand}" Content="Toggle" />
```

### 4.2 ReactiveUI 模式（推薦需要 Observable 組合的專案）

**ViewModel**：

```csharp
using ReactiveUI;
using System.Reactive;
using Avalonia;
using Avalonia.Styling;

public class ThemeViewModel : ReactiveObject
{
    private bool _isDarkMode;
    public bool IsDarkMode
    {
        get => _isDarkMode;
        set => this.RaiseAndSetIfChanged(ref _isDarkMode, value);
    }

    public ReactiveCommand<Unit, Unit> ToggleThemeCommand { get; }

    public ThemeViewModel()
    {
        ToggleThemeCommand = ReactiveCommand.Create(() =>
        {
            IsDarkMode = !IsDarkMode;
            Application.Current!.RequestedThemeVariant = IsDarkMode
                ? ThemeVariant.Dark
                : ThemeVariant.Light;
        });
    }
}
```

**View 綁定** 同 4.1。

### 4.3 共通鐵律

- **禁** ViewModel 直接 import `Avalonia.Controls.Window`（違反 MVVM；跨層通訊用 DI / `IMessenger`）
- 主題切換邏輯封裝為 `IThemeService`（DI 註冊）更佳；避免每個 ViewModel 都碰 `Application.Current`
- 使用者偏好主題應存檔（Avalonia 的 `ThemeVariant` 不會自動持久化）

---

## 五、常用控制項 + Semi Token 對應（10 項）

> Semi.Avalonia 元件 = Avalonia 原生控制項；樣式變化透過 class / token。

| 需求     | Avalonia 控制項                        | Semi Token 參考      | 備註                                       |
| -------- | -------------------------------------- | -------------------- | ------------------------------------------ |
| 主要按鈕 | `<Button Classes="Primary">`           | `SemiColorPrimary`   | Classes 屬性切換樣式變體                   |
| 次要按鈕 | `<Button Classes="Secondary">`         | `SemiColorSecondary` | 同上                                       |
| 文字輸入 | `<TextBox Watermark="提示">`           | `SemiColorBorder`    |                                            |
| 密碼輸入 | `<TextBox PasswordChar="•">`           | —                    |                                            |
| 下拉選單 | `<ComboBox>`                           | —                    | 原生控制項自動套 Semi 樣式                 |
| 資料表格 | `<DataGrid>`（需 `DataGridSemiTheme`） | —                    | 必裝 `Semi.Avalonia.DataGrid`              |
| 彈窗     | `<Window>` + `ShowDialog(parent)`      | `SemiColorBg0`       | 必含 `<semi:SemiPopupAnimations />` 有動畫 |
| 通知     | 無內建；用 `ToastManager` 社群方案     | —                    | Semi 未移植 React 的 Toast                 |
| 載入指示 | `<ProgressBar>`                        | —                    | 原生                                       |
| 分頁控制 | `<TabControl>`                         | —                    | 原生                                       |

**鐵律**：

- 不要找 `<semi:Button>` — **不存在**；繼續用 `<Button>`
- `Classes="Primary/Secondary/Warning/Danger"` 是 Semi 約定的按鈕變體
- 所有顏色用 DynamicResource；token 名稱可於 `upstream/repo-metadata.md` 找到或從 NuGet 套件 resources 查詢

---

## 六、專案結構建議

對齊 Avalonia MVVM 慣例：

```
MyApp/
├── App.axaml                      ← 全域主題匯入（§三）
├── App.axaml.cs                   ← ServiceProvider 初始化
├── Program.cs                     ← Avalonia entry
├── Views/                         ← .axaml + .axaml.cs
├── ViewModels/                    ← *ViewModel.cs（ObservableObject / ReactiveObject）
├── Services/                      ← IThemeService 等 DI service
├── Assets/
│   ├── _index.axaml               ← App 色盤 / spacing 覆寫（選用）
│   └── Icons/                     ← PathGeometry 資源
└── MyApp.csproj                   ← TargetFramework=net8.0；Avalonia 12.0.1
```

---

## 七、§專案特化參照（F2）

| tech-stack 變數    | 參照 workspace 欄位                | 本專案預設（Fallback）                                                                   | 其他可選值            |
| ------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------- | --------------------- |
| Semi.Avalonia 版本 | `TECH_STACK.semi_avalonia_version` | `12.0.1`                                                                                 | 見 §二.1              |
| Semi Locale        | `TECH_STACK.semi_locale`           | **`zh-TW`**                                                                              | 17 種；見 §三.3       |
| 預設主題           | `TECH_STACK.theme_variant_default` | `Default`（跟隨系統）                                                                    | `Light` / `Dark`      |
| 子套件啟用清單     | `TECH_STACK.semi_subpackages`      | **全部 6 個**（ColorPicker / DataGrid / TreeDataGrid / Dock / Tabalonia / AvaloniaEdit） | 精簡子集              |
| Icon pack          | `TECH_STACK.icon_pack`             | **`FontAwesome`**（`Projektanker.Icons.Avalonia.FontAwesome`）                           | `Material` / `None`   |
| 色盤覆寫檔         | `PATHS.semi_palette_override`      | 無（使用原廠色盤）                                                                       | `Assets/_index.axaml` |

**Fallback 原則**：workspace 未填時一律採「本專案預設」欄的值。

**特別說明**：

- Locale 選 `zh-TW` 的理由：User 設計決策（2026-04-24 確認）；zh-TW 於 Semi.Avalonia 原生支援（`src/Semi.Avalonia/Locale/zh-tw.axaml`）
- 保留全部子套件的理由：User 決策 — 預先啟用避免將來單檔增補；閉源子套件（Dock / Tabalonia / AvaloniaEdit）的商業稽核風險由專案端評估
- FontAwesome 採用 Free 版（CC BY 4.0）；Pro 需付費另外評估

---

## 八、Vendor 內容安全準則（§5）

- `upstream/repo-metadata.md` / `upstream/demo-App.axaml` 為**原文 audit snapshot**，**不得**被 rules / skills 引用
- 所有 LLM 規則來源 = **本 README.md**（+ adapted/ 若有）
- 可疑內容審查結果：見 `SOURCE.md` §Suspicious Content Flags（目前狀態：低風險）
- 更新 vendor 文件時：
  1. 取新檔覆蓋 `upstream/`
  2. 更新 `SOURCE.md`（新 commit hash + 日期 + 審核人）
  3. 同步 MANIFEST `vendor_last_vetted`
  4. 若 vendor 有 breaking change → 修本 README.md + bump `CHANGELOG.md`

---

## 九、除錯常見問題（troubleshooting）

| 症狀                               | 可能原因                                                          | 解法                               |
| ---------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| 控制項樣式沒變（預設 Fluent 灰調） | App.axaml 未匯入 `<semi:SemiTheme />`                             | 檢查 Styles 匯入順序               |
| DataGrid 沒套 Semi 樣式            | 未裝 `Semi.Avalonia.DataGrid` 或未加 `<semi:DataGridSemiTheme />` | 兩者都需                           |
| 切主題後某些色塊沒跟著變           | 硬編碼色碼或用 StaticResource                                     | 改 DynamicResource + Semi token    |
| `xmlns:semi` 標籤紅字              | 專案未安裝 `Semi.Avalonia` NuGet                                  | `dotnet add package Semi.Avalonia` |
| 彈窗無淡入淡出動畫                 | 未加 `<semi:SemiPopupAnimations />`                               | App.axaml 補上                     |

---

## MACHINE_READABLE

```yaml
tech_stack_id: semi-avalonia
category: desktop
class: F2
mode: folder
depends_on: [avalonia-ui]
vendor_source: https://github.com/irihitech/Semi.Avalonia
vendor_version_locked: "12.0.1"
vendor_license: MIT # 部分子套件閉源免費
avalonia_version_required: ">=12.0.1"
dotnet_version_required: ">=8.0"
vendor_vetted: true
vendor_last_vetted: 2026-04-24
namespace_uri: https://irihi.tech/semi
subpackages:
  open_source:
    [
      Semi.Avalonia,
      Semi.Avalonia.ColorPicker,
      Semi.Avalonia.DataGrid,
      Semi.Avalonia.TreeDataGrid,
    ]
  closed_source_free:
    [Semi.Avalonia.Dock, Semi.Avalonia.Tabalonia, Semi.Avalonia.AvaloniaEdit]
  default_enabled: all # User 決策：保留全部
theme_variants: [Default, Light, Dark]
locales_supported:
  [
    en-US,
    en-GB,
    zh-CN,
    zh-TW,
    ja-JP,
    ko-KR,
    de-DE,
    es-ES,
    fr-FR,
    it-IT,
    it-CH,
    nl-NL,
    nl-BE,
    pl-PL,
    ru-RU,
    uk-UA,
  ]
locale_default: "zh-TW" # User 決策
icon_pack_default: FontAwesome # User 決策；套件：Projektanker.Icons.Avalonia.FontAwesome
mvvm_compatible: [CommunityToolkit.Mvvm, ReactiveUI]
rules_hash: 20260424-phase-f3-user-defaults-applied
```

---

**維護紀錄**：

- 2026-04-24（v0.3.0）：User 設計決策寫入 — Locale 預設 `zh-TW`（經 WebFetch 確認 Semi.Avalonia `src/Locale/zh-tw.axaml` 存在）+ Icon pack 採 FontAwesome（§3.4 補安裝 / 初始化 / XAML 用法 + 授權說明）+ 保留全部 6 個子套件；§七 Fallback 表格重構為「本專案預設」欄位
- 2026-04-24（v0.2.0）：PROPOSAL_20260423_017 Phase F.3 完成；以 Semi.Avalonia 12.0.1 為鎖定版本填實規範（§二 套件清單 + §三 App.axaml 設定 + §四 MVVM 整合雙範例 + §五 元件對應 + §九 troubleshooting）
- 2026-04-24（v0.1.0）：Phase F.2 建立骨架（已取代）
