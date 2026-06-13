import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Prisma client — actual import is @/lib/db (not @/lib/prisma).
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { GET } from "@/app/api/ready/route";
import { prisma } from "@/lib/db";

describe("GET /api/ready (readiness)", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Supabase not configured so the check is skipped (no network).
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
  });

  it("returns 200 ready when the database is healthy and Supabase is unconfigured", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ready");
    expect(body.checks.database.status).toBe("ok");
    expect(typeof body.checks.database.latency_ms).toBe("number");
    expect(body.checks.supabase.status).toBe("skipped");
  });

  it("returns 503 not_ready when the database is down", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error("Connection refused"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("not_ready");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.database.error).toBe("Connection refused");
  });

  it("includes Cache-Control no-store header", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate",
    );
  });
});
