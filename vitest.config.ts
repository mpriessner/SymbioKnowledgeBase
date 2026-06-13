import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    // Activate the gated dev/local auth fallback under test (audit-01 MUST-FIX 2):
    // without ALLOW_DEV_AUTH=1, missing-Supabase-config no longer synthesizes a
    // dev ADMIN, which the cookie-auth tests depend on. NODE_ENV stays "test"
    // (not "production"), so isDevAuthAllowed() returns true here.
    env: {
      ALLOW_DEV_AUTH: "1",
    },
    include: [
      "src/__tests__/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
