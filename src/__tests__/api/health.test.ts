import { describe, it, expect } from "vitest";

// /api/health is a pure LIVENESS probe: it does not touch the database, so no
// Prisma mock is needed here. Dependency checks live in /api/ready (ready.test.ts).
import { GET } from "@/app/api/health/route";

describe("GET /api/health (liveness)", () => {
  it("should return 200 with status ok (no DB dependency)", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
    expect(typeof body.uptime).toBe("number");
    expect(body.timestamp).toBeDefined();
  });

  it("should NOT include database checks (liveness is dependency-free)", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.checks).toBeUndefined();
  });

  it("should include Cache-Control no-store header", async () => {
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate",
    );
  });

  it("should report uptime as a non-negative number", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
