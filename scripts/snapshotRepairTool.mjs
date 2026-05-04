/**
 * snapshotRepairTool.mjs
 * 帳戶快照手動修正工具
 *
 * 使用方式：
 *   node scripts/snapshotRepairTool.mjs decrypt  <encrypted.json
 *   node scripts/snapshotRepairTool.mjs encrypt   <plaintext.json
 *   node scripts/snapshotRepairTool.mjs roundtrip <encrypted.json  (解密後立即重新加密，驗證金鑰是否正確)
 *
 * 環境變數：
 *   SNAPSHOT_ENCRYPT_KEY  — 64 個 hex 字元 (32 bytes AES-256 金鑰)
 *
 * 範例（Linux / macOS）：
 *   export SNAPSHOT_ENCRYPT_KEY=<your_key>
 *   # 1. 從 DB 取出錯誤快照，貼到 bad.json
 *   # 2. 解密 → 修正 → 再加密
 *   node scripts/snapshotRepairTool.mjs decrypt  < bad.json       > plain.json
 *   node scripts/snapshotRepairTool.mjs encrypt  < plain.json     > fixed.json
 *   # 3. 把 fixed.json 的內容回填到 DB
 *
 * 注意：
 *   - 本工具僅供一次性手動修正使用，請勿加入自動化 CI 流程
 *   - 執行完畢後請從本機刪除 plain.json（明文敏感資料）
 */

import { encryptSnapshot, decryptSnapshot, isSnapshotEncryptEnabled } from '../src/utils/snapshotCrypto.mjs';
import { createInterface } from 'readline';

// ── 讀取 stdin 直到 EOF ──
async function readStdin() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const lines = [];
  for await (const line of rl) {
    lines.push(line);
  }
  return lines.join('\n').trim();
}

// ── 輸出結果到 stdout（純 JSON，方便 pipe） ──
function outputJSON(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

// ── 錯誤輸出到 stderr（不汙染 stdout pipe） ──
function err(msg) {
  process.stderr.write(`[snapshotRepairTool] ERROR: ${msg}\n`);
  process.exit(1);
}

function info(msg) {
  process.stderr.write(`[snapshotRepairTool] ${msg}\n`);
}

// ── 主程式 ──
async function main() {
  const mode = process.argv[2];

  if (!['decrypt', 'encrypt', 'roundtrip'].includes(mode)) {
    process.stderr.write([
      '用法：',
      '  node scripts/snapshotRepairTool.mjs decrypt   <encrypted.json',
      '  node scripts/snapshotRepairTool.mjs encrypt   <plaintext.json',
      '  node scripts/snapshotRepairTool.mjs roundtrip <encrypted.json',
      '',
      '環境變數 SNAPSHOT_ENCRYPT_KEY 必須設定（64 個 hex 字元）',
    ].join('\n') + '\n');
    process.exit(1);
  }

  // 金鑰檢查
  if (!isSnapshotEncryptEnabled()) {
    err('SNAPSHOT_ENCRYPT_KEY 未設定或格式不正確，請先設定環境變數後再執行');
  }

  // 讀取 stdin
  const raw = await readStdin();
  if (!raw) {
    err('stdin 為空，請透過 pipe 或 redirect 提供輸入資料');
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    err(`stdin 不是合法的 JSON：${e.message}`);
  }

  // ── decrypt 模式 ──
  if (mode === 'decrypt') {
    info('模式：解密');
    info(`輸入欄位：${Object.keys(parsed).join(', ')}`);

    if (!parsed.iv || !parsed.tag || !parsed.data) {
      err('輸入格式不正確，應包含 iv / tag / data 三個欄位');
    }

    let plain;
    try {
      plain = decryptSnapshot(parsed);
    } catch (e) {
      err(`解密失敗：${e.message}`);
    }

    info('解密成功，輸出明文 JSON（stdout）');
    outputJSON(plain);
    return;
  }

  // ── encrypt 模式 ──
  if (mode === 'encrypt') {
    info('模式：加密');
    info(`輸入欄位：${Object.keys(parsed).join(', ')}`);

    let encrypted;
    try {
      encrypted = encryptSnapshot(parsed);
    } catch (e) {
      err(`加密失敗：${e.message}`);
    }

    if (!encrypted) {
      err('encryptSnapshot 回傳 null，金鑰設定可能有問題');
    }

    info('加密成功，輸出加密 JSON（stdout）');
    outputJSON(encrypted);
    return;
  }

  // ── roundtrip 模式：解密後立即重新加密，驗證金鑰可用 ──
  if (mode === 'roundtrip') {
    info('模式：roundtrip（解密 → 重新加密）');

    if (!parsed.iv || !parsed.tag || !parsed.data) {
      err('輸入格式不正確，應包含 iv / tag / data 三個欄位');
    }

    let plain;
    try {
      plain = decryptSnapshot(parsed);
    } catch (e) {
      err(`解密失敗：${e.message}`);
    }
    info('解密成功');

    let reEncrypted;
    try {
      reEncrypted = encryptSnapshot(plain);
    } catch (e) {
      err(`重新加密失敗：${e.message}`);
    }
    info('重新加密成功，輸出新加密 JSON（stdout）');
    outputJSON(reEncrypted);
    return;
  }
}

main().catch((e) => {
  process.stderr.write(`[snapshotRepairTool] 未預期的錯誤：${e.message}\n`);
  process.exit(1);
});
