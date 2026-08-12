/**
 * errorStore.mjs
 * 錯誤儲存 - 使用 SQLite 持久化
 */

import Database from "better-sqlite3";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { mkdir } from "fs/promises";
import logger from "../../utils/logger.mjs";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const PROJECT_ROOT = resolve(__dirname, "../../../..");
const DB_PATH = resolve(PROJECT_ROOT, "data/monitoring/errors.db");

let db = null;

/**
 * 初始化資料庫
 */
async function initDb() {
  await mkdir(resolve(DB_PATH, ".."), { recursive: true });

  db = new Database(DB_PATH);

  // 建立錯誤表
  db.exec(`
    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT UNIQUE NOT NULL,
      message TEXT NOT NULL,
      stack TEXT,
      status_code INTEGER,
      request_url TEXT,
      request_method TEXT,
      request_body TEXT,
      count INTEGER DEFAULT 1,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    )
  `);

  // 建立索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_errors_hash ON errors(hash);
    CREATE INDEX IF NOT EXISTS idx_errors_last_seen ON errors(last_seen);
    CREATE INDEX IF NOT EXISTS idx_errors_status_code ON errors(status_code);
  `);

  logger.info({ dbPath: DB_PATH }, "Error store database initialized");
}

/**
 * 生成錯誤雜湊值 (用於去重)
 */
function generateErrorHash(error) {
  const parts = [
    error.message,
    error.statusCode || 500,
    error.request?.url || "",
    error.request?.method || "",
  ];
  // 簡單雜湊
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * 儲存錯誤
 */
export async function save(error) {
  if (!db) await initDb();

  const now = Date.now();
  const hash = generateErrorHash(error);

  const stmt = db.prepare(`
    INSERT INTO errors (hash, message, stack, status_code, request_url, request_method, request_body, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hash) DO UPDATE SET
      count = count + 1,
      last_seen = excluded.last_seen
  `);

  stmt.run(
    hash,
    error.message,
    error.stack || null,
    error.statusCode || 500,
    error.request?.url || null,
    error.request?.method || null,
    error.request?.body ? JSON.stringify(error.request.body) : null,
    now,
    now,
  );

  logger.debug({ hash, message: error.message }, "Error saved");
}

/**
 * 取得所有錯誤
 */
export async function getAll(limit = 100, offset = 0) {
  if (!db) await initDb();

  const stmt = db.prepare(`
    SELECT * FROM errors
    ORDER BY last_seen DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(limit, offset).map((row) => ({
    ...row,
    statusCode: row.status_code,
    requestBody: row.request_body ? JSON.parse(row.request_body) : null,
  }));
}

/**
 * 取得特定時間之後的錯誤
 */
export async function getSince(since, limit = 100) {
  if (!db) await initDb();

  const stmt = db.prepare(`
    SELECT * FROM errors
    WHERE last_seen >= ?
    ORDER BY last_seen DESC
    LIMIT ?
  `);

  return stmt.all(since, limit).map((row) => ({
    ...row,
    statusCode: row.status_code,
    requestBody: row.request_body ? JSON.parse(row.request_body) : null,
  }));
}

/**
 * 取得錯誤統計
 */
export async function getStats() {
  if (!db) await initDb();

  const totalStmt = db.prepare("SELECT COUNT(*) as total FROM errors");
  const statusStmt = db.prepare(`
    SELECT status_code, COUNT(*) as count
    FROM errors
    GROUP BY status_code
  `);
  const recentStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM errors
    WHERE last_seen >= ?
  `);

  const hourAgo = Date.now() - 3600000;
  const dayAgo = Date.now() - 86400000;

  const total = totalStmt.get().total;
  const byStatus = {};
  for (const row of statusStmt.all()) {
    byStatus[row.status_code] = row.count;
  }
  const lastHour = recentStmt.get(hourAgo).count;
  const lastDay = recentStmt.get(dayAgo).count;

  return {
    total,
    byStatus,
    lastHour,
    lastDay,
  };
}

/**
 * 清理舊錯誤 (保留指定天數)
 */
export async function cleanOld(days = 30) {
  if (!db) await initDb();

  const cutoff = Date.now() - days * 86400000;
  const stmt = db.prepare("DELETE FROM errors WHERE last_seen < ?");
  const result = stmt.run(cutoff);

  logger.info({ deleted: result.changes, days }, "Old errors cleaned");
  return result.changes;
}

/**
 * 清空所有錯誤 (測試用)
 */
export async function clear() {
  if (!db) await initDb();

  const stmt = db.prepare("DELETE FROM errors");
  stmt.run();

  logger.info("All errors cleared");
}

/**
 * 關閉資料庫
 */
export function close() {
  if (db) {
    db.close();
    db = null;
  }
}

export const errorStore = {
  save,
  getAll,
  getSince,
  getStats,
  cleanOld,
  clear,
  close,
};

export default errorStore;
