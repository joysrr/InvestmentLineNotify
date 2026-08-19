#!/usr/bin/env bash
# collect-real-report.sh
# 每個交易日執行真實 provider 資料收集，保留本地報告與 provenance，
# 停用 Telegram / Google Sheets / AI 外部副作用。
# 平時 silent（ stdout 無輸出）；失敗或達門檻時輸出到 stdout → 通知 Han。
# 參考計畫：docs/plans/active/CORE_LOGIC_VALIDATION_PLAN.md §14

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/workspace/projects/InvestmentLineNotify}"
REPORT_DIR="${PROJECT_DIR}/data/reports"
LOG_DIR="${PROJECT_DIR}/logs/replay-accumulation"
mkdir -p "${LOG_DIR}" "${REPORT_DIR}"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOG_FILE="${LOG_DIR}/run-${TIMESTAMP}.log"

log() { echo "[$(date -u +%FT%TZ)] $1" >> "${LOG_FILE}"; }

log "開始 replay 資料收集"
cd "${PROJECT_DIR}"

# 執行 dailyCheck，停用所有外部副作用
NODE_ENV=test BYPASS_INIT_DATA=true \
  node src/runDailyCheck.mjs --no-ai --no-telegram --no-sheets \
  >> "${LOG_FILE}" 2>&1 || EXIT_CODE=$?

EXIT_CODE=${EXIT_CODE:-0}
log "dailyCheck exit code: ${EXIT_CODE}"

if [ "${EXIT_CODE}" -ne 0 ]; then
  # 失敗時通知 Han
  echo "❌ replay 資料收集失敗 (${TIMESTAMP})"
  echo "exit code: ${EXIT_CODE}"
  echo "log: ${LOG_FILE}"
  exit "${EXIT_CODE}"
fi

# 只計算具備 replay 的真實報告；legacy JSON 不得觸發門檻通知。
REPORT_COUNT=$(REPORT_DIR="${REPORT_DIR}" python3 - <<'PY'
import json
import os
from pathlib import Path

count = 0
for path in sorted(Path(os.environ["REPORT_DIR"]).glob("*.json")):
    try:
        report = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        continue
    if isinstance(report.get("replay"), dict):
        count += 1
print(count)
PY
)

log "目前累積真實報告數量: ${REPORT_COUNT}"
log "--- 報告清單 ---"
ls -1 "${REPORT_DIR}"/*.json 2>/dev/null | sort >> "${LOG_FILE}"
log "----------------"

# 門檻通知（只在此時輸出到 stdout）
if [ "${REPORT_COUNT}" -ge 10 ]; then
  echo "🎯 達成 10 個真實交易日報告！"
  echo "可以開始正式 production replay 驗證。"
  echo "請繼續執行 CORE_LOGIC_VALIDATION_PLAN §14 的正式 replay 隗段。"
elif [ "${REPORT_COUNT}" -ge 5 ]; then
  echo "✅ 達成 5 個真實交易日報告。"
  echo "建議執行第一次 schema/provenance audit。"
  echo "目前累積: ${REPORT_COUNT}/10"
fi

# 未達門檻：stdout 空 → silent
log "資料收集完成"
