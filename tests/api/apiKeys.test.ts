import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

describe("API Key Management", () => {
  let sessionCookie: string;
  let userId: string;
  let tenantId: string;
  let createdKeyId: string;
  let createdRawKey: string;

  beforeAll(async () => {
    // Create test user
    const passwordHash = await bcrypt.hash("testpassword123", 10);
    const tenant = await prisma.tenant.create({
      data: { name: "API Key Test Tenant" },
    });
    tenantId = tenant.id;

    const user = await prisma.user.create({
      data: {
        name: "API Key Test User",
        email: "test-apikey@example.com",
        passwordHash,
        role: "USER",
        tenantId: tenant.id,
      },
    });
    userId = user.id;

    // Login to get session
    const loginResponse = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-apikey@example.com",
          password: "testpassword123",
        }),
        redirect: "manual",
      }
    );
    sessionCookie =
      loginResponse.headers.get("set-cookie")?.split(";")[0] || "";
  });

  afterAll(async () => {
    await prisma.apiKey.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it("creates a new API key and returns the raw key once", async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ name: "Test Agent Key" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.data.id).toBeDefined();
    expect(body.data.name).toBe("Test Agent Key");
    expect(body.data.key).toMatch(/^skb_live_[a-f0-9]{64}$/);
    expect(body.data.keyPrefix).toBeDefined();
    expect(body.data.createdAt).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();

    createdKeyId = body.data.id;
    createdRawKey = body.data.key;
  });

  it("lists API keys without showing full key", async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      headers: { Cookie: sessionCookie },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data.length).toBeGreaterThan(0);
    const key = body.data.find(
      (k: { id: string }) => k.id === createdKeyId
    );
    expect(key).toBeDefined();
    expect(key.name).toBe("Test Agent Key");
    expect(key.keyPrefix).toBeDefined();
    expect(key.isRevoked).toBe(false);

    // Full key must NOT be present in list response
    expect(key.key).toBeUndefined();
    expect(key.keyHash).toBeUndefined();
  });

  it("authenticates with the created API key", async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      headers: {
        Authorization: `Bearer ${createdRawKey}`,
      },
    });

    expect(response.status).toBe(200);
  });

  it("returns 400 for missing key name", async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ name: "" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("revokes an API key", async () => {
    const response = await fetch(
      `${BASE_URL}/api/keys/${createdKeyId}`,
      {
        method: "DELETE",
        headers: { Cookie: sessionCookie },
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.revokedAt).toBeDefined();
  });

  it("returns 401 when using a revoked API key", async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      headers: {
        Authorization: `Bearer ${createdRawKey}`,
      },
    });

    expect(response.status).toBe(401);
  });

  it("returns 409 when revoking an already-revoked key", async () => {
    const response = await fetch(
      `${BASE_URL}/api/keys/${createdKeyId}`,
      {
        method: "DELETE",
        headers: { Cookie: sessionCookie },
      }
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 404 when revoking a non-existent key", async () => {
    const response = await fetch(
      `${BASE_URL}/api/keys/00000000-0000-0000-0000-000000000000`,
      {
        method: "DELETE",
        headers: { Cookie: sessionCookie },
      }
    );

    expect(response.status).toBe(404);
  });

  it("returns 401 for unauthenticated key listing", async () => {
    const response = await fetch(`${BASE_URL}/api/keys`);
    expect(response.status).toBe(401);
  });
});

describe("API Key Tenant Isolation", () => {
  let userASessionCookie: string;
  let userBSessionCookie: string;
  let tenantAId: string;
  let tenantBId: string;
  let keyAId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("testpassword123", 10);

    const tenantA = await prisma.tenant.create({
      data: { name: "Key Isolation A" },
    });
    tenantAId = tenantA.id;

    await prisma.user.create({
      data: {
        name: "Key User A",
        email: "test-keyiso-a@example.com",
        passwordHash,
        role: "USER",
        tenantId: tenantA.id,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: { name: "Key Isolation B" },
    });
    tenantBId = tenantB.id;

    await prisma.user.create({
      data: {
        name: "Key User B",
        email: "test-keyiso-b@example.com",
        passwordHash,
        role: "USER",
        tenantId: tenantB.id,
      },
    });

    // Login both users
    const loginA = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-keyiso-a@example.com",
          password: "testpassword123",
        }),
        redirect: "manual",
      }
    );
    userASessionCookie =
      loginA.headers.get("set-cookie")?.split(";")[0] || "";

    const loginB = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-keyiso-b@example.com",
          password: "testpassword123",
        }),
        redirect: "manual",
      }
    );
    userBSessionCookie =
      loginB.headers.get("set-cookie")?.split(";")[0] || "";

    // Create a key as User A
    const createResponse = await fetch(`${BASE_URL}/api/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userASessionCookie,
      },
      body: JSON.stringify({ name: "User A Agent" }),
    });
    const createBody = await createResponse.json();
    keyAId = createBody.data.id;
  });

  afterAll(async () => {
    await prisma.apiKey.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: "test-keyiso-" } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } },
    });
  });

  it("user B cannot see user A API keys", async () => {
    const response = await fetch(`${BASE_URL}/api/keys`, {
      headers: { Cookie: userBSessionCookie },
    });

    const body = await response.json();
    const keyIds = body.data.map((k: { id: string }) => k.id);
    expect(keyIds).not.toContain(keyAId);
  });

  it("user B cannot revoke user A API key", async () => {
    const response = await fetch(`${BASE_URL}/api/keys/${keyAId}`, {
      method: "DELETE",
      headers: { Cookie: userBSessionCookie },
    });

    expect(response.status).toBe(404);
  });
});
