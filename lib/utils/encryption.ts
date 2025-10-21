import crypto from "crypto";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Key should be 32 bytes (64 hex characters) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -hex 32"
    );
  }

  if (key.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32"
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Encrypt text content
 * Returns: iv:authTag:encryptedData (all in hex)
 *
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format "iv:authTag:encrypted"
 */
export function encryptContent(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted (all in hex)
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt content");
  }
}

/**
 * Decrypt encrypted content
 *
 * @param encrypted - Encrypted string in format "iv:authTag:encrypted"
 * @returns Decrypted plain text
 */
export function decryptContent(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encrypted.split(":");

    if (parts.length !== 3) {
      throw new Error("Invalid encrypted content format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt content");
  }
}

/**
 * Check if encryption is properly configured
 * @returns true if ENCRYPTION_KEY is set and valid
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a new encryption key
 * This is a helper function for setup - do not use in production code
 * @returns 32-byte hex string suitable for ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
