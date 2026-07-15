import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import path from "path";
import fs from "fs";

const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
const TEST_EMAIL = "admin@symbio.local";
const TEST_PASSWORD = "changeme";

/**
 * Factory auth path (PW_FACTORY): the ExpTube Supabase this app authenticates
 * against is Google-only — email/password login is DISABLED, so the browser
 * login form below cannot work headlessly. Instead mint a session via the
 * admin magic-link path (generateLink -> verifyOtp, which the service role is
 * allowed to do even with email login off) and let @supabase/ssr produce the
 * exact session cookies, which we inject into storageState. This authenticates
 * the "authenticated" Playwright project without touching the Supabase posture.
 * Returns true on success, false if it could not complete (caller then runs the
 * no-auth lane only).
 */
async function factorySessionSetup(baseURL: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    console.warn("[global-setup] factory: missing SUPABASE url/anon/service key — skipping session mint");
    return false;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Ensure the confirmed test user exists (idempotent).
  const { data: list } = await admin.auth.admin.listUsers();
  const exists = list?.users?.some(
    (u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase()
  );
  if (!exists) {
    await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  }

  // Admin magic-link -> OTP verify -> session tokens.
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: TEST_EMAIL });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    console.warn("[global-setup] factory: generateLink failed:", link.error?.message);
    return false;
  }
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await anon.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (verified.error || !verified.data.session) {
    console.warn("[global-setup] factory: verifyOtp failed:", verified.error?.message);
    return false;
  }
  const { access_token, refresh_token } = verified.data.session;

  // Let @supabase/ssr write the exact session cookie(s) it expects (correct
  // name/encoding/chunking for this supabase-js version) via a capturing adapter.
  const captured: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  const ssr = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (toSet) => toSet.forEach((c) => captured.push(c)),
    },
  });
  const setRes = await ssr.auth.setSession({ access_token, refresh_token });
  if (setRes.error) {
    console.warn("[global-setup] factory: setSession failed:", setRes.error.message);
    return false;
  }

  const host = new URL(baseURL).hostname;
  const sameSiteMap: Record<string, "Lax" | "Strict" | "None"> = {
    lax: "Lax", strict: "Strict", none: "None",
  };
  const now = Math.floor(Date.now() / 1000);
  const cookies = captured.map((c) => {
    const maxAge = Number(c.options?.maxAge) || 60 * 60 * 24 * 30;
    return {
      name: c.name,
      value: c.value,
      domain: host,
      path: (c.options?.path as string) || "/",
      httpOnly: Boolean(c.options?.httpOnly),
      secure: false,
      sameSite: sameSiteMap[String(c.options?.sameSite || "lax").toLowerCase()] || "Lax",
      expires: now + maxAge,
    };
  });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies(cookies);
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
  console.log(`[global-setup] factory: injected admin-minted session (${cookies.length} cookie) into storageState`);
  return true;
}

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || "http://localhost:3000";

  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Under the factory, use the admin magic-link session path (email login is
  // disabled on the Google-only Supabase). This is gated on PW_FACTORY so normal
  // dev runs are byte-identical.
  if (process.env.PW_FACTORY) {
    try {
      const ok = await factorySessionSetup(baseURL);
      if (!ok) {
        console.warn(
          "[global-setup] factory session setup did not complete — continuing without auth state (no-auth lane only)"
        );
      }
    } catch (err) {
      console.warn(
        "[global-setup] factory session setup threw — continuing without auth state:",
        (err as Error).message
      );
    }
    return;
  }

  // === Normal dev flow (unchanged): email/password signup + browser login ===
  // Ensure user exists in Supabase (idempotent - signup returns existing user or creates new).
  // Source the anon key + port from the environment. No production/demo JWT is hardcoded.
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
