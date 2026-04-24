# CHANGELOG — Semi.Avalonia tech-stack

> 追蹤 upstream 更新與我方適配調整（skills/tech-stack-onboarding.md §四.1 要求）。

---

## 2026-04-24 — v0.1.0-skeleton（PROPOSAL_20260423_017 Phase F.2）

### Added
- 資料夾結構骨架：`README.md` + `SOURCE.md` + `upstream/` + `adapted/` + `CHANGELOG.md`
- README.md 初版規範（導入原則 / 樣式擴充 / 元件對應骨架 / §專案特化 / MACHINE_READABLE）
- SOURCE.md 審核模板（待 User 觸發時填寫）

### Pending
- upstream/ 空；待 User 提供 vendor 文件（BEST_PRACTICES.md / SKILL.md / WORKFLOWS.md）
- MANIFEST `vendor_last_vetted` 欄位未填
- §四「常用元件對應」待 vendor 文件補齊

### Notes
- 本骨架允許 `tech-stack-validator` 通過（`installed: false` → 不檢查路徑存在性）
- User 實際 Avalonia 專案啟用時：執行 `node .agents/scripts/tech-stack-manage.mjs install semi-avalonia`
