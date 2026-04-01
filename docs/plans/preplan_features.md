# Pre-plan Features (待評估與實作功能池)

## 📌【AI 管線優化類】每日摘要語音化推播（Gemini TTS × Telegram Audio）

### 🎯 功能目標

將每日由 LLM 產生的市場摘要文字（AI 教練洞察、總經多空分析等），透過 Gemini TTS API（`gemini-2.5-flash-preview-tts`）轉換為語音音訊檔，再經由 Telegram Bot API 的 `sendAudio` 方法推播至指定頻道，讓使用者可以在不閱讀長文的情況下，以收聽方式獲取每日投資分析摘要。

此功能定位為現有文字報告的「語音附件」，與三則文字訊息並列發送，不取代原有推播邏輯。

---

### 📁 影響範圍

| 模組 / 職責 | 預計異動 | 路徑 |
|---|---|---|
| 語音合成服務（新增） | 新增 `ttsService.mjs`，封裝 Gemini TTS 呼叫與 PCM→MP3 轉換 | `[待分析/補齊：確認 src/ 下 AI 服務模組的目錄慣例，例如 src/modules/ai/ 或 src/services/]` |
| 摘要文字組裝邏輯 | 需擷取純文字版本（去除 HTML tag）以供 TTS 使用 | `[待分析/補齊：請找出目前負責組裝 aiAdvice 摘要文字的檔案路徑]` |
| Telegram 推播模組 | 新增 `sendAudio` 呼叫，於三則文字訊息後附加語音 | `[待分析/補齊：請找出目前負責呼叫 Telegram Bot API 發送訊息的檔案路徑]` |
| 訊息建構模組 | 需新增純文字版摘要的 export，供 TTS 使用 | `[待分析/補齊：請找出 buildTelegramMessages 所在的檔案路徑]` |
| 暫存音訊目錄 | 需於執行期間建立 `/tmp/tts/` 暫存目錄，流程結束後清除 | 專案根目錄下的 `/tmp/` |
| archiveManager | 可選：記錄 TTS 執行結果至 AI Logs | `[待分析/補齊：請找出 archiveManager.mjs 的完整路徑]` |

---

### ⚙️ 實作步驟草案 (Step-by-Step)

#### Step 1：建立純文字摘要（TTS Script）

TTS 輸入不能含 HTML tag，需從現有的 `aiAdvice` 物件另外組裝一份純文字腳本：

```js
// 建議格式：段落間換行，語意清晰，適合朗讀
function buildTtsScript(aiAdvice, macroAnalysis) {
  const sections = [];

  if (macroAnalysis?.conclusion?.short_summary) {
    sections.push(`市場主軸：${macroAnalysis.conclusion.short_summary}`);
  }

  if (aiAdvice?.risk_warnings?.length) {
    sections.push("風險提示：" + aiAdvice.risk_warnings.join("。"));
  }

  if (aiAdvice?.action_items?.length) {
    sections.push("觀察清單：" + aiAdvice.action_items.join("。"));
  }

  if (aiAdvice?.mindset_advice?.length) {
    sections.push("行動建議：" + aiAdvice.mindset_advice.join("。"));
  }

  return sections.join("\n\n");
}
```

[待分析/補齊：確認 aiAdvice 物件的完整欄位結構，確保擷取路徑正確]

---

#### Step 2：建立 ttsService.mjs，封裝 Gemini TTS 呼叫

Gemini TTS API 回傳的是 **PCM 原始音訊**（`s16le`，24000Hz，單聲道），需要透過 `ffmpeg` 或直接寫入 WAV header 轉換為 MP3 供 Telegram 上傳。

```js
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const TMP_DIR = "/tmp/tts";

export async function generateTtsAudio(script, outputFileName = "daily-brief.mp3") {
  await fs.mkdir(TMP_DIR, { recursive: true });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY1 });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: script,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" }, // 沉穩男聲，適合財經播報
        },
      },
    },
  });

  const audioData = response.candidates.content.parts.inlineData.data;
  const pcmPath = path.join(TMP_DIR, "output.pcm");
  const mp3Path = path.join(TMP_DIR, outputFileName);

  await fs.writeFile(pcmPath, Buffer.from(audioData, "base64"));

  // 需要環境安裝 ffmpeg（GitHub Actions ubuntu-latest 預裝）
  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "s16le",
    "-ar", "24000",
    "-ac", "1",
    "-i", pcmPath,
    mp3Path,
  ]);

  return mp3Path;
}
```

[待分析/補齊：確認目前 GEMINI_API_KEY 的環境變數命名慣例（是否為 GEMINI_API_KEY1 / GEMINI_API_KEY2 輪替）]

---

#### Step 3：整合至推播流程，於文字訊息後發送語音

[待分析/補齊：確認目前 Telegram 推播的呼叫流程，是否在單一函式中依序發送三則訊息，以便確認插入點]

```js
// 在三則文字訊息發送完畢後執行
async function sendDailyAudio(chatId, aiAdvice, macroAnalysis) {
  try {
    const script = buildTtsScript(aiAdvice, macroAnalysis);

    if (!script.trim()) {
      console.warn("[TTS] 摘要內容為空，略過語音發送");
      return;
    }

    const twDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    const fileName = `brief-${twDate}.mp3`;
    const mp3Path = await generateTtsAudio(script, fileName);

    await telegramBot.sendAudio(chatId, fs.createReadStream(mp3Path), {
      title: `每日摘要 ${twDate}`,
      performer: "AI Coach",
      disable_notification: true,
    });

    console.log(`[TTS] 語音推播完成：${fileName}`);
  } catch (err) {
    // 降級：語音失敗不中斷主要文字推播流程
    console.error("[TTS] 語音推播失敗，已降級略過：", err.message);
  } finally {
    // 清除暫存音訊
    await fs.rm("/tmp/tts", { recursive: true, force: true }).catch(() => {});
  }
}
```

---

#### Step 4：GitHub Actions 環境確認（ffmpeg 可用性）

GitHub Actions 的 `ubuntu-latest` runner **預裝 ffmpeg**，不需額外安裝步驟。[待分析/補齊：若有使用 Docker 容器或自架 runner，需確認 ffmpeg 是否已安裝]

若需保險起見，可在 yml 中加入：

```yaml
- name: Ensure ffmpeg available
  run: ffmpeg -version
```

---

#### Step 5：Langfuse 追蹤整合（選配）

將 TTS 呼叫記錄為獨立的 span，便於追蹤成本與延遲：

```js
// 在 generateTtsAudio 內加入 Langfuse span
langfuse.span({
  name: "gemini-tts",
  input: { scriptLength: script.length },
  output: { filePath: mp3Path, success: true },
  metadata: { model: "gemini-2.5-flash-preview-tts", voice: "Kore" },
});
```

[待分析/補齊：確認目前 Langfuse span 的建立方式與命名慣例，是否透過統一的 wrapper 函式呼叫]

---

### ⚠️ 潛在挑戰與防禦機制

#### 1. Gemini TTS API 不穩定 / Timeout

- **策略**：`generateTtsAudio` 包在 `try/catch` 內，失敗時 `console.error` 後直接 `return`（不拋出），確保文字推播主流程不受影響
- **降級**：語音失敗時發送一則無聲的文字訊息 `🔇 今日語音摘要暫時無法生成` 作為替代通知

#### 2. ffmpeg 轉檔失敗（PCM 損毀 / 格式異常）

- **策略**：`execFileAsync` 的 stderr 輸出納入 error message，方便 debug
- **防禦**：轉檔前先驗證 PCM 檔案大小 `> 0`，若為空檔直接略過

#### 3. Telegram `sendAudio` 超時（大檔案上傳）

- **策略**：Gemini TTS 單次呼叫輸出約 30 秒語音對應 ~500KB MP3，遠低於 Telegram 50MB 上限，正常情況無此風險
- **防禦**：若摘要文字超過 3000 字，先截斷至重點段落再送 TTS，避免生成過長音訊

#### 4. API Key Rate Limit

- **策略**：TTS 呼叫固定使用 `GEMINI_API_KEY1`（或獨立的 TTS 專用 key），與現有 `newsFetcher`（KEY1）、`aiCoach`（KEY2）的 key 分配**需重新確認**
- [待分析/補齊：確認目前各模組的 keyIndex 分配，TTS 應使用哪一把 key 避免碰撞]

#### 5. 暫存檔案殘留（GitHub Actions 無狀態環境）

- **策略**：`finally` 區塊強制清除 `/tmp/tts/`，即使上傳失敗也執行清理
- GitHub Actions runner 在 job 結束後整個環境銷毀，此問題風險極低，但仍建議顯式清除以養成習慣

---

### 🔁 資料流設計

```
aiAdvice（LLM 輸出物件）
  ➔ buildTtsScript()
  → 擷取 risk_warnings / action_items / mindset_advice / short_summary
  → 組裝純文字朗讀腳本（去除 HTML tag）

純文字腳本
  ➔ generateTtsAudio()（ttsService.mjs）
  → Gemini API（gemini-2.5-flash-preview-tts）
  → 回傳 Base64 PCM 音訊資料
  → 寫入 /tmp/tts/output.pcm
  → ffmpeg 轉換 PCM → MP3
  → 產出 /tmp/tts/brief-YYYY-MM-DD.mp3

MP3 檔案
  ➔ sendDailyAudio()
  → fs.createReadStream(mp3Path)
  → Telegram Bot API sendAudio（multipart/form-data）
  → 推播至指定 chat_id（disable_notification: true）

執行結束
  ➔ finally 清除 /tmp/tts/
  ➔ （選配）Langfuse span 記錄 TTS 執行結果
  ➔ GitHub Actions git-auto-commit（無音訊檔，/tmp 不在 repo 追蹤範圍）
```