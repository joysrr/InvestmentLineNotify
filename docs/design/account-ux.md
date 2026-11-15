---
title: 帳戶與設定頁 UX 規格
stage: CARD-5.5
status: current
type: explanation
last_updated: 2026-11-14
tags:
  - account
  - ux
  - card-5-5
wiki_links: []
last_verified: 2026-11-15
summary: 帳號頁面 UX 規格，定義帳號管理介面行為。
related_code: []
related_docs: []
---

# 帳戶與設定頁 UX 規格

## 設定分組

頁面採用 3 個 CollapsibleSection 設定分組（各自獨立展開/摺疊），外加 1 個「資料來源」分組（原始結構，不在設定項內）：

| 分組     | 內容                                                                                                                                                      | 預設狀態 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 通知設定 | Telegram 通知開關 (`el-switch`、`v-model=telegramEnabled`)、通知時段輸入 (`el-input`、`v-model.number=notificationHour`)、儲存後顯示 inline 成功/失敗回饋 | 展開     |
| 策略參數 | 僅顯示「連結至 StrategyConfigEditorView」的 router-link，不直接內嵲策略編輯器（保持 async lazy load，避免首屏體積）                                       | 展開     |
| 關於     | 版本、功能說明、`id="about"`                                                                                                                              | 摺疊     |
| 資料來源 | 原始模板結構，獨立於設定項分組之外，顯示資料來源健康度                                                                                                    | 摺疊     |

## 設定回饋

- 成功：inline message「通知設定已儲存」，使用 `--iln-ok-bg` / `--iln-ok-text`
- 失敗：inline message「儲存失敗，請稍後再試」，使用 `--iln-danger-bg` / `--iln-danger-text`
- 兩者皆為 `save-feedback` class，依 `saveStatus` (`success`/`error`/`null`) 動態切換

## 危險操作

| 操作     | 現狀                                                                                                                                                                                                                       | 處置                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 重設設定 | `handleResetSettings()` 曾彈出 `ElMessageBox.confirm` 二次確認，確認後僅重設前端 ref（`telegramEnabled=true`、`notificationHour=9`），**未清除任何持久化設定**（本頁面設定為純前端 ref，無 `localStorage` 或後端持久化層） | **已移除「重設為預設值」按鈕**。假的二次確認比沒有更糟，會誤導用戶以為設定已清除。若未來需真實清除，應在有持久化層後重新引入，列為 CARD-5.6 跟進項。 |

## 已知限制

- 通知設定與策略參數均為純前端狀態，未接入後端 API（階段五不改資料契約）
- 重設設定功能已移除，因無持久化設定可清除，留著假按鈕無實際價值
- 策略參數編輯透過 router-link 導向 StrategyConfigEditorView，該頁面為 `defineAsyncComponent` lazy load

## 360px 驗證

- 4 個 CollapsibleSection（3 設定 + 1 資料來源）在 360px 視窗內無橫向滾動
- 各分組寬度 ≤ 360px，左邊界 x ≥ 0
