import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey } from "@/lib/apiAuth";

describe("generateApiKey", () => {
  it("generates a key with the correct prefix", () => {
    const { rawKey } = generateApiKey();
    expect(rawKey).toMatch(/^skb_live_[a-f0-9]{64}$/);
  });

  it("generates unique keys on each call", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.rawKey).not.toBe(key2.rawKey);
    expect(key1.keyHash).not.toBe(key2.keyHash);
  });

  it("generates a key hash that is a valid SHA-256 hex string", () => {
    const { keyHash } = generateApiKey();
    expect(keyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates the correct hash for the generated key", () => {
    const { rawKey, keyHash } = generateApiKey();
    const recomputedHash = hashApiKey(rawKey);
    expect(recomputedHash).toBe(keyHash);
  });
});

describe("hashApiKey", () => {
  it("produces deterministic SHA-256 hashes", () => {
    const key =
      "skb_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different keys", () => {
    const hash1 = hashApiKey("skb_live_key1");
    const hash2 = hashApiKey("skb_live_key2");
    expect(hash1).not.toBe(hash2);
  });

  it("produces a 64-character hex string", () => {
    const hash = hashApiKey("any-input");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
