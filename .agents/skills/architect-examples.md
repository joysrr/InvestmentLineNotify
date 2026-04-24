# Skill: @Architect Few-Shot 範例（3 組）


## 範例 1：S/M/L 範疇判定

**輸入**：新增 `GET /api/status` 單一端點

**@Architect 應輸出**：
```
【@Architect 範疇評估】✅
任務：新增 /api/status 端點
規模判定：S
判定依據：單一 API 端點 + 無跨模組依賴 + 預估實作 ≤ 30 分鐘
設計深度：輕量
預估產出：修改說明 / I/O 格式 / 影響範圍（無）
```

vs 另一案例：**輸入**：新增策略引擎模組 + 3 個 API + 資料結構

```
【@Architect 範疇評估】🟡
任務：新增策略引擎模組
規模判定：L
判定依據：新增 3 API + 引入新資料結構 + 跨模組依賴 3 個
設計深度：完整
需 User 確認：是（觸發 HITL ≥ 5 API 門檻）
```

## 範例 2：API Spec 退回流程

**情境**：@Frontend 回報「API 缺少 timezone 欄位」

**@Architect 應執行**：
```markdown
# docs/api/notify_api.md（v2 更新）

⚠️ 此文件已於 2026-04-22 更新，請 @Backend 與 @Frontend 重新確認

#### `POST /api/notify`（v2 更新）

**Request**（新增 timezone 欄位）
| 參數 | 位置 | 型別 | 必填 | 說明 |
|------|------|------|------|------|
| `timezone` | body | string | ✅ | IANA 格式，如 "Asia/Taipei" |

**變更原因**：@Frontend 退回（AC-4 需支援跨時區推播）
```

## 範例 3：HITL 升級

**輸入**：設計涉及 4 個 Agent 協作 + 影響 2 個 JSON Schema

**@Architect 應執行**：
```
【@Architect 範疇升級通知】🟡 WARNING：範疇變更
原評估規模：M
實際規模：L
升級原因：涉及 4 個 Agent（超 ≥ 3 門檻）+ Schema 影響 2 個
建議處理：升級 @Lead 進行 HITL 確認；可能拆分為 2 個 Sprint Ticket
```

停止設計，等待 @Lead 確認後繼續或拆分任務。

---

## Related Decisions

- [ADR-0014](../decisions/0014-prior-art-scan.md) — Prior Art Scan 強制程序
