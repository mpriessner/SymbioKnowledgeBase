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

  // Ensure user exists in Supabase (idempotent - signup returns existing user or creates new)
  // Try multiple Supabase ports (54351 for SKB, 54321 for default)
  const supabasePorts = [54351, 54321];
  const anonKeys = [
    "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  ];

  for (let i = 0; i < supabasePorts.length; i++) {
    try {
      const resp = await fetch(
        `http://127.0.0.1:${supabasePorts[i]}/auth/v1/signup`,
        {
          method: "POST",
          headers: {
            apikey: anonKeys[i],
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
        }
      );
      if (resp.ok) {
        console.log(`[global-setup] Ensured user on Supabase port ${supabasePorts[i]}`);
      }
    } catch {
      // Port not available, try next
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
