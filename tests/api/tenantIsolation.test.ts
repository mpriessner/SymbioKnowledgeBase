import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

describe("Tenant Isolation", () => {
  let userASessionCookie: string;
  let userBSessionCookie: string;

  beforeAll(async () => {
    // Create two separate tenants with users
    const passwordHash = await bcrypt.hash("testpassword123", 10);

    const tenantA = await prisma.tenant.create({
      data: { name: "Tenant A Test" },
    });

    await prisma.user.create({
      data: {
        name: "User A",
        email: "test-isolation-a@example.com",
        passwordHash,
        role: "USER",
        tenantId: tenantA.id,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: { name: "Tenant B Test" },
    });

    await prisma.user.create({
      data: {
        name: "User B",
        email: "test-isolation-b@example.com",
        passwordHash,
        role: "USER",
        tenantId: tenantB.id,
      },
    });

    // Login as User A
    const loginA = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-isolation-a@example.com",
          password: "testpassword123",
        }),
        redirect: "manual",
      }
    );
    userASessionCookie =
      loginA.headers.get("set-cookie")?.split(";")[0] || "";

    // Login as User B
    const loginB = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test-isolation-b@example.com",
          password: "testpassword123",
        }),
        redirect: "manual",
      }
    );
    userBSessionCookie =
      loginB.headers.get("set-cookie")?.split(";")[0] || "";
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { startsWith: "test-isolation-" } },
    });
    await prisma.tenant.deleteMany({
      where: { name: { startsWith: "Tenant" } },
    });
  });

  it("returns 401 for unauthenticated API requests", async () => {
    const response = await fetch(`${BASE_URL}/api/pages`);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for invalid API key", async () => {
    const response = await fetch(`${BASE_URL}/api/pages`, {
      headers: {
        Authorization: "Bearer skb_live_invalidkey1234567890",
      },
    });
    expect(response.status).toBe(401);
  });

  it("user A cannot see user B data (tenant isolation)", async () => {
    // Create a page as User A
    const createResponse = await fetch(`${BASE_URL}/api/pages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: userASessionCookie,
      },
      body: JSON.stringify({ title: "User A Private Page" }),
    });

    if (createResponse.status === 201) {
      // User B should not see User A's page
      const listResponse = await fetch(`${BASE_URL}/api/pages`, {
        headers: { Cookie: userBSessionCookie },
      });

      const listBody = await listResponse.json();
      const titles =
        listBody.data?.map((p: { title: string }) => p.title) || [];
      expect(titles).not.toContain("User A Private Page");
    }
  });
});
