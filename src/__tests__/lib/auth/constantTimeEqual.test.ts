import { describe, it, expect } from "vitest";
import { constantTimeEqual } from "@/lib/auth/constantTimeEqual";

describe("constantTimeEqual", () => {
  it("returns true for matching values", () => {
    expect(constantTimeEqual("super-secret-key", "super-secret-key")).toBe(true);
  });

  it("returns false for a wrong value of equal length", () => {
    expect(constantTimeEqual("super-secret-key", "super-secret-keZ")).toBe(false);
  });

  it("returns false for a wrong value of different length", () => {
    expect(constantTimeEqual("super-secret-key", "short")).toBe(false);
  });

  it("returns false when the env key is unset", () => {
    expect(constantTimeEqual("super-secret-key", undefined)).toBe(false);
  });

  it("returns false when the env key is an empty string", () => {
    expect(constantTimeEqual("super-secret-key", "")).toBe(false);
  });

  it("returns false when the provided token is empty", () => {
    expect(constantTimeEqual("", "super-secret-key")).toBe(false);
  });
});
