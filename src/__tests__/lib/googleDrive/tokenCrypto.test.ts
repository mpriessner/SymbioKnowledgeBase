import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, TokenDecryptError } from "@/lib/integrations/googleDrive/tokenCrypto";

const KEY_HEX = "b".repeat(64); // 32 bytes
const OTHER_KEY_HEX = "c".repeat(64);

describe("Google Drive token encryption (a71-12 AC8)", () => {
  it("round-trips a refresh token", () => {
    const plaintext = "1//0gRefreshTokenValueExample";
    const ciphertext = encryptToken(plaintext, KEY_HEX);

    expect(ciphertext).not.toContain(plaintext);
    expect(decryptToken(ciphertext, KEY_HEX)).toBe(plaintext);
  });

  it("stores as iv:authTag:ciphertext (three base64 segments), never plaintext", () => {
    const ciphertext = encryptToken("secret-refresh-token", KEY_HEX);
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
    }
    expect(ciphertext).not.toContain("secret-refresh-token");
  });

  it("uses a random IV per call (two encryptions of the same plaintext differ)", () => {
    const a = encryptToken("same-token", KEY_HEX);
    const b = encryptToken("same-token", KEY_HEX);
    expect(a).not.toBe(b);
  });

  it("throws TokenDecryptError (not a raw crypto error) on wrong key", () => {
    const ciphertext = encryptToken("secret", KEY_HEX);
    expect(() => decryptToken(ciphertext, OTHER_KEY_HEX)).toThrow(TokenDecryptError);
  });

  it("throws TokenDecryptError on tampered ciphertext", () => {
    const ciphertext = encryptToken("secret", KEY_HEX);
    const [iv, authTag, payload] = ciphertext.split(":");
    const tamperedBuf = Buffer.from(payload, "base64");
    tamperedBuf[0] ^= 0xff;
    const tampered = [iv, authTag, tamperedBuf.toString("base64")].join(":");

    expect(() => decryptToken(tampered, KEY_HEX)).toThrow(TokenDecryptError);
  });

  it("throws TokenDecryptError on malformed payload (wrong segment count)", () => {
    expect(() => decryptToken("not-a-valid-payload", KEY_HEX)).toThrow(TokenDecryptError);
  });
});
