import { describe, it, expect } from "vitest";
import { createUserSchema, updateUserSchema } from "@/lib/validation/users";

describe("createUserSchema", () => {
  it("accepts valid user data with default role", () => {
    const result = createUserSchema.safeParse({
      name: "Dr. Lisa Chen",
      email: "lisa@example.com",
      password: "securepassword123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("USER");
    }
  });

  it("accepts valid user data with explicit ADMIN role", () => {
    const result = createUserSchema.safeParse({
      name: "Admin User",
      email: "admin@example.com",
      password: "securepassword123",
      role: "ADMIN",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("ADMIN");
    }
  });

  it("lowercases email", () => {
    const result = createUserSchema.safeParse({
      name: "User",
      email: "USER@EXAMPLE.COM",
      password: "securepassword123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid role", () => {
    const result = createUserSchema.safeParse({
      name: "User",
      email: "user@example.com",
      password: "securepassword123",
      role: "SUPERADMIN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createUserSchema.safeParse({
      name: "",
      email: "user@example.com",
      password: "securepassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createUserSchema.safeParse({
      name: "User",
      email: "not-an-email",
      password: "securepassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = createUserSchema.safeParse({
      name: "User",
      email: "user@example.com",
      password: "1234567",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("accepts name-only update", () => {
    const result = updateUserSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts role-only update", () => {
    const result = updateUserSchema.safeParse({ role: "ADMIN" });
    expect(result.success).toBe(true);
  });

  it("accepts both name and role update", () => {
    const result = updateUserSchema.safeParse({
      name: "New Name",
      role: "USER",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid role value", () => {
    const result = updateUserSchema.safeParse({ role: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name string", () => {
    const result = updateUserSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
