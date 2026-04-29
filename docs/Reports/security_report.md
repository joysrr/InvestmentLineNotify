# Security Policy

## 專案性質聲明

本專案（InvestmentLineNotify）為**個人投資通知系統**，部署於私人 Oracle Cloud VM，僅供個人使用。

- 本專案**不接受外部貢獻（Pull Request / Issue）**
- 本專案**不提供公開服務端點**，無公開 API 或 Web 介面供第三方存取
- 本專案**不儲存任何第三方用戶資料**

---

## 安全架構摘要

| 層級       | 機制                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 原始碼     | Private repo，最小 GitHub Actions 權限                                                                                                  |
| 機密管理   | 所有 token / key 透過 GitHub Secrets 與 VM `.env` 注入，不進版控                                                                        |
| 資料持久化 | `data/` 目錄僅存於 VM 本地，不同步至 GitHub                                                                                             |
| 排程執行   | Oracle VM crontab，含 Telegram 錯誤通知                                                                                                 |
| 敏感欄位   | snapshot 類財務資料採 AES-256-GCM 加密儲存（**前提：`SNAPSHOT_ENCRYPT_KEY` 環境變數已設定**；未設定時系統將發出 warn 並以明文略過加密） |

---

## 已知風險與排除範圍

以下項目屬於**已知且刻意接受的設計決策**，不視為需要回報的漏洞：

- VM 上的 `.env` 檔案以檔案系統權限保護，非加密儲存
- Telegram Bot token 存於 GitHub Secrets，依賴 GitHub 平台安全性
- DuckDNS 動態 DNS 更新使用 URL 參數傳遞 token（官方設計）

---

## SSH Key Rotation SOP

**建議頻率：每 6 個月一次（每年 4 月、10 月）**

> 定期輪換 SSH Key 可確保即使舊 key 外洩，攻擊者也無法繼續使用。
> 執行前確認你能同時存取 VM 終端機與 GitHub Secrets 管理頁面。

### 涉及的 Key 位置

| 位置                                  | 說明                          |
| ------------------------------------- | ----------------------------- |
| `GitHub Secrets → VM_SSH_PRIVATE_KEY` | GitHub Actions 應急連線 VM 用 |
| VM `~/.ssh/authorized_keys`           | 存放對應的 Public Key         |

### Step 1｜在 VM 上產生新 Key Pair

```bash
ssh-keygen -t ed25519 -C "investnotify-$(date +%Y%m)" -f ~/.ssh/id_investnotify_new
# 詢問 passphrase 時直接 Enter（無密碼，供自動化使用）
```

### Step 2｜將新 Public Key 加入 authorized_keys

```bash
cat ~/.ssh/id_investnotify_new.pub >> ~/.ssh/authorized_keys
```

> ⚠️ 先「加入」不要「取代」，確認新 key 可用後再刪舊的

### Step 3｜從本機測試新 Key 可正常連線

```bash
ssh -i ~/.ssh/id_investnotify_new ubuntu@<your-vm-ip>
```

確認成功登入後再繼續下一步。

### Step 4｜更新 GitHub Secrets

```bash
# 在 VM 上複製新 private key 完整內容
cat ~/.ssh/id_investnotify_new
```

前往 [GitHub → Settings → Secrets → VM_SSH_PRIVATE_KEY](https://github.com/joysrr/InvestmentLineNotify/settings/secrets/actions)，貼上新的 Private Key 內容覆蓋舊值。

### Step 5｜從 authorized_keys 刪除舊 Key

```bash
# 開啟編輯，刪除舊 key 那一行（通常是最上面那行）
nano ~/.ssh/authorized_keys
```

存檔後確認 authorized_keys 只剩新 key：

```bash
cat ~/.ssh/authorized_keys
```

### Step 6｜清理暫存的 Key 檔案（可選）

```bash
# 若不需要保留舊 key 備份，直接移除
rm ~/.ssh/id_investnotify_new
rm ~/.ssh/id_investnotify_new.pub
```

### 換 Key 後驗證清單

- [ ] 新 Key 可從本機 SSH 登入 VM
- [ ] GitHub Secrets `VM_SSH_PRIVATE_KEY` 已更新
- [ ] `authorized_keys` 只剩新 Public Key
- [ ] 手動觸發一次應急 workflow，確認 Actions 可正常連線 VM
- [ ] 記錄本次更換日期（下次預計：6 個月後）

### 換 Key 紀錄

| 日期       | 備註                  |
| ---------- | --------------------- |
| 2026-04-13 | 初始建立 SSH Key 設定 |

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

_最後更新：2026-04-13_
