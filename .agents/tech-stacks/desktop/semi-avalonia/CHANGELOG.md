# CHANGELOG — Semi.Avalonia tech-stack

> 追蹤 upstream 更新與我方適配調整（skills/tech-stack-onboarding.md §四.1 要求）。

---

## 2026-04-24 — v0.3.0-user-defaults-applied（PROPOSAL_20260423_017 Phase F.3 收尾）

### Added

- WebFetch `src/Semi.Avalonia/Locale/` 目錄確認支援 17 個 locale（含 `zh-tw.axaml`）
- §三.4 Icon 使用：FontAwesome（`Projektanker.Icons.Avalonia.FontAwesome`）完整安裝 + 初始化 + XAML 範例 + 授權說明（CC BY 4.0 Free）
- §三.2 Locale 選項表（17 種；中文區分簡繁；API 大小寫鐵律）

### Changed

- **§七 Fallback 表格重構**：新增「本專案預設」欄；依 User 2026-04-24 決策填入：
  - Locale = `zh-TW`（原生支援）
  - Icon pack = `FontAwesome`
  - Subpackages = 全部 6 個啟用
  - Theme variant = `Default`（跟隨系統）
- MACHINE_READABLE block 補 `locales_supported` / `locale_default` / `icon_pack_default` / `subpackages.default_enabled` 欄位
- `upstream/repo-metadata.md` 追加 Locale 檔案清單 verbatim

### Notes

- User 設計決策：Locale 偏好邏輯 = 「有 zh-TW 就用 zh-TW，否則 en-US」→ 因 zh-TW 存在，直接採用
- 子套件保留全部：User 選擇「預先啟用避免將來逐一增補」；閉源三子套件（Dock / Tabalonia / AvaloniaEdit）的商業稽核風險由專案端另行評估
- FontAwesome 版本：Free（CC BY 4.0）；Pro 需商業授權但本專案無需

---

## 2026-04-24 — v0.2.0-vetted（PROPOSAL_20260423_017 Phase F.3）

### Added

- `upstream/repo-metadata.md`：verbatim snapshot 含 NuGet 套件清單 / 版本矩陣 / namespace / license 說明 / v12.0.1 changelog / demo 結構
- `upstream/demo-App.axaml`：官方 demo App.axaml 完整 verbatim snapshot（audit reference）
- SOURCE.md：完整 vetting record（取得日期 / URL / 版本 / 審核人 / 可疑 flag checklist = 全清）

### Changed

- README.md 從骨架（~100 行）擴充為實質規範（~230 行）：
  - §二 套件安裝：主套件 + 6 子套件完整表（含閉源警告）
  - §三 App.axaml 設定：命名空間 / Styles 順序 / Locale / 主題切換鐵律
  - §四 MVVM 整合：CommunityToolkit.Mvvm + ReactiveUI 雙範例（含主題切換 ViewModel）
  - §五 10 項常用元件對應（強調 Semi 是主題庫非元件庫；不存在 `<semi:Button>`）
  - §六 專案結構建議
  - §七 §專案特化（6 欄位）+ Fallback
  - §八 Vendor 安全準則
  - §九 troubleshooting 5 項
  - MACHINE_READABLE block 完整填寫（version_locked / license 分類 / subpackages 開源/閉源）
- MANIFEST：`vendor_last_vetted: 2026-04-24` + `vendor_version_locked: "12.0.1"`

### Notes

- **版本鎖定**：Semi.Avalonia 12.0.1 + Avalonia >= 12.0.1 + .NET 8+（User 實際版本）
- **授權分級**：主套件 + ColorPicker + DataGrid + TreeDataGrid = MIT；Dock + Tabalonia + AvaloniaEdit = NuGet 免費但閉源（商業稽核需注意）
- **定位澄清**：Semi.Avalonia 是**主題庫**非**元件庫**；需要 Semi 風格的擴充控制項 → 改用 Ursa.Avalonia
- **MVVM 不綁定**：父 stack `avalonia-ui` 規定 ReactiveUI / CommunityToolkit.Mvvm 擇一；本 stack 兩種都提供範例
- **Prompt injection 審查結果**：低風險（典型開源 README；無 Instruction 偽冒 / 無命令誘導 / 無角色重置）
- `installed: false` 維持；新 Avalonia 專案透過 `node .agents/scripts/tech-stack-manage.mjs install semi-avalonia` opt-in

### Related

- 同日更新 `tech-stacks/desktop/avalonia-ui.md`：版本支援擴展為 11.x + 12.x（.NET 8+ 要求）

---

## 2026-04-24 — v0.1.0-skeleton（PROPOSAL_20260423_017 Phase F.2；已被 v0.2.0 取代）

### Added

- 資料夾結構骨架：`README.md` + `SOURCE.md` + `upstream/` + `adapted/` + `CHANGELOG.md`
- README.md 初版規範（導入原則 / 樣式擴充 / 元件對應骨架 / §專案特化 / MACHINE_READABLE）
- SOURCE.md 審核模板（待 User 觸發時填寫）

### Pending → Resolved in v0.2.0

- ~~upstream/ 空；待 User 提供 vendor 文件~~ → User 於 F.3 同意由 LLM WebFetch 代為擷取
- ~~MANIFEST `vendor_last_vetted` 欄位未填~~ → 2026-04-24 填入
- ~~§四「常用元件對應」待 vendor 文件補齊~~ → 於 README §五 擴充為 10 項表格
