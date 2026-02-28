/**
 * Tests for lib/utils/encryption.ts
 * AES-256-GCM symmetric encryption utilities
 *
 * NOTE: encryptContent and decryptContent wrap all internal errors as
 * "Failed to encrypt content" / "Failed to decrypt content" — so tests
 * assert on the wrapper message, not the original ENCRYPTION_KEY error.
 */

// @jest-environment node

import {
  encryptContent,
  decryptContent,
  isEncryptionConfigured,
  generateEncryptionKey,
} from "@/lib/utils/encryption";

const VALID_KEY = "a".repeat(64); // 64 hex chars = 32 bytes, valid for AES-256

describe("encryption utilities", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalKey;
    }
  });

  // ── encryptContent ───────────────────────────────────────────────────────

  describe("encryptContent", () => {
    it("returns a string in iv:authTag:encrypted format (3 hex parts)", () => {
      const result = encryptContent("hello world");
      const parts = result.split(":");
      expect(parts).toHaveLength(3);
      // Each part must be non-empty hex
      parts.forEach((part) => {
        expect(part).toMatch(/^[0-9a-f]+$/i);
      });
    });

    it("IV part is 32 hex chars (16 bytes)", () => {
      const result = encryptContent("test");
      const iv = result.split(":")[0];
      expect(iv).toHaveLength(32);
    });

    it("authTag part is 32 hex chars (16 bytes)", () => {
      const result = encryptContent("test");
      const authTag = result.split(":")[1];
      expect(authTag).toHaveLength(32);
    });

    it("encrypting the same text twice produces different ciphertexts (random IV)", () => {
      const a = encryptContent("same text");
      const b = encryptContent("same text");
      expect(a).not.toBe(b);
    });

    it("can encrypt empty string", () => {
      const result = encryptContent("");
      expect(result.split(":")).toHaveLength(3);
    });

    it("can encrypt unicode / emoji content", () => {
      const result = encryptContent("こんにちは 🔐");
      expect(result.split(":")).toHaveLength(3);
    });

    it("throws when ENCRYPTION_KEY is not set", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encryptContent("hello")).toThrow("Failed to encrypt content");
    });

    it("throws when ENCRYPTION_KEY is too short (wrong length)", () => {
      process.env.ENCRYPTION_KEY = "abc123"; // only 6 chars, not 64
      expect(() => encryptContent("hello")).toThrow("Failed to encrypt content");
    });

    it("throws when ENCRYPTION_KEY is too long (wrong length)", () => {
      process.env.ENCRYPTION_KEY = "a".repeat(65); // 65 chars, not 64
      expect(() => encryptContent("hello")).toThrow("Failed to encrypt content");
    });

    it("throws when ENCRYPTION_KEY is exactly 63 chars (boundary)", () => {
      process.env.ENCRYPTION_KEY = "a".repeat(63);
      expect(() => encryptContent("hello")).toThrow("Failed to encrypt content");
    });
  });

  // ── decryptContent ───────────────────────────────────────────────────────

  describe("decryptContent", () => {
    it("round-trips: decryptContent(encryptContent(text)) === text", () => {
      const plaintext = "hello";
      expect(decryptContent(encryptContent(plaintext))).toBe(plaintext);
    });

    it("round-trips longer text with special chars", () => {
      const plaintext = 'Company: "Acme & Sons"\nRole: Senior Engineer\tPay: $120k';
      expect(decryptContent(encryptContent(plaintext))).toBe(plaintext);
    });

    it("round-trips empty string", () => {
      expect(decryptContent(encryptContent(""))).toBe("");
    });

    it("round-trips unicode text", () => {
      const plaintext = "日本語テスト 🎉";
      expect(decryptContent(encryptContent(plaintext))).toBe(plaintext);
    });

    it("throws on tampered ciphertext (flipped byte in encrypted data)", () => {
      const encrypted = encryptContent("sensitive data");
      const parts = encrypted.split(":");
      // Flip the first byte of the encrypted payload (part[2])
      const badHex =
        (parseInt(parts[2].slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, "0") +
        parts[2].slice(2);
      const tampered = `${parts[0]}:${parts[1]}:${badHex}`;
      expect(() => decryptContent(tampered)).toThrow("Failed to decrypt content");
    });

    it("throws on tampered auth tag", () => {
      const encrypted = encryptContent("sensitive data");
      const parts = encrypted.split(":");
      // Flip first byte of authTag
      const badTag =
        (parseInt(parts[1].slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, "0") +
        parts[1].slice(2);
      const tampered = `${parts[0]}:${badTag}:${parts[2]}`;
      expect(() => decryptContent(tampered)).toThrow("Failed to decrypt content");
    });

    it("throws on invalid format (missing parts)", () => {
      expect(() => decryptContent("onlyonepart")).toThrow("Failed to decrypt content");
    });

    it("throws on invalid format (only two parts)", () => {
      expect(() => decryptContent("abc:def")).toThrow("Failed to decrypt content");
    });

    it("throws when ENCRYPTION_KEY is not set", () => {
      const encrypted = encryptContent("hello");
      delete process.env.ENCRYPTION_KEY;
      expect(() => decryptContent(encrypted)).toThrow("Failed to decrypt content");
    });

    it("throws when decrypting with a different key", () => {
      const encrypted = encryptContent("hello");
      process.env.ENCRYPTION_KEY = "b".repeat(64); // different valid key
      expect(() => decryptContent(encrypted)).toThrow("Failed to decrypt content");
    });
  });

  // ── isEncryptionConfigured ────────────────────────────────────────────────

  describe("isEncryptionConfigured", () => {
    it("returns true when ENCRYPTION_KEY is valid", () => {
      expect(isEncryptionConfigured()).toBe(true);
    });

    it("returns false when ENCRYPTION_KEY is not set", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
    });

    it("returns false when ENCRYPTION_KEY has wrong length", () => {
      process.env.ENCRYPTION_KEY = "tooshort";
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  // ── generateEncryptionKey ─────────────────────────────────────────────────

  describe("generateEncryptionKey", () => {
    it("returns a 64-character hex string", () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it("returns a different key each time (random)", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });

    it("generated key can be used for encryption/decryption", () => {
      const key = generateEncryptionKey();
      process.env.ENCRYPTION_KEY = key;
      const plaintext = "test with generated key";
      expect(decryptContent(encryptContent(plaintext))).toBe(plaintext);
    });
  });
});
