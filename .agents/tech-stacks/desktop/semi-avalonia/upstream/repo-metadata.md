# Semi.Avalonia Repository Metadata（verbatim snapshot）

> **來源**：https://github.com/irihitech/Semi.Avalonia
> **擷取日期**：2026-04-24（WebFetch）
> **授權**：MIT
> **本檔作 audit snapshot 用**；LLM 規範請讀 `../README.md`（非本檔）。

## NuGet 套件清單

主套件：

```
dotnet add package Semi.Avalonia
```

子套件（按需）：

```
dotnet add package Semi.Avalonia.ColorPicker
dotnet add package Semi.Avalonia.DataGrid
dotnet add package Semi.Avalonia.TreeDataGrid
dotnet add package Semi.Avalonia.Dock
dotnet add package Semi.Avalonia.Tabalonia
dotnet add package Semi.Avalonia.AvaloniaEdit
```

## 版本相容矩陣（verbatim）

| Semi.Avalonia | Avalonia 需求               |
| ------------- | --------------------------- |
| v11.2.1       | >= 11.2.1                   |
| v11.3.7       | >= 11.3.7                   |
| **v12.0.1**   | **>= 12.0.1（需 .NET 8+）** |

## XAML Namespace（verbatim）

```
xmlns:semi="https://irihi.tech/semi"
```

## 授權特別說明（verbatim 原文）

> "Dock, Tabalonia and AvaloniaEdit are delivered via nuget for free, but not open source."

即：`Semi.Avalonia.Dock` / `Semi.Avalonia.Tabalonia` / `Semi.Avalonia.AvaloniaEdit` 三個子套件 **NuGet 免費使用但閉源**；原始碼需聯繫 `contact@irihi.tech`。

其餘套件（`Semi.Avalonia` 主套件 + `ColorPicker` + `DataGrid` + `TreeDataGrid`）為 MIT 開源。

## 定位

Semi.Avalonia 為「**主題庫**」而非「**元件庫**」：

- 提供 Avalonia 內建控制項的 Semi Design 風格樣式
- 不包含額外自訂控制項
- 若需要「更多自訂控制項」，官方 README 建議使用 **[Ursa](https://github.com/irihitech/Ursa.Avalonia)**

## v12.0.1 發布摘要（verbatim changelog）

Release date: 2025-04-18

- Refactor ColorPicker components and improve UI consistency
- add icons to TabbedPage content and improve layout
- Update AutoCompleteBox bindings and clean up project files
- follow .editorconfig from Avalonia
- Bump Avalonia version to 12.0.1

## Locale 支援清單（verbatim 檔名清單）

來源：`src/Semi.Avalonia/Locale/` 目錄檔案列表（WebFetch 2026-04-24）

```
_index.cs
de-de.axaml
en-gb.axaml
en-us.axaml
es-es.axaml
fr-fr.axaml
it-ch.axaml
it-it.axaml
ja-jp.axaml
ko-kr.axaml
nl-be.axaml
nl-nl.axaml
pl-pl.axaml
ru-ru.axaml
uk-ua.axaml
zh-cn.axaml
zh-tw.axaml   ← 繁體中文原生支援（User 2026-04-24 採納為專案預設）
```

**重要**：API 使用時需轉大寫 region（例 `Locale="zh-TW"`），檔名為小寫慣例但 API 大小寫敏感。

## Demo 專案結構

```
demo/
├── Fonts/
├── Semi.Avalonia.Demo/               ← 核心共用 demo（ViewModel + XAML）
├── Semi.Avalonia.Demo.Desktop/       ← 桌面入口
├── Semi.Avalonia.Demo.Android/       ← Android
├── Semi.Avalonia.Demo.Web/           ← Web (Browser WASM)
├── Semi.Avalonia.Demo.Drm/           ← DRM variant
├── Directory.Packages.props          ← 中央套件版本管理
└── global.json                       ← SDK 版本鎖定
```
