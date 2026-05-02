---
skill_id: api-spec-template
file_type: skill
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_002
purpose: |
  @Architect API Spec Markdown 標準格式 + 存放路徑 + 格式規則。
  自 rules/architect.md §s06 搬入。
referenced_by:
  - rules/architect.md §s06
  - rules/backend.md（實作端參考）
  - rules/frontend.md（呼叫端參考）
---

# Skill: API Spec 產出規範

## 存放路徑

所有 API 規格文件統一存放於 `docs/api/`，命名規則：
`<模組名稱>_api.md`（例：`strategy_api.md`、`notify_api.md`）

## 標準格式

<!-- TEMPLATE_START: API Spec 條目 -->

#### `METHOD /路徑`

**用途**：<一句話說明此端點的功能>
**呼叫方**：Frontend / 排程任務 / 外部服務

**Request**
| 參數 | 位置 | 型別 | 必填 | 說明 |
|------|------|------|------|------|
| `paramName` | body/query/path | string/number/boolean | ✅/❌ | <說明> |

**Response（成功）**
| 欄位 | 型別 | 範例值 | 說明 |
|------|------|--------|------|
| `field` | string | `"example"` | <說明> |

**Response（失敗）**
| HTTP 狀態碼 | 錯誤情境 | 回傳訊息 |
|------------|---------|---------|
| 400 | <情境> | `{ "error": "<訊息>" }` |
| 500 | <情境> | `{ "error": "<訊息>" }` |

**備注**：<特殊限制或注意事項，若無則省略>

<!-- TEMPLATE_END -->

## 格式規則

- 禁止使用 `swagger.json`，維持 Markdown 格式以利版本控制閱讀
- 每次功能開發前 `@Architect` 必先建立或更新對應 `_api.md` → 再由 `@Backend` 實作
- 端點已存在但行為有變更 → 必在文件頂部標注：
  `⚠️ 此文件已於 <日期> 更新，請 @Backend 與 @Frontend 重新確認`

## 依賴審查阻斷模板

當需求引入新依賴但 `tech-stacks/` 缺對應規範時，`@Architect` 用此模板退回：

<!-- TEMPLATE_START: 依賴審查阻斷通知 -->

🚧 **架構設計阻斷通知**

**阻斷原因**：缺少 `<技術名稱>` 的 Tech Stack 規範
**影響的設計決策**：<說明這個技術缺失會影響哪個 API 或模組的設計>
**建議替代方案**：

- 方案 A（現有技術棧）：<用現有技術如何達成相同目標，若可行>
- 方案 B（補充規範）：請 User 在 `.agents/tech-stacks/` 建立 `<技術名稱>.md` 後重試

**等待 User 決策**：請選擇方案 A 或方案 B，或提供其他指示。

<!-- TEMPLATE_END -->

<!-- END: api-spec-template -->
