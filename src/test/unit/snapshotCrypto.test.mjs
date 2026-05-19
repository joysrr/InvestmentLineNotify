import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  encryptSnapshot,
  decryptSnapshot,
  isSnapshotEncryptEnabled,
} from "../../utils/snapshotCrypto.mjs";
import crypto from "crypto";
import logger from "../../utils/logger.mjs";

describe("snapshotCrypto (P0)", () => {
  const mockKey = crypto.randomBytes(32).toString("hex");
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("應能正確加密與解密物件且往返一致", () => {
    process.env.SNAPSHOT_ENCRYPT_KEY = mockKey;
    const testData = { a: 1, b: "hello", c: [1, 2, 3] };

    expect(isSnapshotEncryptEnabled()).toBe(true);

    const encrypted = encryptSnapshot(testData);
    expect(encrypted).not.toBeNull();
    expect(encrypted).toHaveProperty("iv");
    expect(encrypted).toHaveProperty("tag");
    expect(encrypted).toHaveProperty("data");

    const decrypted = decryptSnapshot(encrypted);
    expect(decrypted).toEqual(testData);
  });

  it("當 key 長度錯誤時應視為未配置，返回 null 或拋錯", () => {
    process.env.SNAPSHOT_ENCRYPT_KEY = "1234"; // Invalid length
    const testData = { a: 1 };

    expect(isSnapshotEncryptEnabled()).toBe(false);

    // encryptSnapshot returns null if key is invalid
    const encrypted = encryptSnapshot(testData);
    expect(encrypted).toBeNull();

    // decryptSnapshot throws if key is invalid/missing
    expect(() =>
      decryptSnapshot({ iv: "123", tag: "123", data: "123" }),
    ).toThrow(/SNAPSHOT_ENCRYPT_KEY not configured/);
  });

  it("當 key 為 null 時應視為未配置", () => {
    delete process.env.SNAPSHOT_ENCRYPT_KEY;
    const testData = { a: 1 };

    expect(isSnapshotEncryptEnabled()).toBe(false);

    const encrypted = encryptSnapshot(testData);
    expect(encrypted).toBeNull();

    expect(() =>
      decryptSnapshot({ iv: "123", tag: "123", data: "123" }),
    ).toThrow(/SNAPSHOT_ENCRYPT_KEY not configured/);
  });

  it("解密時若格式錯誤應拋出 SnapshotCryptoError", () => {
    process.env.SNAPSHOT_ENCRYPT_KEY = mockKey;
    expect(() => decryptSnapshot(null)).toThrow(
      /Invalid encrypted data: expected object/,
    );
    expect(() =>
      decryptSnapshot({ iv: "invalid-hex", tag: "aa", data: "bb" }),
    ).toThrow(/Invalid encrypted data: 'iv' is not valid hex/);
    expect(() =>
      decryptSnapshot({ iv: "aa", tag: "invalid-hex", data: "bb" }),
    ).toThrow(/Invalid encrypted data: 'tag' is not valid hex/);
  });
});
