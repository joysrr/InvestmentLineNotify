---
task_id: agent-onboarding-flow
file_type: workflow
owner: @Lead
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
purpose: |
  新專案 onboarding 對話驅動 5 步 SOP（精簡版；完整 6 步見 project-onboarding）
referenced_by:
  - skills/lead-context-mappings.md
  - tasks/project-onboarding-workflow.md
  - decisions/0032-tech-stack-audit-cycle.md
---

# Task: Agent-Driven Project Onboarding（對話驅動新專案初始化）

> 本 task 定義「User 對話 → @Lead / @Assistant 驅動 `init-workspace` 非互動 CLI」完整 SOP。
> 依 `PROPOSAL_20260424_018` Phase D 建立（F1 類 task；跨 agent 通用）。
>
> **核心價值**：從「40 題互動問答 + 2 個 CLI」→「3-5 題對話 + 1 次 CLI 呼叫」

---

## 一、適用時機

### 主要觸發（agent 主動識別）

User 說出任一：

- "我要開 <平台/語言> 專案"（例：Avalonia / Vue / React / Node.js / Telegram Bot）
- "建立新 workspace"
- "init workspace"
- "開一個 xxx 專案"
- "幫我做 xxx 的環境初始化"

### 次要觸發（需 agent 判斷）

對話脈絡隱含開案意圖但未明說（例：User 已連續討論 3 輪某平台技術選型），agent 可主動建議：

> 💡 您似乎準備開 <平台> 專案；要幫您跑 onboarding 嗎？

### 不適用

- 既有 workspace 的功能開發（走一般 @Lead 派發流程）
- 框架層（`.agents/` 本身）變更（走 proposal 流程）

---

## 二、Agent 職責分配

| Agent        | 職責                                               |
| ------------ | -------------------------------------------------- |
| `@Lead`      | 主導 onboarding 對話 + 最終拍板執行                |
| `@Assistant` | （可代行）識別關鍵字 + 起草 config YAML + 報告進度 |
| `@Planner`   | onboarding 完成後接手需求階段（交棒）              |

**非本 task 範圍**：`@Retro` / `@Architect` / `@QA` 等角色於 onboarding 不介入。

---

## 三、對話流程（5 步）

### Step 1：意圖識別 + 關鍵字 → stacks 映射

Agent 識別 User 說的平台 / 技術，對應 `tech-stacks/MANIFEST.yaml` 條目。

**映射表範例**：

| User 說的                     | 推薦 tech-stacks                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| "Avalonia 桌面專案"           | `avalonia-ui` + `semi-avalonia`（若使用 Semi 主題）                                  |
| "Vue 3 + Vite"                | `vue3-vite` + `vue3-component-pattern`                                               |
| "Telegram Mini App"           | `vue3-vite` + `vue3-component-pattern` + `telegram-miniapp` + `telegram-miniapp-sdk` |
| "Node.js 後端 + Telegram Bot" | `nodejs-esm-backend` + `testing-nodejs` + `telegram-bot`                             |
| "檔案存 JSON / 無 DB"         | + `file-based-storage`                                                               |
| "純 Node CLI 工具"            | `nodejs-esm-backend` + `testing-nodejs`                                              |

**鐵律**：

- 若識別不確定 → 向 User 確認；**不**擅自推定
- `depends_on` 不需 User 指定；`init-workspace --config` 會自動解析
- 若 User 說的技術**不在** MANIFEST → 走 `skills/tech-stack-onboarding.md` 先新增 stack

### Step 2：用 `AskUserQuestion` 精簡確認

Agent 使用 `AskUserQuestion` 工具（**非** 問 40 題），僅問以下 3-5 題：

```
Q1. 專案代號（snake_case；英文）
    例：my_avalonia_app / iln_bot / order_system

Q2. 一句話描述（display_name + business_domain）
    例："投資人通知機器人" / "訂單管理系統"

Q3. 推薦的 tech-stack 組合 [採納 / 細調]
    根據 Step 1 識別，顯示候選清單；User 確認或調整

Q4. 部署目標（可選）
    例：桌面應用 / VPS server / 雲端函式 / Docker container

Q5. 其他特殊需求（可選）
    例：多語系 / 深色模式 / SSO 登入
```

**不問的事**（自動處理）：

- TECH_STACK.language / framework / version 等 → 由選中 stacks 的 MACHINE_READABLE 推導
- last_audit_date / audit_interval_days → 系統自動填（今天 + 30 天）
- 大量路徑欄位（PATHS.\*）→ 用 Fallback 預設；User 事後可改

### Step 3：產出 config YAML

Agent 依 User 答案組裝 config（寫到 `/tmp/onboarding-<timestamp>.yaml`）：

```yaml
project_name: my_avalonia_app
answers:
  PROJECT_CONTEXT.display_name: "我的 Avalonia 應用"
  PROJECT_CONTEXT.business_domain: "桌面工具"
  PATHS.data_root: "./data"
  TECH_STACK.deployment: "桌面 exe 打包"
  # TECH_STACK.language 等會由選中 stacks 推導
tech_stacks:
  install:
    - avalonia-ui
    - semi-avalonia
  remove:
    - telegram-bot
    - telegram-miniapp
    - telegram-miniapp-sdk
    - nodejs-esm-backend
    - testing-nodejs
    - vue3-vite
    - vue3-component-pattern
    - file-based-storage
  mode: keep-files # 或 delete-files（User Step 2 有詢問時依選擇）
```

**鐵律**：

- **必**經 User 確認 YAML 內容（agent 顯示預覽 + AskUserQuestion "確認執行？"）
- **不**自動覆寫已存在的 workspace（`--force` 旗標須 User 明示同意）
- 確認檔案寫入路徑在 `/tmp/`（不污染專案目錄）

### Step 4：呼叫 `init-workspace --config`

```bash
python3 .agents/scripts/init-workspace.py --config /tmp/onboarding-<timestamp>.yaml
```

Agent 用 Bash 工具執行；等待回傳 exit code。

**預期行為**：

- 非互動；全程無 prompt
- 輸出：✅ Workspace 建立完成 + post-init reminder（audit 提醒）
- exit 0 = 成功
- exit 2 = 驗證失敗 / 寫檔失敗（agent 顯示錯誤給 User；User 決定下一步）

### Step 5：後續引導

init 完成後 agent **主動**：

1. 回顯 workspace 建立資訊（workspace 路徑 / installed stacks 數）
2. 提醒 User：
   - 第一次 30 天後會由 `@Assistant P-23` 自動提醒 audit
   - 可手動任何時候跑 `python3 .agents/scripts/tech-stack-manage.py audit`
3. 交棒：
   > ✅ Workspace 建立完成。您可以：
   >
   > 1. 呼叫 @Planner 進入需求階段
   > 2. 先告訴我專案的初步功能需求，我會派 @Planner 展開

---

## 四、邊界情境

### 4.1 User 提供的 stack 不在 MANIFEST

**處理**：

- Agent **不**自行新增 stack
- 提示 User：「`<stack_name>` 不在 MANIFEST；需先走 `skills/tech-stack-onboarding.md` 的新增 SOP（約 30 分鐘）；要現在做嗎？」
- User 若同意 → 切到新增 stack SOP；完成後回到本 task Step 1

### 4.2 User 要用多種平台（混合專案）

**處理**：

- 接受：Agent 列出多個 stacks（例：`avalonia-ui` + `vue3-vite` 做 hybrid 桌面 + 嵌 webview）
- 提醒：混合 stacks 有學習成本；建議 User 評估是否拆兩個 workspace
- 若 User 堅持混合 → config 列所有 stacks；`init-workspace` 依 depends_on DFS 自動解析

### 4.3 User 已有 CURRENT_WORKSPACE

**處理**：

- Agent 詢問：「您目前有 workspace <current>；要建立新 workspace 會切換；確認嗎？」
- 若 User 確認 → config 無需 `--force`（選擇後 prompt 會問；非互動 mode 直接切換）
- 若 User 猶豫 → 建議先在 project scope proposal 討論架構後再決定

### 4.4 Agent 判斷失準（User 回應 "不對"）

**處理**：

- 回退到 Step 1 重新識別
- **不**反覆猜；第 2 次失準 → 請 User 直接說 stack 名稱（列給他看）

---

## 五、與既有 task / skill 的關聯

| 關聯項                                 | 關係                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `tasks/project-onboarding-workflow.md` | 本 task 的**精簡對話版**；完整 6 步驟 SOP 仍由該 task 定義（agent 走本 task = 自動完成 6 步驟大部分） |
| `skills/tech-stack-onboarding.md`      | 新增 stack 時引用（本 task §4.1）                                                                     |
| `scripts/init-workspace.mjs --config`  | 本 task 的執行引擎（PROPOSAL_018 Phase B）                                                            |
| `scripts/tech-stack-manage.mjs audit`  | 後續定期維護入口（本 task Step 5 提及）                                                               |
| `rules/assistant.md` P-23              | 30 天後自動提醒（PROPOSAL_018 Phase E）                                                               |
| `rules/lead.md`                        | 本 task 由 @Lead 主導；@Lead 規則書引用本 task                                                        |

---

## 六、驗收標準

agent 走完本 task 後應達成：

- [ ] `.agents/workspaces/<name>.md` 建立
- [ ] `.agents/CURRENT_WORKSPACE` 切換到 `<name>`
- [ ] 選中 stacks 全部 `installed: true`；未選者 `installed: false`
- [ ] `TECH_STACK.last_audit_date = today` + `audit_interval_days = 30`
- [ ] TECH_STACK 自動推導欄位（language / framework 等）已填
- [ ] Post-init reminder 顯示給 User
- [ ] User 被明確交棒到下一步（@Planner 或 @Lead）

---

## 七、參考

- `PROPOSAL_20260424_018`：本 task 提案來源
- `PROPOSAL_20260423_017`：tech-stacks Catalog + MANIFEST（Step 1 映射依據）
- `PROPOSAL_20260423_005`：init-workspace 原型
- `ADR-0031`：Tech-Stacks Catalog 架構
- `ADR-0032`：Tech-Stack 生命週期 Audit 機制（本 task 的 Step 5 依據）

---

**維護紀錄**：

- 2026-04-24：由 PROPOSAL_20260424_018 Phase D 建立（F1 類 task）
