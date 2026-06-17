import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/securityHeaders";

const nextConfig: NextConfig = {
  output: "standalone",

  devIndicators: false,

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
