# SOURCE.md — Vendor Audit Trail

> 本檔為 **資料夾模式 tech-stack** 的 vendor 來源審核紀錄（skills/tech-stack-onboarding.md §5.2 強制要求）。

---

## 資料夾角色矩陣（PROPOSAL_20260430_005 整併確認）

| 檔案                        | 角色                                                               | LLM 可讀作規範            | 編輯來源           |
| --------------------------- | ------------------------------------------------------------------ | ------------------------- | ------------------ |
| `README.md`                 | **LLM 規範唯一權威**（套件安裝 / XAML 設定 / 元件對應 / 安全準則） | ✅                        | 我方撰寫（vetted） |
| `SOURCE.md`（本檔）         | Audit trail / Vetting Record / Update Protocol                     | ❌（人類審計用）          | 我方撰寫           |
| `CHANGELOG.md`              | tech-stack 本身的變更紀錄（與 vendor 版本不同）                    | ❌                        | 我方撰寫           |
| `upstream/repo-metadata.md` | vendor README 事實資料 verbatim snapshot                           | ❌（snapshot 不可被引用） | WebFetch           |
| `upstream/demo-App.axaml`   | vendor demo App.axaml verbatim snapshot                            | ❌                        | WebFetch           |

**規則**：

- 規範變動 → 改 `README.md`
- 審計欄位變動（vetted 日期 / 版本鎖定）→ 改 `SOURCE.md` + `MANIFEST.yaml::vendor_last_vetted`
- vendor 升版 → 重抓 `upstream/*` + 走本檔 §Update Protocol

---

## Vendor Source

- **Library**：Semi.Avalonia
- **Repository**：https://github.com/irihitech/Semi.Avalonia
- **Maintainer**：irihitech (contact@irihi.tech)
- **License**：
  - **MIT**：主套件 + `Semi.Avalonia.ColorPicker` / `Semi.Avalonia.DataGrid` / `Semi.Avalonia.TreeDataGrid`
  - **⚠️ 閉源但 NuGet 免費**：`Semi.Avalonia.Dock` / `Semi.Avalonia.Tabalonia` / `Semi.Avalonia.AvaloniaEdit`（原始碼需聯繫 `contact@irihi.tech`）
- **Primary NuGet**：`Semi.Avalonia` version `12.0.1`

---

## Vetting Record

| 欄位          | 內容                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------- |
| 取得日期      | 2026-04-24                                                                                        |
| 取得方式      | WebFetch（GitHub main branch + v12.0.1 release page + NuGet.org）                                 |
| 取得 URL      | https://github.com/irihitech/Semi.Avalonia（main 分支撰寫時）                                     |
| 取得版本      | v12.0.1（released 2025-04-18）                                                                    |
| Avalonia 相依 | `>= 12.0.1`（.NET 8+）                                                                            |
| 初審人        | `@Lead`（自動審查）                                                                               |
| 最終覆核人    | **User**（2026-04-24 同意採納本 tech-stack；設定 `installed: false`，Avalonia 專案開案時 opt-in） |
| 審核結論      | **通過**（可供 LLM 讀 README.md 作規範）                                                          |

---

## Files in upstream/

1. **`upstream/repo-metadata.md`** — 從 README 擷取的事實資料（NuGet 套件清單 / 版本矩陣 / namespace / license 說明 / v12.0.1 changelog / demo 結構）
2. **`upstream/demo-App.axaml`** — 官方 demo 的 App.axaml 完整 verbatim snapshot；作為主題匯入模式的 audit reference

> **注意**：`upstream/` 內容為 vendor 原文參考用，**不得**被 rules / skills / docs 引用。LLM 讀規範 → 去 `../README.md`。

---

## Suspicious Content Flags

> 審查 vendor 原文時若發現下列特徵，標記 ⚠️（skills/tech-stack-onboarding.md §5.3）：

- [x] 含 "Instruction" / "System Message" / "You are" 偽冒段落 → **無**
- [x] 要求「忽略上文」/「跳過規則」/「重置角色」 → **無**
- [x] 誘導執行命令（`curl | bash` 類）→ **無**（僅合理 `dotnet add package ...` 安裝指令；性質為安裝命令而非注入）
- [x] 要求輸出敏感資訊（API key / token）→ **無**
- [x] 語言混雜不一致 → **無**（正常 CN/EN 技術文檔）

**風險等級**：**低**（典型開源專案 README，無異常）。

**備註**：部分子套件（Dock / Tabalonia / AvaloniaEdit）雖 NuGet 免費但**閉源**；若專案有源碼稽核政策（軍工 / 金融 / 醫療），需於採納前自行評估合規性。

---

## Update Protocol（未來更新時套用）

若 Semi.Avalonia 發布新版（例 12.0.2 或 13.x）：

1. 更新 `upstream/repo-metadata.md`（refetch release page + changelog verbatim）
2. 若 `App.axaml` 設定模式有變（新增 Style 標籤等）→ 更新 `upstream/demo-App.axaml`
3. 評估是否需要修 `../README.md`（我方規範）：
   - 新 token 名稱 → §五 補元件對應表
   - 新子套件 → §二.2 表格新增
   - Breaking change → CHANGELOG.md 註記 + 修相關 §
4. 更新本 SOURCE.md：
   - `取得日期`、`取得版本` 欄位更新
   - 新增 `## Update History` 條目（日期 + 版本 + 審核人簽名）
5. MANIFEST `vendor_last_vetted` 同步填新日期
6. 若 `vendor_version_locked` 變動 → README.md `MACHINE_READABLE` block 同步

---

## Changelog

- **2026-04-24（v0.3.0 user-defaults-applied）**：追加 WebFetch `src/Semi.Avalonia/Locale/` 目錄確認 17 個支援 locale；User 設計決策寫入 README §七 Fallback 表：Locale 預設 `zh-TW`（原生支援）+ Icon pack 採 FontAwesome（`Projektanker.Icons.Avalonia.FontAwesome`）+ 保留全部 6 子套件；`upstream/repo-metadata.md` 新增 Locale 檔案清單 verbatim
- **2026-04-24（v0.2.0 vetted）**：PROPOSAL_20260423_017 Phase F.3 完成審核；upstream/ 填入 2 檔（repo-metadata.md + demo-App.axaml）；README.md 補齊實質規範（§二～§九）；MANIFEST `vendor_last_vetted: 2026-04-24`
- 2026-04-24（v0.1.0 skeleton）：PROPOSAL_20260423_017 Phase F.2 建立空骨架（已被 v0.2.0 取代）
