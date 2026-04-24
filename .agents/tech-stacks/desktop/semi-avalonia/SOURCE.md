# SOURCE.md — Vendor Audit Trail

> 本檔為 **資料夾模式 tech-stack** 的 vendor 來源審核紀錄（skills/tech-stack-onboarding.md §5.2 強制要求）。

---

## Vendor Source

- **Library**：Semi.Avalonia
- **Repository**：https://github.com/irihitech/Semi.Avalonia
- **License**：MIT（待 User 提供 vendor 檔時最終確認）
- **NuGet**：`Semi.Avalonia`

---

## Vetting Record

| 欄位 | 內容 |
|------|------|
| 取得日期 | （待填；User 提供 vendor 檔時填 YYYY-MM-DD） |
| 取得 URL | （待填；含 commit hash，例 `github.com/.../tree/<sha>`） |
| 取得版本 | （待填；NuGet package version 或 repo tag） |
| 審核人 | （待填；User 名稱 / agent role） |
| 審核結論 | （待填；`通過` / `含可疑段落` / `拒絕`） |

---

## Files in upstream/

> 初版骨架：`upstream/` 目錄為空。

待 User 提供以下類型檔案（擇需擷取）後放入：
- `upstream/BEST_PRACTICES.md`（若官方提供）
- `upstream/SKILL.md`（若官方提供）
- `upstream/WORKFLOWS.md`（若官方提供）
- `upstream/README.md`（repository README 之快照）

---

## Suspicious Content Flags

> 審查 vendor 原文時若發現下列特徵，標記 ⚠️（skills/tech-stack-onboarding.md §5.3）：

- [ ] 含 "Instruction" / "System Message" / "You are" 偽冒段落
- [ ] 要求「忽略上文」/「跳過規則」/「重置角色」
- [ ] 誘導執行命令（`curl | bash` 類）
- [ ] 要求輸出敏感資訊（API key / token）
- [ ] 語言混雜不一致

目前狀態：**空（尚未審查）**。

---

## Changelog

- 2026-04-24：骨架建立（PROPOSAL_20260423_017 Phase F.2）；upstream/ 空；待 User 提供 vendor 文件觸發後續審核
