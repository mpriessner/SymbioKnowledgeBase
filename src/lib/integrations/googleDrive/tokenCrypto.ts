import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { decodeTokenEncKey } from "./config";

/**
 * Authenticated encryption (AES-256-GCM) for the Drive OAuth refresh token
 * at rest. SKB's only existing secret-storage precedent (`apiAuth.ts`) is
 * one-way SHA-256/bcrypt hashing, which cannot be decrypted and is useless
 * for a refresh token that must be reused — hence this dedicated module.
 *
 * Stored format: `<iv_b64>:<authTag_b64>:<ciphertext_b64>` — a random 12-byte
 * IV per record (never reused), plus the GCM auth tag alongside the
 * ciphertext so tampering is detected on decrypt.
 *
 * Key rotation path: `DRIVE_TOKEN_ENC_KEY` is a single server-held key. To
 * rotate, decrypt all rows with the old key and re-encrypt with the new key
 * in a migration script before swapping the env var — there is no per-record
 * key id in v1, so a rotation must be a full re-encrypt pass, not a live cutover.
 */

const IV_LENGTH = 12; // recommended nonce size for GCM
const ALGORITHM = "aes-256-gcm";

export class TokenDecryptError extends Error {
  constructor(message = "Failed to decrypt stored token") {
    super(message);
    this.name = "TokenDecryptError";
  }
}

export function encryptToken(plaintext: string, rawKey: string): string {
  const key = decodeTokenEncKey(rawKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a stored token. Throws {@link TokenDecryptError} (never a raw
 * crypto error) on any failure — malformed payload, wrong key (e.g. after an
 * un-migrated key rotation), or tampering — so callers can uniformly treat
 * decrypt failure as "connection invalid, reconnect needed" rather than an
 * unhandled exception surfacing into the UI.
 */
export function decryptToken(payload: string, rawKey: string): string {
  try {
    const key = decodeTokenEncKey(rawKey);
    const parts = payload.split(":");
    if (parts.length !== 3) {
      throw new Error("Malformed token payload");
    }
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new TokenDecryptError();
  }
}
