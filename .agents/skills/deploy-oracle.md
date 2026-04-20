# Skill: Deploy to Oracle VM
# Oracle VM 部署操作手冊

> 本文件定義每次後端變更後的標準部署流程。
> `@Backend` 產出部署指令清單時必須參照此格式。
> 實際執行由 User 在 Oracle VM 上操作。

## 部署指令清單標準格式

<!-- TEMPLATE_START: 部署指令清單 -->
### 部署指令清單 - <功能名稱> (<日期>)

**變更摘要**：<一句話說明本次變更內容>
**影響範圍**：`src/<模組路徑>`
**預計停機時間**：< 1 分鐘 / 無停機

#### Step 1：拉取最新程式碼
```bash
cd ~/InvestmentLineNotify
git pull origin main
```

#### Step 2：安裝/更新依賴（僅當 package.json 有變更時執行）
```bash
npm install --production
```

#### Step 3：重啟受影響的 PM2 Process
```bash
# 重啟特定 process（優先使用，避免影響其他服務）
pm2 restart iln-<process名稱>

# 若多個 process 受影響
pm2 restart iln-api iln-scheduler
```

#### Step 4：確認服務狀態
```bash
pm2 status
pm2 logs iln-<process名稱> --lines 20
```

#### Step 5：Nginx Reload（僅當 Nginx 設定有變更時執行）
```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### 驗證清單
- [ ] `pm2 status` 顯示所有 process 為 `online`
- [ ] 最新 log 無 ERROR 級別訊息
- [ ] 核心功能手動測試通過（例如：發送一則測試通知）

#### 回滾指令（若部署後發現問題）
```bash
git log --oneline -5        # 確認要回滾到哪個 commit
git revert HEAD             # 建立回滾 commit
pm2 restart iln-<process名稱>
```
<!-- TEMPLATE_END -->

## 環境變數管理
- 新增環境變數時，必須同步更新 Oracle VM 上的 `.env` 檔案
- `.env` 檔案不在版本控制中，須手動同步
- 標準操作：
```bash
nano ~/InvestmentLineNotify/.env
# 新增變數後儲存，再重啟對應 process
pm2 restart iln-<process名稱>
```

## PM2 常用指令參考
| 指令 | 用途 |
|------|------|
| `pm2 status` | 查看所有 process 狀態 |
| `pm2 logs <name>` | 即時查看 log |
| `pm2 restart <name>` | 重啟特定 process |
| `pm2 save` | 儲存當前 process 列表（開機自啟用） |
| `pm2 startup` | 設定開機自動啟動 |

<!-- 
  維護說明：當部署流程有變更時（例如新增 process、改變目錄結構），
  由 @Backend 提案更新此文件，並通知 @Lead 更新 Skills Mapping。
-->