import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validation/auth";

describe("registerSchema", () => {
  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse({
      name: "Dr. Lisa Chen",
      email: "lisa@example.com",
      password: "securepassword123",
    });
    expect(result.success).toBe(true);
  });

  it("trims and lowercases email", () => {
    const result = registerSchema.safeParse({
      name: "Lisa",
      email: "  LISA@Example.COM  ",
      password: "securepassword123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("lisa@example.com");
    }
  });

  it("rejects empty name", () => {
    const result = registerSchema.safeParse({
      name: "",
      email: "lisa@example.com",
      password: "securepassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = registerSchema.safeParse({
      name: "A".repeat(101),
      email: "lisa@example.com",
      password: "securepassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = registerSchema.safeParse({
      name: "Lisa",
      email: "not-an-email",
      password: "securepassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      name: "Lisa",
      email: "lisa@example.com",
      password: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password longer than 128 characters", () => {
    const result = registerSchema.safeParse({
      name: "Lisa",
      email: "lisa@example.com",
      password: "A".repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({
      email: "lisa@example.com",
      password: "securepassword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "lisa@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "invalid",
      password: "securepassword123",
    });
    expect(result.success).toBe(false);
  });
});
