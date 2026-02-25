/**
 * Shared test utilities for agent API E2E tests.
 *
 * When running with a live database, these helpers create real test tenants
 * and API keys. When running without a database, tests that require DB
 * access should be skipped.
 */

/**
 * Check if a database is available for integration tests.
 */
export function isDatabaseAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Build a full URL for agent API requests.
 */
export function agentUrl(path: string): string {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/api/agent${path}`;
}

/**
 * Make an agent API request with authentication.
 */
export async function agentRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(agentUrl(path), options);
}

/**
 * Assert a successful response and extract data.
 */
export async function expectSuccess(
  res: Response,
  expectedStatus = 200
): Promise<Record<string, unknown>> {
  expect(res.status).toBe(expectedStatus);
  const json = (await res.json()) as Record<string, unknown>;
  expect(json).toHaveProperty("data");
  return json.data as Record<string, unknown>;
}

/**
 * Assert an error response.
 */
export async function expectError(
  res: Response,
  expectedStatus: number,
  expectedCode: string
): Promise<void> {
  expect(res.status).toBe(expectedStatus);
  const json = (await res.json()) as Record<string, unknown>;
  expect(json).toHaveProperty("error");
  const error = json.error as Record<string, unknown>;
  expect(error.code).toBe(expectedCode);
}
