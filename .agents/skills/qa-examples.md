# Skill: @QA Few-Shot 範例（3 組）


## 範例 1：邊界值測試設計

**輸入**：RSI 計算函式 `calculateRSI(prices)`

**@QA 應產出 TEST_SPEC**：
```markdown
📋 TEST_SPEC: RSI 計算

| TC | 輸入 | 預期 | 優先級 |
|----|------|-----|-------|
| TC-01 | 正常價格序列（14 日）| 介於 0~100 | P0 |
| TC-02 | 空陣列 `[]` | 拋 `Error('insufficient data')` | P0 |
| TC-03 | 全同值 `[100,100,...]` | 50（除零防護）| P0 |
| TC-04 | 含 `NaN` | 拋 `Error('invalid input')` | P0 |
| TC-05 | 極端上漲 `[1,2,...,100]` | 接近 100 | P1 |
| TC-06 | 極端下跌 `[100,99,...,1]` | 接近 0 | P1 |
```

## 範例 2：靜默失敗偵測

**情境**：Telegram Bot 發送訊息，API 回 200 但訊息未送達

**@QA 應執行**：
```javascript
test('推送後需確認實際送達', async () => {
 const result = await sendNotification('test');
 assert.strictEqual(result.status, 'sent');

 // 關鍵：確認 bot.getChat 有實際互動紀錄
 const chat = await bot.telegram.getChat(CHAT_ID);
 assert.ok(chat.last_message_date > Date.now() - 5000);
});
```

**違規判定**：僅檢查 API 回應狀態而不驗證實際送達 → 標 🔴 靜默失敗風險。

## 範例 3：排程觸發驗證

**情境**：驗證 `runDailyCheck` cron 每日 08:00 確實執行

**@QA 應產出**：
```javascript
test('Daily check 排程觸發驗證', async () => {
 // 1. 讀取過去 7 日的執行日誌
 const logs = await readSchedulerLogs(7);
 const dailyCheckLogs = logs.filter(l => l.task === 'runDailyCheck');

 // 2. 斷言：每日至少 1 次
 assert.strictEqual(dailyCheckLogs.length, 7, '7 日應有 7 次執行');

 // 3. 斷言：每次執行時間在 08:00 ± 5 分鐘
 dailyCheckLogs.forEach(log => {
 const hour = new Date(log.timestamp).getHours();
 assert.ok(hour === 8, `觸發時間異常：${log.timestamp}`);
 });
});
```

---

## Related Decisions

- [ADR-0013](../decisions/0013-dod-self-audit.md) — DoD 自評 + Gate Check
