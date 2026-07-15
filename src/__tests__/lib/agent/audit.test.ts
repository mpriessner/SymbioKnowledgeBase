import { describe, test, expect, vi, beforeEach } from "vitest";

const mockAuditCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
  },
}));

const { logAgentAction, logAuthEvent, clientIpFromHeaders } = await import(
  "@/lib/agent/audit"
);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuditCreate.mockResolvedValue({});
});

describe("logAgentAction — persists to AuditLog (audit S15)", () => {
  test("writes a row with the principal", async () => {
    await logAgentAction(
      { tenantId: "t", userId: "u", apiKeyId: "k", scopes: ["write"] },
      "page.create",
      "POST /api/agent/pages",
      "page-1"
    );
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const data = mockAuditCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: "t",
      userId: "u",
      apiKeyId: "k",
      action: "page.create",
      resource: "POST /api/agent/pages",
      resourceId: "page-1",
    });
  });

  test("redacts sensitive fields in details", async () => {
    await logAgentAction(
      { tenantId: "t", userId: "u", scopes: ["write"] },
      "x",
      "r",
      undefined,
      { token: "super-secret", safe: "ok" }
    );
    const data = mockAuditCreate.mock.calls[0][0].data;
    expect(data.details).toMatchObject({ token: "[REDACTED]", safe: "ok" });
  });

  test("a failed persist does NOT throw (swallowed)", async () => {
    mockAuditCreate.mockRejectedValue(new Error("db down"));
    await expect(
      logAgentAction({ tenantId: "t", userId: "u", scopes: [] }, "x", "r")
    ).resolves.toBeUndefined();
  });
});

describe("logAuthEvent — anonymous rejection persists with NULL principal (audit S15)", () => {
  test("anonymous reject writes a row with null userId/tenantId (no sentinel)", async () => {
    await logAuthEvent("auth.reject", "GET /api/agent/pages", {}, { reason: "bad" });
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const data = mockAuditCreate.mock.calls[0][0].data;
    expect(data.userId).toBeNull();
    expect(data.tenantId).toBeNull();
    expect(data.action).toBe("auth.reject");
  });

  test("known-principal success carries the principal", async () => {
    await logAuthEvent("auth.success", "GET /api/agent/pages", {
      tenantId: "t",
      userId: "u",
      apiKeyId: "k",
    });
    const data = mockAuditCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({ tenantId: "t", userId: "u", apiKeyId: "k" });
  });
});

describe("clientIpFromHeaders", () => {
  test("uses the left-most x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIpFromHeaders(h)).toBe("1.2.3.4");
  });
  test("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
  });
  test("undefined when no forwarding headers", () => {
    expect(clientIpFromHeaders(new Headers())).toBeUndefined();
  });
});
