# Workspaces 使用說明

> 本目錄由 PROPOSAL_20260422_002 建立，用於存放專案環境變數（Project Context）。
> `@Lead` 於派發子 Agent 前依 **策略 A（靜態注入）** 將對應 workspace 欄位合併至 rule 上下文。

---

## 設計原則

- **Core Soul vs Project Context 分離**：`rules/*.md` 定義通用行為框架；`workspaces/*.md` 定義專案特定資訊
- **單一 active workspace**：由根目錄 `.agents/CURRENT_WORKSPACE` 指定當前服務的專案
- **動態注入**：`@Lead` 於 Workflow 啟動前讀取並注入，子 Agent 不直接讀 workspace 檔案

## 建立新專案 workspace

提供**三種方式**；擇一即可（依 PROPOSAL_20260423_005 雙軌引導 + 保留手動方式）。

### 方式一：互動式 CLI（🟢 主推；快速；不留半成品）

```bash
python3 .agents/scripts/init-workspace.py              # 基本互動
python3 .agents/scripts/init-workspace.py --name myapp # 指定名稱
python3 .agents/scripts/init-workspace.py --dry-run    # 預覽不寫檔
python3 .agents/scripts/init-workspace.py --help       # 完整說明
```

CLI 自動：

- 逐欄引導填寫（動態讀 `WORKSPACE_SCHEMA.yaml`）
- 建立 `workspaces/<name>.md`
- 建立 `workspaces/<name>/proposals/{active,completed,archived}/` 結構（含 `.gitkeep`）
- 建立 `workspaces/<name>/proposals/PROPOSAL_INDEX.md` 空殼
- 寫入 `.agents/CURRENT_WORKSPACE`
- 執行 `workspace-schema-validator` 驗證（失敗則完整回退）
- 更新本文件「當前已建立的 workspace」表格
- 熔斷檢查（tech-stacks 缺失自動警告 + 三選一 fallback）

### 方式二：AI 對話引導（適合需要解釋欄位意義）

1. 與 `@Lead` 互動：「啟動新專案 `<project_name>`」
2. `@Lead` 依 `.agents/tasks/project-onboarding-workflow.md` 6 步驟 SOP 逐欄引導
3. 完成後由 `@Lead` 執行 validator + 更新 `CURRENT_WORKSPACE`

### 方式三：手動（僅供非標準情境；⚠️ 容易遺漏）

1. 複製 `default_env.md` 為 `<project_name>.md`（snake_case 英文代號）
2. 填寫所有欄位；空白欄位須明確標注 `<not_applicable>`
3. 建立 `workspaces/<project_name>/proposals/{active,completed,archived}/` 目錄含 `.gitkeep`
4. 建立 `workspaces/<project_name>/proposals/PROPOSAL_INDEX.md` 空殼
5. 於 `.agents/CURRENT_WORKSPACE` 寫入 `<project_name>` 作為 active workspace
6. 執行 `python3 .agents/tests/workspace-schema-validator.py` 驗證
7. 手動更新本文件表格

⚠️ 手動方式容易遺漏 `.gitkeep` 或 `PROPOSAL_INDEX.md`；**建議使用方式一或二**。

詳細流程參考 `.agents/tasks/project-onboarding-workflow.md`。

## 切換 workspace

修改 `.agents/CURRENT_WORKSPACE` 內容即可；`@Lead` 每次啟動 Workflow 前重新讀取。

## 當前已建立的 workspace

| Workspace 名稱    | 對應專案                                                   | 狀態                  |
| ----------------- | ---------------------------------------------------------- | --------------------- |
| `default_env`     | （模板）                                                   | ⭕ 範本，不供執行使用 |
| `agent_framework` | Agent Framework Optimization（Multi-Agent 框架優化與維運） | ✅ Active             |

## 禁止行為

- **絕對禁止** 直接修改 `rules/*.md` 加入專案特定資訊（違反 Core Soul 原則）
- **絕對禁止** 在 workspace 檔內寫入程式碼或業務邏輯（僅保存環境變數）
- **絕對禁止** 跳過 `project-onboarding` 任務直接新建 workspace

## 缺失時的保守升級政策（依 PROPOSAL_20260422_001 + 002）

若 `CURRENT_WORKSPACE` 缺失或指向無效檔案：

1. `@Assistant` 巡邏 P-12 產生 🔴 `WORKSPACE_MISSING` 通知，阻斷新功能
2. `@Lead` 自動回退為最保守態度：**所有跨技術棧變更均升級 User**
3. User 執行 `project-onboarding` 或 `切換 workspace <project_name>` 解除阻斷
