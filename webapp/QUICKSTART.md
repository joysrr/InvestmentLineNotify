# QUICKSTART — 30 秒上手

```bash
cd /root/work/InvestmentLineNotify/webapp

npm run ui:verify      # 驗證：對比 origin/main + production build
# ... 改 src/ 下任何檔案 ...
npm run ui:verify      # 再驗證
npm run ui:report      # 看報告

npm run ui:push        # 驗證通過 → commit → push 到 GitHub main
npm run ui:rollback    # 有問題 → 回滾 webapp/src
```

完整手冊：`AGENT-UI-HANDBOOK.md`

## 四種狀態

| 狀態 | 意義 | 動作 |
|---|---|---|
| `build ✓` | production build 通過 | 可交付 |
| `lint ⚠` | lint 有問題（不阻斷） | 有空再修 |
| `build ✗` | build 失敗 | **必須修，不能 push** |
| `!error` | 找不到 origin/main | 先 `git fetch origin` |

## 與舊版的差異

- **不再用像素截圖比對**（記憶體不足，chromium 啟動即 OOM）
- **基準 = GitHub origin/main**，不是本地 `.agent-baseline/`
- **交付 = git push**，不是 rsync 到 /sdcard
- 像素驗證仍保留為 `npm run ui:verify:pixel`，環境寬裕時可用
