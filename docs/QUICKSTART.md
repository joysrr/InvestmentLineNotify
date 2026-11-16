# QUICKSTART — 30 秒上手

```bash
cd /root/work/InvestmentLineNotify/webapp

npm run ui:verify      # 驗證當前狀態（預期 7/7 ok）
# ... 改 src/ 下任何檔案 ...
npm run ui:verify      # 再驗證
cat .agent-report/latest/REPORT.md

npm run ui:push        # 全綠 → 交付
npm run ui:rollback    # 有回歸 → 回滾
```

完整手冊：`AGENT-UI-HANDBOOK.md`

## 四種狀態

| 狀態 | 意義 | 動作 |
|---|---|---|
| `ok` | 與基準一致 | 繼續 |
| `changed` | 差異 < 2% | 可接受 |
| `regressed` | 差異 > 2% 或有新 error | 修或回滾 |
| `!error` | 找不到基準 | 先 ui:baseline |
