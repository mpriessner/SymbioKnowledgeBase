import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

describe("Password hashing", () => {
  it("hashes and verifies password correctly", async () => {
    const password = "securepassword123";
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);

    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const password = "securepassword123";
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare("wrongpassword", hash);
    expect(isValid).toBe(false);
  });

  it("uses cost factor 10", async () => {
    const hash = await bcrypt.hash("test", 10);
    // bcrypt hash format: $2a$<cost>$<salt+hash>
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });
});
