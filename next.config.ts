import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/securityHeaders";

const nextConfig: NextConfig = {
  output: "standalone",

  devIndicators: false,

  // a71-10: transparently route `/shared/{token}?format=text|json` to the
  // plain-text/JSON export Route Handler at `/shared/[token]/export`,
  // without changing the public URL. A `route.ts` cannot live alongside
  // `page.tsx` in the same segment, so the export handler is a sibling
  // segment and this rewrite makes the two look like one route to callers.
  // Any other (or missing) `format` value doesn't match and falls through
  // to the existing HTML page, unchanged.
  async rewrites() {
    return [
      {
        source: "/shared/:token",
        has: [
          {
            type: "query",
            key: "format",
            value: "(?<format>text|json)",
          },
        ],
        destination: "/shared/:token/export?format=:format",
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/agent/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        ],
      },
      {
        source: "/api/health",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
