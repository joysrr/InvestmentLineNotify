---
type: plan
status: backlog
last_updated: 2026-09-11
tags:
  - ideas
  - features
  - backlog
wiki_links: []
---

# Draft Features（草稿功能池）

> 此文件存放**尚在調研階段**的功能草稿，待所有待確認清單解決後，才升格移入 `preplan_features.md`。
> 與 `preplan_features.md`（待評估與實作功能池）的差異：草稿計畫尚有未解決的前置研究問題，**不可直接進入實作排程**。

---

## 🔍【調研中】每日摘要語音化推播（Gemini TTS × Telegram Audio）

### 狀態

🔍 調研中｜待確認清單尚未全數解決，暫不排入實作計畫

### 功能目標

將每日由 LLM 產生的市場摘要文字（AI 教練洞察、總經多空分析等），透過 Gemini TTS API（`gemini-2.5-flash-preview-tts`）轉換為語音音訊檔，再經由 Telegram Bot API 的 `sendAudio` 方法推播至指定頻道。

此功能定位為現有文字報告的「語音附件」，與三則文字訊息並列發送，不取代原有推播邏輯。

---

### 📁 影響範圍（草稿）

| 模組 / 職責          | 預計異動                                                   | 路徑                                                          |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 語音合成服務（新增） | 新增 `ttsService.mjs`，封裝 Gemini TTS 呼叫與 PCM→MP3 轉換 | `src/modules/ai/`                                             |
| 摘要文字組裝邏輯     | 需擷取純文字版本（去除 HTML tag）供 TTS 使用               | `src/modules/notifications/templates/telegramHtmlBuilder.mjs` |
| Telegram 推播模組    | 新增 `sendAudio` 呼叫，於三則文字訊息後附加語音            | `src/modules/notifications/transports/telegramClient.mjs`     |
| 暫存音訊目錄         | 需於執行期間建立 `/tmp/tts/` 暫存目錄，流程結束後清除      | 專案根目錄下的 `/tmp/`                                        |

---

### ❓ 待確認清單（升格條件）

以下四項全數解決後，才可將本計畫移入 `preplan_features.md`：

- [ ] 確認 `aiAdvice` / `macroAnalysis` 的實際資料結構與來源模組
- [ ] 確認 `ttsService.mjs` 檔案最佳放置路徑（`src/modules/ai/` 或其他）
- [ ] 確認每日推播流程中負責三則訊息發送的函式名稱與插入點
- [ ] 確認 Gemini API key 分配策略與 Langfuse span wrapper 的使用方式

---

### 難度（預估）

⭐⭐⭐ 高（需整合 AI pipeline、ffmpeg 轉檔與 Telegram Audio API）

---

### 升格條件

待上方四項待確認清單全數勾選完成後，將本計畫搬移至 `preplan_features.md`，狀態標記為 `⚪ 待實作`。
