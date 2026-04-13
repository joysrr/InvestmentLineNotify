# Security Policy

## 專案性質聲明

本專案（InvestmentLineNotify）為**個人投資通知系統**，部署於私人 Oracle Cloud VM，僅供個人使用。

- 本專案**不接受外部貢獻（Pull Request / Issue）**
- 本專案**不提供公開服務端點**，無公開 API 或 Web 介面供第三方存取
- 本專案**不儲存任何第三方用戶資料**

---

## 安全架構摘要

| 層級 | 機制 |
|---|---|
| 原始碼 | Private repo，最小 GitHub Actions 權限 |
| 機密管理 | 所有 token / key 透過 GitHub Secrets 與 VM `.env` 注入，不進版控 |
| 資料持久化 | `data/` 目錄僅存於 VM 本地，不同步至 GitHub |
| 排程執行 | Oracle VM crontab，含 Telegram 錯誤通知 |
| 敏感欄位 | snapshot 類財務資料已加密儲存 |

---

## 已知風險與排除範圍

以下項目屬於**已知且刻意接受的設計決策**，不視為需要回報的漏洞：

- VM 上的 `.env` 檔案以檔案系統權限保護，非加密儲存
- Telegram Bot token 存於 GitHub Secrets，依賴 GitHub 平台安全性
- DuckDNS 動態 DNS 更新使用 URL 參數傳遞 token（官方設計）

---

## 回報安全問題

本專案為個人私用，**不設立正式的漏洞揭露（CVD）流程**。

若你發現重大安全問題（例如：secrets 意外洩漏至公開 commit），可透過以下方式聯繫：

- GitHub：[@joysrr](https://github.com/joysrr)

請**不要**透過公開 Issue 回報含有敏感資訊的安全問題。

---

## 版本支援

本專案僅維護 `main` 分支，不提供舊版本的安全修補。

---

*最後更新：2026-04-13*
