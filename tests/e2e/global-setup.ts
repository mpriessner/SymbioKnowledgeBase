import { chromium, type FullConfig } from "@playwright/test";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
const TEST_EMAIL = "admin@symbio.local";
const TEST_PASSWORD = "changeme";

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3000";

  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Ensure user exists in Supabase (idempotent - signup returns existing user or creates new).
  // Source the anon key + port from the environment. The default port 54341 is the LIVE
  // ExpTube Supabase the app actually authenticates against (NOT the dead local 54351 stack).
  // No production/demo JWT is hardcoded as a fallback — the anon key must come from env.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabasePort = process.env.TEST_SUPABASE_PORT || "54341";

  if (!anonKey) {
    console.warn(
      "[global-setup] NEXT_PUBLIC_SUPABASE_ANON_KEY not set — skipping Supabase user signup; login may fail if the user does not already exist."
    );
  } else {
    try {
      const resp = await fetch(`http://127.0.0.1:${supabasePort}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      });
      if (resp.ok) {
        console.log(`[global-setup] Ensured user on Supabase port ${supabasePort}`);
      }
    } catch {
      // Supabase not reachable at the configured port; login step below will surface it.
    }
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login page
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState("networkidle");

  // Fill login form
  await page.fill('input[placeholder="you@example.com"]', TEST_EMAIL);
  await page.fill('input[placeholder="Enter your password"]', TEST_PASSWORD);

  // Submit
  await page.click('button:has-text("Sign in")');

  // Wait for redirect to /home (successful login)
  await page.waitForURL("**/home**", { timeout: 15_000 });

  console.log("[global-setup] Login successful, saving auth state");

  // Save auth state
  await context.storageState({ path: AUTH_FILE });

  await browser.close();
}

export default globalSetup;
