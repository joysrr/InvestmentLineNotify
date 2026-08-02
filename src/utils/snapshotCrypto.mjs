// snapshotCrypto.mjs
// AES-256-GCM 加解密模組，用於帳戶快照的加密存儲
// 僅在 SNAPSHOT_ENCRYPT_KEY 環境變數存在時才運作

import crypto from "crypto";
import logger from "./logger.mjs";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM 建議 12 bytes
const KEY_LENGTH = 32; // AES-256 需要 32 bytes

/**
 * 自定義錯誤類別
 */
class SnapshotCryptoError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "SnapshotCryptoError";
    this.cause = cause;
  }
}

/**
 * 從環境變數取得 key Buffer
 * @returns {Buffer|null}
 */
function getKeyBuffer() {
  const raw = process.env.SNAPSHOT_ENCRYPT_KEY;
  if (!raw) return null;

  const buf = Buffer.from(raw, "hex");
  if (buf.length !== KEY_LENGTH) {
    logger.warn(
      `[snapshotCrypto] SNAPSHOT_ENCRYPT_KEY 長度不正確 ` +
        `(應為 ${KEY_LENGTH * 2} 個 hex 字元，實際 ${raw.length})，略過快照加密`,
    );
    return null;
  }
  return buf;
}

/**
 * 驗證加密資料格式
 * @param {Object} encrypted
 * @throws {SnapshotCryptoError} 格式不正確時拋出錯誤
 */
function validateEncryptedFormat(encrypted) {
  if (!encrypted || typeof encrypted !== "object") {
    throw new SnapshotCryptoError("Invalid encrypted data: expected object", {
      received: encrypted,
    });
  }

  const { iv, tag, data } = encrypted;

  if (typeof iv !== "string" || !iv) {
    throw new SnapshotCryptoError(
      "Invalid encrypted data: missing or invalid 'iv' field",
    );
  }

  if (typeof tag !== "string" || !tag) {
    throw new SnapshotCryptoError(
      "Invalid encrypted data: missing or invalid 'tag' field",
    );
  }

  if (typeof data !== "string" || !data) {
    throw new SnapshotCryptoError(
      "Invalid encrypted data: missing or invalid 'data' field",
    );
  }

  // 驗證 hex 格式
  if (!/^[0-9a-fA-F]+$/.test(iv)) {
    throw new SnapshotCryptoError(
      "Invalid encrypted data: 'iv' is not valid hex",
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(tag)) {
    throw new SnapshotCryptoError(
      "Invalid encrypted data: 'tag' is not valid hex",
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(data)) {
    throw new SnapshotCryptoError(
      "Invalid encrypted data: 'data' is not valid hex",
    );
  }
}

/**
 * 加密帳戶快照物件
 * @param {Object} data - 要加密的快照資料
 * @returns {{ iv: string, tag: string, data: string } | null}
 *   成功回傳加密結果（hex 字串），金鑰不存在時回傳 null
 * @throws {SnapshotCryptoError} 加密失敗時拋出錯誤
 */
export function encryptSnapshot(data) {
  const key = getKeyBuffer();
  if (!key) return null;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const json = JSON.stringify(data);
    const encrypted = Buffer.concat([
      cipher.update(json, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      data: encrypted.toString("hex"),
    };
  } catch (err) {
    logger.error(`[snapshotCrypto] 加密失敗:`, err);
    throw new SnapshotCryptoError("Failed to encrypt snapshot", err);
  }
}

/**
 * 解密帳戶快照
 * @param {{ iv: string, tag: string, data: string }} encrypted - encryptSnapshot 的輸出
 * @returns {Object} 解密後的快照物件
 * @throws {SnapshotCryptoError} 格式驗證失敗或解密失敗時拋出錯誤
 */
export function decryptSnapshot(encrypted) {
  const key = getKeyBuffer();
  if (!key) {
    throw new SnapshotCryptoError(
      "Snapshot decryption disabled: SNAPSHOT_ENCRYPT_KEY not configured",
    );
  }

  // 輸入格式驗證
  validateEncryptedFormat(encrypted);

  try {
    const iv = Buffer.from(encrypted.iv, "hex");
    const tag = Buffer.from(encrypted.tag, "hex");
    const encData = Buffer.from(encrypted.data, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encData),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8"));
  } catch (err) {
    // 區分不同錯誤類型
    if (err instanceof SnapshotCryptoError) {
      throw err;
    }

    const errorMessage = err.message || String(err);
    logger.error(`[snapshotCrypto] 解密失敗:`, {
      error: errorMessage,
      ivLength: encrypted?.iv?.length,
      tagLength: encrypted?.tag?.length,
      dataLength: encrypted?.data?.length,
    });

    throw new SnapshotCryptoError(
      `Failed to decrypt snapshot: ${errorMessage}`,
      err,
    );
  }
}

/**
 * 判斷加密金鑰是否已設定且格式正確
 * @returns {boolean}
 */
export function isSnapshotEncryptEnabled() {
  return getKeyBuffer() !== null;
}
