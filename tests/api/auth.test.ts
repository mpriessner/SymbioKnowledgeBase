import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

describe("POST /api/auth/register", () => {
  afterAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: { email: { startsWith: "test-auth-" } },
    });
    await prisma.tenant.deleteMany({
      where: { name: { startsWith: "test-auth-" } },
    });
  });

  it("creates a new user and tenant", async () => {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-auth-user",
        email: "test-auth-register@example.com",
        password: "securepassword123",
      }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    expect(body.data.email).toBe("test-auth-register@example.com");
    expect(body.data.name).toBe("test-auth-user");
    expect(body.data.role).toBe("USER");
    expect(body.data.tenantId).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();

    // Verify password is NOT in the response
    expect(body.data.password).toBeUndefined();
    expect(body.data.passwordHash).toBeUndefined();
  });

  it("returns 409 for duplicate email", async () => {
    // Register first
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-auth-dup",
        email: "test-auth-duplicate@example.com",
        password: "securepassword123",
      }),
    });

    // Try to register again with the same email
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-auth-dup-2",
        email: "test-auth-duplicate@example.com",
        password: "anotherpassword123",
      }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 400 for invalid input", async () => {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: "not-an-email",
        password: "short",
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it("stores password as bcrypt hash, not plaintext", async () => {
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-auth-hash",
        email: "test-auth-hashcheck@example.com",
        password: "securepassword123",
      }),
    });

    const user = await prisma.user.findFirst({
      where: { email: "test-auth-hashcheck@example.com" },
    });

    expect(user).toBeDefined();
    expect(user!.passwordHash).not.toBe("securepassword123");
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$10\$/);
  });
});

describe("POST /api/auth/callback/credentials (login)", () => {
  beforeAll(async () => {
    // Register a user for login tests
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test-auth-login",
        email: "test-auth-login@example.com",
        password: "securepassword123",
      }),
    });
  });

  it("returns a session token on valid credentials", async () => {
    const response = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-auth-login@example.com",
          password: "securepassword123",
        }),
        redirect: "manual",
      }
    );

    // NextAuth redirects on success
    const setCookie = response.headers.get("set-cookie");
    expect(
      setCookie?.includes("next-auth.session-token") ||
        setCookie?.includes("__Secure-next-auth.session-token")
    ).toBe(true);
  });

  it("rejects invalid password", async () => {
    const response = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-auth-login@example.com",
          password: "wrongpassword",
        }),
        redirect: "manual",
      }
    );

    // NextAuth redirects to error page on failure
    const location = response.headers.get("location");
    expect(location).toContain("error");
  });

  it("rejects non-existent email", async () => {
    const response = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "securepassword123",
        }),
        redirect: "manual",
      }
    );

    const location = response.headers.get("location");
    expect(location).toContain("error");
  });
});

describe("Middleware: protected routes", () => {
  it("redirects unauthenticated users to /login", async () => {
    const response = await fetch(`${BASE_URL}/pages`, {
      redirect: "manual",
    });

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
  });

  it("allows access to /login without authentication", async () => {
    const response = await fetch(`${BASE_URL}/login`);
    expect(response.status).toBe(200);
  });

  it("allows access to /register without authentication", async () => {
    const response = await fetch(`${BASE_URL}/register`);
    expect(response.status).toBe(200);
  });

  it("allows access to /api/auth endpoints without authentication", async () => {
    const response = await fetch(`${BASE_URL}/api/auth/providers`);
    expect(response.status).toBe(200);
  });
});
