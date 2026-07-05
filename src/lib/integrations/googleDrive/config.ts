/**
 * Config gating for the Google Drive connector (a71-12).
 *
 * The whole feature is OPTIONAL: when the four required env vars are absent,
 * the connector is cleanly absent (routes return a "not configured" response,
 * nothing crashes, nothing is scheduled at boot). This module is intentionally
 * NOT imported from the root layout/`src/lib/env.ts` boot chain — doing so
 * would force every SKB deployment to configure Google Drive just to start.
 * It is only evaluated lazily, when a Drive route/lib is actually invoked.
 *
 * Fail-fast semantics (mirrors `src/lib/env.ts`'s existing pattern, scoped to
 * this optional feature rather than the whole app):
 *   - None of the 4 vars set            -> feature absent, no warning, no throw.
 *   - Some but not all set (partial)     -> misconfiguration: throw in
 *                                           production, warn in development.
 *   - All 4 set but `DRIVE_TOKEN_ENC_KEY` is not a valid 32-byte key -> throw
 *     in every environment (a broken encryption key is never "just missing",
 *     it is broken config that must not silently proceed).
 */

export interface GoogleDriveEnvConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncKey: string;
}

const REQUIRED_VARS = [
  "GOOGLE_DRIVE_CLIENT_ID",
  "GOOGLE_DRIVE_CLIENT_SECRET",
  "GOOGLE_DRIVE_REDIRECT_URI",
  "DRIVE_TOKEN_ENC_KEY",
] as const;

const PLACEHOLDER_VALUES = new Set([
  "",
  "changeme",
  "change_me",
  "todo",
  "xxx",
  "placeholder",
]);

function isMissingOrPlaceholder(value: string | undefined): boolean {
  if (value === undefined) return true;
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

/** Decode `DRIVE_TOKEN_ENC_KEY` (hex or base64) and validate it is 32 bytes. */
export function decodeTokenEncKey(raw: string): Buffer {
  const trimmed = raw.trim();
  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    buf = Buffer.from(trimmed, "hex");
  } else {
    buf = Buffer.from(trimmed, "base64");
  }
  if (buf.length !== 32) {
    throw new Error(
      "DRIVE_TOKEN_ENC_KEY must decode to exactly 32 bytes (AES-256) — " +
        "provide 64 hex characters or 32-byte base64."
    );
  }
  return buf;
}

/**
 * Read the raw env state without throwing. Used by `isDriveConfigured` and by
 * the startup check below.
 */
function readRawConfig(): Record<(typeof REQUIRED_VARS)[number], string | undefined> {
  return {
    GOOGLE_DRIVE_CLIENT_ID: process.env.GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_CLIENT_SECRET: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    GOOGLE_DRIVE_REDIRECT_URI: process.env.GOOGLE_DRIVE_REDIRECT_URI,
    DRIVE_TOKEN_ENC_KEY: process.env.DRIVE_TOKEN_ENC_KEY,
  };
}

/**
 * True iff every required Drive env var is present and not a placeholder.
 * Callers (routes, UI) use this to decide whether to expose the feature at
 * all — this is the single source of truth for "is Drive configured".
 */
export function isDriveConfigured(): boolean {
  const raw = readRawConfig();
  return REQUIRED_VARS.every((key) => !isMissingOrPlaceholder(raw[key]));
}

/**
 * Validate env state at the moment the connector is first touched.
 *
 *   - Fully unset: returns null (feature absent) — never throws, never warns.
 *   - Partially set: throws in production, warns (returns null) in development/test.
 *   - Fully set: validates the enc key length; throws (in ANY environment) if invalid.
 *
 * Returns the resolved config when fully & validly configured, otherwise null.
 */
export function loadGoogleDriveConfig(): GoogleDriveEnvConfig | null {
  const raw = readRawConfig();
  const setCount = REQUIRED_VARS.filter((key) => !isMissingOrPlaceholder(raw[key])).length;

  if (setCount === 0) {
    return null; // feature simply not turned on — silent, by design
  }

  if (setCount < REQUIRED_VARS.length) {
    const missing = REQUIRED_VARS.filter((key) => isMissingOrPlaceholder(raw[key]));
    const message =
      `Google Drive connector is partially configured — missing: ${missing.join(", ")}. ` +
      `Set all of ${REQUIRED_VARS.join(", ")} to enable it, or none to leave it disabled.`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
    console.warn(`[googleDrive] WARNING: ${message}`);
    return null;
  }

  // Fully set — validate the encryption key length regardless of environment;
  // a broken key is a hard config error, not an "optional feature off" case.
  decodeTokenEncKey(raw.DRIVE_TOKEN_ENC_KEY as string);

  return {
    clientId: raw.GOOGLE_DRIVE_CLIENT_ID as string,
    clientSecret: raw.GOOGLE_DRIVE_CLIENT_SECRET as string,
    redirectUri: raw.GOOGLE_DRIVE_REDIRECT_URI as string,
    tokenEncKey: raw.DRIVE_TOKEN_ENC_KEY as string,
  };
}
