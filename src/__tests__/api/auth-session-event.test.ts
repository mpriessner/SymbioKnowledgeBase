import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// SKB-02: login/logout events didn't exist anywhere. Login and logout happen
// entirely client-side against Supabase, so this thin server route lets the
// client trigger a `logAuthEvent` write, with the server independently
// resolving the caller from the session cookie (not trusting a client-supplied
// identity).

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a) },
  })),
}));

const mockLogAuthEvent = vi.fn(async (..._a: unknown[]) => {});
vi.mock("@/lib/agent/audit", () => ({
  logAuthEvent: (...a: unknown[]) => mockLogAuthEvent(...a),
  clientIpFromHeaders: () => undefined,
}));

const { POST } = await import("@/app/api/auth/session-event/route");

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/session-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54341";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-not-placeholder";
});

describe("POST /api/auth/session-event (SKB-02)", () => {
  test("a login event with a valid session logs auth.login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(postReq({ event: "login" }));

    expect(res.status).toBe(200);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.login",
      "auth/session",
      { userId: "user-1" },
      expect.any(Object)
    );
  });

  test("a logout event with a valid session logs auth.logout", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(postReq({ event: "logout" }));

    expect(res.status).toBe(200);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      "auth.logout",
      "auth/session",
      { userId: "user-1" },
      expect.any(Object)
    );
  });

  test("no resolvable session does not log any event", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postReq({ event: "login" }));

    expect(res.status).toBe(200);
    expect(mockLogAuthEvent).not.toHaveBeenCalled();
  });

  test("an invalid event value is rejected with 400", async () => {
    const res = await POST(postReq({ event: "bogus" }));

    expect(res.status).toBe(400);
    expect(mockLogAuthEvent).not.toHaveBeenCalled();
  });
});
