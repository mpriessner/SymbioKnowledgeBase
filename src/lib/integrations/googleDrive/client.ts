/**
 * Google Drive REST client — SEARCH / RETRIEVE / UPLOAD ONLY.
 *
 * ============================================================================
 * OWNER CONSTRAINT (locked decision, a71-12 — restated here on purpose so any
 * future editor sees it before touching this file):
 *
 *   This client must NEVER call a Drive API method capable of deleting,
 *   trashing, or overwriting a pre-existing file. There is no "disable
 *   delete" toggle — the enforcement IS that no such call is written here.
 *   Do not add a generic `driveRequest(method, path)` escape hatch that lets
 *   a caller pass an arbitrary HTTP method/path; every exported function
 *   below hits exactly one fixed, read/search/create endpoint.
 *
 *   Allowed: OAuth token exchange/refresh/revoke, `files.list` (search),
 *   `files.get` (metadata + `alt=media` download), `files.create` (new file
 *   only — never targets an existing file id).
 *   Forbidden, and never to be added: `files.delete`, `files.update` (which
 *   overwrites/patches an existing file), `files.emptyTrash`, `files.copy`
 *   onto an existing id, or any `DELETE`/`PATCH`/`PUT` HTTP verb against
 *   `/drive/v3/files/{id}`.
 * ============================================================================
 *
 * No `googleapis` SDK dependency — SKB's node_modules is a read-only symlink
 * into the host checkout and does not have it installed, so this talks to
 * the Drive v3 / OAuth2 REST endpoints directly via the built-in `fetch`.
 *
 * This module is server-only. It must never be imported from a client
 * component or bundled into client JS (it handles the client secret and
 * access tokens).
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

// Exactly the two scopes the owner approved. Never widen this list.
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
] as const;

const REQUEST_TIMEOUT_MS = 10_000;

export class DriveRateLimitError extends Error {
  constructor(message = "Google Drive rate limit reached — try again later") {
    super(message);
    this.name = "DriveRateLimitError";
  }
}

export class DriveApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "DriveApiError";
    this.status = status;
  }
}

export class DriveAuthError extends Error {
  constructor(message = "Google Drive authorization is invalid or expired") {
    super(message);
    this.name = "DriveAuthError";
  }
}

interface DriveClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildAuthUrl(options: DriveClientOptions, state: string): string {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_SCOPES.join(" "),
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

/** Internal fetch helper — bounded timeout + uniform 429/error handling. All
 * callers below pass a fixed, hardcoded URL/method; no caller-supplied method
 * or path ever reaches this. */
async function driveFetch(
  url: string,
  init: RequestInit
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    throw new DriveApiError(`Google Drive request failed: ${message}`, 0);
  }

  if (res.status === 429) {
    throw new DriveRateLimitError();
  }
  if (res.status === 401 || res.status === 403) {
    // Not always auth-invalid (403 can be a scope/quota issue), but for our
    // narrow scope set 401/403 almost always means "reconnect needed".
    throw new DriveAuthError();
  }
  return res;
}

/** Exchange an OAuth authorization code for tokens (connect flow). */
export async function exchangeCodeForTokens(
  options: DriveClientOptions,
  code: string
): Promise<TokenResponse> {
  const res = await driveFetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
      code,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    throw new DriveApiError(
      `Token exchange failed with status ${res.status}`,
      res.status
    );
  }
  return (await res.json()) as TokenResponse;
}

/** Refresh an access token using the stored refresh token. */
export async function refreshAccessToken(
  options: DriveClientOptions,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await driveFetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) {
    throw new DriveAuthError();
  }
  const data = (await res.json()) as TokenResponse;
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/** Revoke a token (refresh or access) with Google. Best-effort — the caller
 * deletes the stored row regardless of whether Google confirms revocation. */
export async function revokeToken(token: string): Promise<void> {
  await driveFetch(REVOKE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
  });
}

export interface DriveSearchResult {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}

/**
 * Search the user's Drive (read-only `files.list`). `query` is passed through
 * to Drive's `q` search syntax after a light escape of embedded quotes.
 */
export async function searchFiles(
  accessToken: string,
  query: string,
  pageSize = 25
): Promise<DriveSearchResult[]> {
  const escaped = query.replace(/'/g, "\\'").replace(/"/g, '\\"');
  const q = `name contains '${escaped}' and trashed = false`;
  const params = new URLSearchParams({
    q,
    pageSize: String(Math.min(Math.max(pageSize, 1), 100)),
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    spaces: "drive",
  });

  const res = await driveFetch(`${DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new DriveApiError(`Drive search failed with status ${res.status}`, res.status);
  }
  const data = (await res.json()) as { files?: DriveSearchResult[] };
  return data.files ?? [];
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  size?: string;
}

/** Fetch metadata for a single file (read-only). */
export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFileMetadata> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,modifiedTime,webViewLink,size",
  });
  const res = await driveFetch(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?${params.toString()}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new DriveApiError(
      `Drive metadata fetch failed with status ${res.status}`,
      res.status
    );
  }
  return (await res.json()) as DriveFileMetadata;
}

/** Download a file's bytes via `alt=media` (read-only). */
export async function downloadFile(
  accessToken: string,
  fileId: string
): Promise<Buffer> {
  const res = await driveFetch(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new DriveApiError(
      `Drive file download failed with status ${res.status}`,
      res.status
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Create a brand-new file in the user's Drive (Phase 2 — `files.create`
 * only). This can never overwrite or update an existing file: there is no
 * file id in the request, so Drive always allocates a new file.
 */
export async function createFile(
  accessToken: string,
  name: string,
  mimeType: string,
  bytes: Buffer
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const boundary = `skb-drive-upload-${Date.now()}`;
  const metadata = JSON.stringify({ name });

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await driveFetch(
    `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    throw new DriveApiError(`Drive upload failed with status ${res.status}`, res.status);
  }
  return (await res.json()) as { id: string; name: string; webViewLink?: string };
}
