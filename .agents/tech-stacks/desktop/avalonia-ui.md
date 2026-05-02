---
stack_name: avalonia-ui
file_type: tech_stack
category: desktop
class: F2
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
scope: framework
manifest_entry: avalonia-ui
depends_on: []
audience:
  - Frontend
  - Backend
referenced_by:
  - rules/frontend.md
---

# Tech Stack: Avalonia UI (跨平台 .NET Desktop)

> 純通用技術棧；專案特定的 XAML 命名空間前綴 / ViewModel 目錄 / 資源字典位置 → 參照 §專案特化參照 對應 workspace 欄位。
>
> **版本**：Avalonia 11.x LTS（需 User 確認專案實際版本）；本文件以 11.x API 為基準
> 本骨架由 PROPOSAL_20260423_017 Phase F.1 建立；預設 `installed: false`，Avalonia 專案透過 `tech-stack-manage install avalonia-ui` opt-in。

---

## 框架與版本 (Framework & Version)

1. **目標版本**：
   - **Avalonia 12.x**（2025-04 起；最低 .NET 8）→ 搭配 Semi.Avalonia 12.0.1 推薦
   - **Avalonia 11.x LTS**（較保守選擇；相容 .NET 6）
   - **不接受** < 11；0.10 已 deprecated
2. **.NET runtime**：
   - Avalonia 12.x → **必須** .NET 8+（12.0 起移除 netstandard2.0 / net4x 支援）
   - Avalonia 11.x → .NET 6 / 8
3. **跨平台目標**：Windows / macOS / Linux；若僅 Windows → 請改評估 WPF tech-stack（本 stack 不適用單平台 Windows 場景）
4. **版本由 workspace `TECH_STACK.avalonia_version` 欄位指定**；Fallback 為 12.0.1（最新穩定）

---

## XAML 與命名空間 (Namespaces)

1. **根命名空間**：`xmlns="https://github.com/avaloniaui"`（**非** WPF 的 `http://schemas.microsoft.com/...`）
2. **X 命名空間**：`xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"`（沿用 WPF）
3. **嚴禁** 混用 WPF 專屬命名空間（例 `System.Windows.Controls`）；Avalonia 控制項來自 `Avalonia.Controls`
4. **本地化資源命名空間**：`xmlns:local="using:<專案 namespace>"`（參照 §專案特化）

---

## 架構模式 (MVVM)

1. **強制 MVVM**：View (XAML) + ViewModel + Model 三層；View 背後 code-behind 僅做 `InitializeComponent()` + `DataContext` 注入
2. **ViewModel 基底**：使用 `ReactiveUI` (`ReactiveObject`) 或 `CommunityToolkit.Mvvm` (`ObservableObject`)；專案**擇一**，不可混用
3. **命令繫結**：View 按鈕 `Command` 繫結 ViewModel 的 `ICommand` / `ReactiveCommand`
4. **Two-way binding 預設**：對輸入控制項（`TextBox` / `ComboBox`）使用 `Mode=TwoWay`
5. **嚴禁** ViewModel 依賴 View 型別（不得 import `Avalonia.Controls.Window` 類）；需跨層通訊使用 DI / MessageBus

---

## 資源與樣式 (Resources & Styles)

1. **全域樣式**：放 `App.axaml` 的 `<Application.Styles>`；不在單一 View 定義橫跨多 View 的樣式
2. **資源字典**：`ResourceDictionary.MergedDictionaries` 拆分主題 / 色盤 / 尺寸；專案特定目錄參照 §專案特化
3. **主題切換**：走 `RequestedThemeVariant`（`Light` / `Dark` / `Default`）；**禁**手動切換 ResourceDictionary
4. **DPI 適配**：使用 `<Border Padding="{DynamicResource ControlPadding}"/>` 等 DynamicResource 而非硬編 `Padding="8"`

---

## 生命週期 (Lifecycle)

1. **入口**：`Program.cs` → `BuildAvaloniaApp().StartWithClassicDesktopLifetime(args)`
2. **IClassicDesktopStyleApplicationLifetime** 用於桌面；`ISingleViewApplicationLifetime` 用於 Mobile / Browser 目標
3. **關閉流程**：`MainWindow.Closing` 事件或 `IClassicDesktopStyleApplicationLifetime.ShutdownRequested` 處理保存 / 確認離開
4. **嚴禁** 使用 `Environment.Exit(0)`（繞過生命週期會導致資源未釋放）

---

## 非同步與執行緒 (Async & Threading)

1. **UI 執行緒存取**：使用 `Dispatcher.UIThread.InvokeAsync(() => ...)` 從 background thread 更新 UI；**禁**直接賦值
2. **async 命令**：`ReactiveCommand.CreateFromTask(async () => ...)` 或 `AsyncRelayCommand`
3. **禁 .Wait() / .Result**：會導致 UI 死鎖；一律 await
4. **長時間任務**：顯示 progress UI + 提供 cancel（`CancellationToken`）

---

## 相依注入 (DI)

1. 建議 `Microsoft.Extensions.DependencyInjection`；於 `App.Initialize` 建立 ServiceProvider
2. ViewModel 透過建構子注入 IService；**禁** Service Locator 模式（反模式）
3. Transient vs Singleton：UI ViewModel 多為 Transient；資料服務常為 Singleton

---

## 測試 (Testing)

1. **Unit**：ViewModel 測試以 xUnit + FluentAssertions；DI 注入 mock service
2. **UI smoke**：Avalonia 提供 `Avalonia.Headless` + `Avalonia.Headless.XUnit`；可自動化 View 初始化測試
3. **避免** 依賴真實窗口（`Window.Show()`）進行測試

---

## §專案特化參照（F2）

下列欄位指向當前 workspace，避免硬編：

| tech-stack 變數 | 參照 workspace 欄位              | 例                                      |
| --------------- | -------------------------------- | --------------------------------------- |
| 專案根命名空間  | `PROJECT_CONTEXT.root_namespace` | `MyApp.Desktop`                         |
| ViewModel 目錄  | `PATHS.viewmodels_root`          | `src/ViewModels/`                       |
| View 目錄       | `PATHS.views_root`               | `src/Views/`                            |
| 資源字典目錄    | `PATHS.resources_root`           | `src/Assets/`                           |
| MVVM 庫選擇     | `TECH_STACK.mvvm_framework`      | `CommunityToolkit.Mvvm` 或 `ReactiveUI` |
| 目標平台        | `TECH_STACK.platforms`           | `[windows, macos, linux]`               |

**Fallback**：若 workspace 未填，預設 `src/ViewModels/` / `src/Views/` / `src/Assets/` + `CommunityToolkit.Mvvm`。

---

## MACHINE_READABLE

```yaml
tech_stack_id: avalonia-ui
category: desktop
class: F2
language: csharp
framework: avalonia
framework_versions_supported: ["11.x", "12.x"]
framework_version_recommended: "12.0.1"
dotnet_min_version: "8.0" # Avalonia 12 強制；11.x 可降 6.0
platforms: [windows, macos, linux]
mvvm_libraries_allowed: [CommunityToolkit.Mvvm, ReactiveUI]
file_conventions:
  view: .axaml
  viewmodel: .cs
  code_behind: .axaml.cs
rules_hash: 20260424-phase-f3-v12-update
```

---

**維護紀錄**：

- 2026-04-24 Phase F.1：由 PROPOSAL_20260423_017 Phase F.1 建立（骨架）
- 2026-04-24 Phase F.3：User 確認版本為 12.0.1；§框架與版本補充 11.x vs 12.x 差異（.NET 8+ 強制要求）+ workspace 欄位 Fallback；MACHINE_READABLE 擴展為 versions_supported 陣列
