// snapshotCrypto.mjs
// AES-256-GCM 加解密模組，用於帳戶快照的加密存儲
// 僅在 SNAPSHOT_ENCRYPT_KEY 環境變數存在時才運作

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // GCM 建議 12 bytes
const KEY_LENGTH = 32;  // AES-256 需要 32 bytes

/**
 * 從環境變數取得 key Buffer
 * @returns {Buffer|null}
 */
function getKeyBuffer() {
  const raw = process.env.SNAPSHOT_ENCRYPT_KEY;
  if (!raw) return null;

  const buf = Buffer.from(raw, "hex");
  if (buf.length !== KEY_LENGTH) {
    console.warn(
      `⚠️ [snapshotCrypto] SNAPSHOT_ENCRYPT_KEY 長度不正確 ` +
      `(應為 ${KEY_LENGTH * 2} 個 hex 字元，實際 ${raw.length})，略過快照加密`
    );
    return null;
  }
  return buf;
}

/**
 * 加密帳戶快照物件
 * @param {Object} data - 要加密的快照資料
 * @returns {{ iv: string, tag: string, data: string } | null}
 *   成功回傳加密結果（hex 字串），金鑰不存在時回傳 null
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
    console.error("❌ [snapshotCrypto] 加密失敗:", err.message);
    return null;
  }
}

/**
 * 解密帳戶快照
 * @param {{ iv: string, tag: string, data: string }} encrypted - encryptSnapshot 的輸出
 * @returns {Object | null} 解密後的快照物件，失敗時回傳 null
 */
export function decryptSnapshot(encrypted) {
  const key = getKeyBuffer();
  if (!key) return null;

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
    console.error("❌ [snapshotCrypto] 解密失敗:", err.message);
    return null;
  }
}

/**
 * 判斷加密金鑰是否已設定且格式正確
 * @returns {boolean}
 */
export function isSnapshotEncryptEnabled() {
  return getKeyBuffer() !== null;
}
