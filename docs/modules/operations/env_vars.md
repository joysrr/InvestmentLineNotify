---
type: reference
status: needs-review
last_updated: 2026-09-10
related_code:
  - src/modules/ai/langfuseClient.mjs
  - .env.example
  - src/bot.mjs
  - src/scheduler/newsFetch.mjs
dependencies:
  - @langfuse/tracing@5.11.0
  - @langfuse/client@5.11.0
  - google-gemini-api@latest
tags:
  - env
  - configuration
  - langfuse
  - ai
wiki_links:
  - [[Langfuse Prompt Management]]
---

# 環境變數清單

> 本文件列出專案所有使用到的環境變數。
> 每次新增或移除環境變數時，**請同步更新此文件**，並確認對應的 GitHub Actions yaml 已同步設定。
>
> 最後更新：2026-04-12

---

## 📱 Telegram

| 變數名稱                 | 用途                                  | 必填 | 使用的 Workflow                                |
| ------------------------ | ------------------------------------- | :--: | ---------------------------------------------- |
| `TELEGRAM_API_TOKEN`     | 主 Bot Token，發送每日 / 週 / 月報告  |  ✅  | `line_notify` `weekly-report` `monthly-report` |
| `TELEGRAM_LOG_API_TOKEN` | Log Bot Token，發送 Workflow 異常告警 |  ✅  | `notify-workflow-failure`                      |
| `TELEGRAM_USER_ID`       | 接收訊息的 Telegram 使用者 ID         |  ✅  | 全部                                           |
| `TELEGRAM_WEBAPP_URL`    | Mini App URL，嵌入每日報告按鈕        |  ✅  | `line_notify`                                  |

---

## 📊 Google Sheets

| 變數名稱                       | 用途                               | 必填 | 使用的 Workflow |
| ------------------------------ | ---------------------------------- | :--: | --------------- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | GCP 服務帳號 Email，用於讀寫試算表 |  ✅  | `line_notify`   |
| `GOOGLE_PRIVATE_KEY`           | GCP 服務帳號私鑰（PEM 格式）       |  ✅  | `line_notify`   |
| `GOOGLE_SHEET_ID`              | 持股記錄試算表 ID                  |  ✅  | `line_notify`   |

---

## 🤖 AI / Gemini

| 變數名稱          | 用途                                     | 必填 | 使用的 Workflow                                                         |
| ----------------- | ---------------------------------------- | :--: | ----------------------------------------------------------------------- |
| `GEMINI_API_KEY1` | Gemini API 金鑰（輪替用，第 1 把）       |  ✅  | `line_notify` `news-fetch` `optimizer` `weekly-report` `monthly-report` |
| `GEMINI_API_KEY2` | Gemini API 金鑰（輪替用，第 2 把）       |  ✅  | 同上                                                                    |
| `GEMINI_API_KEY3` | Gemini API 金鑰（輪替用，第 3 把）       |  ✅  | 同上                                                                    |
| `GEMINI_MODEL`    | 使用的模型名稱（例：`gemini-2.0-flash`） |  ✅  | 同上                                                                    |

---

## 📡 Langfuse（AI 追蹤，選填）

> 未設定時系統仍可正常運作，僅跳過 AI 決策追蹤記錄。

| 變數名稱              | 用途                  |  必填   | 使用的 Workflow                                                         |
| --------------------- | --------------------- | :-----: | ----------------------------------------------------------------------- |
| `LANGFUSE_SECRET_KEY` | Langfuse 後端追蹤金鑰 | ⚡ 選填 | `line_notify` `news-fetch` `optimizer` `weekly-report` `monthly-report` |
| `LANGFUSE_PUBLIC_KEY` | Langfuse 前端追蹤金鑰 | ⚡ 選填 | 同上                                                                    |
| `LANGFUSE_BASE_URL`   | Langfuse 服務端點 URL | ⚡ 選填 | 同上                                                                    |

---

## 📈 市場資料 API

| 變數名稱         | 用途                        |     必填      | 使用的 Workflow |
| ---------------- | --------------------------- | :-----------: | --------------- |
| `FRED_API_KEY`   | FRED 聯準會資料庫 API       |      ✅       | `line_notify`   |
| `BASE_PRICE_URL` | 0050 基準價外部服務端點 URL |      ✅       | `line_notify`   |
| `STRATEGY_URL`   | 策略引擎外部端點 URL        | ⚠️ 目前未使用 | `line_notify`   |

---

## 🖥️ Oracle VM 部署

| 變數名稱             | 用途                                | 必填 | 使用的 Workflow                        |
| -------------------- | ----------------------------------- | :--: | -------------------------------------- |
| `VM_HOST`            | Oracle VM 的 IP 位址或 domain       |  ✅  | `line_notify` `news-fetch` `optimizer` |
| `VM_USER`            | SSH 登入使用者名稱                  |  ✅  | 同上                                   |
| `VM_SSH_PRIVATE_KEY` | SSH 私鑰，供 GitHub Actions 連線 VM |  ✅  | 同上                                   |

---

## 🔐 快照加密

| `SNAPSHOT_ENCRYPT_KEY` | 強烈建議 | 帳戶快照加密金鑰（AES-256-GCM，需為 64 個 hex 字元 = 32 bytes）。<br>**未設定時**：系統發出 warn 但繼續執行，快照以明文寫入 `daily_report_*.json`。 |

**金鑰產生方式：**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 新增環境變數 SOP

1. 在 GitHub Repo → **Settings → Secrets and variables → Actions** 新增 Secret
2. 在對應的 `.github/workflows/*.yml` 的 `env:` 區塊加入該變數
3. 在 `src/utils/envGuard.mjs` 的 `REQUIRED_VARS` 陣列加入（必填項目才需要）
4. **更新本文件**（`docs/env-vars.md`）
