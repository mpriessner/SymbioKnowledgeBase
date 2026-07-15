import { describe, expect, it } from "vitest";
import { getRequestOrigin } from "@/lib/requestOrigin";

function request(url: string, headers: Record<string, string> = {}) {
  return { url, headers: new Headers(headers) };
}

describe("getRequestOrigin", () => {
  it("preserves HTTP for a forwarded localhost request", () => {
    expect(
      getRequestOrigin(
        request("http://localhost:3000/api/pages/page-1/publish", {
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "http",
        })
      )
    ).toBe("http://localhost:3000");
  });

  it("uses HTTPS when the proxy explicitly forwards HTTPS", () => {
    expect(
      getRequestOrigin(
        request("http://127.0.0.1:3000/api/pages/page-1/publish", {
          "x-forwarded-host": "kb.example.com",
          "x-forwarded-proto": "https",
        })
      )
    ).toBe("https://kb.example.com");
  });

  it("falls back to the request URL protocol when no forwarded protocol exists", () => {
    expect(
      getRequestOrigin(
        request("http://localhost:3000/api/pages/page-1/publish", {
          "x-forwarded-host": "localhost:3000",
        })
      )
    ).toBe("http://localhost:3000");
  });

  it("uses the request origin when no forwarded host exists", () => {
    expect(
      getRequestOrigin(
        request("https://kb.example.com/api/pages/page-1/publish")
      )
    ).toBe("https://kb.example.com");
  });
});
